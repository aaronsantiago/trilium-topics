# topics-editor

A SvelteKit PWA designed as a **gamepad/TV-remote-friendly editor** for [Trilium Notes](https://github.com/zadam/trilium). Notes are organized by "topics" (Trilium note groups) and can be browsed and edited entirely via gamepad.

## Tech Stack

- **SvelteKit** (Svelte 5 runes API) with `adapter-static` (no SSR, prerendered)
- **TailwindCSS v4** + **DaisyUI v5** for styling
- **CKEditor5** (Classic Editor, GPL license) for rich text editing
- **idb-keyval** for IndexedDB persistence (all state survives page refresh)
- **`@bbc/tv-lrud-spatial`** for spatial (arrow-key/D-pad) focus navigation
- **`@vite-pwa/sveltekit`** for PWA manifest + service worker
- Package manager: **pnpm**

## Commands

```bash
pnpm dev          # start dev server (PWA service worker enabled in dev)
pnpm build        # production build → ./build/
pnpm preview      # preview production build
pnpm deploy       # deploy ./build/ to GitHub Pages via gh-pages
pnpm generate-pwa-assets  # regenerate PWA icons from static/icon.jpeg
```

## Project Structure

```
src/
  app.html
  lib/
    appState.svelte.js      # selected topic/note state, breadcrumb generation
    topicsDb.svelte.js      # Trilium API sync, notes cache, pending queue
    editor.svelte           # CKEditor5 wrapper component
    editorActions.js        # word-level cursor movement + insertion for CKEditor
    inputs.js               # gamepad polling (rAF loop) + input event bus
    t8-engine.js            # T9-style trie word prediction (colemak layout)
    keyboard/
      keyboard.svelte       # shoulder-button T9 input + word selection UI
      wordRing.svelte       # 3×3 word grid, joystick-selected
  routes/
    +layout.js              # ssr=false, prerender=true, trailingSlash=always
    +layout.svelte          # navbar with breadcrumbs, scroll container, axis listener
    +page.svelte            # topic list (home)
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
- Both queues are persisted to IndexedDB and flushed every 5 seconds
- `notes` is a `$derived` that merges `dbNotes` + `updatedNotes` + `createdNotes`, so the UI always reflects pending changes immediately

### Input System (`inputs.js`)

Polls the Gamepad API in a `requestAnimationFrame` loop. Maps gamepad buttons to named events dispatched to all registered listeners:

| Event | Button Index |
|---|---|
| `confirm` | 1 (Circle/B) |
| `cancel` | 8 (Select/Back) |
| `delete` | 3 (Triangle/Y) |
| `up/down/left/right` | 12–15 (D-pad) |
| `l1/l2/r1/r2` | 4/6/5/7 |
| `l3` | 10 (left stick click) |

Axes (left/right joystick) are dispatched as `{ axis: "lx"|"ly"|"rx"|"ry", value }`.

Keyboard arrow key support exists in the source but is **commented out**.

### T9 Keyboard

The keyboard system allows text input without a physical keyboard:

1. **Shoulder buttons** type letters: L2=`s`, L1=`t`, R1=`n`, R2=`e` (colemak mapping via `t8-engine.js`)
2. As characters are entered, a trie (`t9Db`) matches words by their T9-mapped key sequence
3. Matching words are shown in **WordRings** (3×3 grids); the **left joystick** selects a word
4. **L3** (left stick click) cycles to the next word ring
5. **Confirm** inserts the selected word + space; **Delete** backs up one T9 character (or deletes a word from the editor if buffer is empty)

The word dictionary is built from: user's own notes (words sorted by frequency) + `static/google-10000-english-usa.txt`.

### Navigation

Spatial navigation uses `@bbc/tv-lrud-spatial`. Each page registers an `addInputListener` in a `$effect` (returns cleanup). The D-pad moves focus between focusable elements; `confirm` activates; `cancel` goes back.

## State Modules

Both use the **Svelte 5 runes module pattern**: a `$state` object exported directly, with `$effect`s that must be initialized inside a component (via exported `initialize()` / `initializeAppState()` functions called from `+layout.svelte` / `+page.svelte`).

- **`appState`**: `{ selectedTopic, selectedNoteName, selectedNoteId }` — persisted to idb-keyval
- **`topicsDbState`**: `{ triliumUrl, triliumSecret, topicsDb, dbNotes, updatedNotes, createdNotes }` — persisted to idb-keyval

## Deployment

Static site deployed to GitHub Pages. The `pnpm deploy` script runs `gh-pages -d build -t` (the `-t` flag includes dotfiles like `.nojekyll`).
