# trilium-topics

A monorepo of tools that turn [Trilium Notes](https://github.com/zadam/trilium) into a gamepad-accessible note-taking system. Notes are organized as "topics" (Trilium note groups). The PWA (`topics-editor`) exposes a TV/couch-friendly UI; the other directories provide the server-side glue.

## Repository Layout

```
trilium-topics/
├── topics-editor/          # SvelteKit PWA — the main application
├── sync-endpoints/         # Trilium custom API endpoint scripts (run inside Trilium)
├── base/                   # Trilium automation scripts (topic management)
└── dictionary-construction/ # CLI utilities for building T9 word dictionaries
```

---

## `topics-editor/` — SvelteKit PWA

The primary user-facing application. See [`topics-editor/CLAUDE.md`](topics-editor/CLAUDE.md) for detailed architecture documentation.

**Quick start:**

```bash
cd topics-editor
pnpm install
pnpm dev        # dev server (PWA service worker enabled)
pnpm build      # production build → ./build/
pnpm deploy     # push build/ to GitHub Pages via gh-pages
```

**Package manager:** `pnpm` (enforced via `.npmrc` `engine-strict=true`).

---

## `sync-endpoints/` — Trilium Custom API Endpoints

These JavaScript files are pasted directly into Trilium as [custom request handler notes](https://github.com/zadam/trilium/wiki/Custom-request-handler). Each file exposes one POST endpoint and is attached to a Trilium note whose `#customRequestHandler` attribute equals the path.

| File | Endpoint | Purpose |
|---|---|---|
| `getTopicNotes.js` | `/custom/get-topic-notes` | Returns full topic tree + note metadata (position, dateModified, topics) |
| `getNoteContent.js` | `/custom/get-note` | Returns a single note's content + metadata |
| `setNoteContent.js` | `/custom/set-note` | Overwrites a note's HTML content |
| `createNote.js` | `/custom/create-note` | Creates a new note under the day note, applies `t_<topic>` labels |

**Auth:** Every endpoint checks that the `secret` field in the POST body matches the `#secret` label on the handler note itself.

**CORS:** Each endpoint handles `OPTIONS` preflight requests by returning appropriate `Access-Control-Allow-*` headers so the PWA (potentially on a different origin) can call them.

**No build step** — these files are copied/pasted into Trilium directly.

---

## `base/` — Trilium Automation Scripts

Scripts that run inside Trilium to manage the topic data model.

| File | Purpose |
|---|---|
| `topic_collection.js` | Automation triggered by `~runOnAttributeChange`; creates/removes topic collection notes when `t_*` labels are added or removed from notes |
| `topic_note_creator.jsx` | React JSX component for creating new topic notes from within Trilium |

These are not executed externally — they live inside Trilium notes and are triggered by Trilium's own event system.

---

## `dictionary-construction/` — Dictionary Utilities

Node.js CLI scripts for building and maintaining the word prediction dictionary used by the T9 keyboard in `topics-editor`.

| File | Purpose |
|---|---|
| `extract-words.js` | Extracts words from source files and writes frequency-sorted list |
| `combine-dicts.js` | Merges multiple word lists into one |
| `compare-dicts.js` | Diffs two dictionaries |
| `compare-to-master.js` | Compares a candidate dict against the master |
| `lowercase-dedup.js` | Lowercases and deduplicates a word list |

**Source word lists:**
- `google-10000-english-usa.txt` — Google's 10 k most common English words
- `master-dictionary.txt` / `master-dictionary-lowercase.txt` — curated merged list
- `ngram_words_*.txt` — n-gram word lists from the iWeb corpus (tracked via Git LFS)

**Output:** `master-dictionary-lowercase.txt` is copied to `topics-editor/static/` and fetched at runtime by the PWA to seed the T9 trie.

**Git LFS:** Large `ngram_words_*.txt` files are stored via Git LFS (see `.gitattributes`).

---

## How the Pieces Connect

```
Trilium Notes (server)
  └── sync-endpoints/ (custom API handlers inside Trilium)
        ↑↓ HTTP POST (secret-authenticated)
  topics-editor/ (PWA in the browser)
        ├── reads master-dictionary-lowercase.txt at startup (static asset)
        └── base/ scripts manage the topic structure inside Trilium
```

1. A user installs the PWA and sets the Trilium URL + secret in **Settings**.
2. `topicsDbState` fetches the topic tree every 5 seconds via `get-topic-notes`.
3. Note content is loaded on demand via `get-note`.
4. Edits are queued locally (IndexedDB) and flushed via `set-note` / `create-note`.
5. New notes receive `t_<topic>` labels, which `base/topic_collection.js` picks up to update the topic collection automatically.

---

## Branch / Development Notes

- The active feature branch is `claude/claude-md-mm3yqxjud5csni96-kySAh`.
- There is no CI/CD pipeline — deployment is manual via `pnpm deploy` from `topics-editor/`.
- No test suite exists; validate changes manually in a browser with a gamepad or by reviewing component logic.
