<script>
  // Tap/click list of the existing topics with a checkmark per row. Shared by
  // the create page, the quicknote edit popup and the note page's topic popup.
  //
  // `stateOf(topic)` returns 'all' | 'some' | 'none' ('some' is for
  // multi-note selections); `ontoggle(topic)` is called on tap/click.
  import { topicsDbState } from '$lib/topicsDb.svelte.js';

  let { stateOf, ontoggle, disabled = false } = $props();

  let topics = $derived((topicsDbState.topicsDb?.children || []).map((t) => t.title));
</script>

<div class="flex flex-col gap-1" role="group" aria-label="Topics">
  {#each topics as topic (topic)}
    {@const selection = stateOf(topic)}
    <button
      type="button"
      class="text-left outline-none transition-transform focus-visible:scale-[1.02] focus-visible:shadow-xl rounded px-2 py-1 cursor-pointer hover:bg-base-200 disabled:opacity-50 disabled:cursor-default"
      data-topic-option={topic}
      aria-pressed={selection === 'all' ? 'true' : selection === 'some' ? 'mixed' : 'false'}
      {disabled}
      onclick={() => ontoggle(topic)}
    >
      {topic}
      {#if selection === 'all'}<span class="badge badge-primary ml-1">✓</span>
      {:else if selection === 'some'}<span class="badge badge-ghost ml-1">–</span>{/if}
    </button>
  {/each}
</div>
