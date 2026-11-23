import { useAppStore, type GameState, type ProfileData } from '../store/useAppStore';

/** The active profile's game, or null when none is in progress. */
export function getGame(): GameState | null {
  const s = useAppStore.getState();
  return (s.currentProfileKey && s.profiles[s.currentProfileKey]?.game) || null;
}

export function useGame(): GameState | null {
  return useAppStore((s) => (s.currentProfileKey ? s.profiles[s.currentProfileKey]?.game : null) ?? null);
}

export function useProfile(): ProfileData | undefined {
  return useAppStore((s) => (s.currentProfileKey ? s.profiles[s.currentProfileKey] : undefined));
}

export type { GameState };
