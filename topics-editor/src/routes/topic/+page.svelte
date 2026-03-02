<script>
  import {appState} from '$lib/appState.svelte.js';
  import {getNotes} from '$lib/topicsDb.svelte.js';
  import { goto } from "$app/navigation";
  import { addInputListener } from "$lib/inputs.js";
  import { getNextFocus } from '@bbc/tv-lrud-spatial';
  import NoteCollection from '$lib/NoteCollection.svelte';
  import dayjs from 'dayjs';

  let notes = $derived.by(() => {
    let allNotes = getNotes();
    if (!allNotes || Object.keys(allNotes).length <= 0) {
      return [];
    }

    return Object.values(allNotes)
      .filter(notePojo => notePojo?.topics?.includes(appState.selectedTopic))
      .sort((a, b) => dayjs(b.dateCreated).valueOf() - dayjs(a.dateCreated).valueOf());
  });

  function navigateToNote(note) {
    appState.selectedNoteName = note.title;
    appState.selectedNoteId = note.noteId;
    goto(`/note`);
  }

  const directionMap = {
    up: 'ArrowUp', down: 'ArrowDown',
    left: 'ArrowLeft', right: 'ArrowRight'
  };

  $effect(() => {
    return addInputListener((e) => {
      if (directionMap[e]) {
        const next = getNextFocus(document.activeElement, directionMap[e]);
        if (next) {
          next.focus();
          next.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      } else if (e === 'confirm') {
        const noteId = document.activeElement?.dataset?.noteId;
        if (noteId) {
          const note = notes.find(n => n.noteId === noteId);
          if (note) navigateToNote(note);
        }
      } else if (e === 'cancel') {
        goto(`/`);
      }
    });
  });


</script>

<NoteCollection notes={notes} onNoteClick={navigateToNote} />
