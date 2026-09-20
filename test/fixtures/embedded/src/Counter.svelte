<script context="module">
  export const increments = 'module-scope';

  export function describeModule() {
    return increments;
  }
</script>

<script>
  export class Counter {
    static STEP = 1;

    total = 0;

    onTick = () => {};

    reset() {
      count = 0;
    }

    async flush() {}
  }

  export const counterActions = {
    bump: 'bump',
    clear: () => {},
  };

  function increment() {
    count += 1;
  }

  let count = 0;
</script>

<button class="counter" on:click={increment}>{count}</button>
