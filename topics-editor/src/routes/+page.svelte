<script>
  import { goto } from "$app/navigation";
  import { topicsDbState, initialize, getNotes } from "$lib/topicsDb.svelte.js";
  import { appState } from "$lib/appState.svelte.js";
  import { base } from '$app/paths';
  import { addInputListener } from "$lib/inputs.js";
  import { getNextFocus } from '@bbc/tv-lrud-spatial';
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
    if (!focusInitialized) {
      if (recentNotes.length > 0) {
        focusInitialized = true;
        document.getElementById('note_' + recentNotes[0].noteId)?.focus();
      } else if (topics.length > 0) {
        focusInitialized = true;
        document.getElementById('topic_' + topics[0])?.focus();
      }
    }
  });

</script>

<div class="flex flex-row w-full h-full bg-base-200">
  <div class="flex flex-col gap-4 h-full overflow-y-scroll">
    {#each topics as topic}
      <div
        class="card bg-base-100 w-64 shadow-sm group outline-none"
        id={"topic_" + topic}
        tabindex="0"
        data-topic={topic}
        onclick={() => navigateToTopic(topic)}
      >
        <div class="card-body group-focus:bg-secondary group-focus:text-secondary-content">
          <div class="card-title text-2xl">{topic}</div>
        </div>
      </div>
    {/each}
  </div>

  <div class="flex flex-col gap-4 bg-base-300 p-4 rounded-lg overflow-x-scroll h-full">
    <div class="text-xl font-semibold px-2 opacity-60">Recent</div>
    <div class="flex flex-row gap-4 flex-grow min-h-0">
      {#each recentNotes as note}
        <div
          class="overflow-hidden card bg-base-100 w-128 shadow-sm group outline-none flex-shrink-0 overflow-hidden text-ellipsis"
          id={"note_" + note.noteId}
          tabindex="0"
          data-note-id={note.noteId}
          onclick={() => navigateToNote(note)}
        >
          <div class="min-h-0 overflow-hidden card-body group-focus:bg-secondary group-focus:text-secondary-content wrap-break-word">
            <div class="card-title text-xl">{note.title}</div>
            {#if note.topics?.length > 0}
              <div class="text-sm opacity-60">{note.topics[0]}</div>
            {/if}
            <div class="overflow-hidden [&_p]:my-0.5 [&_li]:my-0 prose">
              {#if topicsDbState?.updatedNotes?.[note.noteId]}
                {@html topicsDbState.updatedNotes[note.noteId].content}
              {:else}
                {@html note.content}
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>
