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
  : layout === 'responsive'
  ? 'flex flex-col md:flex-row gap-4 md:flex-grow md:min-h-0'
  : layout === 'stripResponsive'
  ? 'flex flex-row md:flex-col gap-3'
  : 'flex flex-col gap-4'}>
  {#each notes as note}
    <NoteCard
      note={note}
      class={layout === 'horizontal' ? 'flex-shrink-0 w-128' : layout === 'responsive' ? 'md:flex-shrink-0 md:w-128' : layout === 'stripResponsive' ? 'flex-shrink-0 w-56 md:w-full' : ''}
      onclick={() => onNoteClick(note)}
    />
  {/each}
</div>
