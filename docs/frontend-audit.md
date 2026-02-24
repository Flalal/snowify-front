# Frontend Audit — Snowify v1.4.8

> Date: 2026-02-24 | Score: **6.5 / 10**

| Category | Score | Weight | Notes |
|----------|-------|--------|-------|
| Architecture & Code | 8/10 | 35% | Solid hook decomposition, no leaks, clean deps |
| CSS & Theming | 5.5/10 | 20% | Broken variables, incomplete light theme, no responsive |
| Accessibility | 4/10 | 25% | ARIA basics done, missing alt/labels/focus-trap/contrast |
| Performance | 7.5/10 | 20% | Good lazy/virtual, minor image/memoization gaps |

---

## 1. Architecture & Code (8/10)

### What's good

- Clean dependency chain: state → hooks → components → services, zero circular deps
- Hooks well decomposed (useTrackPlayer, useQueueControls, usePlayback orchestrator)
- Code splitting via `lazy()` on all heavy views
- TrackList virtualization above threshold
- API request dedup in `services/api.js`
- Fresh closure refs (usePlayback, watchdog, keyboard shortcuts)
- AbortController on lyrics fetch
- Event listener cleanup: 100% correct everywhere
- Unmount guards on async hooks (useLyrics, useSpotifyImport)

### To fix

#### HIGH

- [ ] **Duplicated `applyThemeToDOM`**
  - `hooks/useAppInit.js:10-16` and `views/settings/AppearanceSection.jsx:3-9`
  - Fix: extract to `utils/applyThemeToDOM.js`, import in both

- [ ] **`draggedTrack` signal exported from component**
  - `components/Sidebar/Sidebar.jsx:7`
  - Fix: move to `state/index.js` or `state/dragState.js`

- [ ] **Cross-module import violation**
  - `views/settings/PlaybackSection.jsx:6` imports `invalidateExploreCache` from `ExploreView.jsx`
  - Fix: move cache + invalidation to `services/exploreCache.js`

- [ ] **Module-level cache in component**
  - `views/ExploreView.jsx:28-48` — `_exploreCache`, `_chartsCache`, timing vars
  - Fix: move to `services/exploreCache.js`

#### MEDIUM

- [ ] **`handleStart` is 148 lines of async**
  - `hooks/useSpotifyImport.js:87-235`
  - Fix: extract batch-processing logic to a utility or split into sub-functions

- [ ] **VideoPlayer useEffect is 78 lines**
  - `overlays/VideoPlayer.jsx:96-173`
  - Fix: extract async video loading to `utils/loadVideo.js` or `hooks/useVideoLoader.js`

- [ ] **11 useState in useSpotifyImport**
  - `hooks/useSpotifyImport.js:8-18`
  - Fix: consolidate into `useReducer` — many states are derived (`startDisabled` = `!pendingPlaylists?.length`)

#### LOW

- [ ] **Prop drilling NowPlayingBar (10 props)**
  - `App.jsx:198-209` → NowPlayingBar → PlaybackControls
  - Fix: wrap playback callbacks in a context or import hooks directly

---

## 2. CSS & Theming (5.5/10)

### What's good

- 6 complete theme palettes in variables.css
- Centralized truncate selector (25 selectors in global.css)
- Shadow variables (`--shadow-card-hover`, `--shadow-accent-sm`, etc.)
- All animations use GPU-friendly transform/opacity
- Scrollbar themed per-theme

### To fix

#### CRITICAL

- [ ] **3 undefined CSS variables (silently broken)**
  - `--bg-elevated-hover` — used in explore.css:54,132,150
  - `--border` — used in search.css:154
  - `--ease-bounce` — used in cards.css:191
  - Fix: define in variables.css `:root` + all theme blocks

- [ ] **Dead selectors targeting non-existent classes**
  - context-menu.css:83-84 — `.flyout-menu`, `.flyout-item` don't exist (actual: `.context-submenu`, `.context-sub-item`)
  - Fix: remove dead rules, add light overrides for actual selectors

- [ ] **Wrong ID selector in light override**
  - nowplaying.css:249 — `#now-playing` should be `#now-playing-bar`
  - Fix: correct the selector

#### HIGH

