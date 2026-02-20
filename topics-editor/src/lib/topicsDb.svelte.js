import { get, set } from 'idb-keyval';

let topicsDbState = $state({
  triliumUrl: '',
  triliumSecret: '',
  topicsDb: null,
  notes: null
});

// load the initial values from idb
(async () => {
  topicsDbState.triliumUrl = await get('triliumUrl') || '';
  topicsDbState.triliumSecret = await get('triliumSecret') || '';
  topicsDbState.topicsDb = await get('topicsDb') || null;
  topicsDbState.notes = await get('notes') || null;
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
    topicsDbState.triliumUrl;
    topicsDbState.triliumSecret;

    refreshTopicsDb();
  });
}

async function refreshTopicsDb() {
  if (!topicsDbState.triliumUrl || !topicsDbState.triliumSecret) return;
  (async () => {
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
  })();
}

async function refreshNotes() {
  if (!topicsDbState.topicsDb) return;
  if (topicsDbState.notes == null) topicsDbState.notes = {};

  for (let topicNote of (topicsDbState?.topicsDb?.children || [])) {
    for (let note of topicNote.children) {
      if (!topicsDbState.notes[note.noteId] || topicsDbState.notes[note.noteId].dateModified != note.dateModified) {
        console.log("updated note: ", note.noteId);
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
      }
    }
  }
}

export { topicsDbState, initialize, refreshTopicsDb, refreshNotes };
