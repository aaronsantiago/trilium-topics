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

  let { initialData, editHandler, editorCallback } = $props();

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

  onMount(() => {
    (async () => {
      let editor = await ClassicEditor.create(
        document.querySelector("#editor"),
        editorConfig,
      );

      editor.model.document.on("change:data", () => {
        console.log("change detected");
        editHandler(editor.getData());
      });

      if (editorCallback) {
        editorCallback(editor);
      }
    })();
  });
</script>

<div class="editor-container editor-container_classic-editor prose">
  <div class="editor-container__editor"><div id="editor"></div></div>
</div>
