import { get, set } from 'idb-keyval';
import { untrack } from 'svelte';
import { appState } from './appState.svelte.js';
import dayjs from 'dayjs';

let sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let topicsDbState = $state({
  triliumUrl: '',
  triliumSecret: '',
  topicsDb: null,
  dbNotes: null,
  updatedNotes: null,
  createdNotes: null
});

let notes = $derived.by(() => {
  let cumulativeNotes = {};
  for (let noteId in topicsDbState.dbNotes) {
    cumulativeNotes[noteId] = topicsDbState.dbNotes[noteId];
  }
  for (let noteId in topicsDbState.updatedNotes) {
    cumulativeNotes[noteId] = topicsDbState.updatedNotes[noteId];
  }
  for (let noteId in topicsDbState.createdNotes) {
    cumulativeNotes[noteId] = topicsDbState.createdNotes[noteId];
  }
  return cumulativeNotes;
});

function getNotes() {
  return notes;
}

function getQuicknotes() {
  let quicknoteMeta = topicsDbState.topicsDb?.quicknotes || [];
  let allNotes = notes;
  // pending quicknotes aren't in topicsDb.quicknotes yet (they ride the
  // createdNotes queue), so prepend them, newest first
  let pendingQuicknotes = Object.values(topicsDbState.createdNotes || {})
    .filter((note) => note?.quicknote)
    .sort((a, b) => (b.recordedAt || 0) - (a.recordedAt || 0));
  let serverQuicknotes = quicknoteMeta
    .slice()
    .sort((a, b) => a.notePosition - b.notePosition)
    .map((meta) => allNotes[meta.noteId])
    .filter(Boolean);
  // the todos-first sort is stable, so a fresh note lands at the top of
  // the non-todo section
  return [...pendingQuicknotes, ...serverQuicknotes]
    .filter((note) => !(note.isTodo && note.todoDone))
    .filter((note) => note.isTodo || !(note.topics?.length > 0))
    .sort((a, b) => (a.isTodo ? 0 : 1) - (b.isTodo ? 0 : 1));
}

// ids of all quicknotes (server + pending) — keeps pending quicknotes out of
// the Recent list while they wait for upload
function getQuicknoteIds() {
  let ids = new Set(
    (topicsDbState.topicsDb?.quicknotes || []).map((n) => n.noteId),
  );
  for (let noteId in topicsDbState.createdNotes || {}) {
    if (topicsDbState.createdNotes[noteId]?.quicknote) ids.add(noteId);
  }
  return ids;
}

// true while the note is still in the createdNotes queue as a quicknote
// (topic/todo staging can't round-trip through index-create until it lands)
function isPendingQuicknote(noteId) {
  return !!topicsDbState.createdNotes?.[noteId]?.quicknote;
}

// queue a quicknote for upload to /custom/index-create (pebble endpoint);
// the optimistic note rides the createdNotes queue like create-page notes,
// but checkCreatedNotes POSTs it as multipart transcription + recordedAt
function queueQuicknote(text) {
  const tempNoteId = crypto.randomUUID();
  const now = Date.now();
  if (topicsDbState.createdNotes == null) topicsDbState.createdNotes = {};
  topicsDbState.createdNotes[tempNoteId] = {
    title: dayjs(now).format("MMMM D - h:mmA - YYYY") + " quicknote",
    noteId: tempNoteId,
    dateCreated: dayjs(now).format("YYYY-MM-DD HH:mm:ss.SSS").concat(dayjs(now).format("Z").replace(':', '')),
    // escape so the text renders literally (card, Trilium, editor)
    content: text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"),
    topics: [],
    quicknote: true,
    recordedAt: now,
  };
}

