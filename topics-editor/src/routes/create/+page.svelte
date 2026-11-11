<script>
  import { appState } from "$lib/appState.svelte.js";
  import { topicsDbState } from "$lib/topicsDb.svelte.js";
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import dayjs from "dayjs";
  import TopicPicker from "$lib/TopicPicker.svelte";

  let title = $state("");
  // seeded by the topic page's "New note" button; read once and cleared so
  // the next /create from elsewhere (flower menu) starts empty
  const returnTo = appState.createReturnTo;
  let selectedTopics = $state([...appState.createSeedTopics]);
  appState.createSeedTopics = [];
  appState.createReturnTo = '';


  async function createNote() {
    let tempNoteId = crypto.randomUUID();
    // createdNotes is null until the idb hydration IIFE resolves
    if (topicsDbState.createdNotes == null) topicsDbState.createdNotes = {};
    topicsDbState.createdNotes[tempNoteId] = {
      title: title,
      noteId: tempNoteId,
      dateCreated: dayjs().format('YYYY-MM-DD HH:mm:ss.SSS').concat(dayjs().format('Z').replace(':', '')),
      content: "",
      topics: selectedTopics
    };
    if (returnTo) {
      // opened from a topic: go back to it (or to the first chosen topic if
      // the user deselected it) and show the new note in its timeline
      if (!selectedTopics.includes(appState.selectedTopic)) {
        appState.selectedTopic = selectedTopics[0];
      }
      goto(base + returnTo);
      return;
    }
    appState.selectedTopic = selectedTopics[0];
    appState.selectedNoteName = title;
    appState.selectedNoteId = tempNoteId;
    goto(base + `/note`);

  }

  function cancel() {
    goto(base + (returnTo || '/'));
  }

  function toggleTopic(topic) {
    if (selectedTopics.includes(topic)) {
      selectedTopics = selectedTopics.filter(t => t !== topic);
    } else {
      selectedTopics = [...selectedTopics, topic];
    }
  }
</script>

<!-- One compact card: title, then the actions right under it, then the topic
     list in its own scroll area. The actions sit near the top on purpose: the
     phone keyboard covers the bottom of the screen (the layout viewport
     doesn't shrink), so a bottom bar would hide behind it; here Create stays
     in view while typing. pb-24 keeps the card above the bottom-right FAB. -->
<div class="h-full flex flex-col bg-base-200 px-4 pt-4 pb-24">
  <div class="w-full max-w-xl mx-auto min-h-0 flex flex-col gap-3 bg-base-100 rounded-box shadow-sm p-4">
    <h1 class="shrink-0 text-lg font-semibold">New note</h1>
    <input
      type="text"
      class="shrink-0 input input-bordered w-full"
      placeholder="Note title"
      bind:value={title}
    />
    <div class="shrink-0 flex gap-2">
      <button
        class="btn btn-ghost outline-none"
        onclick={cancel}
      >Cancel</button>
      <button
        class="btn flex-1 btn-soft btn-primary outline-none transition-transform focus-visible:scale-[1.02] focus-visible:shadow-xl"
        tabindex="0"
        disabled={title.trim() === "" || selectedTopics.length == 0}
        onclick={createNote}
      >Create</button>
    </div>
    <!-- picker rows carry the ✓, but with a long list the chosen ones can
         scroll out of view, so a one-line summary stays next to the heading -->
    <div class="shrink-0 flex items-baseline gap-2 min-w-0 border-t border-base-300 pt-3">
      <span class="text-sm font-semibold">Topics</span>
      <span
        class="truncate text-sm opacity-70"
        data-create-selected
        title={selectedTopics.join(', ')}
      >{selectedTopics.length ? selectedTopics.join(', ') : 'none selected'}</span>
    </div>
    <div class="min-h-0 overflow-y-auto overscroll-contain -mx-2 [overflow-wrap:anywhere]" data-create-topic-scroll>
      <TopicPicker
        stateOf={(topic) => (selectedTopics.includes(topic) ? "all" : "none")}
        ontoggle={toggleTopic}
      />
    </div>
  </div>
</div>
