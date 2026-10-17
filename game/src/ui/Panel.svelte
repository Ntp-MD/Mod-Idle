<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
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
  let { title, subtitle = '', width = 'normal', fixed = true, topmost = true, showcase = false, gridArea = '2 / 3 / 15 / 14', onclose, children }: {
    title: string;
    subtitle?: string;
    width?: 'normal' | 'wide';
    /** a fixed viewport-tall box whose body never scrolls: content inside must fold (tabs, pages,
        collapsed prose) rather than grow, per the no-scrollbar ruling */
    fixed?: boolean;
    /** a modal that must cover the fixed screen rail instead of switching screens behind it */
    topmost?: boolean;
    /** Reflow this live panel into the development Showcase document. */
    showcase?: boolean;
    /** the footprint on the shared modal grid, in CSS grid-line coordinates */
    gridArea?: string;
    onclose: () => void;
    children: Snippet;
  } = $props();

  const labelId = $derived(`panel-${title.replace(/\W+/g, '-').toLowerCase()}`);
  let box = $state<HTMLDivElement | null>(null);
  /** The element that opened the panel, so closing it puts the hand back where it was — one Escape or
   *  ✕ returns focus to the rail tab, not to the document body. */
  let opener: HTMLElement | null = null;

  onMount(() => {
    if (showcase) return;
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    box?.focus();
  });

  onDestroy(() => {
    if (showcase) return;
    if (opener && opener.isConnected) opener.focus();
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

<svelte:window onkeydown={showcase ? undefined : onkey} />

<div class="veil" class:panel-veil={!showcase} class:front={topmost} class:showcase style={`--panel-grid-area:${gridArea};`} role="presentation" onclick={showcase ? undefined : onground}>
  <div class="box panel-solid {width}" class:panel-showcase={showcase} class:fixed class:showcase role={showcase ? 'region' : 'dialog'} aria-modal={showcase ? undefined : 'true'} aria-labelledby={labelId} tabindex="-1" bind:this={box}>
    <header class="panel-head">
      <h2 id={labelId}>{title}</h2>
      {#if subtitle}<p class="sub">{subtitle}</p>{/if}
      <button class="quit btn btn-ghost btn-icon" onclick={onclose} disabled={showcase} aria-label="Close {title}" title={showcase ? 'Panel stays visible in the Showcase' : 'Close (Esc)'}>✕</button>
    </header>
    <div class="body" class:fixed class:showcase>
      {@render children()}
    </div>
  </div>
</div>

<style>
  .veil {
    position: fixed;
    inset: 0;
    z-index: var(--z-panel);
    display: grid;
    grid-template-columns: repeat(15, minmax(0, 1fr));
    grid-template-rows: repeat(15, minmax(0, 1fr));
    align-items: stretch;
    justify-items: stretch;
  }
  .veil.front { z-index: var(--z-popover); }
  .box {
    grid-area: var(--panel-grid-area, 2 / 3 / 15 / 14);
    display: flex;
    flex-direction: column;
    justify-self: stretch;
    width: 100%;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    height: 100%;
    max-height: 100%;
    outline: none;
  }
  .wide { width: 100%; }
  /* Tab bars and compact pages stay inside the shared modal canvas without a scrollbar. */
  .box.fixed { height: 100%; max-height: 100%; }
  .veil.showcase { position: relative; inset: auto; z-index: auto; display: grid; grid-template-columns: minmax(0, 1fr); justify-items: center; padding: var(--spacing-md) var(--screen-pad); }
  .veil.showcase.front { z-index: auto; }
  .box.showcase {
    width: clamp(960px, 92vw, 1900px); max-width: calc(100% - 2 * var(--screen-pad));
    height: auto; max-height: none; min-height: 0; overflow: visible;
  }
  .box.fixed.showcase { height: auto; max-height: none; }
  .body.showcase { overflow: visible; }
  .body.fixed.showcase { display: block; height: auto; max-height: none; }
  .panel-head {
    display: flex;
    align-items: baseline;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md) var(--spacing-sm);
    flex: none;
  }
  /* A square icon control centres its glyph itself: the tag's own padding is uneven (xs down, md across),
     so a ✕ left to text layout sits off-centre in its token-sized box. */
  .quit {
    width: var(--icon-md);
    height: var(--icon-md);
    place-content: center;
    display: grid;
  }
  /* The flex child may shrink to the canvas; content must fit its own compact layout. */
  .body { padding: var(--spacing-md); overflow: hidden; min-width: 0; min-height: 0; }
  .body.fixed { overflow: hidden; display: flex; flex-direction: column; gap: var(--spacing-sm); }
</style>
