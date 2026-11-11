<script>
  import { appState } from "$lib/appState.svelte.js";
  import { topicsDbState, getNotes, queueNoteUpdate } from "$lib/topicsDb.svelte.js";
  import Editor from "$lib/editor.svelte";
  import dayjs from "dayjs";

  let humanReadableDate = $derived.by(() => {
    if (!note?.dateCreated) return "";
    return dayjs(note.dateCreated).format("MMMM D, YYYY");
  });
  let humanReadableTime = $derived.by(() => {
    if (!note?.dateCreated) return "";
    return dayjs(note.dateCreated).format("h:mm A");
  });

  let note = $derived.by(() => {
    let notes = getNotes();
    return notes[appState.selectedNoteId];
  });

  function editHandler(content) {
    if (!note?.noteId) return;

    if (topicsDbState.createdNotes[note.noteId]) {
      topicsDbState.createdNotes[note.noteId].content = content;
      return;
    }
    queueNoteUpdate(note.noteId, { content });
  }
</script>

<!-- No height/overflow here: #scrollContainer (layout) is the note page's only
     scroll box, so title, toolbar and text scroll together like a document.
     An overflow-hidden box here had scroll room a finger couldn't reach but
     CKEditor's caret-following could, which stranded the title (pb clears
     the floating button). -->
<div class="flex flex-col md:flex-row items-stretch md:items-start pb-28">
  <Editor {editHandler} initialData={note?.content} />
  <div class="prose m-2 order-first md:order-none w-full md:w-auto md:sticky md:top-0">
    <h1 class="mb-[-1em]">{note?.title}</h1>
    <h2 class="lowercase">
      <span>{humanReadableDate}</span>
      <span class="hidden md:inline"><br/></span>
      <span class="md:hidden"> · </span>
      <span>{humanReadableTime}</span>
    </h2>
    <div>
      {#each note?.topics as topic}
        <span class="badge badge-xl badge-primary mr-1">{topic}</span>
      {/each}
    </div>
  </div>
</div>
