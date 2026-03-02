<script>
  import NoteCard from '$lib/NoteCard.svelte';

  let { notes, onNoteClick, layout = 'vertical' } = $props();

  let focusInitialized = false;
  $effect(() => {
    if (notes.length > 0 && !focusInitialized) {
      focusInitialized = true;
      document.getElementById('note_' + notes[0].noteId)?.focus();
    }
  });
</script>

<div class={layout === 'horizontal'
  ? 'flex flex-row gap-4 flex-grow min-h-0'
  : 'flex flex-col gap-4'}>
  {#each notes as note}
    <NoteCard
      note={note}
      class={layout === 'horizontal' ? 'flex-shrink-0 w-128' : ''}
      onclick={() => onNoteClick(note)}
    />
  {/each}
</div>
