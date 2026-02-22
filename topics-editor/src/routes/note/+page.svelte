<script>
  import { appState } from "$lib/appState.svelte.js";
  import { topicsDbState } from "$lib/topicsDb.svelte.js";
  import Editor from "$lib/editor.svelte";
  import { addInputListener } from "$lib/inputs.js";
  import { goto } from "$app/navigation";

  import { generateT9Db } from "$lib/t8-engine.js";

  let t9Db = $state({});
  let currentString = $state("");

  let editor = $state(null);

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
    (async () => {
      let wordList = await fetch("/google-10000-english-usa.txt");
      let text = await wordList.text();
      t9Db = generateT9Db(text);
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
                  }
                  else if (isPunctuation) {
                    // if the first char found is a punctuation, move to the other side of it
                    if (firstChar) {
                      writer.setSelection(nextPosition);
                      return;
                    }
                    writer.setSelection(previousPosition);
                    return;
                  }
                  else {
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
                  }
                  else if (isPunctuation) {
                    // if the first char found is a punctuation, move to the other side of it
                    if (firstChar) {
                      writer.setSelection(nextPosition);
                      return;
                    }
                    writer.setSelection(previousPosition);
                    return;
                  }
                  else {
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

      if (e == "confirm") {
        if (editor) {
          let word = t9Words[0];
          if (word) {
            currentString = "";
            editor.model.change((writer) => {
              editor.model.insertContent(
                writer.createText(word + " "),
                editor.model.document.selection,
              );
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

<div>{currentString}</div>
<div>
  {#each t9Words as word, i}
    <div>{word}</div>
  {/each}
</div>
<div class="card card-m">
  <div class="card-body">
    <div class="card-title text-2xl">{note?.title}</div>
    <Editor
      {editHandler}
      initialData={topicsDbState.updatedNotes[note?.noteId]?.content ||
        note?.content}
      editorCallback={setEditor}
    />
  </div>
</div>
