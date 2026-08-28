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
  import { addInputListener } from "$lib/inputs.js";
  import { getNextFocus } from "@bbc/tv-lrud-spatial";
  import NoteCollection from "$lib/NoteCollection.svelte";
  import QuicknoteCard from "$lib/QuicknoteCard.svelte";
  import QuicknoteInput from "$lib/QuicknoteInput.svelte";
  import QuicknoteEditPopup from "$lib/QuicknoteEditPopup.svelte";
  import dayjs from "dayjs";
  import { tick } from "svelte";

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
  // flat view for input-handler lookups (includes done todos, now visible)
  let allQuicknotes = $derived([
    qnSections.unsorted,
    qnSections.todos,
    qnSections.sorted,
    qnSections.done,
  ].flat());

  let quicknoteInput = $state(null);
  let quicknoteInputFocused = $state(false);

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
  let editPanel = $state(null);

  function toggleEditing(noteId) {
    if (!noteId) return;
    // topic/todo staging can't round-trip through index-create (it only
    // creates the note) — staging works normally once the quicknote lands
    if (isPendingQuicknote(noteId)) return;
    editingIds = editingIds.includes(noteId)
      ? editingIds.filter((id) => id !== noteId)
      : [...editingIds, noteId];
  }

  async function closeQuicknoteEditor() {
    editingIds = [];
    // the panel (which held focus) unmounts — put focus back on the page
    await tick();
    const target =
      document.querySelector("[data-note-id]") ??
      document.querySelector("[data-topic]");
    target?.focus();
  }

  // the card unmounts when it toggles (it moves between the Todos and Done
  // sections), so hand focus to a spatial neighbour first — otherwise focus
  // falls to <body> and D-pad navigation has nothing to move from
  async function toggleTodoDone(noteId) {
    const note = getNotes()[noteId];
    if (!note?.isTodo) return;
    const card = document.getElementById("note_" + noteId);
    const next = card
      ? getNextFocus(card, "ArrowRight") ||
        getNextFocus(card, "ArrowDown") ||
        getNextFocus(card, "ArrowLeft")
      : null;
    queueNoteUpdate(noteId, { todoDone: !note.todoDone });
    await tick();
    if (next && document.contains(next)) next.focus();
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

  const directionMap = {
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
  };

  const focusIsInEditPanel = () =>
    !!document.activeElement?.closest("#quicknoteEditPanel");

  $effect(() => {
    return addInputListener((e) => {
      if (quicknoteInputFocused) {
        // the QuicknoteInput's T9 keyboard owns confirm/delete/shoulder
        // buttons while the field is focused; cancel exits input mode
        // (blur keeps the draft)
        if (e === "cancel") quicknoteInput?.blurInput();
        return;
      }
      if (directionMap[e]) {
        const next = getNextFocus(document.activeElement, directionMap[e]);
        if (next) {
          next.focus();
          next.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      } else if (e === "confirm") {
        if (focusIsInEditPanel()) {
          document.activeElement?.click();
          return;
        }
        const noteId = document.activeElement?.dataset?.noteId;
        if (noteId) {
          // while editing, confirm adds/removes quicknotes from the selection
          if (editorOpen && allQuicknotes.find((n) => n.noteId === noteId)) {
            toggleEditing(noteId);
            return;
          }
          const note =
            recentNotes.find((n) => n.noteId === noteId) ||
            allQuicknotes.find((n) => n.noteId === noteId);
          if (note) navigateToNote(note);
        } else {
          const topic = document.activeElement?.dataset?.topic;
          if (topic) navigateToTopic(topic);
          else document.activeElement?.click();
        }
      } else if (e === "special") {
        const noteId = document.activeElement?.dataset?.noteId;
        if (allQuicknotes.find((n) => n.noteId === noteId)) {
          toggleEditing(noteId);
        }
      } else if (e === "cancel") {
        if (editorOpen) editPanel?.commit();
      } else if (e === "r1") {
        // focus may sit on a sub-element (e.g. the checkbox) rather than the card
        const noteId =
          document.activeElement?.dataset?.noteId ??
          document.activeElement?.closest?.("[data-note-id]")?.dataset?.noteId;
        const note = allQuicknotes.find((n) => n.noteId === noteId);
        if (note?.isTodo) {
          toggleTodoDone(noteId);
        }
      }
    });
  });

  let focusInitialized = false;
  $effect(() => {
    if (focusInitialized) return;
    // don't steal focus from an active text input (e.g. the home
    // quicknote input) when its submitted card lands in Unsorted
    if (document.activeElement?.tagName === "INPUT") return;
    // first card of the first non-empty section wins
    const firstNote =
      qnSections.unsorted[0] ??
      qnSections.todos[0] ??
      qnSections.sorted[0] ??
      qnSections.done[0];
    if (firstNote) {
      focusInitialized = true;
      document.getElementById("note_" + firstNote.noteId)?.focus();
      return;
    }
    if (recentNotes.length === 0 && topics.length > 0) {
      focusInitialized = true;
      document.getElementById("topic_" + topics[0])?.focus();
    }
  });
</script>

<div class="flex flex-col md:flex-row w-full h-full bg-base-200">
  <div
    class="order-3 md:order-1 grid grid-rows-2 grid-flow-col auto-cols-max gap-4 overflow-x-auto p-4 md:flex md:flex-col md:gap-4 md:h-full md:overflow-x-hidden md:overflow-y-scroll md:grow md:shrink-0 md:p-0"
    class:lrud-ignore={editorOpen}
    inert={editorOpen}
  >
    {#each topics as topic}
      <div
        class="card bg-base-100 shadow-sm group outline-none transition-transform focus:scale-[1.02] focus:shadow-xl"
        id={"topic_" + topic}
        tabindex="0"
        data-topic={topic}
        onclick={() => navigateToTopic(topic)}
      >
        <div class="card-body">
          <div class="card-title text-2xl">{topic}</div>
        </div>
      </div>
    {/each}
  </div>

  <div
    class="order-2 flex flex-col gap-2 p-4 md:p-0 md:pl-4 md:w-64 md:shrink-0 md:h-full"
  >
    <div class="text-xl font-semibold px-2 opacity-60">Quicknotes</div>
    <div class:lrud-ignore={editorOpen} inert={editorOpen}>
      <QuicknoteInput
        bind:this={quicknoteInput}
        placeholder="New quicknote"
        onSubmit={queueQuicknote}
        onFocusChange={(f) => (quicknoteInputFocused = f)}
      />
    </div>
    <div
      class="flex flex-col gap-1.5 overflow-x-auto md:overflow-x-hidden md:overflow-y-scroll md:flex-1 md:min-h-0"
    >
      {#each [
        { label: "Unsorted", notes: qnSections.unsorted },
        { label: "Todos", notes: qnSections.todos },
        { label: "Sorted", notes: qnSections.sorted },
        { label: "Done", notes: qnSections.done },
      ] as section (section.label)}
        {#if section.notes.length > 0}
          <div class="text-sm font-semibold px-2 opacity-60">
            {section.label}
          </div>
          <NoteCollection
            notes={section.notes}
            onNoteClick={(note) =>
              editorOpen
                ? toggleEditing(note.noteId)
                : navigateToNote(note)}
            layout="stripResponsive"
            cardComponent={QuicknoteCard}
            autoFocus={false}
            onCardEdit={(note) => toggleEditing(note.noteId)}
            onCardToggleDone={(note) => toggleTodoDone(note.noteId)}
            isSelected={(note) => editingIds.includes(note.noteId)}
          />
        {/if}
      {/each}
      {#if allQuicknotes.length === 0}
        <div class="text-xs opacity-40 px-2 py-1">No quicknotes</div>
      {/if}
    </div>
  </div>

  {#if editingNotes.length > 0}
    <QuicknoteEditPopup
      bind:this={editPanel}
      notes={editingNotes}
      onclose={closeQuicknoteEditor}
    />
  {/if}

  <div
    class="order-1 md:order-4 flex-1 min-h-0 flex flex-col gap-4 bg-base-300 p-4 rounded-lg overflow-y-auto md:flex-none md:overflow-y-hidden md:overflow-x-scroll md:h-full"
    class:lrud-ignore={editorOpen}
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
