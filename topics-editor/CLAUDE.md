# topics-editor

A SvelteKit PWA editor for [Trilium Notes](https://github.com/zadam/trilium), used mainly on a phone (touch) and also with a mouse. Notes are organized by "topics" (Trilium note groups). Text entry uses the native/on-screen keyboard; there is no gamepad or T9 input layer (removed 2026-11-10).

## Tech Stack

- **SvelteKit** (Svelte 5 runes API) with `adapter-static` (no SSR, prerendered)
- **TailwindCSS v4** + **DaisyUI v5** (`caramellatte` theme) for styling
- **CKEditor5** (Classic Editor, GPL license) for rich text editing
- **idb-keyval** for IndexedDB persistence (all state survives page refresh)
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
pnpm test:e2e         # Playwright, mobile + desktop projects (see Testing)
pnpm test:e2e:mobile  # Playwright, phone emulation only
```

## Testing

Playwright (`@playwright/test`, pinned to 1.56.1 to match the Chromium already in `~/.cache/ms-playwright`; if it's missing, `pnpm exec playwright install chromium`). Config: `playwright.config.js`.

- **Server:** Playwright starts `vite dev` on `PW_PORT` (default **5180**) and reuses one already running there. Use a different `PW_PORT` per worktree/agent.
- **Projects:** `mobile` = `devices['Pixel 7']` (412×839, touch, `isMobile`); `desktop` = Desktop Chrome.
- **Cold Vite cache:** right after `pnpm install` (or with `node_modules/.vite` cleared) the first one or two runs can fail at random, because Vite discovers deps (ckeditor5, isotope, …) on first browser load and force-reloads open pages. Re-run before you go debugging.
- **Service worker is blocked** (`serviceWorkers: 'block'`): the dev build registers the PWA worker, whose fetches would bypass request mocking.
- **Fake Trilium** — `tests/helpers/trilium.js`, `mockTrilium(page, fixtures)`: routes `http://trilium.test/custom/*` and answers `get-topic-notes`, `get-note`, `set-note`, `create-note`, `index-create` in the same shapes as `sync-endpoints/*.js`. It's stateful (edits/creates show up on the next 5 s sync; topics with no notes disappear, like `base/topic_collection.js`). The returned object exposes `notes` (Map), `requests`, `requestsTo('set-note')` for asserting what the app sent, and `failNext('create-note')` to inject a 500.
- **Fixtures** — `tests/fixtures/notes.js`, `defaultFixtures()`: topics `work`/`home`/`reading`, a note in all three topics (`noteMulti`), a 60-paragraph note (`noteLong`, for scroll bugs), and quicknotes (unsorted, open todo, done todo). Copy and modify it per test rather than editing shared data.
- **App helpers** — `tests/helpers/app.js`:
  - `setupApp(page, { fixtures?, path? })` installs the fake, writes `triliumUrl`/`triliumSecret` straight into IndexedDB (`keyval-store`), reloads, and waits for the first sync. (Filling the Settings page doesn't persist: the idb write `$effect`s only run once home calls `initialize()`.)
  - `touchScroll(page, x, y, dy)` does a real finger-drag scroll via CDP `Input.dispatchTouchEvent` (touchStart → touchMoves → touchEnd; Chromium may add a little fling); positive `dy` scrolls content down. Keep `y - dy` on screen. (`Input.synthesizeScrollGesture` with touch is a silent no-op in this Chromium — don't use it.) Use it for touch-scroll bugs; `page.mouse.wheel` doesn't exercise touch scrolling.
  - `scrollChain(page, selector)` lists `scrollTop`/`overflowY` of every scrollable ancestor, which helps find nested scroll-container bugs.
- **Writing a spec:** add `tests/<feature>.spec.js`; start with `const trilium = await setupApp(page)`; drive the UI with `locator.tap()` on mobile (or `click()`, which works in both projects); assert on the DOM *and* on `trilium.requestsTo(...)` for sync behaviour. Remember the queues flush every 5 s, so use `expect.poll(() => trilium.requestsTo('set-note').length).toBeGreaterThan(0)` rather than fixed sleeps.
- **Look at it:** save screenshots with `await page.screenshot({ path: testInfo.outputPath('name.png') })`; they land in `test-results/<test>-<project>/`. Read them to check layout. Failures also keep a screenshot and `trace.zip` (`pnpm exec playwright show-trace <zip>`).
- **One-off look at a page:** write a throwaway spec (or `-g` an existing one) and run `pnpm exec playwright test tests/x.spec.js --project=mobile`. Delete throwaway specs before committing.

## Project Structure

```
src/
  app.html
  lib/
    appState.svelte.js      # selected topic/note state, breadcrumb generation
    topicsDb.svelte.js      # Trilium API sync, notes cache, pending queues
    NoteCard.svelte         # full note card (title + rendered content)
    NoteCollection.svelte   # card list w/ layouts (vertical, horizontal strip, todoStrip, responsive, masonryH — Isotope masonryHorizontal in portrait)
    QuicknoteCard.svelte    # compact quicknote card (timestamp, full content, todo checkbox, edit)
    QuicknoteInput.svelte   # plain text input for quicknotes; Enter submits and keeps focus (phone keyboard stays up)
    QuicknoteEditPopup.svelte # staged topic/todo editor for selected quicknotes
    editor.svelte           # CKEditor5 wrapper component
  routes/
    +layout.js              # ssr=false, prerender=true, trailingSlash=always
    +layout.svelte          # FloatingButton + #scrollContainer, registers the PWA service worker
    +page.svelte            # topic list (home)
    floatingButton.svelte   # tap-to-open flower menu: Home / Create / Settings
    topic/+page.svelte      # topic view: todos strip (opens first, dones last) + date-ordered timeline w/ inline quicknote scrollers
    note/+page.svelte       # note editor (CKEditor)
    create/+page.svelte     # new note form (title input + tap-to-toggle topic picker)
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
| `/custom/index-create` | POST | Create a quicknote from multipart `transcription` + `recordedAt` (pebble endpoint; also used by the home quicknote input) |

Auth is via a `secret` field in the request body (configured in Settings). `index-create` accepts the secret as a `secret` multipart field (PWA) or a `TRILIUM-SECRET` header (Pebble watch) — the PWA uses the field because Trilium's global CORS middleware answers browser preflights with a fixed `Content-Type,Authorization` allow-list, so a custom request header can never pass.

### Offline / Optimistic Updates

- **`updatedNotes`**: queue of edited notes pending upload to Trilium
- **`createdNotes`**: queue of newly created notes pending upload (use temp UUID until Trilium assigns a real ID)
- Both queues are persisted to IndexedDB and flushed every 5 seconds via `setInterval`
- Quicknotes typed into the home panel's `QuicknoteInput` also ride the `createdNotes` queue (optimistic card), but `checkCreatedNotes` uploads them to `/custom/index-create` (multipart `transcription` + `recordedAt` + `secret`) instead of `/custom/create-note`; since that endpoint returns no note ID, the editor's ID is resolved by content match against the refreshed quicknotes
- `notes` is a `$derived` that merges `dbNotes` + `updatedNotes` + `createdNotes`, so the UI always reflects pending changes immediately
- `refreshTopicsDb` uses an `isRefreshing` boolean mutex to prevent concurrent fetches
- `refreshNotes` checks `dateModified` before fetching note content — only re-fetches notes that changed
- After creating/updating notes, the app waits 1500 ms then calls `refreshTopicsDb` to pick up Trilium's authoritative IDs

### Floating Button / Navigation Menu

`floatingButton.svelte` is a daisyUI `fab fab-flower` in the bottom-right corner:

- Tapping/clicking the `⋯` trigger (a `tabindex="0"` div — it must stay focusable, since the flower opens on focus) reveals the sub-buttons.
- The sub-buttons (**Create note**, **Settings**, **Home**, each with an `aria-label`) navigate via `onclick` + `goto`. Tapping elsewhere blurs the trigger and closes the menu.

It is the only app-wide navigation for touch and mouse. The old breadcrumb navbar is commented out in `+layout.svelte`.

### Navigation

Plain tap/click: cards and topic chips use `onclick`, the browser back button goes back. There is no spatial navigation and no focus auto-initialization. Cards keep `tabindex="0"` for keyboard Tab access, and their enlarge-on-focus style uses `focus-visible:` so a tapped card doesn't stay scaled up.

On home, `focusin`/`pointerdown` inside the quicknotes panel switch on the mobile quicknotes mode (the panel grows, topics hide); while the quicknote edit popup is open the rest of the page is `inert`.

## State Modules

Both use the **Svelte 5 runes module pattern**: state is declared with `$state` at module scope, loaded from IndexedDB in a top-level `async` IIFE on import, and persisted back via `$effect`s that must run inside a component lifecycle. Each module exports an `initialize()` function to be called from the appropriate page/layout.

- **`appState`** (`appState.svelte.js`): `{ selectedTopic, selectedNoteName, selectedNoteId }` — persisted to idb-keyval. `initializeAppState()` called from `+layout.svelte`.
- **`topicsDbState`** (`topicsDb.svelte.js`): `{ triliumUrl, triliumSecret, topicsDb, dbNotes, updatedNotes, createdNotes }` — persisted to idb-keyval. `initialize()` called from `+page.svelte` (home). The `setInterval` sync timers are started in the IIFE on module load (not in `initialize()`).

**Important:** The `$effect`s in `initialize()` also trigger `refreshTopicsDb` when `triliumUrl` or `triliumSecret` change, using `untrack()` to avoid feedback loops.

## Deployment

Static site deployed to GitHub Pages. The `pnpm deploy` script runs `gh-pages -d build -t` (the `-t` flag includes dotfiles like `.nojekyll`). Base path is currently set to `""` (root) for both dev and production in `svelte.config.js`.
