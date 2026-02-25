/**
 * CKEditor model manipulation operations extracted from the note page.
 * Each function takes the CKEditor `editor` instance as its first argument.
 */

function ensureFocus(editor) {
  if (!editor.editing.view.document.isFocused) {
    editor.editing.view.focus();
    return false;
  }
  return true;
}

export function moveCursorLeft(editor) {
  if (!ensureFocus(editor)) return;

  editor.model.change((writer) => {
    let selection = editor.model.document.selection;
    let position = selection.getFirstPosition();
    if (position) {
      // At start of paragraph — jump to end of previous paragraph
      if (position.offset === 0) {
        const previousSibling = position.parent.previousSibling;
        if (previousSibling) {
          writer.setSelection(writer.createPositionAt(previousSibling, "end"));
        }
        return;
      }

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
            if (firstChar) {
              firstChar = false;
              continue;
            }
            writer.setSelection(nextPosition);
            return;
          } else if (isPunctuation) {
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
          writer.setSelection(writer.createPositionAt(item, 0));
          return;
        }
      }
    }
  });
}

export function moveCursorRight(editor) {
  if (!ensureFocus(editor)) return;

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
      let lastWordEndPosition = null;

      for (const { item, nextPosition, previousPosition } of walker) {
        if (item.is("$textProxy")) {
          const char = item.data;
          const isSpace = /\s/.test(char);
          const isPunctuation = !isSpace && /\W/.test(char);

          if (isSpace) {
            if (firstChar) {
              firstChar = false;
              continue;
            }
            writer.setSelection(previousPosition);
            return;
          } else if (isPunctuation) {
            if (firstChar) {
              writer.setSelection(nextPosition);
              return;
            }
            writer.setSelection(previousPosition);
            return;
          } else {
            firstChar = false;
            lastWordEndPosition = nextPosition;
          }
        } else if (item.is("element")) {
          if (!firstChar && lastWordEndPosition) {
            writer.setSelection(lastWordEndPosition);
            return;
          }
          const pos = writer.createPositionAt(item, 0);
          writer.setSelection(pos);
          return;
        }
      }

      // Single-line case: loop ended at end-of-range after traversing a word
      if (!firstChar && lastWordEndPosition) {
        writer.setSelection(lastWordEndPosition);
      }
    }
  });
}

export function moveCursorUp(editor) {
  if (!ensureFocus(editor)) return;

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
        if (!skipFirst) {
          skipFirst = true;
          continue;
        }
        if (item.is("element")) {
          const newPosition = writer.createPositionAt(item, 0);
          writer.setSelection(newPosition);

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

export function moveCursorDown(editor) {
  if (!ensureFocus(editor)) return;

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
        if (item.is("element")) {
          const newPosition = writer.createPositionAt(item, 0);
          writer.setSelection(newPosition);

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

export function deleteWordBackward(editor) {
  if (!ensureFocus(editor)) return;

  editor.model.change((writer) => {
    let selection = editor.model.document.selection;
    let position = selection.getFirstPosition();
    let endPosition = null;
    if (position) {
      // At start of paragraph — merge with previous paragraph (delete the newline)
      if (position.offset === 0) {
        const previousSibling = position.parent.previousSibling;
        if (previousSibling) {
          writer.merge(writer.createPositionBefore(position.parent));
        }
        return;
      }

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
            if (firstChar) {
              firstChar = false;
              continue;
            }
            endPosition = nextPosition;
            break;
          } else if (isPunctuation) {
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

export function insertWord(editor, word) {
  if (!ensureFocus(editor)) return;

  editor.model.change((writer) => {
    if (word == "\n") {
      editor.execute('enter');
    }
    else {
      const insertedRange = editor.model.insertContent(
        writer.createText(word + " "),
        editor.model.document.selection,
      );

      writer.setSelection(insertedRange.end);
    }
  });
}
