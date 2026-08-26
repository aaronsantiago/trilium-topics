<script>
  import { base } from '$app/paths';
	import { addAxisListener, addInputListener, addInputReleasedListener } from '$lib/inputs.js';
	import { goto } from '$app/navigation';
	import { appState } from '$lib/appState.svelte.js';

  $effect (() => {
    return addInputListener((e) => {
      if (appState.modalOpen) return;
      if (e === 'menu') {
        if (floatingButton) {
          if (document.activeElement != floatingButton) {
            floatingButton.focus();
          }
        }
      }
    });
  });

  $effect (() => {
    return addInputReleasedListener((e) => {
      if (e === 'menu') {
        if ([floatingButton, createButton, homeButton, settingsButton].includes(document.activeElement)) {
          if (buttonSelectionXAxis < -0.5 && buttonSelectionYAxis < -0.5) {
            goto(base + "/settings");
          } else if (buttonSelectionXAxis < -0.5) {
            goto(base + "/create");
          } else if (buttonSelectionYAxis < -0.5) {
            goto(base + "/");
          }
          else {
            document.activeElement.blur();
          }
        }
      }
    });
  });

  let buttonSelectionXAxis = $state(0);
  let buttonSelectionYAxis = $state(0);

  $effect(() => {
    return addAxisListener((e) => {
      if (e.axis == "lx") {
        buttonSelectionXAxis = e.value;
      }
      if (e.axis == "ly") {
        buttonSelectionYAxis = e.value;
      }
    });
  })

  $effect(() => {
    buttonSelectionXAxis, buttonSelectionYAxis;
    if ([floatingButton, createButton, homeButton, settingsButton].includes(document.activeElement)) {
      if (buttonSelectionXAxis < -0.5 && buttonSelectionYAxis < -0.5) {
        settingsButton?.focus();
      } else if (buttonSelectionXAxis < -0.5) {
        createButton?.focus();
      } else if (buttonSelectionYAxis < -0.5) {
        homeButton?.focus();
      } else {
        floatingButton?.focus();
      }
    }
  })

  let floatingButton = $state(null);
  let settingsButton = $state(null);
  let homeButton = $state(null);
  let createButton = $state(null);
</script>

<div class="fab fab-flower">
  <!-- a focusable div with tabindex is necessary to work on all browsers. role="button" is necessary for accessibility -->
  <div bind:this={floatingButton} tabindex="0" role="button" class="btn btn-circle btn-xl">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
      <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
    </svg>
  </div>
  <div class="btn btn-circle btn-xl">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
      <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
    </svg>
  </div>
  <button bind:this={createButton} class="btn btn-circle btn-xl" onclick={() => {goto(base + "/create")}}>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="32" height="32">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  </button>
  <button bind:this={settingsButton} class="btn btn-circle btn-xl" onclick={() => {goto(base + "/settings")}}>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="32" height="32">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  </button>
  <button bind:this={homeButton} class="btn btn-circle btn-xl" onclick={() => {goto(base + "/")}}>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="32" height="32">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  </button>
</div>
