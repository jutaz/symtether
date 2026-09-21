<script lang="ts">
  import { onMount } from 'svelte';

  export interface CardProps {
    title: string;
  }

  export type CardId = string;

  export enum CardState {
    Collapsed = 0,
    Expanded = 1,
  }

  export namespace cards {
    export function describe(): string {
      return 'card';
    }
  }

  export class UserCard {
    static VERSION = '1.0';

    limit = 12;

    onSelect = (): void => {};

    #expanded = false;

    get state(): CardState {
      return this.#expanded ? CardState.Expanded : CardState.Collapsed;
    }

    render(): string {
      return this.#expanded ? 'open' : 'closed';
    }

    async load(): Promise<void> {}

    *walk(): Generator<number> {
      yield this.limit;
    }

    static create(): UserCard {
      return new UserCard();
    }
  }

  export function makeCard(): UserCard {
    return new UserCard();
  }

  export async function fetchCard(): Promise<UserCard> {
    return makeCard();
  }

  export function* cardIds(): Generator<CardId> {
    yield 'a';
  }

  export const buildCard = (): UserCard => new UserCard();

  export const cardActions = {
    open: 'open',
    close: (): void => {},
  };

  export const CARD_DEFAULTS = { theme: 'light' } as const;

  export const MAX_CARDS: number = 12;

  onMount(() => {
    const node = document.querySelector('.card');
    node?.setAttribute('data-ready', 'true');
  });
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
