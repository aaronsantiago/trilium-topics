<script>
  import { onMount } from "svelte";
  import {
    ClassicEditor,
    Autosave,
    Essentials,
    Paragraph,
    Autoformat,
    TextTransformation,
    Link,
    BlockQuote,
    Bold,
    Table,
    TableToolbar,
    Heading,
    Indent,
    IndentBlock,
    Italic,
    List,
    TodoList,
    Underline,
    Strikethrough,
    Code,
    CodeBlock,
    Alignment,
  } from "ckeditor5";
  import "ckeditor5/ckeditor5.css";

  let { initialData, editHandler } = $props();

  const editorConfig = {
    toolbar: {
      items: [
        "undo",
        "redo",
        "|",
        "heading",
        "|",
        "bold",
        "italic",
        "underline",
        "strikethrough",
        "code",
        "|",
        "link",
        "insertTable",
        "blockQuote",
        "codeBlock",
        "|",
        "alignment",
        "|",
        "bulletedList",
        "numberedList",
        "todoList",
        "outdent",
        "indent",
      ],
      shouldNotGroupWhenFull: false,
    },
    plugins: [
      Alignment,
      Autoformat,
      Autosave,
      BlockQuote,
      Bold,
      Code,
      CodeBlock,
      Essentials,
      Heading,
      Indent,
      IndentBlock,
      Italic,
      Link,
      List,
      Paragraph,
      Strikethrough,
      Table,
      TableToolbar,
      TextTransformation,
      TodoList,
      Underline,
    ],
    heading: {
      options: [
        {
          model: "paragraph",
          title: "Paragraph",
          class: "ck-heading_paragraph",
        },
        {
          model: "heading1",
          view: "h1",
          title: "Heading 1",
          class: "ck-heading_heading1",
        },
        {
          model: "heading2",
          view: "h2",
          title: "Heading 2",
          class: "ck-heading_heading2",
        },
        {
          model: "heading3",
          view: "h3",
          title: "Heading 3",
          class: "ck-heading_heading3",
        },
        {
          model: "heading4",
          view: "h4",
          title: "Heading 4",
          class: "ck-heading_heading4",
        },
        {
          model: "heading5",
          view: "h5",
          title: "Heading 5",
          class: "ck-heading_heading5",
        },
        {
          model: "heading6",
          view: "h6",
          title: "Heading 6",
          class: "ck-heading_heading6",
        },
      ],
    },
    initialData: initialData,
    licenseKey: "GPL",
    link: {
      addTargetToExternalLinks: true,
      defaultProtocol: "https://",
      decorators: {
        toggleDownloadable: {
          mode: "manual",
          label: "Downloadable",
          attributes: {
            download: "file",
          },
        },
      },
    },
    placeholder: "Type or paste your content here!",
    table: {
      contentToolbar: ["tableColumn", "tableRow", "mergeTableCells"],
    },
  };

  let editorElement;

  /**
   * The toolbar is pinned with CSS (position: sticky against #scrollContainer,
   * see <style>), focused or not. CKEditor's own sticky panel only sticks
   * while focused and positions itself against the window, which doesn't
   * scroll here, so switch it off and tell CKEditor's caret-following about
   * the pinned toolbar instead, so it doesn't scroll the caret under it.
   */
  function pinToolbar(editor) {
    const stickyPanel = editor.ui.view.stickyPanel;
    if (stickyPanel) {
      stickyPanel.unbind("isActive");
      stickyPanel.isActive = false;
    }
    const top = editor.ui.view.element?.querySelector(".ck-editor__top");
    editor.editing.view.on(
      "scrollToTheSelection",
      (evt, data) => {
        const h = top?.offsetHeight ?? 0;
        data.ancestorOffset = Math.max(data.ancestorOffset ?? 0, h + 12);
      },
      { priority: "low" },
    );
  }

  onMount(() => {
    let editor;
    let destroyed = false;
    ClassicEditor.create(editorElement, editorConfig).then((created) => {
      // unmounted before CKEditor finished starting
      if (destroyed) return created.destroy();
      editor = created;
      pinToolbar(editor);
      editor.model.document.on("change:data", () => {
        editHandler(editor.getData());
      });
    });
    // destroy on unmount, or every note visit leaks an editor and its
    // window scroll / visualViewport listeners
    return () => {
      destroyed = true;
      editor?.destroy();
    };
  });
</script>

<div
  class="editor-container editor-container_classic-editor prose relative flex flex-col flex-1"
>
  <div class="editor-container__editor flex flex-col flex-1">
    <div id="editor" bind:this={editorElement}></div>
  </div>
</div>

<style>
  .editor-container :global(.ck.ck-editor) {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  /* pinned toolbar: sticks to the top of #scrollContainer (the only scroll
     box between it and the viewport, so nothing in between may get an
     overflow other than visible/clip). Its parent .ck-editor spans the
     whole note, so it stays pinned to the end. Opaque so text scrolls under
     it; z-10 keeps it under the topics popup (z-40) and the flower FAB. */
  .editor-container :global(.ck.ck-editor__top) {
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--ck-color-toolbar-background, #ffead2);
  }

  .editor-container :global(.ck.ck-editor__main) {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  /* no max-height: the editable grows with its content and the page scrolls
     (#scrollContainer), so there's no inner scroll box to get stuck in */
  .editor-container :global(.ck.ck-editor__editable) {
    flex: 1;
  }
</style>
