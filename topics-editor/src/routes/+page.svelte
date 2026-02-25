<script>
  import { goto } from "$app/navigation";
  import { topicsDbState, initialize } from "$lib/topicsDb.svelte.js";
  import { appState } from "$lib/appState.svelte.js";
  import { base } from '$app/paths';
  import { addInputListener } from "$lib/inputs.js";
  import { getNextFocus } from '@bbc/tv-lrud-spatial';

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
        const topic = document.activeElement?.dataset?.topic;
        if (topic) navigateToTopic(topic);
        else document.activeElement?.click();
      }
    });
  });

  let focusInitialized = false;
  $effect(() => {
    if (topics.length > 0 && !focusInitialized) {
      focusInitialized = true;
      document.getElementById('topic_' + topics[0])?.focus();
    }
  });

</script>

<a href={base +"/settings"} class="outline-none focus:bg-secondary focus:text-secondary-content rounded px-2 py-1">Settings</a>
<a href={base +"/create"} class="outline-none focus:bg-secondary focus:text-secondary-content rounded px-2 py-1">Create</a>

{#each topics as topic}
  <div
    class="card bg-base-100 w-96 shadow-sm group outline-none"
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
