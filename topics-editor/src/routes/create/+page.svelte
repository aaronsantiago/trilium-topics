<script>
  import Keyboard from "$lib/keyboard/keyboard.svelte";
  import { addInputListener } from "$lib/inputs.js";
  import { appState } from "$lib/appState.svelte.js";
  import { topicsDbState, refreshTopicsDb } from "$lib/topicsDb.svelte.js";
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import { tick } from 'svelte';
  import dayjs from "dayjs";

  let title = $state("");
  let inputEl = $state(null);
  let highlightState = $state(0);
  let selectedTopics = $state([]);

  async function onInsertWord(word) {
    if (highlightState > 0) return;

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
    if (highlightState > 0) return;

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
    if (highlightState > 0) return;

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
    if (highlightState > 0) return;

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
    if (direction === "left") {
      if (highlightState > 0) {
        highlightState = 0;
      } else {
        moveCursorWordLeft();
      }
    }
    else if (direction === "right") moveCursorWordRight();
    else if (direction === "up") highlightState -= 1;
    else if (direction === "down") highlightState += 1;
  }

  let topics = $derived.by(() => {
    let topicNotes = topicsDbState.topicsDb?.children || [];
    return topicNotes.map((topic) => {
      return topic.title;
    });
  });

  async function createNote() {

    let response = await fetch(topicsDbState.triliumUrl + '/custom/create-note', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        "title": title,
        "dateCreated": dayjs().format('YYYY-MM-DD HH:mm:ss.SSS').concat(dayjs().format('Z').replace(':', '')),//"2026-02-18 13:27:23.347-0500",
        "secret": topicsDbState.triliumSecret,
        "content": "",
        "topics": selectedTopics
      }),
    })

    if (response.ok) {
      const data = await response.json();

      await refreshTopicsDb();

      appState.selectedTopic = selectedTopics[0];
      appState.selectedNoteName = title;
      appState.selectedNoteId = data.noteId;
      goto(base + `/note`);
    } else {
      console.error("Failed to create note", response.statusText);
    }
  }

  $effect(() => {
    return addInputListener((e) => {
      if (["l1", "l2", "r1", "r2"].includes(e)) {
        highlightState = 0;
      }
      if (e === "confirm") {
        if (highlightState == 1) {
          if (title.trim() === "" || selectedTopics.length == 0) return;

          createNote();
        }
        if (highlightState > 1) {
          const topic = topics[highlightState - 2];
          if (selectedTopics.includes(topic)) {
            selectedTopics = selectedTopics.filter(t => t !== topic);
          } else {
            selectedTopics = [...selectedTopics, topic];
          }
        }
      }
      if (e === "delete") {
        if (highlightState > 0) {
          selectedTopics = selectedTopics.slice(0, selectedTopics.length - 1);
        }
      }
      if (e === "cancel") {
        goto(base + "/");
      }
    });
  });

  $effect(() => {
    highlightState = Math.max(0, Math.min(highlightState, topics.length + 2));

    if (highlightState == 0) {
      inputEl?.focus();
    } else {
      inputEl?.blur();
      const el = document.querySelector("#topic_" + topics[highlightState - 2]);
      if (el) {
        el.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        });
      }
    }
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
    <button class={"btn mt-2 btn-soft" + (highlightState == 1 ? " btn-secondary" : " btn-primary")} disabled={title.trim() === "" || selectedTopics.length == 0}>Create</button>
    {#each topics as topic, i}
      <div class={(i + 2) === highlightState ? "border" : ""}>{topic}</div>
    {/each}
  </div>
</div>