function queueNoteUpdate(noteId, changes) {
  if (!noteId) return;
  if (topicsDbState.createdNotes?.[noteId]) {
    Object.assign(topicsDbState.createdNotes[noteId], changes);
    return;
  }
  // updatedNotes is null until the idb hydration IIFE resolves
  if (topicsDbState.updatedNotes == null) topicsDbState.updatedNotes = {};
  if (topicsDbState.updatedNotes[noteId] == null) {
    topicsDbState.updatedNotes[noteId] = { ...(notes[noteId] || {}), ...changes, noteId };
  } else {
    Object.assign(topicsDbState.updatedNotes[noteId], changes);
  }
}


// initialize topicsDb
(async () => {
  // load the initial values from idb
  topicsDbState.triliumUrl = await get('triliumUrl') || '';
  topicsDbState.triliumSecret = await get('triliumSecret') || '';
  topicsDbState.topicsDb = await get('topicsDb') || null;
  topicsDbState.dbNotes = await get('dbNotes') || null;
  topicsDbState.updatedNotes = await get('updatedNotes') || {};
  topicsDbState.createdNotes = await get('createdNotes') || {};

  // set up an interval to attempt uploading updated notes 5 seconds
  setInterval(checkUpdatedNotes, 5000);
  setInterval(checkCreatedNotes, 5000);
})();

// effects must be called inside of a component, so we call this
// initialize function from the top level component
function initialize() {
  $effect(() => {
    if (topicsDbState.triliumUrl) set('triliumUrl', topicsDbState.triliumUrl);
  });

  $effect(() => {
    if (topicsDbState.triliumSecret) set('triliumSecret', topicsDbState.triliumSecret);
  });

  $effect(() => {
    if (topicsDbState.topicsDb) set('topicsDb', $state.snapshot(topicsDbState.topicsDb));
  });

  $effect(() => {
    if (topicsDbState.dbNotes) set('dbNotes', $state.snapshot(topicsDbState.dbNotes));
  });

  $effect(() => {
    if (topicsDbState.updatedNotes) set('updatedNotes', $state.snapshot(topicsDbState.updatedNotes));
  });

  $effect(() => {
    if (topicsDbState.createdNotes) set('createdNotes', $state.snapshot(topicsDbState.createdNotes));
  });

  $effect(() => {
    topicsDbState.triliumUrl;
    topicsDbState.triliumSecret;
    console.log("effect triggered");

    // we use untrack here to avoid an infinite loop of effects triggering each other
    // not sure why these trigger based on the above tracking though
    untrack(() => {
      refreshTopicsDb();
      checkUpdatedNotes();
      checkCreatedNotes();
    });
  });
}

