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

  let title = $state("");
  let inputEl = $state(null);
  let selectedTopics = $state([]);

  $effect(() => {
    if (inputEl) inputEl.focus();
  });

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

    // let response = await fetch(topicsDbState.triliumUrl + '/custom/create-note', {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify({
    //     "title": title,
    //     "dateCreated": dayjs().format('YYYY-MM-DD HH:mm:ss.SSS').concat(dayjs().format('Z').replace(':', '')),//"2026-02-18 13:27:23.347-0500",
    //     "secret": topicsDbState.triliumSecret,
    //     "content": "",
    //     "topics": selectedTopics
    //   }),
    // })

    // if (response.ok) {
    //   const data = await response.json();

    //   await refreshTopicsDb();

    //   appState.selectedTopic = selectedTopics[0];
    //   appState.selectedNoteName = title;
    //   appState.selectedNoteId = data.noteId;
    //   goto(base + `/note`);
    // } else {
    //   console.error("Failed to create note", response.statusText);
    // }
  }

  $effect(() => {
    return addInputListener((e) => {
      if (["l1", "l2", "r1", "r2"].includes(e)) {
        inputEl?.focus();
      }
      if (e === "confirm") {
        if (document.activeElement?.dataset?.action === 'create') {
          if (title.trim() === "" || selectedTopics.length == 0) return;
          createNote();
        }
        const topic = document.activeElement?.dataset?.topic;
        if (topic) {
          if (selectedTopics.includes(topic)) {
            selectedTopics = selectedTopics.filter(t => t !== topic);
          } else {
            selectedTopics = [...selectedTopics, topic];
          }
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

<div class="flex gap-4 w-screen p-4">
  <div class="flex-grow h-full overflow-hidden">
    <Keyboard {onInsertWord} {onDeleteWordBackward} {onMoveCursor} />
  </div>
  <div class="w-96 grid grid-cols-1 h-full overflow-y-auto">
    <input
      type="text"
      class="input input-bordered w-full"
      placeholder="Note title"
      bind:value={title}
      bind:this={inputEl}
    />
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
    >Create</button>
    {#each topics as topic}
      <div
        class="outline-none focus:bg-secondary focus:text-secondary-content rounded px-2 py-1 cursor-pointer"
        tabindex="0"
        data-topic={topic}
      >
        {topic}
        {#if selectedTopics.includes(topic)}
          <span class="badge badge-primary ml-1">✓</span>
        {/if}
      </div>
    {/each}
  </div>
</div>
