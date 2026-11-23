#!/usr/bin/env python3
# managed-by: vscode-rlm-agent
"""Compact memory graph for agent requests and responses. Standard library only.

  add    --kind request|response [--text T | --stdin] [--reply-to ID] [--link PATH ...]
  recall QUERY [--limit N]        print the best-matching entries with neighbours and stale links (JSON)
  prune  [--keep N]               keep the newest N entries (default 500)
  stats                           print counts (JSON)

Every command accepts --store FILE (default .agent-memory/graph.json) and --root DIR (default .).
Requires rlm_corpus.py in the same folder (it is installed alongside this file).
"""

from __future__ import annotations

import argparse
import contextlib
import hashlib
import json
import math
import os
import re
import sys
import time
import uuid
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # rlm_corpus.py sits next to this file
import rlm_corpus  # noqa: E402

DEFAULT_STORE = ".agent-memory/graph.json"
LOCK_TIMEOUT = 5.0  # seconds to wait for another live writer before giving up
MAX_TEXT = 2000  # characters stored per entry
MAX_SYMBOLS = 100  # symbol names stored per entry
SNIPPET = 240  # characters returned per entry in recall
WORD = re.compile(r"[a-z0-9_][a-z0-9_./-]{2,}")
SYMBOL = re.compile(
    r"^\s*(?:export\s+|pub\s+)?(?:async\s+)?(?:def|class|function|func|fn|struct|interface|type|const|let|enum)\s+([A-Za-z_]\w*)",
    re.MULTILINE,
)
# Redaction is a backstop: known formats first, then random-looking tokens. Keep secrets out of the text.
SECRET_PATTERNS = [
    re.compile(r"(?i)(\b(?:api[_-]?key|secret|token|password|passwd)\s*[:=]\s*)\S+"),  # key = value
    re.compile(r"(?i)(\bbearer\s+)[A-Za-z0-9._~+/=-]{16,}"),  # Authorization: Bearer ...
    re.compile(r"(://[^/\s:@]+:)[^/\s@]+(@)"),  # user:password@host in URLs
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----", re.DOTALL),
    re.compile(r"\bsk-[A-Za-z0-9_-]{16,}"),  # OpenAI-style keys
    re.compile(r"\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b"),  # Stripe keys
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),  # AWS access key IDs
    re.compile(r"\bgh[pousr]_[A-Za-z0-9]{36,}\b"),  # GitHub tokens
    re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}\b"),  # Slack tokens
    re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b"),  # Google API keys
    re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b"),  # JWTs
]
RANDOM_TOKEN = re.compile(r"[A-Za-z0-9+/_=-]{24,}")
# Hex (for example commit SHAs) tops out at 4 bits per character, so it stays below this threshold.
RANDOM_BITS = 4.5


class StoreError(Exception):
    """A problem the user must fix. The store is never overwritten when this is raised."""


def entropy(token: str) -> float:
    counts = Counter(token)
    return -sum(n / len(token) * math.log2(n / len(token)) for n in counts.values())


def is_random(token: str) -> bool:
    return any(c.isdigit() for c in token) and any(c.isalpha() for c in token) and entropy(token) >= RANDOM_BITS


def redact(text: str) -> str:
    for pattern in SECRET_PATTERNS:
        text = pattern.sub(
            lambda m: (m.group(1) if m.lastindex else "")
            + "<redacted>"
            + (m.group(2) if m.lastindex and m.lastindex > 1 else ""),
            text,
        )
    return RANDOM_TOKEN.sub(lambda m: "<redacted>" if is_random(m.group(0)) else m.group(0), text)


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def file_hash(path: Path) -> str | None:
    """Content hash of a file, or None if it does not exist. Used to flag stale entries."""
    try:
        return hashlib.sha256(path.read_bytes()).hexdigest()
    except OSError:
        return None


def file_symbols(path: Path) -> list[str]:
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return []
    return sorted(set(SYMBOL.findall(text)))[:MAX_SYMBOLS]


