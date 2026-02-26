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
    scrollViewportToShowTarget,
  } from "ckeditor5";
  import "ckeditor5/ckeditor5.css";

  let { initialData, editHandler, editorCallback } = $props();

  let cursorX = $state(0);
  let cursorY = $state(0);
  let cursorHeight = $state(20);
  let cursorVisible = $state(false);
  let cursorKey = $state(0);
  let containerEl = $state(null);
  let isProgrammaticScroll = false;


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

  function updateCursorPosition(editor) {
    try {
      const modelPos = editor.model.document.selection.getFirstPosition();
      if (!modelPos) { cursorVisible = false; return; }

      const viewPos = editor.editing.mapper.toViewPosition(modelPos);
      if (!viewPos) { cursorVisible = false; return; }

      const domPos = editor.editing.view.domConverter.viewPositionToDom(viewPos);
      if (!domPos) { cursorVisible = false; return; }

      const domRange = document.createRange();
      domRange.setStart(domPos.parent, domPos.offset);
      domRange.setEnd(domPos.parent, domPos.offset);

      isProgrammaticScroll = true;
      scrollViewportToShowTarget({ target: domRange, viewportOffset: 50 });
      requestAnimationFrame(() => { isProgrammaticScroll = false; });

      const rect = domRange.getBoundingClientRect();
      const containerRect = containerEl.getBoundingClientRect();

      if (rect.width === 0 && rect.height === 0 && rect.top === 0) {
        // Fallback for empty paragraphs: use parent element rect
        const parentEl = domPos.parent.nodeType === Node.TEXT_NODE
          ? domPos.parent.parentElement
          : domPos.parent;
        const parentRect = parentEl?.getBoundingClientRect();
        if (!parentRect) { cursorVisible = false; return; }
        cursorX = parentRect.left - containerRect.left;
        cursorY = parentRect.top - containerRect.top;
        cursorHeight = parentRect.height || 20;
      } else {
        cursorX = rect.left - containerRect.left;
        cursorY = rect.top - containerRect.top;
        cursorHeight = rect.height || 20;
      }

      cursorKey++;
      cursorVisible = true;
    } catch (e) {
      cursorVisible = false;
    }
  }

  onMount(() => {
    (async () => {
      let editor = await ClassicEditor.create(
        document.querySelector("#editor"),
        editorConfig,
      );

      // Suppress Android soft keyboard
      const editableEl = editor.editing.view.getDomRoot();
      editableEl.setAttribute("inputmode", "none");

      editor.model.document.on("change:data", () => {
        console.log("change detected");
        editHandler(editor.getData());
      });

      // Track cursor on all model changes (selection-only changes don't fire change:data)
      editor.model.document.on("change", () => {
        updateCursorPosition(editor);
      });

      // Update cursor on programmatic scroll; hide it on manual scroll
      editableEl.addEventListener("scroll", () => {
        if (isProgrammaticScroll) {
          updateCursorPosition(editor);
        } else {
          cursorVisible = false;
        }
      });

      if (editorCallback) {
        editorCallback(editor);
      }

      // Initial cursor render
      updateCursorPosition(editor);
    })();
  });
</script>

<div
  bind:this={containerEl}
  class="editor-container editor-container_classic-editor prose relative flex flex-col flex-1"
>
  <div class="editor-container__editor flex flex-col flex-1"><div id="editor"></div></div>

  {#if cursorVisible}
    {#key cursorKey}
      <div
        class="custom-cursor"
        style="left: {cursorX}px; top: {cursorY}px; height: {cursorHeight}px;"
        aria-hidden="true"
      ></div>
    {/key}
  {/if}
</div>

<style>
  .editor-container :global(.ck.ck-editor) {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .editor-container :global(.ck.ck-editor__main) {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .editor-container :global(.ck.ck-editor__editable) {
    flex: 1;
    max-height: 90vh;
  }

  .custom-cursor {
    position: absolute;
    width: 2px;
    background-color: currentColor;
    pointer-events: none;
    animation: blink 1s step-end infinite;
    z-index: 10;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0; }
  }
</style>
