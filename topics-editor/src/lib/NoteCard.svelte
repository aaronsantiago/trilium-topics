<script>
  import { topicsDbState } from '$lib/topicsDb.svelte.js';

  let { note, onclick, class: className = '' } = $props();

  let content = $derived(
    topicsDbState?.updatedNotes?.[note.noteId]?.content ?? note.content
  );
</script>

<div
  class="overflow-hidden card bg-base-100 shadow-sm group outline-none transition-transform focus:scale-[1.02] focus:shadow-xl {className}"
  id={"note_" + note.noteId}
  tabindex="0"
  data-note-id={note.noteId}
  {onclick}
>
  <div class="min-h-0 overflow-hidden card-body wrap-break-word">
    <div class="card-title text-xl">{note.title}</div>
    {#if note.topics?.length > 0}
      <div class="text-sm opacity-60">{note.topics[0]}</div>
    {/if}
    <div class="overflow-hidden [&_p]:my-0.5 [&_li]:my-0 prose">
      {@html content}
    </div>
  </div>
</div>
