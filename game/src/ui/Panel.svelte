<script lang="ts">
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';

  /**
   * The one overlay layer of the client — the sub-screen a rail tab opens. The field keeps running
   * behind it, uncovered when the tab is closed, because the client never navigates: it covers and
   * uncovers, and no trip into a screen costs the player the scene they were reading. The veil stops
   * short of the rail so a tab press switches screens directly instead of going back to the field first.
   *
   * Close three ways, because a modal you cannot get out of is a wall: the ✕, Escape, and a click on
   * the ground behind it. Focus is taken by the panel when it opens and kept inside it while it is
   * open, so a keyboard press cannot land on the screen behind the backdrop.
   */
  let { title, subtitle = '', width = 'normal', onclose, children }: {
    title: string;
    subtitle?: string;
    width?: 'normal' | 'wide';
    onclose: () => void;
    children: Snippet;
  } = $props();

  const labelId = $derived(`panel-${title.replace(/\W+/g, '-').toLowerCase()}`);
  let box = $state<HTMLDivElement | null>(null);

  onMount(() => {
    box?.focus();
    box?.scrollTo({ top: 0 });
  });

  /** Escape closes; Tab is held inside the panel so nothing behind the backdrop can be reached. */
  function onkey(ev: KeyboardEvent) {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      onclose();
      return;
    }
    if (ev.key !== 'Tab' || !box) return;
    const stops = Array.from(box.querySelectorAll<HTMLElement>('button, select, input, a[href], [tabindex]:not([tabindex="-1"])'))
      .filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
    if (!stops.length) return;
    const first = stops[0];
    const last = stops[stops.length - 1];
    if (ev.shiftKey && document.activeElement === first) {
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && document.activeElement === last) {
      ev.preventDefault();
      first.focus();
    } else if (!box.contains(document.activeElement)) {
      ev.preventDefault();
      first.focus();
    }
  }

  /** A click that lands on the backdrop itself, not on the panel, closes it. */
  function onground(ev: MouseEvent) {
    if (ev.target === ev.currentTarget) onclose();
  }
</script>

<svelte:window onkeydown={onkey} />

<div class="veil" role="presentation" onclick={onground}>
  <div class="box {width}" role="dialog" aria-modal="true" aria-labelledby={labelId} tabindex="-1" bind:this={box}>
    <header class="panel-head">
      <h2 id={labelId}>{title}</h2>
      {#if subtitle}<p class="sub">{subtitle}</p>{/if}
      <button class="quit" onclick={onclose} aria-label="Close {title}" title="Close (Esc)">✕</button>
    </header>
    <div class="body">
      {@render children()}
    </div>
  </div>
</div>

<style>
  .veil {
    position: fixed;
    /* the rail stays outside the veil's padding: a sub-screen is switched by pressing the next tab,
       not by closing this one first — so the gutter the rail owns is the right one */
    inset: 0 var(--rail) 0 0;
    z-index: 60;
    display: grid;
    /* one row that may shrink below its content: an `auto` row grows to the panel's full height, the
       box's max-height then resolves against that row, and a long panel's bottom is never reachable */
    grid-template-rows: minmax(0, 1fr);
    /* centred in the row rather than stretched to it: a sub-screen is a window over the field, not a
       second field, and the field is what the player returns to when it closes */
    align-items: center;
    justify-items: stretch;
    background: rgba(6, 9, 13, .68);
    backdrop-filter: blur(4px);
  }
  .box {
    display: flex;
    flex-direction: column;
    justify-self: center;
    width: min(880px, 100%);
    /* the screen takes only the room its own content needs, up to three quarters of the height: a
       sub-screen is a window over the field, not a second field, and a short one that stretched to a
       fixed height would leave the ground showing through an empty plate. The row above may still shrink
       below the content, so a long panel's bottom stays reachable inside its own scroll. */
    height: auto;
    max-height: min(70vh, 100%);
    background: var(--bg);
    border-inline: 1px solid var(--edge);
    box-shadow: 0 0 60px rgba(0, 0, 0, .6);
    outline: none;
    animation: slide .16s ease-out;
  }
  .wide { width: min(1440px, 100%); }
  @keyframes slide { from { transform: translateY(1.2rem); opacity: .4; } to { transform: none; opacity: 1; } }
  .panel-head {
    display: flex;
    align-items: baseline;
    gap: .6rem;
    padding: .7rem 1rem .55rem;
    border-bottom: 1px solid var(--edge);
    background: linear-gradient(180deg, rgba(232, 193, 105, .10), transparent);
    position: sticky;
    top: 0;
  }
  .panel-head h2 { margin: 0; flex: none; color: var(--gold); letter-spacing: .12em; }
  .sub { margin: 0; flex: 1; color: var(--dim); font-size: .75rem; }
  .quit {
    background: none; border: 1px solid var(--edge); color: var(--dim); border-radius: 8px;
    width: 1.7rem; height: 1.7rem; padding: 0; line-height: 1;
  }
  .quit:hover { color: var(--text); border-color: var(--gold); }
  /* min-height: 0 is what lets a flex child shrink: without it a long panel body keeps its content
     height, the box overflows the veil, and the bottom of the panel is unreachable. */
  .body { padding: 1rem; overflow: auto; min-height: 0; overscroll-behavior: contain; }
</style>
