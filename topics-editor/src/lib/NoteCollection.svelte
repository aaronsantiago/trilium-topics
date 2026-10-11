<script>
  import { tick } from 'svelte';
  import NoteCard from '$lib/NoteCard.svelte';
  import Isotope from 'isotope-layout';
  // registers the 'masonryHorizontal' layout mode (not included in isotope-layout itself)
  import 'isotope-masonry-horizontal';

  let { notes, onNoteClick, layout = 'vertical', cardComponent = NoteCard, onCardEdit, onCardToggleDone, isSelected, autoFocus = true } = $props();

  // masonryH geometry: masonryHorizontal lays items on a lane grid of
  // MASONRY_ROW_HEIGHT px — a card spans ceil(height / rowHeight) lanes and
  // is placed in the emptiest stretch of consecutive lanes, so cards of
  // varying heights (1–3 lines) interlock into true masonry rather than
  // equal rows. (A rowHeight >= tallest card height degenerates to
  // balanced equal rows, since every card then spans a single lane.)
  // The scroll wrapper (+page.svelte) is the 252px viewport; this
  // container follows its content area (h-full), which is 252px but shrinks
  // by the horizontal scrollbar's height when rows extend past the panel —
  // lane count = floor(contentArea / 6): 42 without the bar, 39 with it.
  const MASONRY_ROW_HEIGHT = 6;
  const MASONRY_GUTTER = 0;

  const layoutClasses = {
    vertical: 'flex flex-col gap-4',
    // compact single-row strip for horizontal scrollers (quicknote runs, portrait todos)
    horizontal: 'flex flex-row gap-2 min-w-0',
    // horizontal strip in portrait, vertical column in landscape (todos view)
    todoStrip: 'flex flex-row gap-2 md:flex-col md:gap-2',
    responsive: 'flex flex-col md:flex-row gap-4 md:flex-grow md:min-h-0',
    // masonry box in portrait (Isotope masonryHorizontal), vertical column
    // in landscape. h-full (NOT a fixed px): the wrapper is the 252px
    // viewport, but a horizontal scrollbar (when rows run past the panel)
    // eats ~15px of its content height — a fixed-height container would
    // overflow that by exactly the scrollbar's height. h-full follows the
    // content area, and the rAF self-heal below re-packs Isotope once the
    // scrollbar has appeared and the height has settled.
    masonryH: 'relative h-full md:h-auto md:flex md:flex-col md:items-stretch md:gap-1.5'
  };

  const cardClasses = {
    vertical: '',
    horizontal: 'flex-shrink-0 w-40',
    todoStrip: 'flex-shrink-0 w-40 md:w-full',
    responsive: 'md:flex-shrink-0 md:w-128',
    masonryH: 'flex-shrink-0 w-40 md:w-full'
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

  // masonryHorizontal (portrait only): one Isotope instance per section,
  // re-created whenever the card set or orientation changes. Outlayer's
  // initial layout is instant, so re-creation never flashes; subsequent
  // window-resize relayouts animate over transitionDuration.
  let containerEl = $state(null);
  let isPortrait = $state(false);

  $effect(() => {
    if (layout !== 'masonryH') return;
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => (isPortrait = !mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  });

  $effect(() => {
    if (layout !== 'masonryH' || !isPortrait || notes.length === 0) return;
    // track the card set and each card's content — card height is driven by
    // its content (1–3 line clamp) and a card's lane span is fixed at layout
    // time, so any content change (pending quicknote edit, 5s sync refresh)
    // must re-create the instance to recompute spans
    const noteKey = notes
      .map((n) => n.noteId + '|' + (n.content ?? ''))
      .join(';');
    let iso = null;
    let cancelled = false;
    tick().then(() => {
      if (cancelled || !containerEl || !document.contains(containerEl)) return;
      // Snap each item's height up to the next 6px lane multiple so a card
      // always fits the lane span Isotope computes for it. Card heights are
      // fractional (16.5px line boxes) and Isotope's span calc rounds when a
      // height lands within 1px of a grid multiple — which can assign a slot
      // shorter than the card, overflowing the box vertically. Measuring the
      // exact height (getBoundingClientRect, not offsetHeight) and rounding
      // the *item* up keeps span*6 >= card height exact; the leftover 0–6px
      // under each card is the natural masonry gap.
      for (const w of Array.from(containerEl.children)) {
        const h = (w.firstElementChild ?? w).getBoundingClientRect().height;
        w.style.height =
          Math.ceil(h / MASONRY_ROW_HEIGHT) * MASONRY_ROW_HEIGHT + 'px';
      }
      iso = new Isotope(containerEl, {
        layoutMode: 'masonryHorizontal',
        masonryHorizontal: {
          rowHeight: MASONRY_ROW_HEIGHT,
          gutter: MASONRY_GUTTER
        },
        transitionDuration: '0.2s'
      });
      // self-heal: re-measure after the browser has settled sizes. The
      // first pass measures before resizeContainer widens the container and
      // the horizontal scrollbar appears (which shrinks the h-full content
      // area by the bar's height) — this pass re-derives the lane count
      // from the settled height and re-packs. No visible change when
      // nothing moved (unmoved items are placed instantly).
      requestAnimationFrame(() => {
        if (!cancelled && iso) iso.layout();
      });
    });
    return () => {
      cancelled = true;
      iso?.destroy();
      // destroy() already clears Isotope's inline styles; belt and braces so
      // the CSS stack (md:) takes over cleanly on orientation changes
      if (containerEl) for (const el of containerEl.children) el.style.cssText = '';
    };
  });
</script>

<div bind:this={containerEl} class={layoutClasses[layout]}>
  {#each notes as note (note.noteId)}
    {@const Card = cardComponent}
    {#if layout === 'masonryH'}
      <!-- item wrapper: Isotope packs items edge-to-edge in x (the gutter
           option only spaces rows), so 3px side padding on the item yields
           the 6px horizontal gap between cards -->
      <div class="max-md:px-[3px]">
        <Card
          note={note}
          class={cardClasses[layout]}
          selected={isSelected?.(note) ?? false}
          onclick={() => onNoteClick(note)}
          onedit={onCardEdit ? () => onCardEdit(note) : undefined}
          ontoggledone={onCardToggleDone ? () => onCardToggleDone(note) : undefined}
        />
      </div>
    {:else}
      <Card
        note={note}
        class={cardClasses[layout]}
        selected={isSelected?.(note) ?? false}
        onclick={() => onNoteClick(note)}
        onedit={onCardEdit ? () => onCardEdit(note) : undefined}
        ontoggledone={onCardToggleDone ? () => onCardToggleDone(note) : undefined}
      />
    {/if}
  {/each}
</div>
