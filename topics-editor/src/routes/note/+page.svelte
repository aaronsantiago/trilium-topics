<script>
  import { appState } from "$lib/appState.svelte.js";
  import { topicsDbState, getNotes } from "$lib/topicsDb.svelte.js";
  import Editor from "$lib/editor.svelte";
  import Keyboard from "$lib/keyboard/keyboard.svelte";
  import { addInputListener } from "$lib/inputs.js";
  import * as editorActions from "$lib/editorActions.js";
  import { goto } from "$app/navigation";

  let editor = $state(null);

  function setEditor(e) {
    editor = e;
  }

  let note = $derived.by(() => {
    let notes = getNotes();
    return notes[appState.selectedNoteId];
  });


  function editHandler(content) {
    if (!note?.noteId) return;

    if (topicsDbState.createdNotes[note.noteId]) {
      topicsDbState.createdNotes[note.noteId].content = content;
      return;
    }
    else if (topicsDbState.updatedNotes[note.noteId] == null) {
      topicsDbState.updatedNotes[note.noteId] = {
        content: content,
        noteId: note.noteId,
        title: note.title,
        dateCreated: note.dateCreated
      };
    } else {
      topicsDbState.updatedNotes[note.noteId].content = content;
    }
  }

  function onInsertWord(word) {
    if (editor) {
      editorActions.insertWord(editor, word);
    }
  }

  function onDeleteWordBackward() {
    if (editor) {
      editorActions.deleteWordBackward(editor);
    }
  }

  function onMoveCursor(direction) {
    if (!editor) return;
    if (direction == "left") editorActions.moveCursorLeft(editor);
    if (direction == "right") editorActions.moveCursorRight(editor);
    if (direction == "up") editorActions.moveCursorUp(editor);
    if (direction == "down") editorActions.moveCursorDown(editor);
  }

  $effect(() => {
    return addInputListener((e) => {
      if (e == "cancel") {
        goto(`/topic`);
      }
    });
  });
</script>

<div class="flex gap-4 w-screen flex-col">
  <div class="flex-grow">
    <div class="">{note?.title}</div>
    <Editor
      {editHandler}
      initialData={note?.content}
      editorCallback={setEditor}
    />
  </div>
  <div>
    <Keyboard {onInsertWord} {onDeleteWordBackward} {onMoveCursor} />
  </div>
</div>
