<script lang="ts">
  import { onMount } from 'svelte';

  export class UserCard {
    private expanded = false;

    render(): string {
      return this.expanded ? 'open' : 'closed';
    }
  }

  export function makeCard(): UserCard {
    return new UserCard();
  }

  onMount(() => {
    const node = document.querySelector('.card');
    node?.setAttribute('data-ready', 'true');
  });

  export const MAX_CARDS: number = 12;
</script>

<article class="card" class:expanded={false}>
  <h2>{title}</h2>

  {#if items.length > 0}
    <ul>
      {#each items as item, i (item.id)}
        <li on:click={() => select(item)}>{i}: {item.name}</li>
      {/each}
    </ul>
  {:else}
    <p>Nothing here.</p>
  {/if}

  <slot name="footer" />
  {@html '<hr />'}
</article>

<style lang="scss">
  .card {
    color: red;
  }
</style>
