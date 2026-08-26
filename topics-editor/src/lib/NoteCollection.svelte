<script>
  import NoteCard from '$lib/NoteCard.svelte';

  let { notes, onNoteClick, layout = 'vertical', cardComponent = NoteCard, onCardEdit, onCardMarkDone, isSelected, autoFocus = true } = $props();

  const layoutClasses = {
    vertical: 'flex flex-col gap-4',
    // compact single-row strip for horizontal scrollers (quicknote runs, portrait todos)
    horizontal: 'flex flex-row gap-2 min-w-0',
    // horizontal strip in portrait, vertical column in landscape (todos view)
    todoStrip: 'flex flex-row gap-2 md:flex-col md:gap-2',
    responsive: 'flex flex-col md:flex-row gap-4 md:flex-grow md:min-h-0',
    stripResponsive: 'grid grid-rows-2 grid-flow-col auto-cols-max items-start gap-1.5 md:flex md:flex-col md:items-stretch md:gap-1.5'
  };

  const cardClasses = {
    vertical: '',
    horizontal: 'flex-shrink-0 w-40',
    todoStrip: 'flex-shrink-0 w-40 md:w-full',
    responsive: 'md:flex-shrink-0 md:w-128',
    stripResponsive: 'flex-shrink-0 w-40 md:w-full'
  };

  let focusInitialized = false;
  $effect(() => {
    if (autoFocus && notes.length > 0 && !focusInitialized) {
      // don't steal focus from an active text input (e.g. the home
      // quicknote input) when its first submitted card appears
      if (document.activeElement?.tagName === 'INPUT') return;
      focusInitialized = true;
      document.getElementById('note_' + notes[0].noteId)?.focus();
    }
  });
</script>

<div class={layoutClasses[layout]}>
  {#each notes as note (note.noteId)}
    {@const Card = cardComponent}
    <Card
      note={note}
      class={cardClasses[layout]}
      selected={isSelected?.(note) ?? false}
      onclick={() => onNoteClick(note)}
      onedit={onCardEdit ? () => onCardEdit(note) : undefined}
      onmarkdone={onCardMarkDone ? () => onCardMarkDone(note) : undefined}
    />
  {/each}
</div>
