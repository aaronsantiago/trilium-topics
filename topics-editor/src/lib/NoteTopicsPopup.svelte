<script>
  // Topic editor for the open note (note page). Each tap queues the change
  // right away, so the page's badges update immediately; the 5 s sync sends it
  // up with set-note (or create-note, for a note still in createdNotes).
  //
  // The caller only opens this once the note's content is loaded and it
  // isn't a quicknote still uploading (see canEditNoteTopics).
  import { queueNoteUpdate } from '$lib/topicsDb.svelte.js';
  import TopicPicker from '$lib/TopicPicker.svelte';

  let { note, onclose } = $props();

  // a topic whose removal would leave the note with none, awaiting confirmation
  let confirmRemove = $state(null);

  let current = $derived(note?.topics ?? []);

  function stateOf(topic) {
    return current.includes(topic) ? 'all' : 'none';
  }

  function setTopics(topics) {
    queueNoteUpdate(note.noteId, { topics });
  }

  function toggle(topic) {
    if (current.includes(topic)) {
      if (current.length === 1) {
        confirmRemove = topic;
        return;
      }
      setTopics(current.filter((t) => t !== topic));
    } else {
      setTopics([...current, topic]);
    }
    confirmRemove = null;
  }

  function removeLast() {
    setTopics(current.filter((t) => t !== confirmRemove));
    confirmRemove = null;
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<!-- tap outside to dismiss -->
<button
  type="button"
  class="fixed inset-0 z-30 bg-black/20 cursor-default"
  aria-label="Close topics"
  tabindex="-1"
  onclick={onclose}
></button>

<div
  id="noteTopicsPanel"
  class="not-prose fixed inset-x-0 top-0 z-40 max-h-[60vh] overflow-y-auto bg-base-100 shadow-xl border-b border-base-300 p-3 flex flex-col gap-2
         md:inset-x-auto md:top-4 md:right-4 md:w-72 md:rounded-box md:border"
  role="dialog"
  aria-label="Note topics"
>
  <div class="text-lg font-semibold">Topics</div>

  <TopicPicker {stateOf} ontoggle={toggle} disabled={confirmRemove !== null} />

  {#if confirmRemove}
    <div class="alert alert-warning flex flex-col items-stretch gap-2 text-sm" role="alert">
      <span>
        Remove <b>{confirmRemove}</b>, the note's last topic? It won't show on any topic page.
        If this is the last note in “{confirmRemove}”, Trilium deletes that topic.
      </span>
      <div class="flex gap-2 justify-end">
        <button type="button" class="btn btn-sm" onclick={() => (confirmRemove = null)}>Keep</button>
        <button type="button" class="btn btn-sm btn-error" onclick={removeLast}>Remove</button>
      </div>
    </div>
  {/if}

  <button type="button" class="btn btn-primary mt-2" onclick={onclose}>Done</button>
</div>
