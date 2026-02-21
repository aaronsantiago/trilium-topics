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
        // move the cursor to the beginning of the previous word
        if (editor) {
          editor.model.change((writer) => {
            let selection = editor.model.document.selection;
            let position = selection.getFirstPosition();
            if (position) {
              let text = position.nodeBefore?.data || position.textNode?.data;

              let prevWordOffset = 1;

              for (; text[position.offset - prevWordOffset - 1] && text[position.offset - prevWordOffset - 1] != " "; prevWordOffset++) {}
              let prevWordPosition = position.getShiftedBy(-prevWordOffset);
              if (prevWordPosition) {
                writer.setSelection(prevWordPosition);
              }
            }
          });
        }
      }

      if (e == "right") {
        // move the cursor to the end of the next word
        if (editor) {
          editor.model.change((writer) => {
            let selection = editor.model.document.selection;
            let position = selection.getFirstPosition();
            if (position) {
              let text = position.nodeAfter?.data || position.textNode?.data;

              let nextWordOffset = 0;

              for (; text[position.offset + nextWordOffset] && text[position.offset + nextWordOffset] != " "; nextWordOffset++) {}
              nextWordOffset++;
              let nextWordPosition = position.getShiftedBy(nextWordOffset);
              if (nextWordPosition) {
                writer.setSelection(nextWordPosition);
              }
            }
          });
        }
      }

      if (e == "up") {
        // move the cursor to the previous node
        if (editor) {
          editor.model.change((writer) => {
            let selection = editor.model.document.selection;
            let position = selection.getFirstPosition();
            if (position) {
              let nextNode = position.parent.previousSibling;

              if (nextNode) {
                let newPosition = writer.createPositionAt(nextNode, 0);
                writer.setSelection(newPosition);
              }
            }
          });
        }
      }

      if (e == "down") {
        // move the cursor to the next node
        if (editor) {
          editor.model.change((writer) => {
            let selection = editor.model.document.selection;
            let position = selection.getFirstPosition();
            if (position) {
              let nextNode = position.parent.nextSibling;

              if (nextNode) {
                let newPosition = writer.createPositionAt(nextNode, 0);
                writer.setSelection(newPosition);
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
