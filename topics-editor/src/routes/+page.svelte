<script>
  import { goto } from "$app/navigation";
  import { topicsDbState, initialize, getNotes } from "$lib/topicsDb.svelte.js";
  import { appState } from "$lib/appState.svelte.js";
  import { base } from '$app/paths';
  import { addInputListener } from "$lib/inputs.js";
  import { getNextFocus } from '@bbc/tv-lrud-spatial';
  import NoteCollection from '$lib/NoteCollection.svelte';
  import dayjs from 'dayjs';

  initialize();

  let topics = $derived.by(() => {
    let topicNotes = $state.snapshot(topicsDbState.topicsDb?.children) || [];
    return topicNotes.sort((a, b) => {
        return a.notePosition - b.notePosition
      }).map((topic) => {
        return topic.title;
      });
  });

  let recentNotes = $derived.by(() => {
    const allNotes = getNotes();
    if (!allNotes) return [];
    return Object.values(allNotes)
      .sort((a, b) => dayjs(b.dateCreated).valueOf() - dayjs(a.dateCreated).valueOf())
      .slice(0, 5);
  });

  function navigateToTopic(topic) {
    appState.selectedTopic = topic;
    goto(base + `/topic`);
  }

  function navigateToNote(note) {
    appState.selectedTopic = note.topics?.[0] ?? '';
    appState.selectedNoteName = note.title;
    appState.selectedNoteId = note.noteId;
    goto(base + `/note`);
  }

  const directionMap = {
    up: 'ArrowUp', down: 'ArrowDown',
    left: 'ArrowLeft', right: 'ArrowRight'
  };

  $effect(() => {
    return addInputListener((e) => {
      if (directionMap[e]) {
        const next = getNextFocus(document.activeElement, directionMap[e]);
        if (next) {
          next.focus();
          next.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      } else if (e === 'confirm') {
        const noteId = document.activeElement?.dataset?.noteId;
        if (noteId) {
          const note = recentNotes.find(n => n.noteId === noteId);
          if (note) navigateToNote(note);
        } else {
          const topic = document.activeElement?.dataset?.topic;
          if (topic) navigateToTopic(topic);
          else document.activeElement?.click();
        }
      }
    });
  });

  let focusInitialized = false;
  $effect(() => {
    if (!focusInitialized && recentNotes.length === 0 && topics.length > 0) {
      focusInitialized = true;
      document.getElementById('topic_' + topics[0])?.focus();
    }
  });

</script>

<div class="flex flex-row w-full h-full bg-base-200">
  <div class="flex flex-col gap-4 h-full overflow-y-scroll flex-grow flex-shrink-0">
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

  <div class="flex flex-col gap-4 bg-base-300 p-4 rounded-lg overflow-x-scroll h-full">
    <div class="text-xl font-semibold px-2 opacity-60">Recent</div>
    <NoteCollection notes={recentNotes} onNoteClick={navigateToNote} layout="horizontal" />
  </div>
</div>
