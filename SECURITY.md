# Security and Data Handling

Math CrossWord is a local-only web app. It has no backend, no accounts, no analytics and no network calls.

## What is stored, and where

- Everything lives in the browser's `localStorage` under the key `math-crossword-v1`:
  - player profiles (name, age, age tier, tour status)
  - each profile's saved game, statistics and score
  - settings
- Nothing is sent off the device. Clearing the site's data in the browser removes everything.
- A player can delete a profile in Settings → Logout / Clear Profile, or reset statistics in Settings → Reset Statistics.

## Protections in the app

- A Content Security Policy in `index.html` allows scripts and connections only from the app's own origin (`script-src 'self'`, `connect-src 'self'`). Inline styles are allowed for Tailwind; inline scripts and external resources are blocked.
- No third-party scripts, fonts, trackers or CDNs are loaded.
- All player-entered text (name) is rendered as text by React, never as HTML.
- No secrets, API keys or credentials exist in the code or configuration.

## Known limits

- Anyone with access to the device or browser profile can read or edit the stored data. This is inherent to local storage and is not a security boundary.
- The app is intended for use by one household on a shared or personal device. It is not designed to protect data from other users of that device.

## Reporting a problem

Report security issues to the project owner directly rather than in a public channel.
