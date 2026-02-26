<script>
  import { onMount } from 'svelte';
	import './layout.css';
	import { pwaInfo } from 'virtual:pwa-info';
	import { generateBreadcrumbs } from '$lib/appState.svelte.js';
	import { base } from '$app/paths';
	import { initInputs, addAxisListener, addInputListener } from '$lib/inputs.js';
	import { initializeAppState } from '$lib/appState.svelte.js';
	import { goto } from '$app/navigation';

	onMount(async () => {

	  initInputs();
		initializeAppState();

	  if (pwaInfo) {
      const { registerSW } = await import('virtual:pwa-register')
      registerSW({
        immediate: true,
        onRegistered(r) {
          // uncomment following code if you want check for updates
          // r && setInterval(() => {
          //    console.log('Checking for sw update')
          //    r.update()
          // }, 20000 /* 20s for testing purposes */)
          console.log(`SW Registered: ${r}`)
        },
        onRegisterError(error) {
          console.log('SW registration error', error)
        }
      })
    }
	})

  let webManifestLink = $derived(pwaInfo ? pwaInfo.webManifest.linkTag : '' );
  let { children } = $props();

  $effect(() => {
    return addAxisListener((e) => {
      if (e.axis == "ry" && Math.abs(e.value) > 0.1) {
        document.getElementById("scrollContainer").scrollBy({
          top: 5 * e.value * e.value * Math.sign(e.value),
          // behavior: 'smooth'
        });
      }
    });
  })

  $effect (() => {
    return addInputListener((e) => {
      if (e === 'menu') {
        if (floatingButton) {
          if (document.activeElement === floatingButton) {
            floatingButton.blur();
          } else {
            floatingButton.focus();
          }
        }
      }
    });
  });

  let floatingButton = $state(null);
</script>

<svelte:head>
 	{@html webManifestLink}
</svelte:head>

<div class="h-screen">
  <div class="fab fab-flower">
    <!-- a focusable div with tabindex is necessary to work on all browsers. role="button" is necessary for accessibility -->
    <div bind:this={floatingButton} tabindex="0" role="button" class="btn btn-circle btn-lg">
      !
    </div>
    <div class="btn btn-circle btn-lg">
      !
    </div>
    <button class="btn btn-circle btn-lg" onclick={() => {goto(base + "/create")}}>
      +
    </button>
    <button class="btn btn-circle btn-lg" onclick={() => {goto(base + "/settings")}}>
      S
    </button>
    <button class="btn btn-circle btn-lg" onclick={() => {goto(base + "/")}}>
      H
    </button>
  </div>
  <!-- <div class="navbar bg-base-100 shadow-sm">
    <div class="breadcrumbs text-sm">
      <ul>
        {#each generateBreadcrumbs() as breadcrumb}
          <li> <a href={base + "/"} class="btn btn-ghost text-xl">{breadcrumb}</a></li>
        {/each}
      </ul>
    </div>
  </div> -->
  <div id="scrollContainer" class="overflow-y-auto h-full relative">
    {@render children()}
  </div>
</div>
