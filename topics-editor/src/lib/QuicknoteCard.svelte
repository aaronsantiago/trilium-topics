<script>
  import { topicsDbState } from '$lib/topicsDb.svelte.js';
  import dayjs from 'dayjs';

  let { note, onclick, onedit, ontoggledone, selected = false, class: className = '' } = $props();

  let content = $derived(
    topicsDbState?.updatedNotes?.[note.noteId]?.content ?? note.content
  );

  let timestamp = $derived(
    note?.dateCreated ? dayjs(note.dateCreated).format('MMM D, h:mm A') : ''
  );

  let done = $derived(!!(note.isTodo && note.todoDone));

  function toggleDone(e) {
    e.stopPropagation();
    ontoggledone?.();
  }

  function handleEdit(e) {
    e.stopPropagation();
    onedit?.();
  }
</script>

<div
  class="overflow-hidden card bg-base-100 shadow-sm group outline-none transition-transform focus:scale-[1.02] focus:shadow-xl {selected ? 'ring-2 ring-primary' : ''} {done ? 'opacity-70' : ''} {className}"
  id={"note_" + note.noteId}
  tabindex="0"
  data-note-id={note.noteId}
  {onclick}
>
  <div class="min-h-0 overflow-hidden card-body p-2.5 gap-1 wrap-break-word">
    <div class="flex items-center justify-between gap-1 shrink-0">
      <div class="text-[11px] leading-none opacity-50">{timestamp}</div>
      <div class="flex items-center gap-1.5">
        {#if note.isTodo}
          <input
            type="checkbox"
            class="checkbox checkbox-xs"
            checked={!!note.todoDone}
            onclick={toggleDone}
            aria-label={done ? 'Unmark todo done' : 'Mark todo done'}
          />
        {/if}
        <button
          type="button"
          class="opacity-40 hover:opacity-100 shrink-0"
          onclick={handleEdit}
          aria-label="Edit quicknote"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
            <path d="M12 20h9"/>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="overflow-hidden line-clamp-3 text-xs leading-snug [&_img]:hidden [&_figure]:hidden">
      {#if content?.trim()}
        {@html content}
      {:else}
        <span class="italic opacity-40">Empty note</span>
      {/if}
    </div>
  </div>
</div>
