// A stateful fake Trilium server, built from Playwright request routing.
// It answers the PWA's custom endpoints the way sync-endpoints/*.js do, keeps
// its own note store (so edits and creates show up on the next sync), and
// records every request so tests can assert on what the app sent.
//
// Never point tests at a real Trilium: these fakes are the only backend.

import { defaultFixtures } from "../fixtures/notes.js";

export const TRILIUM_URL = "http://trilium.test";
export const TRILIUM_SECRET = "test-secret";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

function nowStamp(offsetMs = 0) {
  // Trilium style: "2026-11-10 13:27:23.347-0500" (exact zone doesn't matter)
  const d = new Date(Date.now() + offsetMs);
  return d.toISOString().replace("T", " ").replace("Z", "+0000");
}

function pojo(note) {
  return {
    noteId: note.noteId,
    title: note.title,
    type: "text",
    mime: "text/html",
    isProtected: false,
    dateCreated: note.dateCreated,
    dateModified: note.dateModified,
    utcDateCreated: note.dateCreated,
    utcDateModified: note.dateModified,
  };
}

function meta(note, notePosition) {
  return {
    ...pojo(note),
    topics: [...note.topics],
    quicknote: !!note.quicknote,
    isTodo: !!note.isTodo,
    todoDone: !!note.todoDone,
    notePosition,
  };
}

function parseMultipart(body) {
  const fields = {};
  if (!body) return fields;
  const re = /name="([^"]+)"\r?\n\r?\n([\s\S]*?)\r?\n--/g;
  let m;
  while ((m = re.exec(body))) fields[m[1]] = m[2];
  return fields;
}

/**
 * Install the fake Trilium on a page (call before the app makes requests).
 * @param {import('@playwright/test').Page} page
 * @param {ReturnType<typeof defaultFixtures>} [fixtures]
 * @returns the fake's state: { notes, topics, requests, failNext(endpoint) }
 */
export async function mockTrilium(page, fixtures = defaultFixtures()) {
  let counter = 0;
  const state = {
    topics: [...fixtures.topics],
    notes: new Map(),
    /** every request, in order: { endpoint, body } */
    requests: [],
    /** endpoints whose next call should fail with a 500 */
    failures: new Set(),
    failNext(endpoint) {
      state.failures.add(endpoint);
    },
    /** recorded bodies for one endpoint, e.g. requestsTo('set-note') */
    requestsTo(endpoint) {
      return state.requests.filter((r) => r.endpoint === endpoint).map((r) => r.body);
    },
  };

  for (const n of fixtures.notes) {
    state.notes.set(n.noteId, {
      quicknote: false,
      isTodo: false,
      todoDone: false,
      dateModified: n.dateCreated,
      ...n,
      topics: [...(n.topics || [])],
    });
  }

  function topicTree() {
    // like base/topic_collection.js: a topic note exists while it has notes,
    // and new topics get appended after the seeded ones
    const allTopics = [...state.topics];
    for (const n of state.notes.values()) {
      for (const t of n.topics) if (!allTopics.includes(t)) allTopics.push(t);
    }
    const notes = [...state.notes.values()];
    const children = allTopics
      .map((title, i) => {
        const members = notes.filter((n) => n.topics.includes(title));
        return {
          noteId: "topic_" + title,
          title,
          type: "text",
          notePosition: (i + 1) * 10,
          topics: [],
          quicknote: false,
          isTodo: false,
          todoDone: false,
          children: members.map((n, j) => meta(n, (j + 1) * 10)),
        };
      })
      .filter((t) => t.children.length > 0);
    const quicknotes = notes
      .filter((n) => n.quicknote)
      .map((n, j) => meta(n, (j + 1) * 10));
    return { noteId: "topicsRoot", title: "topics", type: "text", children, quicknotes };
  }

  await page.route(`${TRILIUM_URL}/custom/**`, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: CORS });
    }
    const endpoint = new URL(request.url()).pathname.replace("/custom/", "");
    const raw = request.postData();
    let body;
    try {
      body = JSON.parse(raw || "{}");
    } catch {
      body = parseMultipart(raw);
    }
    state.requests.push({ endpoint, body });

    if (body.secret !== TRILIUM_SECRET) {
      return route.fulfill({ status: 400, headers: CORS, body: "Bad Request" });
    }
    if (state.failures.delete(endpoint)) {
      return route.fulfill({ status: 500, headers: CORS, body: "Injected failure" });
    }

    const json = (status, data) =>
      route.fulfill({ status, headers: CORS, contentType: "application/json", body: JSON.stringify(data) });

    switch (endpoint) {
      case "get-topic-notes":
        return json(201, topicTree());

      case "get-note": {
        const note = state.notes.get(body.noteId);
        if (!note) return route.fulfill({ status: 500, headers: CORS, body: "Note not found" });
        return json(200, { ...meta(note), content: note.content });
      }

      case "set-note": {
        const note = state.notes.get(body.noteId);
        if (!note) return route.fulfill({ status: 500, headers: CORS, body: "Note not found" });
        if (body.topics != null) note.topics = [...body.topics];
        if (body.isTodo != null) note.isTodo = !!body.isTodo;
        if (body.todoDone != null) note.todoDone = !!body.todoDone;
        note.content = body.content;
        note.dateModified = nowStamp(++counter);
        return json(200, { ...pojo(note) });
      }

      case "create-note": {
        const noteId = `created${++counter}`;
        const note = {
          noteId,
          title: body.title,
          dateCreated: body.dateCreated || nowStamp(),
          dateModified: nowStamp(counter),
          content: body.content ?? "",
          topics: [...(body.topics || [])],
          quicknote: false,
          isTodo: false,
          todoDone: false,
        };
        state.notes.set(noteId, note);
        return json(201, { ...pojo(note), content: note.content });
      }

      case "index-create": {
        const noteId = `quick${++counter}`;
        const at = Number(body.recordedAt) || Date.now();
        state.notes.set(noteId, {
          noteId,
          title: "quicknote",
          dateCreated: nowStamp(at - Date.now()),
          dateModified: nowStamp(counter),
          content: body.transcription ?? "",
          topics: [],
          quicknote: true,
          isTodo: false,
          todoDone: false,
        });
        return json(201, { success: true });
      }

      default:
        return route.fulfill({ status: 404, headers: CORS, body: "Unknown endpoint" });
    }
  });

  return state;
}
