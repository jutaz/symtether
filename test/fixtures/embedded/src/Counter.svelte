<script context="module">
  export const increments = 'module-scope';
</script>

<script>
  export class Counter {
    reset() {
      count = 0;
    }
  }

  function increment() {
    count += 1;
  }

  let count = 0;
</script>

<button class="counter" on:click={increment}>{count}</button>
