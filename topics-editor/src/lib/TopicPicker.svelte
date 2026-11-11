<script>
  // Tap/click list of the existing topics with a checkmark per row. Shared by
  // the create page, the quicknote edit popup and the note page's topic popup.
  //
  // `stateOf(topic)` returns 'all' | 'some' | 'none' ('some' is for
  // multi-note selections); `ontoggle(topic)` is called on tap/click.
  // Optional `lockedOf(topic)` returns a short reason (truthy) when that row
  // can't be toggled: it stays shown as selected, is aria-disabled, ignores
  // taps and shows the reason under the topic (visible on touch, no hover).
  import { topicsDbState } from '$lib/topicsDb.svelte.js';

  let { stateOf, ontoggle, disabled = false, lockedOf = () => '' } = $props();

  let topics = $derived((topicsDbState.topicsDb?.children || []).map((t) => t.title));
</script>

<div class="flex flex-col gap-1" role="group" aria-label="Topics">
  {#each topics as topic (topic)}
    {@const selection = stateOf(topic)}
    {@const locked = lockedOf(topic)}
    <button
      type="button"
      class={[
        'text-left outline-none transition-transform focus-visible:scale-[1.02] focus-visible:shadow-xl rounded px-2 py-1 disabled:opacity-50 disabled:cursor-default',
        locked ? 'cursor-default bg-base-200/60' : 'cursor-pointer hover:bg-base-200',
      ]}
      data-topic-option={topic}
      data-locked={locked ? 'true' : undefined}
      aria-pressed={selection === 'all' ? 'true' : selection === 'some' ? 'mixed' : 'false'}
      aria-disabled={locked ? 'true' : undefined}
      {disabled}
      onclick={() => !locked && ontoggle(topic)}
    >
      {topic}
      {#if selection === 'all'}<span class={['badge ml-1', locked ? 'badge-primary badge-soft' : 'badge-primary']}>✓</span>
      {:else if selection === 'some'}<span class="badge badge-ghost ml-1">–</span>{/if}
      {#if locked}
        <span class="ml-1" aria-hidden="true">🔒</span>
        <span class="block text-xs opacity-70">{locked}</span>
      {/if}
    </button>
  {/each}
</div>
