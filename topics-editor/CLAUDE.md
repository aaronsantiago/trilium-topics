# topics-editor

A SvelteKit PWA designed as a **gamepad/TV-remote-friendly editor** for [Trilium Notes](https://github.com/zadam/trilium). Notes are organized by "topics" (Trilium note groups) and can be browsed and edited entirely via gamepad.

## Tech Stack

- **SvelteKit** (Svelte 5 runes API) with `adapter-static` (no SSR, prerendered)
- **TailwindCSS v4** + **DaisyUI v5** (`caramellatte` theme) for styling
- **CKEditor5** (Classic Editor, GPL license) for rich text editing
- **idb-keyval** for IndexedDB persistence (all state survives page refresh)
- **`@bbc/tv-lrud-spatial`** for spatial (arrow-key/D-pad) focus navigation
- **`@vite-pwa/sveltekit`** for PWA manifest + service worker (`autoUpdate` mode)
- **`dayjs`** for date formatting when creating notes
- Package manager: **pnpm** (enforced via `.npmrc` `engine-strict=true`)

## Commands

```bash
pnpm dev          # start dev server (PWA service worker enabled in dev)
pnpm build        # production build → ./build/
pnpm preview      # preview production build
pnpm deploy       # deploy ./build/ to GitHub Pages via gh-pages (includes dotfiles via -t)
pnpm generate-pwa-assets  # regenerate PWA icons from static/icon.jpeg
```

## Project Structure

```
src/
  app.html
  lib/
    appState.svelte.js      # selected topic/note state, breadcrumb generation
    topicsDb.svelte.js      # Trilium API sync, notes cache, pending queues
    editor.svelte           # CKEditor5 wrapper component
    editorActions.js        # word-level cursor movement + insertion for CKEditor
    inputs.js               # gamepad polling (rAF loop) + input event bus
    t8-engine.js            # T9-style trie word prediction (colemak layout)
    keyboard/
      keyboard.svelte       # shoulder-button T9 input + word selection UI
      wordRing.svelte       # 3×3 word grid, joystick-selected
  routes/
    +layout.js              # ssr=false, prerender=true, trailingSlash=always
    +layout.svelte          # FloatingButton + scrollContainer (ry-axis scroll)
    +page.svelte            # topic list (home)
    floatingButton.svelte   # flower-menu overlay for navigation (menu button)
    topic/+page.svelte      # notes list for selected topic
    note/+page.svelte       # note editor (CKEditor + Keyboard)
    create/+page.svelte     # new note form (title input + topic picker + Keyboard)
    settings/+page.svelte   # Trilium URL + secret config, reset DB
```

## Architecture

### Trilium API Integration

State is stored in `topicsDbState` (idb-keyval). On startup and every 5 seconds, the app syncs with Trilium's custom API endpoints:

| Endpoint | Method | Purpose |
|---|---|---|
| `/custom/get-topic-notes` | POST | Fetch topic tree + note metadata |
| `/custom/get-note` | POST | Fetch individual note content |
| `/custom/set-note` | POST | Update an existing note |
| `/custom/create-note` | POST | Create a new note |

Auth is via a `secret` field in the request body (configured in Settings).

### Offline / Optimistic Updates

- **`updatedNotes`**: queue of edited notes pending upload to Trilium
- **`createdNotes`**: queue of newly created notes pending upload (use temp UUID until Trilium assigns a real ID)
- Both queues are persisted to IndexedDB and flushed every 5 seconds via `setInterval`
- `notes` is a `$derived` that merges `dbNotes` + `updatedNotes` + `createdNotes`, so the UI always reflects pending changes immediately
- `refreshTopicsDb` uses an `isRefreshing` boolean mutex to prevent concurrent fetches
- `refreshNotes` checks `dateModified` before fetching note content — only re-fetches notes that changed
- After creating/updating notes, the app waits 1500 ms then calls `refreshTopicsDb` to pick up Trilium's authoritative IDs

### Input System (`inputs.js`)

Polls the Gamepad API in a `requestAnimationFrame` loop. Three separate listener buses:

- **`addInputListener(fn)`** — called on button *press* (fires immediately, D-pad repeats after hold)
- **`addInputReleasedListener(fn)`** — called on button *release*
- **`addAxisListener(fn)`** — called every frame with `{ axis: "lx"|"ly"|"rx"|"ry", value }`

All three return a cleanup function suitable for use in `$effect` return values.

**Button → event name mapping:**

| Event | Button Index |
|---|---|
| `confirm` | 1 (Circle/B) |
| `special` | 2 (Square/X) |
| `delete` | 3 (Triangle/Y) |
| `l1` / `r1` | 4 / 5 |
| `l2` / `r2` | 6 / 7 |
| `cancel` | 8 (Select/Back) |
| `menu` | 9 (Start/Menu) |
| `l3` | 10 (left stick click) |
| `up/down/left/right` | 12–15 (D-pad) |

**D-pad key-repeat:** D-pad buttons (12–15) support held-key repeat. Initial delay is **400 ms**, repeat interval is **100 ms**. No other buttons repeat.

Keyboard key bindings exist in the source but are **commented out** (development aid only).

`initInputs()` is idempotent — calling it more than once is safe (guarded by `inputsInitialized`).

### Floating Button / Navigation Menu

`floatingButton.svelte` provides a radial ("flower") overlay menu triggered by the **`menu`** button (button 9):

- Press `menu` → the floating button receives focus
- While the menu is focused, tilt the **left joystick** to reveal directional sub-buttons:
  - `lx < -0.5` → Create (`+`)
  - `ly < -0.5` → Home (`H`)
  - `lx < -0.5 && ly < -0.5` → Settings (`S`)
- Release `menu` → navigates to the selected destination (or blurs if no direction held)

The global layout (`+layout.svelte`) scrolls `#scrollContainer` using the **right joystick Y axis** (`ry`).

The old breadcrumb navbar is commented out in `+layout.svelte` — `FloatingButton` is the current navigation approach.

### T9 Keyboard

The keyboard system allows text input without a physical keyboard:

1. **Shoulder buttons** type letters: L2=`s`, L1=`t`, R1=`n`, R2=`e` (colemak mapping via `t8-engine.js`)
2. As characters are entered, a trie (`t9Db`) matches words by their T9-mapped key sequence
3. Matching words are shown in **WordRings** (3×3 grids); the **left joystick** selects a word
4. **L3** (left stick click) cycles to the next word ring
5. **Confirm** inserts the selected word + space; **Delete** backs up one T9 character (or deletes a word from the editor if buffer is empty)

The word dictionary is built from: user's own notes (words sorted by frequency) + `static/master-dictionary-lowercase.txt` (derived from Google 10k + iWeb n-gram corpus).

**T9 engine details (`t8-engine.js`):** Uses a colemak keyboard layout. Maps all colemak keys into 4 "buckets" (one per shoulder button) via a lookup table (`t4`), then builds a character trie indexed by bucket keys. `generateT9Db(inputFile)` returns the trie; word priority is determined by line order in the input file.

### Navigation

Spatial navigation uses `@bbc/tv-lrud-spatial`. Each page registers an `addInputListener` in a `$effect` (returns cleanup). The D-pad moves focus between focusable elements via `getNextFocus`; `confirm` activates; `cancel` goes back (via `goto`).

Focus is auto-initialized to the first focusable item when a list loads (e.g., first topic on home page).

## State Modules

Both use the **Svelte 5 runes module pattern**: state is declared with `$state` at module scope, loaded from IndexedDB in a top-level `async` IIFE on import, and persisted back via `$effect`s that must run inside a component lifecycle. Each module exports an `initialize()` function to be called from the appropriate page/layout.

- **`appState`** (`appState.svelte.js`): `{ selectedTopic, selectedNoteName, selectedNoteId }` — persisted to idb-keyval. `initializeAppState()` called from `+layout.svelte`.
- **`topicsDbState`** (`topicsDb.svelte.js`): `{ triliumUrl, triliumSecret, topicsDb, dbNotes, updatedNotes, createdNotes }` — persisted to idb-keyval. `initialize()` called from `+page.svelte` (home). The `setInterval` sync timers are started in the IIFE on module load (not in `initialize()`).

**Important:** The `$effect`s in `initialize()` also trigger `refreshTopicsDb` when `triliumUrl` or `triliumSecret` change, using `untrack()` to avoid feedback loops.

## Deployment

Static site deployed to GitHub Pages. The `pnpm deploy` script runs `gh-pages -d build -t` (the `-t` flag includes dotfiles like `.nojekyll`). Base path is currently set to `""` (root) for both dev and production in `svelte.config.js`.
