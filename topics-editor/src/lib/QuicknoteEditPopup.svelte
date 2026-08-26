<script>
  import { topicsDbState, queueNoteUpdate } from '$lib/topicsDb.svelte.js';
  import { untrack } from 'svelte';

  let { notes, onclose } = $props();

  // noteId -> { topics: string[], isTodo: boolean }, staged until commit()
  let staged = $state({});

  let topics = $derived.by(() => (topicsDbState.topicsDb?.children || []).map((t) => t.title));
  let selectedIds = $derived(notes.map((n) => n.noteId));

  // seed staged entries for newly selected notes, drop deselected ones
  $effect(() => {
    const incoming = notes.map((n) => ({
      noteId: n.noteId,
      topics: [...(n.topics ?? [])],
      isTodo: !!n.isTodo,
    }));

    // untrack so reading/writing staged here doesn't retrigger this effect
    untrack(() => {
      for (const n of incoming) {
        if (!staged[n.noteId]) staged[n.noteId] = { topics: n.topics, isTodo: n.isTodo };
      }
      const keep = new Set(incoming.map((n) => n.noteId));
      for (const id of Object.keys(staged)) {
        if (!keep.has(id)) delete staged[id];
      }
    });
  });

  // 'all' | 'some' | 'none' across the current selection
  function tristate(predicate) {
    if (selectedIds.length === 0) return 'none';
    const hits = selectedIds.filter((id) => staged[id] && predicate(staged[id])).length;
    if (hits === selectedIds.length) return 'all';
    return hits > 0 ? 'some' : 'none';
  }

  function topicState(topic) {
    return tristate((s) => s.topics.includes(topic));
  }

  function todoState() {
    return tristate((s) => s.isTodo);
  }

  function toggleTopic(topic) {
    const removing = topicState(topic) === 'all';
    for (const id of selectedIds) {
      const s = staged[id];
      if (!s) continue;
      if (removing) {
        s.topics = s.topics.filter((t) => t !== topic);
      } else if (!s.topics.includes(topic)) {
        s.topics = [...s.topics, topic];
      }
    }
  }

  function toggleTodo() {
    const value = todoState() !== 'all';
    for (const id of selectedIds) {
      if (staged[id]) staged[id].isTodo = value;
    }
  }

  export function commit() {
    for (const id of Object.keys(staged)) {
      const s = staged[id];
      queueNoteUpdate(id, {
        topics: $state.snapshot(s.topics),
        isTodo: s.isTodo,
        ...(s.isTodo ? {} : { todoDone: false }),
      });
    }
    onclose();
  }
</script>

<div
  id="quicknoteEditPanel"
  class="fixed inset-x-0 top-0 z-40 max-h-[45vh] overflow-y-auto bg-base-100 shadow-xl border-b border-base-300 p-3 flex flex-col gap-2
         md:static md:inset-auto md:z-auto md:max-h-none md:h-full md:w-72 md:shrink-0 md:order-3 md:border-b-0 md:border-l"
>
  <div class="text-lg font-semibold">
    Edit {selectedIds.length} quicknote{selectedIds.length === 1 ? '' : 's'}
  </div>

  <div
    class="outline-none transition-transform focus:scale-[1.02] focus:shadow-xl rounded px-2 py-1 cursor-pointer"
    tabindex="0"
    role="button"
    data-action="todo-toggle"
    onclick={toggleTodo}
  >
    Todo
    {#if todoState() === 'all'}<span class="badge badge-primary ml-1">✓</span>
    {:else if todoState() === 'some'}<span class="badge badge-ghost ml-1">–</span>{/if}
  </div>

  <div class="flex flex-col gap-1">
    <div class="text-sm opacity-60">Topics</div>
    {#each topics as topic}
      {@const selection = topicState(topic)}
      <div
        class="outline-none transition-transform focus:scale-[1.02] focus:shadow-xl rounded px-2 py-1 cursor-pointer"
        tabindex="0"
        role="button"
        data-edit-topic={topic}
        onclick={() => toggleTopic(topic)}
      >
        {topic}
        {#if selection === 'all'}<span class="badge badge-primary ml-1">✓</span>
        {:else if selection === 'some'}<span class="badge badge-ghost ml-1">–</span>{/if}
      </div>
    {/each}
  </div>

  <button
    class="btn btn-primary mt-2 outline-none transition-transform focus:scale-[1.02]"
    tabindex="0"
    onclick={commit}
  >Done</button>
</div>
