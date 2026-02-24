# Snowify Frontend — Pending Improvements

Stack audit: 2026-02-24 on v1.4.8. Global score: **7.1/10**.

Scores by category:

| Category | Score | Notes |
|----------|-------|-------|
| Architecture | 8/10 | Good main/renderer/preload separation |
| Performance | 7/10 | Good caches, but watchdog too frequent |
| Security | 7/10 | Sandbox good, but data not encrypted |
| Code Quality | 6/10 | Duplication, no linting, no tests |
| State Management | 8/10 | Signals excellent, but no middleware |
| Error Handling | 5/10 | Ad-hoc, no centralized logging |
| CSS | 7/10 | Well organized, but not scoped |
| Dependencies | 8/10 | Minimalist, modern, up to date |

---

## Critical (before production)

### 1. Sensitive data stored in plaintext
- **Problem:** `cloudApiKey`, tokens, full app state saved as unencrypted JSON in localStorage
- **Impact:** Any app with disk access can read user tokens
- **Fix:** Use `electron safeStorage` API or Keytar for tokens/API keys
- **Files:** `src/renderer/state/index.js`, `src/preload/index.js`

### 2. No IPC middleware
- **Problem:** 10 IPC handlers with inconsistent validation, error handling, and logging
- **Impact:** Some handlers throw, others return null, no input validation
- **Fix:** Create `registerHandler(name, schema, fn)` wrapper with zod schema validation + centralized try/catch + structured error response
- **Files:** `src/main/ipc/*.handlers.js`

### 3. No structured logging
- **Problem:** ~30 `console.error/warn/log` calls, all lost when app closes
- **Impact:** Can't debug production crashes, no audit trail for sync/auth
- **Fix:** Integrate Winston or Pino with file rotation + log levels (debug/info/warn/error)
- **Files:** Create `src/main/utils/logger.js`, use everywhere

---

## Important (before v1.5)

### 4. No linting or formatting
- **Problem:** No ESLint, no Prettier
- **Fix:** Add `eslint` + `@preact/eslint-plugin` + `prettier`

### 5. Zero test coverage
- **Problem:** No test framework at all
- **Fix:** Add Vitest, start with `src/main/utils/` and `src/main/services/` (pure logic, easy to test)
- **Note:** Already identified in architecture-todo.md #14

### 6. Code duplication
| Pattern | Locations | Fix |
|---------|-----------|-----|
| Track mapping | `parse.js`, `sync.js`, `state/index.js`, `fieldMapping.js` | Extract `utils/trackMapper.js` |
| Retry logic | `api.js`, `explore.handlers.js`, ytmusic init | Extract `utils/retryFetch.js` |
| Audio error handling | `usePlayback.js`, `usePlaybackWatchdog.js` | Extract shared error handler |
| Toast messages | Ad-hoc strings everywhere | Standardize with error codes |

### 7. CSP too permissive
- **Problem:** `connect-src 'self' https: http:` accepts all origins
- **Fix:** Whitelist only: YouTube domains, Snowify API, fonts.googleapis.com
- **File:** `src/main/index.js` (CSP header injection)

### 8. No centralized error state
- **Problem:** Errors handled ad-hoc in each component/hook, no observable error state
- **Fix:** Create `errorState` signal + `useError` hook + standardized error code enum
- **Files:** `src/renderer/state/index.js`, create `src/renderer/hooks/useError.js`

---

## Nice-to-have (backlog)

### 9. CSS not scoped
- 30+ global CSS files with no selector scoping — risk of conflicts
- Themes repeated as boilerplate across 7 `[data-theme]` blocks
- **Fix:** Migrate to CSS Modules or PostCSS for auto-scoping

### 10. Watchdog too frequent
- `WATCHDOG_INTERVAL_MS = 2000` → 30 calls/min — battery impact
- **Fix:** Increase to 4000ms in `src/shared/constants.js`

### 11. localStorage has no size limit
- 10,000+ liked songs ≈ 5MB+ — problematic on mobile (Capacitor)
- No atomic transactions — risk of corruption on crash
- **Fix:** Migrate large collections to IndexedDB, or add compression

### 12. Preload still in CommonJS
- `src/preload/index.js` uses `require('electron')` (legacy pattern)
- **Fix:** Convert to ES modules

### 13. Bridge surface too large
- 70+ methods exposed to renderer via `window.snowify`
- **Fix:** Group by namespace, consider permission-based exposure

### 14. No OS theme detection
- Theme always set manually — no `prefers-color-scheme` integration
- **Fix:** Read `window.matchMedia('(prefers-color-scheme: dark)')` at startup, add "System" theme option

### 15. No request batching
- 100 tracks searched = 100 parallel requests
- **Fix:** Batch API on server side, or client-side request queue with concurrency limit

### 16. Prop drilling NowPlayingBar
- Receives 10+ props from App.jsx
- **Fix:** Import playback signals/hooks directly instead of passing through props
- **Note:** Already identified in architecture-todo.md #13
