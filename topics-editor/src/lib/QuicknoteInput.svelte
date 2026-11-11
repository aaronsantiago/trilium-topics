<script>
  let { placeholder, onSubmit } = $props();

  let title = $state("");
  let inputEl = $state(null);

  function submit() {
    const text = title.trim();
    if (!text) return;
    onSubmit(text);
    title = "";
    // keep focus (and the phone keyboard up) for rapid successive notes
    inputEl?.focus();
    inputEl?.setSelectionRange(0, 0);
  }
</script>

<input
  id="quicknoteInputField"
  type="text"
  class="input input-bordered w-full"
  {placeholder}
  bind:value={title}
  bind:this={inputEl}
  onkeydown={(e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  }}
/>
