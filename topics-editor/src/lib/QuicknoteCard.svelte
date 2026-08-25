<script>
  import { topicsDbState } from '$lib/topicsDb.svelte.js';
  import dayjs from 'dayjs';

  let { note, onclick, class: className = '' } = $props();

  let content = $derived(
    topicsDbState?.updatedNotes?.[note.noteId]?.content ?? note.content
  );

  let timestamp = $derived(
    note?.dateCreated ? dayjs(note.dateCreated).format('MMM D, h:mm A') : ''
  );
</script>

<div
  class="overflow-hidden card bg-base-100 shadow-sm group outline-none transition-transform focus:scale-[1.02] focus:shadow-xl {className}"
  id={"note_" + note.noteId}
  tabindex="0"
  data-note-id={note.noteId}
  {onclick}
>
  <div class="min-h-0 overflow-hidden card-body p-2.5 gap-1 wrap-break-word">
    <div class="text-[11px] leading-none opacity-50 shrink-0">{timestamp}</div>
    <div class="overflow-hidden line-clamp-3 text-xs leading-snug [&_img]:hidden [&_figure]:hidden">
      {#if content?.trim()}
        {@html content}
      {:else}
        <span class="italic opacity-40">Empty note</span>
      {/if}
    </div>
  </div>
</div>
