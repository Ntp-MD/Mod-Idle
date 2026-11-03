<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { Snippet } from 'svelte';
  import PanelSessionBar from './PanelSessionBar.svelte';
  import { choosePanelFocus } from './panel-focus';

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
    width?: 'compact' | 'normal' | 'wide';
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

  const isVisible = (element: HTMLElement | null): element is HTMLElement =>
    !!element && element.isConnected && element.getClientRects().length > 0;
  function topDialog(exclude: HTMLElement | null): HTMLElement | null {
    return Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]'))
      .filter((dialog) => dialog !== exclude && isVisible(dialog)).at(-1) ?? null;
  }
  const isUsable = (target: HTMLElement | null): target is HTMLElement =>
    isVisible(target) && !target.closest('[inert]');
  function focusTarget(target: HTMLElement | null): boolean {
    if (!isUsable(target)) return false;
    target.focus();
    return document.activeElement === target;
  }
  onDestroy(() => {
    if (showcase) return;
    // The closing dialog may still be in the DOM during onDestroy. Wait for the update, then choose
    // the remaining top dialog (or the field control) rather than focusing an element behind it.
    setTimeout(() => {
      const top = topDialog(box);
      const fallbacks = Array.from(document.querySelectorAll<HTMLElement>('[data-panel-fallback], .rail .disclosure-toggle'));
      const choice = choosePanelFocus({
        topDialog: !!top,
        openerInTop: !!top && !!opener && top.contains(opener),
        openerUsable: isUsable(opener),
        fallbackUsable: fallbacks.some(isUsable),
      });
      if (choice === 'opener-in-top' && focusTarget(opener)) return;
      if (choice === 'top' || choice === 'opener-in-top') { top?.focus(); return; }
      if (choice === 'opener' && focusTarget(opener)) return;
      if (choice === 'fallback' && fallbacks.some(focusTarget)) return;
      setTimeout(() => {
        if (document.activeElement === document.body) fallbacks.some(focusTarget);
      }, 80);
    }, 0);
  });

  /** Escape closes; Tab is held inside the panel so nothing behind the backdrop can be reached. */
  function onkey(ev: KeyboardEvent) {
    const top = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]'))
      .filter((dialog) => dialog.offsetParent !== null).at(-1);
    if (top !== box) return;
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
    if (document.activeElement === box) {
      ev.preventDefault();
      (ev.shiftKey ? last : first).focus();
    } else if (ev.shiftKey && document.activeElement === first) {
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
      <div class="panel-heading">
        <h2 id={labelId}>{title}</h2>
        {#if subtitle}<p class="sub">{subtitle}</p>{/if}
      </div>
      <button class="quit btn btn-ghost btn-icon" onclick={onclose} disabled={showcase} aria-label="Close {title}" title={showcase ? 'Panel stays visible in the Showcase' : 'Close (Esc)'}>✕</button>
    </header>
    <PanelSessionBar />
    <div class="body" class:fixed class:showcase>
      {@render children()}
    </div>
  </div>
</div>

<style>
  /* A panel draws a second Hub Grid over the stage: the box names a cell rectangle and its body holds the
     panel's one scroll owner, so the canvas itself never scrolls — see AGENTS.md §UI integration. */
  .veil {
    position: fixed;
    inset: 0;
    z-index: 60;
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
  .box.normal { width: min(100%, 1120px); height: min(100%, 800px); justify-self: center; align-self: center; }
  .box.compact { width: min(100%, 860px); height: min(100%, 740px); justify-self: center; align-self: center; }
  /* Tab bars and compact pages stay inside the shared modal canvas without a scrollbar. */
  .box.fixed { height: 100%; max-height: 100%; }
  .box.fixed.normal { height: min(100%, 800px); }
  .box.fixed.compact { height: min(100%, 740px); }
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
    align-items: center;
    flex-wrap: wrap;
    gap: var(--spacing-xs) var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md) var(--spacing-sm);
    flex: none;
  }
  .panel-heading { display: flex; flex-direction: column; gap: var(--spacing-xs); flex: 1; min-width: 0; }
  .panel-head h2 { min-width: 0; overflow-wrap: anywhere; font-size: var(--font-lg); }
  .panel-head .sub { min-width: 0; font-size: var(--font-2xs); line-height: 1.5; color: var(--dim); }
  .panel-head .quit { margin-left: auto; }
  /* A square icon control centres its glyph itself: the tag's own padding is uneven (xs down, md across),
     so a ✕ left to text layout sits off-centre in its token-sized box. */
  .quit {
    width: calc(var(--icon-label) * 1.5);
    height: calc(var(--icon-label) * 1.5);
    place-content: center;
    display: grid;
  }
  /* The flex child may shrink to the canvas; content must fit its own compact layout. */
  .body { padding: var(--spacing-md); overflow: hidden; min-width: 0; min-height: 0; }
  .body.fixed { overflow: hidden; display: flex; flex: 1 1 auto; flex-direction: column; gap: var(--spacing-sm); }
</style>
