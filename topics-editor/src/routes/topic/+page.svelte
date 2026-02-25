<script>
  import {appState} from '$lib/appState.svelte.js';
  import {topicsDbState, getNotes} from '$lib/topicsDb.svelte.js';
  import { goto } from "$app/navigation";
  import { addInputListener } from "$lib/inputs.js";
  import { getNextFocus } from '@bbc/tv-lrud-spatial';
  import dayjs from 'dayjs';

  let notes = $derived.by(() => {
    let allNotes = getNotes();
    if (!allNotes || Object.keys(allNotes).length <= 0) {
      return [];
    }

    return Object.values(allNotes)
      .filter(notePojo => notePojo?.topics?.includes(appState.selectedTopic))
      .sort((a, b) => dayjs(b.createdTime).valueOf() - dayjs(a.createdTime).valueOf());
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

  let focusInitialized = false;
  $effect(() => {
    if (notes.length > 0 && !focusInitialized) {
      focusInitialized = true;
      document.getElementById('note_' + notes[0].noteId)?.focus();
    }
  });

</script>

{#each notes as note}
  <div
    class="card card-m group outline-none"
    id={"note_" + note.noteId}
    tabindex="0"
    data-note-id={note.noteId}
    onclick={() => navigateToNote(note)}
  >
    <div class="card-body group-focus:bg-secondary group-focus:text-secondary-content">
      <div class="card-title text-2xl">{note.title}</div>
      {#if (topicsDbState && topicsDbState.updatedNotes && topicsDbState.updatedNotes[note.noteId])}
        {@html topicsDbState.updatedNotes[note.noteId].content}
      {:else}
        {@html note.content}
      {/if}
    </div>
  </div>
{/each}
