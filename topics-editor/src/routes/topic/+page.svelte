<script>
  import {appState} from '$lib/appState.svelte.js';
  import {getNotes, queueNoteUpdate} from '$lib/topicsDb.svelte.js';
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
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

  function createNoteInTopic() {
    appState.createSeedTopics = [appState.selectedTopic];
    appState.createReturnTo = '/topic';
    goto(base + '/create');
  }

  let editingIds = $state([]);
  let editorOpen = $derived(editingIds.length > 0);
  let editingNotes = $derived.by(() => {
    const allNotes = getNotes();
    return editingIds.map((id) => allNotes[id]).filter(Boolean);
  });

  function toggleEditing(noteId) {
    if (!noteId) return;
    editingIds = editingIds.includes(noteId)
      ? editingIds.filter((id) => id !== noteId)
      : [...editingIds, noteId];
  }

  function closeQuicknoteEditor() {
    editingIds = [];
  }

  function toggleTodoDone(noteId) {
    const note = getNotes()[noteId];
    if (!note?.isTodo) return;
    queueNoteUpdate(noteId, { todoDone: !note.todoDone });
  }
</script>

<div class="flex flex-col md:flex-row w-full h-full bg-base-200">
  {#if todos.length > 0}
    <div
      class="order-1 flex flex-col gap-2 p-4 shrink-0 md:p-0 md:pl-4 md:w-72 md:h-full"
      inert={editorOpen}
    >
      <div class="text-xl font-semibold px-2 opacity-60">Todos</div>
      <div class="overflow-x-auto md:overflow-x-hidden md:overflow-y-auto md:flex-1 md:min-h-0">
        <NoteCollection
          notes={todos}
          layout="todoStrip"
          cardComponent={QuicknoteCard}
          onNoteClick={(note) => toggleEditing(note.noteId)}
          onCardEdit={(note) => navigateToNote(note)}
          onCardToggleDone={(note) => toggleTodoDone(note.noteId)}
          isSelected={(note) => editingIds.includes(note.noteId)}
        />
      </div>
    </div>
  {/if}

  <div
    class="order-2 flex-1 min-h-0 flex flex-col gap-4 bg-base-300 p-4 pb-24 rounded-lg overflow-y-auto md:h-full"
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
            onNoteClick={(note) => toggleEditing(note.noteId)}
            onCardEdit={(note) => navigateToNote(note)}
            onCardToggleDone={(note) => toggleTodoDone(note.noteId)}
            isSelected={(note) => editingIds.includes(note.noteId)}
          />
        </div>
      {/if}
    {/each}
    {#if timelineItems.length === 0}
      <div class="opacity-40 p-4 shrink-0">No notes in this topic</div>
    {/if}
  </div>

  <!-- bottom-left, opposite the flower-menu FAB (bottom-right), so it's in
       thumb reach without colliding with the flower's arc -->
  {#if !editorOpen}
    <button
      class="btn btn-primary btn-lg rounded-full shadow-lg fixed bottom-4 left-4 z-40"
      onclick={createNoteInTopic}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" width="22" height="22" aria-hidden="true">
        <path d="M12 5v14M5 12h14"/>
      </svg>
      New note
    </button>
  {/if}

  {#if editingNotes.length > 0}
    <QuicknoteEditPopup
      notes={editingNotes}
      onclose={closeQuicknoteEditor}
    />
  {/if}
</div>
