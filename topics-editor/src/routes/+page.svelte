<script>
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { topicsDbState, initialize } from "$lib/topicsDb.svelte.js";
  import { appState } from "$lib/appState.svelte.js";
  import { base } from '$app/paths';
  import { addInputListener } from "$lib/inputs.js";

  initialize();

  let topics = $derived.by(() => {
    let topicNotes = $state.snapshot(topicsDbState.topicsDb?.children) || [];
    return topicNotes.sort((a, b) => {
        return a.notePosition - b.notePosition
      }).map((topic) => {
        return topic.title;
      });
  });

  function navigateToTopic(topic) {
    appState.selectedTopic = topic;
    goto(base + `/topic`);
  }

  let highlightedTopic = $derived.by(() => {
    return topics[appState.cursorState["main"] || 0];
  });

  $effect(() => {
    return addInputListener((e) => {
      if (e == "up") {
        appState.cursorState["main"] = Math.max((appState.cursorState["main"] || 0) - 1, 0);
        console.log("cursorState", appState.cursorState["main"]);
      } else if (e == "down") {
        appState.cursorState["main"] = Math.min((appState.cursorState["main"] || 0) + 1, topics.length - 1);
      } else if (e == "confirm") {
        navigateToTopic(highlightedTopic);
      }

      const el = document.querySelector("#topic_" + highlightedTopic);
      if (!el) return;
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    });
  });

</script>

<a href={base +"/settings"}>Settings</a>
<a href={base +"/create"}>Create</a>

{#each topics as topic}
  <div class="card bg-base-100 w-96 shadow-sm" id={"topic_" + topic}>
    <div class={"card-body " + (highlightedTopic == topic ? "bg-secondary text-secondary-content" : "")}>
      <div class="card-title text-2xl" onclick={() => navigateToTopic(topic)}>
        {topic}
      </div>
    </div>
  </div>
{/each}
