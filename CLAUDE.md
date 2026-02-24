# Snowify — Claude Code Instructions

## Project overview
Electron 33 + Preact 10.28 + electron-vite 5 desktop music player streaming from free sources (yt-dlp).
Version: 1.4.8 | Repo: github.com/Flalal/Snowify

## Tech stack
- **Runtime:** Electron 33, Preact 10.28, @preact/signals 2.8
- **Build:** electron-vite 5, electron-builder 26.7, @preact/preset-vite
- **Services:** ytmusic-api 5.3.1, @stef-0012/synclyrics 2.5.10, @xhayper/discord-rpc 1.3, electron-updater 6.8
- **No:** React, jQuery, lodash, TypeScript, CSS-in-JS, test framework, linter

## Architecture

### Process separation
```
src/main/          → Electron main process (Node.js)
src/preload/       → Context bridge (CommonJS, 70+ methods on window.snowify)
src/renderer/      → Preact UI (ES modules)
src/shared/        → Constants + field mapping (shared between main/renderer)
```

### Main process (`src/main/`)
- `index.js` — entry point, window creation, IPC registration
- `services/` — ytmusic.js, stream.js (yt-dlp + cache 4h/200 max), lyrics.js (LRU), discord.js (lazy), sync.js, api.js (token refresh), updater.js
- `ipc/` — 10 handler modules: auth, discord, explore (heaviest: 283 lines), lyrics, playlist, search, shell, spotify, stream, updater
- `utils/parse.js` — track mapping, artist extraction
- Handler pattern: `register(ipcMain, { getMainWindow, getYtMusic, stream, lyrics })`

### Renderer (`src/renderer/`)
- `state/index.js` — all state as Preact signals, persisted to localStorage (debounced)
- `hooks/` — 15 custom hooks (usePlayback, useQueueControls, useTrackPlayer, useNavigation, useKeyboardShortcuts, usePlaybackWatchdog, useLyrics, useVideoLoader, useFocusTrap, useSpotifyImport...)
- `components/views/` — lazy-loaded: Home, Search, Explore, Library, Playlist, Album, Artist, Settings
- `components/overlays/` — Lyrics, Queue, VideoPlayer
- `components/shared/` — TrackRow, TrackCard, AlbumCard, ArtistCard, Toast, Spinner, ContextMenu
- `components/NowPlayingBar/` — playback controls
- `services/api.js` — dedup() pattern with inflight Map, exploreCache.js (30min TTL)
- `styles/` — 30+ CSS files, 6 themes via CSS custom properties + `data-theme` attribute

### Key patterns
- **State:** `@preact/signals` — `signal()`, `computed()`, accessed via `.value`
- **IPC:** `register(ipcMain, deps)` exports, no classes
- **Lazy loading:** `lazy(() => import('./views/X.jsx'))` + `<Suspense>`
- **API dedup:** `dedup(key, fn)` prevents duplicate concurrent requests
- **Theming:** CSS custom properties, `[data-theme="X"]` selectors, 6 themes
- **Preact, not React:** use `import { useState } from 'preact/hooks'`, NOT `react`

### Security
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- ASAR enabled, CSP in main process via `session.defaultSession.webRequest.onHeadersReceived`

## Build commands
- `npm run dev` — dev server with HMR
- `npm run build` — electron-vite build to `out/`
- `npm run build:win` — Windows NSIS
- `npm run build:linux` — Linux AppImage
- `npm run build:mac` — macOS
- `npm run build:all` — all platforms

## Conventions
- Language: French (conversations), English (code/commits)
- Commits: conventional (`feat:`, `fix:`, `chore:`)
- Always bump `package.json` version BEFORE tagging for releases
- Never delete/recreate tags — always bump to new patch version

## Documentation
- `docs/frontend-audit.md` — Previous detailed audit (CSS, a11y, performance) with fixes
- `docs/architecture.md` — Full architecture reference
- `docs/improvements.md` — Pending improvement backlog from stack audit

## Known gotchas
- Mobile CSS: when overriding `left: 50%` + `translateX(-50%)`, MUST also override `transform`
- Cloud Sync: see `src/shared/fieldMapping.js` — client/server format mapping is critical
- Token refresh: `App.jsx` listens for `auth:tokens-updated` IPC to sync renderer signals
- Watchdog at 2s interval (WATCHDOG_INTERVAL_MS in shared/constants) — battery impact
- localStorage has no size limit — large liked songs collections can grow to 5MB+