async function checkCreatedNotes() {
  if (!topicsDbState.triliumUrl || !topicsDbState.triliumSecret) return;
  if (!Object.keys(topicsDbState?.createdNotes || {}).length) return;

  let createdNotesToDelete = [];
  let editorNoteId = null;
  for (let createdNoteId in topicsDbState.createdNotes) {
    let entry = topicsDbState.createdNotes[createdNoteId];
    try {
      if (entry.quicknote) {
        // quicknotes go to the pebble endpoint (multipart transcription +
        // recordedAt); it returns no note id, so the editor id is resolved
        // by content match below. The secret travels as a body field (not a
        // TRILIUM-SECRET header): Trilium's global CORS middleware answers
        // preflights with a fixed Content-Type,Authorization allow-list, so
        // a custom request header would fail the preflight
        const form = new FormData();
        form.append("transcription", entry.content);
        form.append("recordedAt", String(entry.recordedAt));
        form.append("secret", topicsDbState.triliumSecret);
        await fetch(topicsDbState.triliumUrl + "/custom/index-create", {
          method: "POST",
          body: form,
        });

        console.log("Uploaded quicknote: ", createdNoteId);

        createdNotesToDelete.push(createdNoteId);
      } else {
        let result = await fetch(topicsDbState.triliumUrl + '/custom/create-note', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            "title": topicsDbState.createdNotes[createdNoteId].title,
            "dateCreated": dayjs().format('YYYY-MM-DD HH:mm:ss.SSS').concat(dayjs().format('Z').replace(':', '')),//"2026-02-18 13:27:23.347-0500",
            "secret": topicsDbState.triliumSecret,
            "content": topicsDbState.createdNotes[createdNoteId].content,
            "topics": topicsDbState.createdNotes[createdNoteId].topics
          })
        });

        let resultJson = await result.json();

        console.log("Uploaded created note: ", createdNoteId, resultJson.noteId);

        if (appState.selectedNoteId == createdNoteId) {
          editorNoteId = resultJson.noteId;
        }
        createdNotesToDelete.push(createdNoteId);
      }
    }
    catch (error) {
      console.error("Error uploading updated note: ", error);
    }
  }

  if (createdNotesToDelete?.length > 0) {
    await sleep(1500);
    await refreshTopicsDb();
    for (let noteId of createdNotesToDelete) {
      let entry = topicsDbState.createdNotes[noteId];
      if (entry?.quicknote && appState.selectedNoteId == noteId) {
        // index-create returns no note id — resolve the real one by content
        // match in the refreshed quicknotes (newest match wins)
        let matches = (topicsDbState.topicsDb?.quicknotes || [])
          .map((meta) => meta.noteId)
          .filter((id) => topicsDbState.dbNotes?.[id]?.content === entry.content);
        if (matches.length > 0) {
          matches.sort((a, b) =>
            dayjs(topicsDbState.dbNotes[b].dateCreated).valueOf() -
            dayjs(topicsDbState.dbNotes[a].dateCreated).valueOf()
          );
          editorNoteId = matches[0];
        }
      }
      delete topicsDbState.createdNotes[noteId];
    }
    if (editorNoteId) {
      appState.selectedNoteId = editorNoteId;
    }
  }
}

// An update stays in updatedNotes (masking the stale dbNotes copy) until a refresh
// proves the server took it. Otherwise the note briefly reverts to its old state,
// which makes quicknotes disappear/reappear as the filters and sort re-evaluate.
const UPLOAD_CONFIRM_TIMEOUT_MS = 30000;
const pendingUploads = new Map(); // noteId -> { dateModified, at, payload }

const SYNCED_FIELDS = ['content', 'isTodo', 'todoDone'];
function syncedFieldsMatch(a, b) {
  if (!a || !b) return false;
  if (SYNCED_FIELDS.some((field) => a[field] !== b[field])) return false;
  return JSON.stringify([...(a.topics ?? [])].sort()) === JSON.stringify([...(b.topics ?? [])].sort());
}

function reconcilePendingUploads() {
  for (let [noteId, pending] of pendingUploads) {
    let current = topicsDbState.updatedNotes?.[noteId];
    if (!current) {
      pendingUploads.delete(noteId);
      continue;
    }
    if (!syncedFieldsMatch(current, pending.payload)) {
      // edited again since the upload — re-upload next tick, keep masking until then
      pendingUploads.delete(noteId);
      continue;
    }
    let dbNote = topicsDbState.dbNotes?.[noteId];
    let confirmed = dbNote && dbNote.dateModified !== pending.dateModified;
    let expired = Date.now() - pending.at > UPLOAD_CONFIRM_TIMEOUT_MS;
    if (!confirmed && !expired) continue;
    if (!confirmed) console.warn("Dropping unconfirmed note update: ", noteId);
    pendingUploads.delete(noteId);
    // dbNotes already holds the server copy, so this hand-off is invisible
    delete topicsDbState.updatedNotes[noteId];
  }
}

