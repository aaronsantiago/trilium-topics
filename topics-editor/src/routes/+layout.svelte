<script>
  import { onMount } from 'svelte';
	import './layout.css';
	import { pwaInfo } from 'virtual:pwa-info';

	onMount(async () => {
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
</script>

<svelte:head>
 	{@html webManifestLink}
</svelte:head>

{@render children()}