- [ ] **9 CSS files missing light theme overrides**
  - `artist.css` — disco-filter, show-more-btn, follow-btn, artist-tag, similar-artist all dark-only
  - `explore.css` — mood-card borders, top-song-item, top-artist-card hover
  - `library.css` — lib-card border colors
  - `lyrics.css` — lyrics-panel background
  - `modal.css` — modal-box elevation/shadow
  - `playlist.css` — hero cover, action buttons
  - `scroll-arrows.css` — arrow backgrounds/shadows
  - `video.css` — overlay background
  - `views.css` — view-error button
  - Fix: add `[data-theme="light"]` overrides in each file

- [ ] **Only 1 @media query for 3,339 lines of CSS**
  - global.css:146-150 (max-width: 1000px) is the only breakpoint
  - Fix: add breakpoints at 1200px, 900px, 600px for sidebar collapse, card grid columns, modal widths, queue panel

#### MEDIUM

- [ ] **Liked-cover gradient hardcoded 3 times**
  - library.css:38, sidebar.css:144, playlist.css:13 — same `#6c5ce7 → #a29bfe`
  - Fix: add `--liked-gradient` variable

- [ ] **12 interactive elements missing `:focus-visible` state**
  - `.icon-btn`, `.nav-btn`, `.playlist-item`, `.track-row`, `.disco-filter`, `.show-more-btn`, `.follow-btn`, `.artist-tag`, `.picker-item`, `.picker-new`, `.modal-btn`, `.spotify-pick-btn`
  - Fix: add `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }` or `box-shadow: var(--shadow-focus)`

- [ ] **`playlist-cover-grid` defined in 3 files**
  - library.css:45-52, sidebar.css:126-138, playlist.css:31-38
  - Fix: consolidate into one shared rule in global.css or a new `covers.css`

#### LOW

- [ ] **4 unused variables in variables.css**
  - `--glass-border` (line 29), `--glass-blur` (line 30)
  - Fix: remove or start using them

- [ ] **28 `!important` declarations (8-10 avoidable)**
  - Justified: `.no-animations`, `.no-effects`, `.hidden`
  - Avoidable: lyrics.css:72,75,93 (opacity), tracklist.css:46,48 (display), sidebar.css:178-180 (drag-over)
  - Fix: increase selector specificity instead

---

## 3. Accessibility (4/10)

### What's good

- All modals: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` ✓
- Both context menus: `role="menu"`, `role="menuitem"`, arrow/Enter/Escape keyboard nav ✓
- ProgressBar + VolumeControl: `role="slider"`, `aria-valuenow/min/max`, keyboard arrows ✓
- Toast: `role="status"`, `aria-live="polite"` ✓
- All close buttons: `aria-label="Close ..."` ✓
- Panels: `role="complementary"`, `aria-label` ✓

### To fix

#### HIGH

- [ ] **Empty `alt=""` on all images (12+ instances)**
  - NowPlayingBar.jsx:53 — `<img alt="" />`
  - TrackRow.jsx:80 — `<img alt="" />`
  - TrackCard.jsx:39 — `<img alt="" />`
  - AlbumCard.jsx:45 — `<img alt="" />`
  - ArtistCard.jsx:24,38 — `<img alt="" />`
  - VideoCard.jsx:23 — `<img alt="" />`
  - QueuePanel.jsx:95 — `<img alt="" />`
  - PlaylistCover.jsx:3,14 — `<img alt="" />`
  - SearchView.jsx:170 — `<img alt="" />`
  - HomeView.jsx:212 — `<img alt="" />`
  - Fix: use `alt={track.title}` or `alt={album.name}` etc.

- [ ] **15+ buttons missing `aria-label`**
  - NowPlayingBar.jsx:64,69 — Like, Add-to-playlist buttons (have `title` but no `aria-label`)
  - NowPlayingBar.jsx:89-92 — Lyrics, Queue toggle buttons
  - PlaybackControls.jsx:29,40,52,55 — Shuffle, Previous, Next, Repeat
  - TrackRow.jsx:89-108 — Like, Add buttons
  - TrackCard.jsx:44 — Play button
  - AlbumCard.jsx:46 — Play button
  - Sidebar.jsx:83-88 — Import, Create playlist
  - SpotifyImport.jsx:65 — Remove file button
  - Fix: add `aria-label` matching the action (e.g. `aria-label="Like"`, `aria-label="Play"`)

- [ ] **6 clickable divs without keyboard support**
  - TrackCard.jsx:30-50 — card with onClick, no tabIndex/onKeyDown
  - AlbumCard.jsx:38-62 — same
  - VideoCard.jsx:17-34 — same
  - ArtistCard.jsx:11-41 — both variants
  - QueuePanel.jsx:88-103 — queue items
  - HomeView.jsx:204-224 — quick pick cards
  - Fix: add `tabIndex={0}` + `onKeyDown` (Enter/Space → onClick) or convert to `<button>`

- [ ] **No focus trap in any modal**
  - SpotifyImport, InputModal, PlaylistPickerModal, VideoPlayer
  - Fix: create a `useFocusTrap(ref, visible)` hook that traps Tab within the modal and restores focus on close

- [ ] **`--text-subdued` fails WCAG AA contrast (4.5:1 required)**
  - Dark: `#6a6a6a` on `#0a0a0a` ≈ 3.8:1
  - Light: `#999999` on `#f0f0f0` ≈ 3.6:1
  - Ocean: `#5a6680` — borderline
  - Forest: `#4e7a62` — borderline
  - Fix: bump subdued colors up (e.g. dark `#808080`, light `#767676`)

