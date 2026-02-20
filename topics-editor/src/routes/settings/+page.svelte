<script>
  import {topicsDbState} from '$lib/topicsDb.svelte.js';
</script>

<input bind:value={topicsDbState.triliumUrl} placeholder="Trilium URL" class="input input-m w-full" />
<input bind:value={topicsDbState.triliumSecret} placeholder="Secret" class="input input-m w-full" />
