<script>
  import { appState } from "$lib/appState.svelte.js";
  import { topicsDbState, getNotes, queueNoteUpdate, isPendingQuicknote } from "$lib/topicsDb.svelte.js";
  import Editor from "$lib/editor.svelte";
  import NoteTopicsPopup from "$lib/NoteTopicsPopup.svelte";
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

  let topicsOpen = $state(false);

  // set-note always overwrites the content, so a topic change needs the
  // content loaded locally (otherwise the queued update would carry
  // content: undefined). Quicknotes still in the createdNotes queue go up
  // via index-create, which ignores topics.
  let topicsBlockedReason = $derived.by(() => {
    if (note && isPendingQuicknote(note.noteId)) return "Quicknote still uploading";
    if (note?.content == null) return "Loading note…";
    return "";
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
     scroll box, so title and text scroll together like a document (the
     toolbar is sticky against it, see editor.svelte).
     An overflow-hidden box here had scroll room a finger couldn't reach but
     CKEditor's caret-following could, which stranded the title (pb clears
     the floating button). -->
<div class="flex flex-col md:flex-row items-stretch md:items-start pb-28">
  <Editor {editHandler} initialData={note?.content} />
  <!-- no w-full: with m-2 it was 100% + 16px wide and panned the page sideways;
       the flex column stretches it to fit instead. md:z-20: sticky makes a
       stacking context, so the topics popup (z-40) inside it only beats the
       pinned toolbar (z-10) if the panel itself does -->
  <div class="prose m-2 order-first md:order-none md:sticky md:top-0 md:z-20">
    <h1 class="mb-[-1em]">{note?.title}</h1>
    <h2 class="lowercase">
      <span>{humanReadableDate}</span>
      <span class="hidden md:inline"><br/></span>
      <span class="md:hidden"> · </span>
      <span>{humanReadableTime}</span>
    </h2>
    <div id="noteTopics" class="flex flex-wrap items-center gap-1">
      {#each note?.topics ?? [] as topic (topic)}
        <span class="badge badge-xl badge-primary">{topic}</span>
      {/each}
      <button
        type="button"
        class="btn btn-sm btn-soft btn-primary not-prose"
        aria-label="Edit topics"
        title={topicsBlockedReason || "Edit topics"}
        disabled={!!topicsBlockedReason}
        onclick={() => (topicsOpen = true)}
      >✎ Topics</button>
      {#if topicsBlockedReason}
        <span class="text-xs opacity-60">{topicsBlockedReason}</span>
      {/if}
    </div>
    {#if topicsOpen && !topicsBlockedReason}
      <NoteTopicsPopup {note} onclose={() => (topicsOpen = false)} />
    {/if}
  </div>
</div>
