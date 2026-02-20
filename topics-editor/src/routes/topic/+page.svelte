<script>
  import {appState} from '$lib/appState.svelte.js';
  import {topicsDbState} from '$lib/topicsDb.svelte.js';

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

</script>

{#each notes as note}
  <div class="card card-m">
    <div class="card-body">
      <div class="card-title text-2xl">{note.title}</div>
      {@html note.content}
    </div>
  </div>
{/each}
