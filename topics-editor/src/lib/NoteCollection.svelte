<script>
  import NoteCard from '$lib/NoteCard.svelte';

  let { notes, onNoteClick, layout = 'vertical', cardComponent = NoteCard, onCardEdit, onCardMarkDone, isSelected } = $props();

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
  ? 'grid grid-rows-2 grid-flow-col auto-cols-max items-start gap-1.5 md:flex md:flex-col md:items-stretch md:gap-1.5'
  : 'flex flex-col gap-4'}>
  {#each notes as note (note.noteId)}
    {@const Card = cardComponent}
    <Card
      note={note}
      class={layout === 'horizontal' ? 'flex-shrink-0 w-128' : layout === 'responsive' ? 'md:flex-shrink-0 md:w-128' : layout === 'stripResponsive' ? 'flex-shrink-0 w-40 md:w-full' : ''}
      selected={isSelected?.(note) ?? false}
      onclick={() => onNoteClick(note)}
      onedit={onCardEdit ? () => onCardEdit(note) : undefined}
      onmarkdone={onCardMarkDone ? () => onCardMarkDone(note) : undefined}
    />
  {/each}
</div>
