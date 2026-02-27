<script>
  import { topicsDbState, getNotes } from "$lib/topicsDb.svelte.js";
  import WordRing from "./wordRing.svelte";
  import { addInputListener, addAxisListener } from "$lib/inputs.js";
  import { generateT9Db } from "$lib/t8-engine.js";
  import * as cheerio from "cheerio";

  let { onInsertWord, onDeleteWordBackward, onMoveCursor } = $props();

  let t9Db = $state({});
  let baseT9Db = $state({});
  let currentString = $state("");
  let selectedWordIndex = $state(0);
  let selectedWordRing = $state(0);

  let t9WordsOverride = $state(null);

  function updateSelectedWordIndex(index) {
    selectedWordIndex = index;
  }

  let t9Words = $derived.by(() => {
    if (t9WordsOverride) {
      return t9WordsOverride;
    }
    let curT9Db = t9Db;
    for (let c of currentString) {
      if (!(c in curT9Db)) {
        return [];
      }
      curT9Db = curT9Db[c];
    }

    let finalWords = curT9Db.entries || [];

    curT9Db = baseT9Db;
    for (let c of currentString) {
      if (!(c in curT9Db)) {
        return [];
      }
      curT9Db = curT9Db[c];
    }

    return [...finalWords, ...(curT9Db.entries || [])];
  });

  $effect(() => {
    t9Words;

    selectedWordRing = 0;
  });

  $effect(() => {
    selectedWordRing;

    let currentRingEl = document.getElementById("word-ring-" + selectedWordRing);
    if (currentRingEl) {
      currentRingEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });

  let wordRings = $derived.by(() => {
    let rings = [];
    let remainingWords = [...t9Words];

    while (remainingWords.length > 0) {
      rings.push(remainingWords.slice(0, 9));
      remainingWords = remainingWords.slice(9);
    }
    return rings;
  });

  $effect(() => {
    (async () => {
      let startTime = Date.now();
      let wordList = await fetch("/master-dictionary-lowercase.txt");
      let text = await wordList.text();
      let textWordList = text.split("\n").map((w) => w.trim());

      baseT9Db = generateT9Db(textWordList);

      console.log(
        "Base T9 DB generated in " + (Date.now() - startTime) + "ms",
      );
    })();
  });

  $effect(() => {
    console.log("Generating T9 DB...");
    let startTime = Date.now();
    let notes = getNotes();
    (async () => {
      let notesWordMap = {};
      for (let noteId in notes) {
        let note = notes[noteId];

        if (note.content) {
          const html = cheerio.load(note.content);
          html("br").replaceWith("\n");
          html("code").replaceWith("\n");

          html("p, div, h1, h2, h3, h4, h5, h6, li, tr, blockquote, pre").each(
            (_, el) => {
              html(el).append("\n");
            },
          );

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
      let wordSet = new Set([...noteWordList]);
      console.log("initial word set generated in " + (Date.now() - startTime) + "ms");
      for (let word of noteWordList) {
        let rootWord = word;
        let suffixes = ["s", "e", "ed", "ing", "ly"];
        for (let suffix of suffixes) {
          if (rootWord.endsWith(suffix)) {
            rootWord = rootWord.slice(0, -suffix.length);
          }
        }
        wordSet.add(rootWord);
        for (let suffix of suffixes) {
          wordSet.add(word + suffix);
          wordSet.add(rootWord + suffix);
        }
      }
      let wordList = Array.from(wordSet);
      console.log("Note word list generated in " + (Date.now() - startTime) + "ms");
      t9Db = generateT9Db(wordList);

      console.log("T9 DB generated in " + (Date.now() - startTime) + "ms");
    })();
  });

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
      if (!t9WordsOverride) {
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
      }

      if (e == "special") {
        if (t9WordsOverride) {
          t9WordsOverride = null;
        } else {
          t9WordsOverride = [".", "\n", "!", "?", ",", "-", ":", ";"];
        }
      }

      if (e == "l3") {
        selectedWordRing = (selectedWordRing + 1) % wordRings.length;
      }

      if (e == "left") {
        onMoveCursor("left");
      }

      if (e == "right") {
        onMoveCursor("right");
      }

      if (e == "up") {
        onMoveCursor("up");
      }

      if (e == "down") {
        onMoveCursor("down");
      }

      if (e == "delete") {
        if (currentString.length > 0) {
          currentString = currentString.slice(0, -1);
        } else {
          onDeleteWordBackward();
        }
      }

      if (e == "confirm") {
        let word = t9Words[selectedWordRing * 9 + selectedWordIndex];
        if (word) {
          currentString = "";
          onInsertWord(word);
        } else {
          currentString = "";
        }
        t9WordsOverride = null;
      }
    });
  });
</script>

<div
  class={"z-100 flex flex-col overflow-x-scroll w-full h-full" +
  " pointer-events-none absolute top-0 left-0 justify-end pb-[10vh]" +
  "" + (currentString ? "" : "hidden")
  }
>
  <div class="bg-base-300/90">{currentString}</div>
  <div class="grid grid-rows-1 grid-flow-col gap-4 justify-start bg-base-300/85">
    {#each wordRings as words, i (words.join("-") + selectedWordRing)}
      <WordRing
        id={"word-ring-" + i}
        className={"w-48"}
        style={"opacity: " + Math.pow(0.7, Math.abs(i - selectedWordRing))}
        selected={i == selectedWordRing}
        xAxisValue={i == selectedWordRing ? wordSelectionXAxis : 0}
        yAxisValue={i == selectedWordRing ? wordSelectionYAxis : 0}
        {words}
        selectedWordIndexUpdateCallback={i == selectedWordRing
          ? updateSelectedWordIndex
          : null}
      />
    {/each}
  </div>
</div>
