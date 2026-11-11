<script>
  import { appState } from "$lib/appState.svelte.js";
  import { topicsDbState } from "$lib/topicsDb.svelte.js";
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import dayjs from "dayjs";

  let title = $state("");
  // seeded by the topic page's "New note" button; read once and cleared so
  // the next /create from elsewhere (flower menu) starts empty
  const returnTo = appState.createReturnTo;
  let selectedTopics = $state([...appState.createSeedTopics]);
  appState.createSeedTopics = [];
  appState.createReturnTo = '';

  let topics = $derived.by(() => {
    let topicNotes = topicsDbState.topicsDb?.children || [];
    return topicNotes.map((topic) => {
      return topic.title;
    });
  });

  async function createNote() {
    let tempNoteId = crypto.randomUUID();
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

<div class="w-full grid grid-cols-1 h-full overflow-y-auto">
  <input
    type="text"
    class="input input-bordered w-full"
    placeholder="Note title"
    bind:value={title}
  />
  <div>
    {#each selectedTopics as topic}
      <span class="badge badge-primary mr-1">{topic}</span>
    {/each}
  </div>
  <div class="flex gap-2 mt-2">
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
  {#each topics as topic}
    <div
      class="outline-none transition-transform focus-visible:scale-[1.02] focus-visible:shadow-xl rounded px-2 py-1 cursor-pointer"
      tabindex="0"
      role="button"
      aria-pressed={selectedTopics.includes(topic)}
      data-topic={topic}
      onclick={() => toggleTopic(topic)}
      onkeydown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleTopic(topic);
        }
      }}
    >
      {topic}
      {#if selectedTopics.includes(topic)}
        <span class="badge badge-primary ml-1">✓</span>
      {/if}
    </div>
  {/each}
</div>
