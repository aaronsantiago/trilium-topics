<script>
  import {appState} from '$lib/appState.svelte.js';
  import {topicsDbState} from '$lib/topicsDb.svelte.js';
  import { goto } from "$app/navigation";

  let notes = $derived.by(() => {
    let topicNotes = (topicsDbState.topicsDb?.children || []);

    let topicNote = topicNotes.find(note => note.title === appState.selectedTopic);
    if (!topicNote) {
      return [];
    }

    return topicNote.children.map(notePojo => {
      return topicsDbState.notes[notePojo.noteId];
    });
  });


  function navigateToTopic(note) {
    appState.selectedNoteName = note.title;
    appState.selectedNoteId = note.noteId;
    goto(`/note`);
  }

</script>

{#each notes as note}
  <div class="card card-m">
    <div class="card-body">
      <div class="card-title text-2xl" onclick={() => {navigateToTopic(note)}}>{note.title}</div>
      {#if (topicsDbState && topicsDbState.updatedNotes[note.noteId])}
        {@html topicsDbState.updatedNotes[note.noteId].content}
      {:else}
        {@html note.content}
      {/if}
    </div>
  </div>
{/each}
