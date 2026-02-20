<script>
  import {appState} from '$lib/appState.svelte.js';
  import {topicsDbState} from '$lib/topicsDb.svelte.js';
  import Editor from '$lib/editor.svelte';

  let note = $derived.by(() => {
    return topicsDbState.notes[appState.selectedNoteId];
  });

  function editHandler(content) {
    console.log("edit handler called", note?.noteId)
    if (!(note?.noteId)) return;

    if (topicsDbState.updatedNotes[note.noteId] == null) {
      topicsDbState.updatedNotes[note.noteId] = {
        content: content
      }
    } else {
      topicsDbState.updatedNotes[note.noteId].content = content;
    }
  }

</script>

<div class="card card-m">
  <div class="card-body">
    <div class="card-title text-2xl">{note?.title}</div>
    <Editor editHandler={editHandler} initialData={topicsDbState.updatedNotes[note?.noteId]?.content || note?.content} />
  </div>
</div>
