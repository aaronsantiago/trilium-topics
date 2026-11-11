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

  let current = $derived(note?.topics ?? []);

  // A regular note always keeps at least one topic: when a topic loses its
  // last note, base/topic_collection.js deletes that topic note in Trilium,
  // which can take a note that lives only under it along. Quicknotes are
  // exempt (no topic = the Unsorted inbox).
  const LAST_TOPIC_HINT = 'A note needs at least one topic';

  function lockedOf(topic) {
    if (note?.quicknote) return '';
    return current.length === 1 && current[0] === topic ? LAST_TOPIC_HINT : '';
  }

  function stateOf(topic) {
    return current.includes(topic) ? 'all' : 'none';
  }

  function toggle(topic) {
    if (lockedOf(topic)) return;
    const topics = current.includes(topic)
      ? current.filter((t) => t !== topic)
      : [...current, topic];
    queueNoteUpdate(note.noteId, { topics });
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

  <TopicPicker {stateOf} {lockedOf} ontoggle={toggle} />


  <button type="button" class="btn btn-primary mt-2" onclick={onclose}>Done</button>
</div>
