<script>
  import Keyboard from "$lib/keyboard/keyboard.svelte";
  import { addInputListener } from "$lib/inputs.js";
  import { getNextFocus } from "@bbc/tv-lrud-spatial";
  import { tick } from "svelte";

  let { placeholder, onSubmit, onFocusChange } = $props();

  let title = $state("");
  let focused = $state(false);
  let inputEl = $state(null);

  // we need to optionally disable the native mobile keyboard
  // because we are providing our own custom keyboard and the native one can get in the way
  // but if the user is using touch input, they likely want the native keyboard, so we only disable it when we detect gamepad input
  let usingGamepad = $state(false);

  let cursorX = $state(0);
  let cursorY = $state(0);
  let cursorHeight = $state(20);
  let cursorVisible = $state(false);
  let cursorKey = $state(0);

  function setFocused(value) {
    focused = value;
    onFocusChange?.(value);
  }

  function focusInput() {
    inputEl?.focus();
  }

  function blurInput() {
    inputEl?.blur();
  }

  $effect(() => {
    return addInputListener(() => {
      usingGamepad = true;
    });
  });

  function updateCursorPosition() {
    if (!inputEl) {
      cursorVisible = false;
      return;
    }
    try {
      const pos = inputEl.selectionStart ?? title.length;
      const textBefore = title.slice(0, pos);
      const style = getComputedStyle(inputEl);

      const mirror = document.createElement("span");
      mirror.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${style.font};letter-spacing:${style.letterSpacing};`;
      mirror.textContent = textBefore;
      document.body.appendChild(mirror);
      const textWidth = mirror.getBoundingClientRect().width;
      document.body.removeChild(mirror);

      const paddingLeft = parseFloat(style.paddingLeft);
      const borderLeft = parseFloat(style.borderLeftWidth);
      const inputHeight = inputEl.offsetHeight;
      const lineHeight = parseFloat(style.lineHeight) || inputHeight;

      cursorX = borderLeft + paddingLeft + textWidth - inputEl.scrollLeft;
      cursorHeight = Math.min(lineHeight, inputHeight * 0.7);
      cursorY = (inputHeight - cursorHeight) / 2;
      cursorKey++;
      cursorVisible = true;
    } catch (e) {
      cursorVisible = false;
    }
  }

  async function onInsertWord(word) {
    if (document.activeElement !== inputEl) return;

    const pos = inputEl?.selectionStart ?? title.length;
    const before = title.slice(0, pos);
    const after = title.slice(pos);
    const separator = before.length > 0 && !before.endsWith(" ") ? " " : "";
    const insertText = separator + word + " ";
    title = before + insertText + after;
    const newPos = pos + insertText.length;
    await tick();
    inputEl?.focus();
    inputEl?.setSelectionRange(newPos, newPos);
    updateCursorPosition();
  }

  async function onDeleteWordBackward() {
    if (document.activeElement !== inputEl) return;

    const pos = inputEl?.selectionStart ?? title.length;
    let firstChar = true;
    let newPos = 0;
    for (let i = pos - 1; i >= 0; i--) {
      const char = title[i];
      const isSpace = /\s/.test(char);
      const isPunctuation = !isSpace && /\W/.test(char);
      if (isSpace) {
        if (firstChar) {
          firstChar = false;
          continue;
        }
        newPos = i;
        break;
      } else if (isPunctuation) {
        if (firstChar) {
          newPos = i;
          break;
        }
        newPos = i + 1;
        break;
      } else {
        firstChar = false;
      }
    }
    title = title.slice(0, newPos) + title.slice(pos);
    await tick();
    inputEl?.focus();
    inputEl?.setSelectionRange(newPos, newPos);
    updateCursorPosition();
  }

  function moveCursorWordLeft() {
    const pos = inputEl?.selectionStart ?? 0;
    const text = title;
    let firstChar = true;
    let newPos = 0;

    for (let i = pos - 1; i >= 0; i--) {
      const char = text[i];
      const isSpace = /\s/.test(char);
      const isPunctuation = !isSpace && /\W/.test(char);

      if (isSpace) {
        if (firstChar) {
          firstChar = false;
          continue;
        }
        newPos = i;
        break;
      } else if (isPunctuation) {
        if (firstChar) {
          newPos = i;
          break;
        }
        newPos = i + 1;
        break;
      } else {
        firstChar = false;
      }
    }

    inputEl?.focus();
    inputEl?.setSelectionRange(newPos, newPos);
    updateCursorPosition();
  }

  function moveCursorWordRight() {
    const pos = inputEl?.selectionStart ?? 0;
    const text = title;
    let firstChar = true;
    let newPos = text.length;

    for (let i = pos; i < text.length; i++) {
      const char = text[i];
      const isSpace = /\s/.test(char);
      const isPunctuation = !isSpace && /\W/.test(char);

      if (isSpace) {
        if (firstChar) {
          firstChar = false;
          continue;
        }
        newPos = i;
        break;
      } else if (isPunctuation) {
        if (firstChar) {
          newPos = i + 1;
          break;
        }
        newPos = i;
        break;
      } else {
        firstChar = false;
      }
    }

    inputEl?.focus();
    inputEl?.setSelectionRange(newPos, newPos);
    updateCursorPosition();
  }

  function onMoveCursor(direction) {
    if (direction === "left") {
      moveCursorWordLeft();
    } else if (direction === "right") {
      moveCursorWordRight();
    } else if (direction === "up" || direction === "down") {
      // move focus away from the field (the blur deactivates the T9 keyboard);
      // no-op if nothing is in that direction.
      // Deferred a tick because the home page's input listener runs later in
      // the same event and early-returns while the field is focused — moving
      // focus synchronously would blur the field first, letting that listener
      // also navigate from the new element (one D-pad press, two focus moves)
      Promise.resolve().then(() => {
        if (!focused || !inputEl || document.activeElement !== inputEl) return;
        const next = getNextFocus(
          inputEl,
          direction === "up" ? "ArrowUp" : "ArrowDown",
        );
        if (next) {
          next.focus();
          next.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      });
    }
  }

  function submit() {
    const text = title.trim();
    if (!text) return;
    onSubmit(text);
    title = "";
    // stay in input mode for rapid successive notes
    inputEl?.focus();
    inputEl?.setSelectionRange(0, 0);
    updateCursorPosition();
  }
</script>

<Keyboard
  active={focused}
  {onInsertWord}
  {onDeleteWordBackward}
  {onMoveCursor}
  onConfirmNoWord={submit}
/>

<div class="relative">
  <input
    id="quicknoteInputField"
    type="text"
    class="input input-bordered w-full caret-transparent"
    {placeholder}
    inputmode={usingGamepad ? "none" : null}
    bind:value={title}
    bind:this={inputEl}
    onfocus={() => {
      setFocused(true);
      updateCursorPosition();
    }}
    onblur={() => {
      setFocused(false);
      cursorVisible = false;
    }}
    onkeyup={updateCursorPosition}
    onclick={updateCursorPosition}
    onpointerdown={() => (usingGamepad = false)}
    onkeydown={(e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    }}
  />
  {#if cursorVisible}
    {#key cursorKey}
      <div
        class="custom-cursor"
        style="left: {cursorX}px; top: {cursorY}px; height: {cursorHeight}px;"
        aria-hidden="true"
      ></div>
    {/key}
  {/if}
</div>

<style>
  .custom-cursor {
    position: absolute;
    width: 2px;
    background-color: currentColor;
    pointer-events: none;
    animation: blink 1s step-end infinite;
    z-index: 10;
  }

  @keyframes blink {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0;
    }
  }
</style>
