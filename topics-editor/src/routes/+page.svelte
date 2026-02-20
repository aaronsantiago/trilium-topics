<script>
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { topicsDbState, initialize } from "$lib/topicsDb.svelte.js";
  import { appState } from "$lib/appState.svelte.js";

  initialize();

  let topics = $derived.by(() => {
    let topicNotes = topicsDbState.topicsDb?.children || [];
    return topicNotes.map((topic) => {
      return topic.title;
    });
  });

  function navigateToTopic(topic) {
    appState.selectedTopic = topic;
    goto(`/topic`);
  }

</script>

<a href="settings">Settings</a>

{#each topics as topic}
  <div class="card bg-base-100 w-96 shadow-sm">
    <div class="card-body">
      <div class="card-title text-2xl" onclick={() => navigateToTopic(topic)}>
        {topic}
      </div>
    </div>
  </div>
{/each}