async function checkUpdatedNotes() {
  if (!topicsDbState.triliumUrl || !topicsDbState.triliumSecret) return;
  let noteIds = Object.keys(topicsDbState?.updatedNotes || {});
  if (!noteIds.length) return;

  let uploadedAny = false;
  for (let updatedNoteId of noteIds) {
    let entry = topicsDbState.updatedNotes[updatedNoteId];
    if (!entry) continue;
    let pending = pendingUploads.get(updatedNoteId);
    if (pending) {
      // unchanged since it went up — leave it masking dbNotes until a refresh confirms it
      if (syncedFieldsMatch(entry, pending.payload)) continue;
      pendingUploads.delete(updatedNoteId); // edited again, send the newer version now
    }
    let payload = $state.snapshot(entry);
    try {
      await fetch(topicsDbState.triliumUrl + '/custom/set-note', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          secret: topicsDbState.triliumSecret,
          noteId: updatedNoteId,
          content: payload.content,
          topics: payload.topics,
          isTodo: payload.isTodo,
          todoDone: payload.todoDone,
        })
      });
      console.log("Uploaded updated note: ", updatedNoteId);
      pendingUploads.set(updatedNoteId, {
        dateModified: topicsDbState.dbNotes?.[updatedNoteId]?.dateModified ?? null,
        at: Date.now(),
        payload,
      });
      uploadedAny = true;
    }
    catch (error) {
      console.error("Error uploading updated note: ", error);
    }
  }

  if (uploadedAny) {
    await sleep(1500);
    await refreshTopicsDb(); // reconcilePendingUploads runs at the end of refreshNotes
  } else if (pendingUploads.size) {
    // still masking an uploaded edit whose refresh never landed — poll for it
    await refreshTopicsDb();
  }
}

// resolves only once the whole refresh (including refreshNotes) is done, so callers
// can await the server copy actually landing in dbNotes
let refreshPromise = null;
function refreshTopicsDb() {
  if (refreshPromise) return refreshPromise;
  if (!topicsDbState.triliumUrl || !topicsDbState.triliumSecret) return Promise.resolve();
  refreshPromise = (async () => {
    try {
      const response = await fetch(topicsDbState.triliumUrl + '/custom/get-topic-notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          secret: topicsDbState.triliumSecret
        })
      });

      topicsDbState.topicsDb = await response.json();
      await refreshNotes();
    } catch (error) {
      console.error("Error fetching topicsDb: ", error);
    }
    finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

function isNoteStale(note) {
  let dbNote = topicsDbState.dbNotes[note.noteId];
  return !dbNote || dbNote.dateModified != note.dateModified;
}

async function fetchNote(noteId) {
  console.log("updated note: ", noteId);
  try {
    let noteResponse = await fetch(topicsDbState.triliumUrl + '/custom/get-note', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        secret: topicsDbState.triliumSecret,
        noteId: noteId
      })
    });
    return await noteResponse.json();
  } catch (error) {
    console.error("Error fetching note: ", error);
    return null;
  }
}

async function refreshNotes() {
  if (!topicsDbState.topicsDb) return;
  if (topicsDbState.dbNotes == null) topicsDbState.dbNotes = {};

  // collect first so dbNotes is written once, instead of re-rendering every list
  // between each round trip (a quicknote can also live under a topic, hence the Set)
  let staleNoteIds = new Set();
  for (let topicNote of (topicsDbState?.topicsDb?.children || [])) {
    for (let note of (topicNote.children || [])) {
      if (isNoteStale(note)) staleNoteIds.add(note.noteId);
    }
  }
  for (let note of (topicsDbState?.topicsDb?.quicknotes || [])) {
    if (isNoteStale(note)) staleNoteIds.add(note.noteId);
  }

  let fetched = [];
  for (let noteId of staleNoteIds) {
    let note = await fetchNote(noteId);
    if (note) fetched.push([noteId, note]);
  }

  for (let [noteId, note] of fetched) {
    topicsDbState.dbNotes[noteId] = note;
  }

  reconcilePendingUploads();
}

function resetDb() {
  topicsDbState.topicsDb = null;
  topicsDbState.dbNotes = null;
  topicsDbState.updatedNotes = {};
  topicsDbState.createdNotes = {};
  pendingUploads.clear();
}

export { topicsDbState, initialize, refreshTopicsDb, refreshNotes, getNotes, getQuicknotes, getQuicknoteIds, isPendingQuicknote, queueQuicknote, queueNoteUpdate, resetDb };
