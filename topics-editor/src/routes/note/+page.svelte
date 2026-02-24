<script>
  import { appState } from "$lib/appState.svelte.js";
  import { topicsDbState } from "$lib/topicsDb.svelte.js";
  import Editor from "$lib/editor.svelte";
  import WordRing from "./wordRing.svelte";
  import { addInputListener, addAxisListener } from "$lib/inputs.js";
  import * as editorActions from "$lib/editorActions.js";
  import { goto } from "$app/navigation";
  import * as cheerio from 'cheerio';

  import { generateT9Db } from "$lib/t8-engine.js";

  let t9Db = $state({});
  let currentString = $state("");

  let editor = $state(null);
  let selectedWordIndex = $state(0);
  let selectedWordRing = $state(0);

  function updateSelectedWordIndex(index) {
    selectedWordIndex = index;
  }

  function setEditor(e) {
    editor = e;
  }

  let t9Words = $derived.by(() => {
    let curT9Db = t9Db;
    for (let c of currentString) {
      if (!(c in curT9Db)) {
        return [];
      }
      curT9Db = curT9Db[c];
    }

    return curT9Db.entries || [];
  });

  $effect(() => {
    t9Words;

    selectedWordRing = 0;
  });

  let wordRings = $derived.by(() => {
    let rings = [];
    let remainingWords = [...t9Words];

    console.log(remainingWords);

    while (remainingWords.length > 0) {
      rings.push(remainingWords.slice(0, 9));
      remainingWords = remainingWords.slice(9);
    }
    console.log(rings);
    return rings;
  });

  $effect(() => {
    (async () => {
      let wordList = await fetch("/google-10000-english-usa.txt");
      let text = await wordList.text();

      let notesWordMap = {};

      for (let noteId in topicsDbState.notes) {
        let note = topicsDbState.notes[noteId];

        if (note.content) {
          console.log(note.content)
          const html = cheerio.load(note.content);
          html("br").replaceWith("\n");
          html("code").replaceWith("\n");

          html('p, div, h1, h2, h3, h4, h5, h6, li, tr, blockquote, pre').each((_, el) => {
            html(el).append('\n');
          });

          let textContent = html.text();

          let words = textContent.split(/\s+/);
          for (let word of words) {
            let cleanedWord = word.toLowerCase().replace(/[^a-z]/g, "");
            if (cleanedWord.length == 0) continue;
            if (!notesWordMap[cleanedWord]) notesWordMap[cleanedWord] = 0;
            notesWordMap[cleanedWord]++;
          }
        }
      }
      let wordsWithCounts = Object.entries(notesWordMap);
      wordsWithCounts.sort((a, b) => b[1] - a[1]);
      let noteWordList = wordsWithCounts.map(([word, count]) => word);
      let noteDictionary = noteWordList.join("\n") + "\n" + text;
      t9Db = generateT9Db(noteDictionary);
    })();
  });

  let note = $derived.by(() => {
    return topicsDbState.notes[appState.selectedNoteId];
  });

  function editHandler(content) {
    console.log("edit handler called", note?.noteId);
    if (!note?.noteId) return;

    if (topicsDbState.updatedNotes[note.noteId] == null) {
      topicsDbState.updatedNotes[note.noteId] = {
        content: content,
      };
    } else {
      topicsDbState.updatedNotes[note.noteId].content = content;
    }
  }

  let wordSelectionXAxis = $state(0);
  let wordSelectionYAxis = $state(0);

  $effect(() => {
    return addAxisListener((e) => {
      if (e.axis == "lx") {
        wordSelectionXAxis = e.value;
      }
      if (e.axis == "ly") {
        wordSelectionYAxis = e.value;
      }
    });
  });

  $effect(() => {
    return addInputListener((e) => {
      if (e == "l2") {
        currentString += "s";
      }
      if (e == "l1") {
        currentString += "t";
      }
      if (e == "r1") {
        currentString += "n";
      }
      if (e == "r2") {
        currentString += "e";
      }

      if (e == "l3") {
        selectedWordRing = (selectedWordRing + 1) % wordRings.length;
      }

      if (e == "left" && editor) {
        editorActions.moveCursorLeft(editor);
      }

      if (e == "right" && editor) {
        editorActions.moveCursorRight(editor);
      }

      if (e == "up" && editor) {
        editorActions.moveCursorUp(editor);
      }

      if (e == "down" && editor) {
        editorActions.moveCursorDown(editor);
      }

      if (e == "delete") {
        if (currentString.length > 0) {
          currentString = currentString.slice(0, -1);
        } else if (editor) {
          editorActions.deleteWordBackward(editor);
        }
      }

      if (e == "confirm") {
        if (editor) {
          let word = t9Words[selectedWordRing * 9 + selectedWordIndex];
          if (word) {
            currentString = "";
            editorActions.insertWord(editor, word);
          }
        }
        currentString = "";
      }

      if (e == "cancel") {
        goto(`/topic`);
      }
    });
  });
</script>

<div class="flex gap-4 w-screen">
  <div class="flex-grow">
    {#each wordRings as words, i (words.join("-") + selectedWordRing)}
      <WordRing
        selected={i == selectedWordRing}
        xAxisValue={i == selectedWordRing ? wordSelectionXAxis : 0}
        yAxisValue={i == selectedWordRing ? wordSelectionYAxis : 0}
        words={words}
        selectedWordIndexUpdateCallback={i == selectedWordRing ? updateSelectedWordIndex : null}
      />
    {/each}
    <div>{currentString}</div>
    <div>
      {#each t9Words as word, i}
        <div>{word}</div>
      {/each}
    </div>
  </div>
  <div>
    <div class="">{note?.title}</div>
    <Editor
      {editHandler}
      initialData={topicsDbState.updatedNotes[note?.noteId]?.content ||
        note?.content}
      editorCallback={setEditor}
    />
  </div>
</div>
