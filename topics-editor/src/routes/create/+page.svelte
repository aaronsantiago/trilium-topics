<script>
  import Keyboard from "$lib/keyboard/keyboard.svelte";
  import { addInputListener } from "$lib/inputs.js";
  import { appState } from "$lib/appState.svelte.js";
  import { topicsDbState, refreshTopicsDb } from "$lib/topicsDb.svelte.js";
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import { tick } from 'svelte';
  import dayjs from "dayjs";
  import { getNextFocus } from '@bbc/tv-lrud-spatial';
  import { onMount } from "svelte";

  let title = $state("");
  let inputEl = $state(null);
  let selectedTopics = $state([]);
  let cursorX = $state(0);
  let cursorY = $state(0);
  let cursorHeight = $state(20);
  let cursorVisible = $state(false);
  let cursorKey = $state(0);
  let inputWrapperEl = $state(null);

  // we need to optionally disable the native mobile keyboard
  // because we are providing our own custom keyboard and the native one can get in the way
  // but if the user is using touch input, they likely want the native keyboard, so we only disable it when we detect gamepad input
  let usingGamepad = $state(false);

  onMount(() => {

    inputEl.addEventListener("pointerdown", (e) => {usingGamepad = false});

  });

  function updateCursorPosition() {
    if (!inputEl) { cursorVisible = false; return; }
    try {
      const pos = inputEl.selectionStart ?? title.length;
      const textBefore = title.slice(0, pos);
      const style = getComputedStyle(inputEl);

      const mirror = document.createElement('span');
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
    const separator = before.length > 0 && !before.endsWith(' ') ? ' ' : '';
    const insertText = separator + word + ' ';
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
        if (firstChar) { firstChar = false; continue; }
        newPos = i;
        break;
      } else if (isPunctuation) {
        if (firstChar) { newPos = i + 1; break; }
        newPos = i; break;
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
      if (document.activeElement !== inputEl) {
        inputEl?.focus();
      } else {
        moveCursorWordLeft();
      }
    } else if (direction === "right") {
      if (document.activeElement !== inputEl) {
        const next = getNextFocus(document.activeElement, 'ArrowRight');
        if (next) next.focus();
      } else {
        moveCursorWordRight();
      }
    } else if (direction === "up") {
      const next = getNextFocus(document.activeElement, 'ArrowUp');
      if (next) {
        next.focus();
        next.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } else if (direction === "down") {
      const next = getNextFocus(document.activeElement, 'ArrowDown');
      if (next) {
        next.focus();
        next.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  let topics = $derived.by(() => {
    let topicNotes = topicsDbState.topicsDb?.children || [];
    return topicNotes.map((topic) => {
      return topic.title;
    });
  });

  async function createNote() {
    let tempNoteId = crypto.randomUUID();
    topicsDbState.createdNotes[tempNoteId] = {
      title: title,
      noteId: tempNoteId,
      dateCreated: dayjs().format('YYYY-MM-DD HH:mm:ss.SSS').concat(dayjs().format('Z').replace(':', '')),
      content: "",
      topics: selectedTopics
    };
    appState.selectedTopic = selectedTopics[0];
    appState.selectedNoteName = title;
    appState.selectedNoteId = tempNoteId;
    goto(base + `/note`);

  }

  function toggleTopic() {
    console.log("toggletopic called")
    const topic = document.activeElement?.dataset?.topic;
    if (!topic) return;

    if (selectedTopics.includes(topic)) {
      selectedTopics = selectedTopics.filter(t => t !== topic);
    } else {
      selectedTopics = [...selectedTopics, topic];
    }
  }

  $effect(() => {
    return addInputListener((e) => {
      usingGamepad = true;

      if (["l1", "l2", "r1", "r2"].includes(e)) {
        inputEl?.focus();
        updateCursorPosition();
      }
      if (e === "confirm") {
        if (document.activeElement?.dataset?.action === 'create') {
          if (title.trim() === "" || selectedTopics.length == 0) return;
          createNote();
        }
        else if (document.activeElement?.dataset?.topic) {
          toggleTopic();
        }
      }
      if (e === "delete") {
        if (document.activeElement !== inputEl) {
          selectedTopics = selectedTopics.slice(0, selectedTopics.length - 1);
        }
      }
      if (e === "cancel") {
        goto(base + "/");
      }
    });
  });
</script>

<Keyboard {onInsertWord} {onDeleteWordBackward} {onMoveCursor} />
<div class="w-full grid grid-cols-1 h-full overflow-y-auto">
  <div class="relative" bind:this={inputWrapperEl}>
    <input
      type="text"
      class="input input-bordered w-full caret-transparent"
      placeholder="Note title"
      inputmode={usingGamepad ? "none" : null}
      bind:value={title}
      bind:this={inputEl}
      onfocus={() => updateCursorPosition()}
      onclick={() => updateCursorPosition()}
      onkeyup={() => updateCursorPosition()}
      onblur={() => { cursorVisible = false; }}
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
  <div>
    {#each selectedTopics as topic}
      <span class="badge badge-primary mr-1">{topic}</span>
    {/each}
  </div>
  <button
    class="btn mt-2 btn-soft btn-primary outline-none focus:bg-secondary focus:text-secondary-content"
    tabindex="0"
    data-action="create"
    disabled={title.trim() === "" || selectedTopics.length == 0}
    onclick={createNote}
  >Create</button>
  {#each topics as topic}
    <div
      class="outline-none focus:bg-secondary focus:text-secondary-content rounded px-2 py-1 cursor-pointer"
      tabindex="0"
      data-topic={topic}
      onclick={toggleTopic}
    >
      {topic}
      {#if selectedTopics.includes(topic)}
        <span class="badge badge-primary ml-1">✓</span>
      {/if}
    </div>
  {/each}
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
    0%, 100% { opacity: 1; }
    50%       { opacity: 0; }
  }
</style>
