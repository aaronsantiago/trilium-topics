<script>
  import { base } from '$app/paths';
	import { addAxisListener, addInputListener, addInputReleasedListener } from '$lib/inputs.js';
	import { goto } from '$app/navigation';

  $effect (() => {
    return addInputListener((e) => {
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
  <div bind:this={floatingButton} tabindex="0" role="button" class="btn btn-circle btn-lg">
    !
  </div>
  <div class="btn btn-circle btn-lg">
    !
  </div>
  <button bind:this={createButton} class="btn btn-circle btn-lg" onclick={() => {goto(base + "/create")}}>
    +
  </button>
  <button bind:this={settingsButton} class="btn btn-circle btn-lg" onclick={() => {goto(base + "/settings")}}>
    S
  </button>
  <button bind:this={homeButton} class="btn btn-circle btn-lg" onclick={() => {goto(base + "/")}}>
    H
  </button>
</div>
