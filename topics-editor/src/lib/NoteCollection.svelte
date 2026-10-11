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
  // varying heights interlock into true masonry rather than equal rows.
  // The container height is set inline (below) to the snapped tallest card
  // height, floored at MASONRY_MIN_HEIGHT: cards show their full content,
  // and Isotope clamps a card's lane span to the lane count
  // (floor(containerHeight / rowHeight)), so a box shorter than the tallest
  // card would clip it — and a box exactly as tall as the tallest card
  // gives every card its own column (flat row), since cards stack down a
  // column before wrapping.
  const MASONRY_ROW_HEIGHT = 6;
  const MASONRY_GUTTER = 0;
  // constant empty band reserved below each card so the vertical gap between
  // stacked cards has a guaranteed minimum (a tighter lane leftover would let
  // a neighbour's background paint over the 2px selection ring)
  const MASONRY_ROW_GAP = 4;
  // minimum vertical space per section: the lane count comes from the
  // container height and cards stack down a column before wrapping, so the
  // box height is how many cards fit in one column. A box only as tall as
  // the tallest card would flatten every section into a row.
  const MASONRY_MIN_HEIGHT = 252;

  const layoutClasses = {
    vertical: 'flex flex-col gap-4',
    // compact single-row strip for horizontal scrollers (quicknote runs, portrait todos)
    horizontal: 'flex flex-row gap-2 min-w-0',
    // horizontal strip in portrait, vertical column in landscape (todos view)
    todoStrip: 'flex flex-row gap-2 md:flex-col md:gap-2',
    responsive: 'flex flex-col md:flex-row gap-4 md:flex-grow md:min-h-0',
    // masonry box in portrait (Isotope masonryHorizontal), vertical column
    // in landscape. The effect below sets an inline height for portrait
    // (the snapped tallest card, floored at MASONRY_MIN_HEIGHT, so
    // full-content cards are never clipped and short cards can stack);
    // h-full is only the pre-JS fallback (the wrapper has no fixed height
    // — it wraps the box).
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
    // its full content and a card's lane span is fixed at layout time, so
    // any content change (pending quicknote edit, 5s sync refresh) must
    // re-create the instance to recompute spans
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
      // the *item* up keeps span*6 >= card height exact. The gap is folded
      // INTO the snap (ceil((h+GAP)/6)*6, not ceil(h/6)*6+GAP — Isotope's
      // span is derived from the item height, so a band added after the snap
      // wouldn't change the lanes) — this leaves a constant MASONRY_ROW_GAP
      // band under the card, so the visual gap between stacked cards is
      // 4–10px, always enough for the 2px selection ring to clear a
      // neighbour's background.
      let maxCardH = 0;
      for (const w of Array.from(containerEl.children)) {
        const h = (w.firstElementChild ?? w).getBoundingClientRect().height;
        maxCardH = Math.max(maxCardH, h);
        w.style.height =
          Math.ceil((h + MASONRY_ROW_GAP) / MASONRY_ROW_HEIGHT) *
          MASONRY_ROW_HEIGHT + 'px';
      }
      // size the box to the snapped tallest card (see the lane-span clamp
      // note above) — the wrapper has no fixed height, so the box is the
      // thing that must fit its content — floored at MASONRY_MIN_HEIGHT so
      // short cards have room to stack in a column before wrapping
      const snappedMax =
        Math.ceil((maxCardH + MASONRY_ROW_GAP) / MASONRY_ROW_HEIGHT) *
        MASONRY_ROW_HEIGHT;
      containerEl.style.height =
        Math.max(snappedMax, MASONRY_MIN_HEIGHT) + 'px';
      iso = new Isotope(containerEl, {
        layoutMode: 'masonryHorizontal',
        masonryHorizontal: {
          rowHeight: MASONRY_ROW_HEIGHT,
          gutter: MASONRY_GUTTER
        },
        transitionDuration: '0.2s'
      });
      // self-heal: re-pack once the browser has settled sizes (late fonts,
      // slow images). No visible change when nothing moved (unmoved items
      // are placed instantly).
      requestAnimationFrame(() => {
        if (!cancelled && iso) iso.layout();
      });
    });
    return () => {
      cancelled = true;
      iso?.destroy();
      // destroy() already clears Isotope's inline styles; belt and braces so
      // the CSS stack (md:) takes over cleanly on orientation changes
      if (containerEl) {
        containerEl.style.height = '';
        for (const el of containerEl.children) el.style.cssText = '';
      }
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