def link_dependencies(root: Path, links: list[str]) -> dict[str, str | None]:
    """Hashes of the local files that the linked files import. A change there makes the entry stale."""
    found: set[str] = set()
    for link in links:
        found.update(rlm_corpus.local_dependencies(root, link))
    return {dep: file_hash(root / dep) for dep in sorted(found)}


def stale_items(node: dict, root: Path) -> list[dict]:
    items = []
    for link, stored in node.get("hashes", {}).items():
        current = file_hash(root / link)
        if current is None:
            items.append({"link": link, "status": "missing"})
        elif current != stored:
            items.append({"link": link, "status": "appeared" if stored is None else "changed"})
    for dep, stored in node.get("dependencies", {}).items():
        current = file_hash(root / dep)
        if current is None:
            items.append({"link": dep, "status": "missing", "kind": "dependency"})
        elif current != stored:
            items.append({"link": dep, "status": "changed", "kind": "dependency"})
    return items


def lock_is_stale(lock: Path) -> bool:
    """True when the process that wrote the lock no longer exists. Unknown or unreadable locks are kept."""
    try:
        pid = int(lock.read_text(encoding="utf-8").strip() or 0)
    except (OSError, ValueError):
        return False
    if pid <= 0:
        return False
    try:
        os.kill(pid, 0)  # signal 0 only checks that the process exists
    except ProcessLookupError:
        return True
    except PermissionError:
        return False  # the process exists but belongs to someone else
    return False


@contextlib.contextmanager
def locked(store: Path):
    """Exclusive lock for read-modify-write, so two agents writing at once do not drop each other's entries."""
    lock = store.with_suffix(".lock")
    store.parent.mkdir(parents=True, exist_ok=True)
    deadline = time.monotonic() + LOCK_TIMEOUT
    while True:
        try:
            fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            break
        except FileExistsError:
            if lock_is_stale(lock):
                with contextlib.suppress(FileNotFoundError):
                    lock.unlink()  # left behind by a process that exited without releasing it
                continue
            if time.monotonic() > deadline:
                raise StoreError(f"{lock} is held by another process. If no other agent is running, delete it and retry.")
            time.sleep(0.05)
    try:
        os.write(fd, str(os.getpid()).encode())
        yield
    finally:
        os.close(fd)
        with contextlib.suppress(FileNotFoundError):
            lock.unlink()


def load(path: Path) -> dict:
    if not path.exists():
        return {"nodes": {}, "edges": []}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise StoreError(f"{path} is not valid JSON ({exc}). Fix or move it; memory was not overwritten.") from exc
    if not isinstance(data, dict) or not isinstance(data.get("nodes"), dict) or not isinstance(data.get("edges"), list):
        raise StoreError(f"{path} has an unexpected structure; memory was not overwritten.")
    return data


def save(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=1), encoding="utf-8")
    os.replace(tmp, path)  # atomic: a crash leaves the old file intact


def cmd_add(args: argparse.Namespace) -> int:
    text = sys.stdin.read() if args.stdin else (args.text or "")
    text = redact(text.strip())[:MAX_TEXT]
    if not text:
        raise StoreError("nothing to store: pass --text or --stdin")
    path = Path(args.store)
    links = args.link or []
    root = Path(args.root)
    node_id = uuid.uuid4().hex[:12]
    symbols = sorted({s for link in links for s in file_symbols(root / link)})[:MAX_SYMBOLS]
    dependencies = link_dependencies(root, links)  # read outside the lock: it reads the project
    with locked(path):
        data = load(path)
        if args.reply_to and args.reply_to not in data["nodes"]:
            raise StoreError(f"unknown --reply-to id {args.reply_to}")
        data["nodes"][node_id] = {
            "kind": args.kind,
            "text": text,
            "links": links,
            "hashes": {link: file_hash(root / link) for link in links},  # to flag stale entries on recall
            "dependencies": dependencies,  # to flag entries whose imports changed
            "symbols": symbols,
            "created": now(),
        }
        if args.reply_to:
            data["edges"].append({"from": node_id, "to": args.reply_to, "rel": "reply"})
        save(path, data)
    print(json.dumps({"id": node_id, "entries": len(data["nodes"])}))
    return 0


