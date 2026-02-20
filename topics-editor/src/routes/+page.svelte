<script>
  import {topicsDbState, initialize} from '$lib/topicsDb.svelte.js';

  initialize();

  let notes = $derived(topicsDbState.notes ? Object.values(topicsDbState.notes) : []);

</script>

<input bind:value={topicsDbState.triliumUrl} placeholder="Trilium URL" class="input input-m w-full" />
<input bind:value={topicsDbState.triliumSecret} placeholder="Secret" class="input input-m w-full" />
{#each notes as note}
  <div class="card card-m">
    <div class="card-body">
      <div class="card-title text-2xl">{note.title}</div>
      <div>{@html note.content}</div>
    </div>
  </div>
{/each}
