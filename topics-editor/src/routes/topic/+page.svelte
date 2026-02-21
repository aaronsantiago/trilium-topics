<script>
  import {appState} from '$lib/appState.svelte.js';
  import {topicsDbState} from '$lib/topicsDb.svelte.js';
  import { goto } from "$app/navigation";
  import { addInputListener } from "$lib/inputs.js";

  let notes = $derived.by(() => {
    let topicNotes = (topicsDbState.topicsDb?.children || []);

    let topicNote = topicNotes.find(note => note.title === appState.selectedTopic);
    if (!topicNote) {
      return [];
    }
    if (!topicsDbState.notes || topicsDbState.notes.length <= 0) {
      return [];
    }

    return topicNote.children.map(notePojo => {
      return topicsDbState.notes[notePojo.noteId];
    });
  });


  function navigateToNote(note) {
    appState.selectedNoteName = note.title;
    appState.selectedNoteId = note.noteId;
    goto(`/note`);
  }

  let highlightedNote = $derived.by(() => {
    return notes[appState.cursorState["topic_" + appState.selectedTopic] || 0];
  });

  $effect(() => {
    return addInputListener((e) => {
      if (e == "up") {
        appState.cursorState["topic_" + appState.selectedTopic] = Math.max((appState.cursorState["topic_" + appState.selectedTopic] || 0) - 1, 0);
        console.log("cursorState", appState.cursorState["topic_" + appState.selectedTopic]);
      } else if (e == "down") {
        appState.cursorState["topic_" + appState.selectedTopic] = Math.min((appState.cursorState["topic_" + appState.selectedTopic] || 0) + 1, notes.length - 1);
      } else if (e == "confirm") {
        navigateToNote(highlightedNote);
      } else if (e == "cancel") {
         goto(`/`);
      }
      const el = document.querySelector("#note_" + highlightedNote.noteId);
      if (!el) return;
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    });
  });

</script>

{#each notes as note}
  <div class="card card-m">
    <div id={"note_" + note.noteId} class={"card-body " + (highlightedNote == note ? "bg-secondary text-secondary-content" : "")}>
      <div class="card-title text-2xl" onclick={() => {navigateToNote(note)}}>{note.title}</div>
      {#if (topicsDbState && topicsDbState.updatedNotes && topicsDbState.updatedNotes[note.noteId])}
        {@html topicsDbState.updatedNotes[note.noteId].content}
      {:else}
        {@html note.content}
      {/if}
    </div>
  </div>
{/each}