def score(query_words: set[str], node: dict) -> int:
    words = set(WORD.findall(node["text"].lower()))
    overlap = len(query_words & words)
    link_hits = sum(1 for q in query_words for link in node["links"] if q in link.lower())
    symbol_hits = sum(1 for q in query_words for s in node.get("symbols", []) if q == s.lower())
    return overlap + 2 * link_hits + 2 * symbol_hits  # file paths and symbol names count double


def cmd_recall(args: argparse.Namespace) -> int:
    data = load(Path(args.store))
    root = Path(args.root)
    query_words = set(WORD.findall(args.query.lower()))
    ranked = []
    for rank, (node_id, node) in enumerate(data["nodes"].items()):  # dict order: oldest first
        value = score(query_words, node) if query_words else 0
        if value > 0:
            ranked.append((value, rank, node_id))
    ranked.sort(reverse=True)  # best score first; among equal scores, newer first

    results = []
    for value, _, node_id in ranked[: args.limit]:
        node = data["nodes"][node_id]
        neighbours = []
        for edge in data["edges"]:
            if edge["from"] == node_id:
                other = edge["to"]
            elif edge["to"] == node_id:
                other = edge["from"]
            else:
                continue
            if other in data["nodes"]:
                neighbour = data["nodes"][other]
                neighbours.append({"id": other, "kind": neighbour["kind"], "rel": edge["rel"],
                                   "text": neighbour["text"][:SNIPPET]})
        results.append({"id": node_id, "score": value, "kind": node["kind"], "created": node["created"],
                        "links": node["links"], "stale": stale_items(node, root), "text": node["text"][:SNIPPET],
                        "neighbours": neighbours})
    print(json.dumps({"results": results}, indent=2))
    return 0


def cmd_prune(args: argparse.Namespace) -> int:
    path = Path(args.store)
    with locked(path):
        data = load(path)
        ids = list(data["nodes"])  # oldest first
        if len(ids) > args.keep:
            drop = set(ids[: len(ids) - args.keep])
            for node_id in drop:
                del data["nodes"][node_id]
            data["edges"] = [e for e in data["edges"] if e["from"] not in drop and e["to"] not in drop]
            save(path, data)
    print(json.dumps({"entries": len(data["nodes"]), "edges": len(data["edges"])}))
    return 0


def cmd_stats(args: argparse.Namespace) -> int:
    data = load(Path(args.store))
    kinds: dict[str, int] = {}
    for node in data["nodes"].values():
        kinds[node["kind"]] = kinds.get(node["kind"], 0) + 1
    print(json.dumps({"entries": len(data["nodes"]), "by_kind": kinds, "edges": len(data["edges"])}, indent=2))
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Agent memory graph.")
    sub = parser.add_subparsers(dest="command", required=True)

    def common(p: argparse.ArgumentParser) -> None:
        p.add_argument("--store", default=DEFAULT_STORE, help="memory file (default %(default)s)")
        p.add_argument("--root", default=".", help="project root that linked paths are relative to")

    p = sub.add_parser("add", help="store a request or response")
    common(p)
    p.add_argument("--kind", required=True, choices=["request", "response"])
    p.add_argument("--text")
    p.add_argument("--stdin", action="store_true", help="read the text from standard input")
    p.add_argument("--reply-to", help="id of the request this response answers")
    p.add_argument("--link", action="append", help="repository path this entry concerns (repeatable)")
    p.set_defaults(func=cmd_add)

    p = sub.add_parser("recall", help="find related entries")
    common(p)
    p.add_argument("query")
    p.add_argument("--limit", type=int, default=5)
    p.set_defaults(func=cmd_recall)

    p = sub.add_parser("prune", help="keep only the newest entries")
    common(p)
    p.add_argument("--keep", type=lambda v: max(1, int(v)), default=500)
    p.set_defaults(func=cmd_prune)

    p = sub.add_parser("stats", help="print counts")
    common(p)
    p.set_defaults(func=cmd_stats)

    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except StoreError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    except OSError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
