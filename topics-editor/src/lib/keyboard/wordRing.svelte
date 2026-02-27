<script>

  let { id, style, xAxisValue, yAxisValue, selectedWordIndexUpdateCallback, words, selected, className } = $props();

  $effect(() => console.log(words));
  let orderMapping = [6, 7, 8, 5, 0, 1, 4, 3, 2]

  // let xAxisValue = 0;
  // let yAxisValue = 1;

  let selectedWordIndex = $derived.by(() => {
    let xAxisValueInt = Math.round(xAxisValue);
    let yAxisValueInt = Math.round(yAxisValue);
    return (yAxisValueInt + 1) * 3 + (xAxisValueInt + 1);
  });

  $effect(() => {
    selectedWordIndexUpdateCallback &&
      selectedWordIndexUpdateCallback(orderMapping[selectedWordIndex]);
  })

  let orderedWords = orderMapping.map(i => words[i]);
</script>
<div id={id} class={className} style={style}>
  <div class={`grid grid-cols-3 gap-2 ${selected ? "border-2 border-primary" : ""}`}>
    {#each orderedWords as word,i}
      <div class={"p-4 " + (selected && selectedWordIndex == i ? "border" : "")}>{word}</div>
    {/each}
  </div>
</div>
