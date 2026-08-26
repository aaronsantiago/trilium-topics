<script>
  import {appState} from '$lib/appState.svelte.js';
  import {getNotes, queueNoteUpdate} from '$lib/topicsDb.svelte.js';
  import { goto } from "$app/navigation";
  import { addInputListener } from "$lib/inputs.js";
  import { getNextFocus } from '@bbc/tv-lrud-spatial';
  import { tick } from "svelte";
  import dayjs from 'dayjs';
  import NoteCollection from '$lib/NoteCollection.svelte';
  import NoteCard from '$lib/NoteCard.svelte';
  import QuicknoteCard from '$lib/QuicknoteCard.svelte';
  import QuicknoteEditPopup from '$lib/QuicknoteEditPopup.svelte';

  let topicNotes = $derived.by(() => {
    let allNotes = getNotes();
    if (!allNotes || Object.keys(allNotes).length <= 0) {
      return [];
    }

    return Object.values(allNotes)
      .filter(notePojo => notePojo?.topics?.includes(appState.selectedTopic))
      .sort((a, b) => dayjs(b.dateCreated).valueOf() - dayjs(a.dateCreated).valueOf());
  });

  // the todos view is a separate projection of the same notes: opens first, dones last,
  // each group in date order — independent of where they sit in the timeline below
  let todos = $derived.by(() =>
    topicNotes
      .filter(note => note.isTodo)
      .sort((a, b) =>
        ((a.todoDone ? 1 : 0) - (b.todoDone ? 1 : 0)) ||
        dayjs(b.dateCreated).valueOf() - dayjs(a.dateCreated).valueOf())
  );

  // timeline in date order; consecutive quicknotes collapse into horizontal scrollers
  // that run until the next regular note
  let timelineItems = $derived.by(() => {
    const items = [];
    for (const note of topicNotes) {
      if (note.quicknote) {
        const last = items[items.length - 1];
        if (last?.type === 'quicknotes') {
          last.notes.push(note);
        } else {
          items.push({ type: 'quicknotes', notes: [note] });
        }
      } else {
        items.push({ type: 'note', note });
      }
    }
    return items;
  });

  function navigateToNote(note) {
    appState.selectedNoteName = note.title;
    appState.selectedNoteId = note.noteId;
    goto(`/note`);
  }

  let editingIds = $state([]);
  let editorOpen = $derived(editingIds.length > 0);
  let editingNotes = $derived.by(() => {
    const allNotes = getNotes();
    return editingIds.map((id) => allNotes[id]).filter(Boolean);
  });
  let editPanel = $state(null);

  function toggleEditing(noteId) {
    if (!noteId) return;
    editingIds = editingIds.includes(noteId)
      ? editingIds.filter((id) => id !== noteId)
      : [...editingIds, noteId];
  }

  async function closeQuicknoteEditor() {
    editingIds = [];
    // the panel (which held focus) unmounts — put focus back on the page
    await tick();
    const target = document.querySelector("[data-note-id]");
    target?.focus();
  }

  // done todos stay in their lists (they just move to the "dones" group), so the
  // keyed each keeps the focused DOM node in place and no focus hand-off is needed
  function markTodoDone(noteId) {
    queueNoteUpdate(noteId, { todoDone: true });
  }

  const directionMap = {
    up: 'ArrowUp', down: 'ArrowDown',
    left: 'ArrowLeft', right: 'ArrowRight'
  };

  const focusIsInEditPanel = () =>
    !!document.activeElement?.closest('#quicknoteEditPanel');

  $effect(() => {
    return addInputListener((e) => {
      if (directionMap[e]) {
        const next = getNextFocus(document.activeElement, directionMap[e]);
        if (next) {
          next.focus();
          next.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      } else if (e === 'confirm') {
        if (focusIsInEditPanel()) {
          document.activeElement?.click();
          return;
        }
        const noteId = document.activeElement?.dataset?.noteId;
        if (noteId) {
          const note = getNotes()[noteId];
          // while editing, confirm adds/removes quicknotes from the selection
          if (editorOpen && note?.quicknote) {
            toggleEditing(noteId);
            return;
          }
          if (note) navigateToNote(note);
        } else {
          document.activeElement?.click();
        }
      } else if (e === 'special') {
        // focus may sit on a sub-element (e.g. the checkbox) rather than the card
        const noteId = document.activeElement?.dataset?.noteId
          ?? document.activeElement?.closest('[data-note-id]')?.dataset?.noteId;
        if (noteId) {
          const note = getNotes()[noteId];
          if (note?.quicknote) toggleEditing(noteId);
        }
      } else if (e === 'cancel') {
        if (editorOpen) editPanel?.commit();
        else goto(`/`);
      } else if (e === 'r1') {
        const noteId = document.activeElement?.dataset?.noteId
          ?? document.activeElement?.closest('[data-note-id]')?.dataset?.noteId;
        if (noteId) {
          const note = getNotes()[noteId];
          if (note?.isTodo && !note?.todoDone) markTodoDone(noteId);
        }
      }
    });
  });

  let focusInitialized = false;
  $effect(() => {
    if (focusInitialized) return;
    const first =
      (todos.length > 0 ? todos[0] : null) ??
      (timelineItems.length > 0 && timelineItems[0].type === 'note'
        ? timelineItems[0].note
        : null) ??
      (timelineItems.length > 0 && timelineItems[0].type === 'quicknotes'
        ? timelineItems[0].notes[0]
        : null);
    if (first) {
      focusInitialized = true;
      document.getElementById('note_' + first.noteId)?.focus();
    }
  });

</script>

<div class="flex flex-col md:flex-row w-full h-full bg-base-200">
  {#if todos.length > 0}
    <div
      class="order-1 flex flex-col gap-2 p-4 shrink-0 md:p-0 md:pl-4 md:w-72 md:h-full"
      class:lrud-ignore={editorOpen}
      inert={editorOpen}
    >
      <div class="text-xl font-semibold px-2 opacity-60">Todos</div>
      <div class="overflow-x-auto md:overflow-x-hidden md:overflow-y-auto md:flex-1 md:min-h-0">
        <NoteCollection
          notes={todos}
          layout="todoStrip"
          cardComponent={QuicknoteCard}
          autoFocus={false}
          onNoteClick={(note) =>
            editorOpen ? toggleEditing(note.noteId) : navigateToNote(note)}
          onCardEdit={(note) => toggleEditing(note.noteId)}
          onCardMarkDone={(note) => markTodoDone(note.noteId)}
          isSelected={(note) => editingIds.includes(note.noteId)}
        />
      </div>
    </div>
  {/if}

  <div
    class="order-2 flex-1 min-h-0 flex flex-col gap-4 bg-base-300 p-4 rounded-lg overflow-y-auto md:h-full"
    class:lrud-ignore={editorOpen}
    inert={editorOpen}
  >
    <div class="text-xl font-semibold px-2 opacity-60 shrink-0">{appState.selectedTopic}</div>
    {#each timelineItems as item (item.type === 'note'
      ? item.note.noteId
      : 'qn_' + item.notes[0].noteId + '_' + item.notes.length)}
      {#if item.type === 'note'}
        <NoteCard note={item.note} onclick={() => navigateToNote(item.note)} />
      {:else}
        <div class="overflow-x-auto shrink-0">
          <NoteCollection
            notes={item.notes}
            layout="horizontal"
            cardComponent={QuicknoteCard}
            autoFocus={false}
            onNoteClick={(note) =>
              editorOpen ? toggleEditing(note.noteId) : navigateToNote(note)}
            onCardEdit={(note) => toggleEditing(note.noteId)}
            onCardMarkDone={(note) => markTodoDone(note.noteId)}
            isSelected={(note) => editingIds.includes(note.noteId)}
          />
        </div>
      {/if}
    {/each}
    {#if timelineItems.length === 0}
      <div class="opacity-40 p-4 shrink-0">No notes in this topic</div>
    {/if}
  </div>

  {#if editingNotes.length > 0}
    <QuicknoteEditPopup
      bind:this={editPanel}
      notes={editingNotes}
      onclose={closeQuicknoteEditor}
    />
  {/if}
</div>
