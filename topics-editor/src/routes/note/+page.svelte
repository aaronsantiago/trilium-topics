<script>
  import { appState } from "$lib/appState.svelte.js";
  import { topicsDbState } from "$lib/topicsDb.svelte.js";
  import Editor from "$lib/editor.svelte";
  import WordRing from "./wordRing.svelte";
  import { addInputListener, addAxisListener } from "$lib/inputs.js";
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

      if (e == "left") {
        // move the cursor to the end of the next word
        if (editor) {
          if (!editor.editing.view.document.isFocused) {
            editor.editing.view.focus();
            return;
          }

          editor.model.change((writer) => {
            let selection = editor.model.document.selection;
            let position = selection.getFirstPosition();
            if (position) {
              const root = editor.model.document.getRoot();
              const range = editor.model.createRange(
                editor.model.createPositionAt(root, 0),
                position,
              );

              const walker = range.getWalker({
                singleCharacters: true,
                ignoreElementEnd: true,
                direction: "backward",
              });

              let firstChar = true;

              for (const { item, nextPosition, previousPosition } of walker) {
                if (item.is("$textProxy")) {
                  const char = item.data;
                  const isSpace = /\s/.test(char);
                  const isPunctuation = !isSpace && /\W/.test(char);

                  if (isSpace) {
                    // if first char found is space we should skip it
                    if (firstChar) {
                      firstChar = false;
                      continue;
                    }
                    // note that this is different from the right case
                    // we want to be on the left side of spaces for inputs
                    writer.setSelection(nextPosition);
                    return;
                  } else if (isPunctuation) {
                    // if the first char found is a punctuation, move to the other side of it
                    if (firstChar) {
                      writer.setSelection(nextPosition);
                      return;
                    }
                    writer.setSelection(previousPosition);
                    return;
                  } else {
                    firstChar = false;
                  }
                } else if (item.is("element")) {
                  // Treat element boundaries as word boundaries
                  const pos = writer.createPositionAt(item, 0);
                  writer.setSelection(pos);
                  return;
                }
              }
            }
          });
        }
      }

      if (e == "right") {
        // move the cursor to the end of the next word
        if (editor) {
          if (!editor.editing.view.document.isFocused) {
            editor.editing.view.focus();
            return;
          }

          editor.model.change((writer) => {
            let selection = editor.model.document.selection;
            let position = selection.getFirstPosition();
            if (position) {
              const root = editor.model.document.getRoot();
              const range = editor.model.createRange(
                position,
                editor.model.createPositionAt(root, "end"),
              );

              const walker = range.getWalker({
                singleCharacters: true,
                ignoreElementEnd: true,
                direction: "forward",
              });

              let firstChar = true;

              for (const { item, nextPosition, previousPosition } of walker) {
                if (item.is("$textProxy")) {
                  const char = item.data;
                  const isSpace = /\s/.test(char);
                  const isPunctuation = !isSpace && /\W/.test(char);

                  if (isSpace) {
                    // if first char found is space we should skip it
                    if (firstChar) {
                      firstChar = false;
                      continue;
                    }
                    writer.setSelection(previousPosition);
                    return;
                  } else if (isPunctuation) {
                    // if the first char found is a punctuation, move to the other side of it
                    if (firstChar) {
                      writer.setSelection(nextPosition);
                      return;
                    }
                    writer.setSelection(previousPosition);
                    return;
                  } else {
                    firstChar = false;
                  }
                } else if (item.is("element")) {
                  // Treat element boundaries as word boundaries
                  const pos = writer.createPositionAt(item, 0);
                  writer.setSelection(pos);
                  return;
                }
              }
            }
          });
        }
      }

      if (e == "up") {
        if (editor) {
          if (!editor.editing.view.document.isFocused) {
            editor.editing.view.focus();
            return;
          }

          editor.model.change((writer) => {
            const selection = editor.model.document.selection;
            const position = selection.getFirstPosition();

            if (position) {
              const root = editor.model.document.getRoot();
              const range = editor.model.createRange(
                editor.model.createPositionAt(root, 0),
                position,
              );

              const walker = range.getWalker({
                ignoreElementEnd: true,
                direction: "backward",
              });
              let skipFirst = false;
              for (const { item, previousPosition } of walker) {
                // initial previous is the beginning of the current position, so skip it
                if (!skipFirst) {
                  skipFirst = true;
                  continue;
                }
                // Skip text nodes, look for a block element
                if (item.is("element")) {
                  const newPosition = writer.createPositionAt(item, 0);
                  writer.setSelection(newPosition);

                  // If the new position has the same total offset as the current position,
                  // it means it's the same line, so keep looking
                  let currentTotalOffset = position.path.reduce(
                    (a, b) => a + b,
                    0,
                  );
                  let newTotalOffset = newPosition.path.reduce(
                    (a, b) => a + b,
                    0,
                  );
                  if (currentTotalOffset == newTotalOffset) {
                    continue;
                  }
                  break;
                }
              }
            }
          });
        }
      }

      if (e == "down") {
        if (editor) {
          if (!editor.editing.view.document.isFocused) {
            editor.editing.view.focus();
            return;
          }

          editor.model.change((writer) => {
            const selection = editor.model.document.selection;
            const position = selection.getFirstPosition();

            if (position) {
              const root = editor.model.document.getRoot();
              const range = editor.model.createRange(
                position,
                editor.model.createPositionAt(root, "end"),
              );

              const walker = range.getWalker({
                ignoreElementEnd: true,
              });
              let skipFirst = false;
              for (const { item, nextPosition } of walker) {
                // Skip text nodes, look for a block element
                if (item.is("element")) {
                  const newPosition = writer.createPositionAt(item, 0);
                  writer.setSelection(newPosition);

                  // If the new position has the same total offset as the current position,
                  // it means it's the same line, so keep looking
                  let currentTotalOffset = position.path.reduce(
                    (a, b) => a + b,
                    0,
                  );
                  let newTotalOffset = newPosition.path.reduce(
                    (a, b) => a + b,
                    0,
                  );
                  if (currentTotalOffset == newTotalOffset) {
                    continue;
                  }
                  break;
                }
              }
            }
          });
        }
      }

      if (e == "delete") {
        if (currentString.length > 0) {
          currentString = currentString.slice(0, -1);
        } else {
          if (editor) {
            if (!editor.editing.view.document.isFocused) {
              editor.editing.view.focus();
              return;
            }

            editor.model.change((writer) => {
              let selection = editor.model.document.selection;
              let position = selection.getFirstPosition();
              let endPosition = null;
              if (position) {
                const root = editor.model.document.getRoot();
                const range = editor.model.createRange(
                  editor.model.createPositionAt(root, 0),
                  position,
                );

                const walker = range.getWalker({
                  singleCharacters: true,
                  ignoreElementEnd: true,
                  direction: "backward",
                });

                let firstChar = true;

                for (const { item, nextPosition, previousPosition } of walker) {
                  if (item.is("$textProxy")) {
                    const char = item.data;
                    const isSpace = /\s/.test(char);
                    const isPunctuation = !isSpace && /\W/.test(char);

                    if (isSpace) {
                      // if first char found is space we should skip it
                      if (firstChar) {
                        firstChar = false;
                        continue;
                      }
                      // note that this is different from the right case
                      // we want to be on the left side of spaces for inputs
                      endPosition = nextPosition;
                      break;
                    } else if (isPunctuation) {
                      // if the first char found is a punctuation, move to the other side of it
                      if (firstChar) {
                        endPosition = nextPosition;
                        break;
                      }
                      endPosition = previousPosition;
                      break;
                    } else {
                      firstChar = false;
                    }
                  } else if (item.is("element")) {
                    // Treat element boundaries as word boundaries
                    endPosition = writer.createPositionAt(item, 0);
                    break;
                  }
                }

                if (endPosition) {
                  const deleteRange = writer.createRange(endPosition, position);
                  writer.remove(deleteRange);
                }
              }
            });
          }
        }
      }

      if (e == "confirm") {
        if (editor) {
          let word = t9Words[selectedWordRing * 9 + selectedWordIndex];
          if (word) {
            currentString = "";
            editor.model.change((writer) => {
              const insertedRange = editor.model.insertContent(
                writer.createText(word + " "),
                editor.model.document.selection,
              );

              writer.setSelection(insertedRange.end);
            });
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
