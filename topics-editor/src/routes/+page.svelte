<script>
  import { goto } from "$app/navigation";
  import {
    topicsDbState,
    initialize,
    getNotes,
    getQuicknoteSections,
    queueNoteUpdate,
    queueQuicknote,
    getQuicknoteIds,
    isPendingQuicknote,
  } from "$lib/topicsDb.svelte.js";
  import { appState } from "$lib/appState.svelte.js";
  import { base } from "$app/paths";
  import NoteCollection from "$lib/NoteCollection.svelte";
  import QuicknoteCard from "$lib/QuicknoteCard.svelte";
  import QuicknoteInput from "$lib/QuicknoteInput.svelte";
  import QuicknoteEditPopup from "$lib/QuicknoteEditPopup.svelte";
  import dayjs from "dayjs";

  initialize();

  let topics = $derived.by(() => {
    let topicNotes = $state.snapshot(topicsDbState.topicsDb?.children) || [];
    return topicNotes
      .sort((a, b) => {
        return a.notePosition - b.notePosition;
      })
      .map((topic) => {
        return topic.title;
      });
  });

  let qnSections = $derived.by(() => getQuicknoteSections());
  // flat view of every visible quicknote (for the empty-state check)
  let allQuicknotes = $derived([
    qnSections.unsorted,
    qnSections.todos,
    qnSections.sorted,
    qnSections.done,
  ].flat());

  // true while the quicknotes panel has the user's attention — i.e. focus
  // is inside it, or the user last pressed/tapped inside it (pressing its
  // empty space blurs to <body>, which fires no focusin). Drives the
  // mobile quicknotes mode
  let quicknotesPanel = $state(null);
  let quicknotesFocused = $state(false);

  $effect(() => {
    const setFocusedFrom = (el) => {
      quicknotesFocused = !!quicknotesPanel?.contains(el);
    };
    const onFocusIn = (e) => setFocusedFrom(e.target);
    const onPointerDown = (e) => setFocusedFrom(e.target);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  });

  let recentNotes = $derived.by(() => {
    const allNotes = getNotes();
    if (!allNotes) return [];
    const quicknoteIds = getQuicknoteIds();
    return Object.values(allNotes)
      .filter((n) => !quicknoteIds.has(n.noteId))
      .sort(
        (a, b) =>
          dayjs(b.dateCreated).valueOf() - dayjs(a.dateCreated).valueOf(),
      )
      .slice(0, 5);
  });

  let editingIds = $state([]);
  let editorOpen = $derived(editingIds.length > 0);
  let editingNotes = $derived.by(() => {
    const allNotes = getNotes();
    return editingIds.map((id) => allNotes[id]).filter(Boolean);
  });

  function toggleEditing(noteId) {
    if (!noteId) return;
    // topic/todo staging can't round-trip through index-create (it only
    // creates the note) — staging works normally once the quicknote lands
    if (isPendingQuicknote(noteId)) return;
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

  function navigateToTopic(topic) {
    appState.selectedTopic = topic;
    goto(base + `/topic`);
  }

  function navigateToNote(note) {
    appState.selectedTopic = note.topics?.[0] ?? "";
    appState.selectedNoteName = note.title;
    appState.selectedNoteId = note.noteId;
    goto(base + `/note`);
  }
</script>

<div class="flex flex-col md:flex-row w-full h-full bg-base-200">
  <div
    class="order-2 md:order-1 grid grid-rows-1 grid-flow-col auto-cols-max gap-2 overflow-x-auto p-2 md:flex md:flex-col md:gap-4 md:h-full md:overflow-x-hidden md:overflow-y-scroll md:grow md:shrink-0 md:p-0"
    class:max-md:hidden={quicknotesFocused}
    inert={editorOpen}
  >
    {#each topics as topic}
      <div
        class="card bg-base-100 shadow-sm group outline-none transition-transform focus-visible:scale-[1.02] focus-visible:shadow-xl"
        id={"topic_" + topic}
        tabindex="0"
        data-topic={topic}
        onclick={() => navigateToTopic(topic)}
      >
        <div class="card-body max-md:px-3 max-md:py-2">
          <div class="card-title text-2xl max-md:text-lg">{topic}</div>
        </div>
      </div>
    {/each}
  </div>

  <div
    bind:this={quicknotesPanel}
    class="order-3 flex flex-col gap-2 p-4 pt-3 md:p-0 md:pl-4 md:w-64 shrink-0 md:h-full transition-[height] duration-300 ease-out {quicknotesFocused ? 'h-3/4' : editorOpen ? 'h-1/2' : 'h-1/4'}"
  >
    <div
      class="flex flex-col max-md:flex-row max-md:items-center gap-2 shrink-0"
      inert={editorOpen}
    >
      <div class="text-xl font-semibold px-2 opacity-60 shrink-0">Quicknotes</div>
      <div class="shrink-0 max-md:flex-1 max-md:min-w-0">
        <QuicknoteInput
          placeholder="New quicknote"
          onSubmit={queueQuicknote}
        />
      </div>
    </div>
    <div
      class="flex flex-col gap-1.5 flex-1 min-h-0 overflow-y-auto md:overflow-x-hidden md:overflow-y-scroll md:flex-1 md:min-h-0"
    >
      {#each [
        { label: "Unsorted", notes: qnSections.unsorted },
        { label: "Todos", notes: qnSections.todos },
        { label: "Sorted", notes: qnSections.sorted },
        { label: "Done", notes: qnSections.done },
      ] as section (section.label)}
        {#if section.notes.length > 0}
          <div class="text-sm font-semibold px-2 opacity-60 shrink-0">
            {section.label}
          </div>
          <!-- the masonry box sizes itself to its tallest card (min 252px;
               full-content cards; lane grid geometry in
               NoteCollection.svelte); plain flow in landscape -->
          <div class="overflow-x-auto shrink-0">
            <NoteCollection
              notes={section.notes}
              onNoteClick={(note) => toggleEditing(note.noteId)}
              layout="masonryH"
              cardComponent={QuicknoteCard}
              onCardEdit={(note) => navigateToNote(note)}
              onCardToggleDone={(note) => toggleTodoDone(note.noteId)}
              isSelected={(note) => editingIds.includes(note.noteId)}
            />
          </div>
        {/if}
      {/each}
      {#if allQuicknotes.length === 0}
        <div class="text-xs opacity-40 px-2 py-1 shrink-0">No quicknotes</div>
      {/if}
    </div>
  </div>

  {#if editingNotes.length > 0}
    <QuicknoteEditPopup
      notes={editingNotes}
      onclose={closeQuicknoteEditor}
    />
  {/if}

  <div
    class="order-1 md:order-4 flex-1 min-h-0 flex flex-col gap-4 bg-base-300 p-4 rounded-lg overflow-y-auto md:flex-none md:overflow-y-hidden md:overflow-x-scroll md:h-full"
    inert={editorOpen}
  >
    <div class="text-xl font-semibold px-2 opacity-60">Recent</div>
    <NoteCollection
      notes={recentNotes}
      onNoteClick={navigateToNote}
      layout="responsive"
    />
  </div>
</div>