#### MEDIUM

- [ ] **Search input has no label**
  - SearchView.jsx — only `placeholder="Search..."`, no `aria-label`
  - Fix: add `aria-label="Search songs, artists, albums"`

- [ ] **Toast missing `aria-atomic="true"`**
  - Toast.jsx — has `aria-live` but screen reader may only read changed text
  - Fix: add `aria-atomic="true"` to announce full toast

---

## 4. Performance (7.5/10)

### What's good

- All views lazy-loaded via `lazy()` ✓
- TrackList virtualized above threshold ✓
- Search debounced ✓
- API dedup prevents duplicate requests ✓
- `loading="lazy"` on most card images ✓
- Event listener cleanup 100% correct ✓
- LikedSongs computed as `Set` via `useMemo` ✓

### To fix

#### MEDIUM

- [ ] **`loading="lazy"` missing on 4 image groups**
  - NowPlayingBar.jsx:53 — now-playing thumbnail
  - QueuePanel.jsx:95 — queue item thumbnails
  - SearchView.jsx:170 — artist result avatar
  - HomeView.jsx:212 — quick pick card images
  - Fix: add `loading="lazy"` attribute

- [ ] **SpotifyImport track list not virtualized**
  - SpotifyImport.jsx:119-154 — renders all items in DOM
  - Can have hundreds/thousands of tracks
  - Fix: use same VirtualTrackList pattern or simple windowing

- [ ] **Missing `useCallback` on view handlers**
  - SearchView.jsx:32-60 — `performSearch` recreated each render
  - HomeView.jsx — some inline callbacks
  - Fix: wrap with `useCallback` and proper deps

#### LOW

- [ ] **Inline objects created every render**
  - NowPlayingBar.jsx:45 — `{ name: track.album, thumbnail: track.thumbnail }`
  - Sidebar.jsx:10-16 — nav items array
  - Fix: extract to constants or memoize

- [ ] **Triple text-shadow on active lyrics line**
  - lyrics.css:78-81 — 3 layered text-shadows + scale transform
  - Fix: reduce to single shadow or use `filter: drop-shadow()`

---

## Roadmap to 10/10

### Phase 1 — CSS fixes (quick wins)
1. Define the 3 missing variables in variables.css
2. Fix dead selectors (context-menu.css, nowplaying.css)
3. Add `--liked-gradient` variable, deduplicate
4. Add `:focus-visible` to all interactive elements
5. Consolidate `playlist-cover-grid` into one location

### Phase 2 — Light theme completion
6. Add `[data-theme="light"]` overrides to the 9 files listed above
7. Bump `--text-subdued` contrast in all 6 themes

### Phase 3 — Accessibility
8. Add `alt={name}` to all images
9. Add `aria-label` to all icon-only buttons
10. Add `tabIndex={0}` + keyboard handler to all clickable cards
11. Create `useFocusTrap` hook, apply to all modals
12. Add `aria-label` to search input, `aria-atomic` to toast

### Phase 4 — Architecture cleanup
13. Extract `applyThemeToDOM` to utils/
14. Move `draggedTrack` to state/
15. Create `services/exploreCache.js` (move cache + invalidation from ExploreView)
16. Refactor `useSpotifyImport` to `useReducer`
17. Extract VideoPlayer loading logic to hook

### Phase 5 — Performance polish
18. Add `loading="lazy"` to remaining images
19. Virtualize SpotifyImport track list
20. Add responsive breakpoints (1200/900/600px)
21. Wrap view handlers in `useCallback`
