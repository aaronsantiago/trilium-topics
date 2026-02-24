<script>
  import Keyboard from "$lib/keyboard/keyboard.svelte";
  import { addInputListener } from "$lib/inputs.js";
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import { tick } from 'svelte';

  let title = $state("");
  let inputEl = $state(null);

  async function onInsertWord(word) {
    const pos = inputEl?.selectionStart ?? title.length;
    const before = title.slice(0, pos);
    const after = title.slice(pos);
    const separator = before.length > 0 && !before.endsWith(' ') ? ' ' : '';
    const insertText = separator + word + ' ';
    title = before + insertText + after;
    const newPos = pos + insertText.length;
    await tick();
    inputEl?.focus();
    inputEl?.setSelectionRange(newPos, newPos);
  }

  async function onDeleteWordBackward() {
    const pos = inputEl?.selectionStart ?? title.length;
    let firstChar = true;
    let newPos = 0;
    for (let i = pos - 1; i >= 0; i--) {
      const char = title[i];
      const isSpace = /\s/.test(char);
      const isPunctuation = !isSpace && /\W/.test(char);
      if (isSpace) {
        if (firstChar) { firstChar = false; continue; }
        newPos = i;
        break;
      } else if (isPunctuation) {
        if (firstChar) { newPos = i; break; }
        newPos = i + 1; break;
      } else {
        firstChar = false;
      }
    }
    title = title.slice(0, newPos) + title.slice(pos);
    await tick();
    inputEl?.focus();
    inputEl?.setSelectionRange(newPos, newPos);
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
  }

  function onMoveCursor(direction) {
    if (direction === "left") moveCursorWordLeft();
    else if (direction === "right") moveCursorWordRight();
  }

  $effect(() => {
    return addInputListener((e) => {
      if (e === "cancel") {
        goto(base + "/");
      }
    });
  });
</script>

<div class="flex gap-4 w-screen p-4">
  <div class="flex-grow">
    <Keyboard {onInsertWord} {onDeleteWordBackward} {onMoveCursor} />
  </div>
  <div class="w-96">
    <input
      type="text"
      class="input input-bordered w-full"
      placeholder="Note title"
      bind:value={title}
      bind:this={inputEl}
    />
  </div>
</div>
