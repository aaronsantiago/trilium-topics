import { get, set } from 'idb-keyval';
import * as cheerio from 'cheerio';

let sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let topicsDbState = $state({
  triliumUrl: '',
  triliumSecret: '',
  topicsDb: null,
  notes: null,
  updatedNotes: null
});

// initialize topicsDb
(async () => {
  // load the initial values from idb
  topicsDbState.triliumUrl = await get('triliumUrl') || '';
  topicsDbState.triliumSecret = await get('triliumSecret') || '';
  topicsDbState.topicsDb = await get('topicsDb') || null;
  topicsDbState.notes = await get('notes') || null;
  topicsDbState.updatedNotes = await get('updatedNotes') || {};

  // set up an interval to attempt uploading updated notes 5 seconds
  setInterval(checkUpdatedNotes, 5000);
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
    if (topicsDbState.notes) set('notes', $state.snapshot(topicsDbState.notes));
  });

  $effect(() => {
    if (topicsDbState.updatedNotes) set('updatedNotes', $state.snapshot(topicsDbState.updatedNotes));
  });

  $effect(() => {
    topicsDbState.triliumUrl;
    topicsDbState.triliumSecret;

    refreshTopicsDb();
    checkUpdatedNotes();
  });
}

async function checkUpdatedNotes() {
  if (!topicsDbState.triliumUrl || !topicsDbState.triliumSecret) return;
  if (!topicsDbState.updatedNotes?.length) return;

  let updatedNotesToDelete = []
  for (let updatedNoteId in topicsDbState.updatedNotes) {
    console.log("found updated note", updatedNoteId);
    try {
      await fetch(topicsDbState.triliumUrl + '/custom/set-note', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          secret: topicsDbState.triliumSecret,
          noteId: updatedNoteId,
          content: topicsDbState.updatedNotes[updatedNoteId].content,
        })
      });
      console.log("Uploaded updated note: ", updatedNoteId);
      updatedNotesToDelete.push(updatedNoteId);
    }
    catch (error) {
      console.error("Error uploading updated note: ", error);
    }
  }

  for (let noteId of updatedNotesToDelete) {
    delete topicsDbState.updatedNotes[noteId];
  }
  if (updatedNotesToDelete?.length > 0) {
    await sleep(1500);
    refreshTopicsDb();
  }
}
let isRefreshing = false;
async function refreshTopicsDb() {
  if (isRefreshing) return;
  isRefreshing = true;
  console.log("refreshing db");
  if (!topicsDbState.triliumUrl || !topicsDbState.triliumSecret){
    isRefreshing = false;
    return;
  };
  (async () => {
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
      refreshNotes();
    } catch (error) {
      console.error("Error fetching topicsDb: ", error);
    }
    finally {
      isRefreshing = false;
    }
  })();
}

async function refreshNotes() {
  if (!topicsDbState.topicsDb) return;
  if (topicsDbState.notes == null) topicsDbState.notes = {};

  for (let topicNote of (topicsDbState?.topicsDb?.children || [])) {
    for (let note of topicNote.children) {
      if (!topicsDbState.notes[note.noteId] || topicsDbState.notes[note.noteId].dateModified != note.dateModified) {
        console.log("updated note: ", note.noteId);
        try {
          let noteResponse = await fetch(topicsDbState.triliumUrl + '/custom/get-note', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              secret: topicsDbState.triliumSecret,
              noteId: note.noteId
            })
          });
          topicsDbState.notes[note.noteId] = await noteResponse.json();

        } catch (error) {
          console.error("Error fetching note: ", error);
        }
      }
    }
  }
}

export { topicsDbState, initialize, refreshTopicsDb, refreshNotes };
