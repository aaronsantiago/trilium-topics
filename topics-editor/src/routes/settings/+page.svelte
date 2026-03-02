<script>
  import {topicsDbState, resetDb} from '$lib/topicsDb.svelte.js';
  import {appState} from '$lib/appState.svelte.js';
</script>

<input bind:value={topicsDbState.triliumUrl} placeholder="Trilium URL" class="input input-m w-full" />
<input bind:value={topicsDbState.triliumSecret} placeholder="Secret" class="input input-m w-full" />
<select bind:value={appState.buttonLayout} class="select select-m w-full">
  <option value="standard">Standard (Xbox / PlayStation)</option>
  <option value="swapped">Nintendo (A/B swapped)</option>
</select>
<button class="btn" on:click={() => resetDb()}>Reset DB</button>
