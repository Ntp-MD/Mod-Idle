<script lang="ts">
  import { onMount } from 'svelte';
  import type { MenuItem } from '../shared/menu';

  /**
   * The slot's own press-and-hold menu — the verbs a piece offers, said where the piece is.
   *
   * A right-click on an item square opens this instead of sending the player to a panel: the transfer,
   * the lock and the dissolve are the same sim calls the buttons already make, so this is a second door
   * onto one rule, not a second rule. It never scrolls (owner ruling) — the verb list is short by design,
   * and a box that outgrew the frame would be a defect, not a scrollbar.
   *
   * Closes on the choice, on Escape, and on any press outside it. Escape is swallowed on the capture
   * phase so the frame's own Escape (which folds the map and the overlays) never fires behind it.
   */
  let { x, y, items, onclose }: { x: number; y: number; items: MenuItem[]; onclose: () => void } = $props();

  let box = $state<HTMLDivElement | null>(null);
  /** placed at the pointer once the box has measured itself, so it never opens off the frame edge */
  let at = $state({ x: 0, y: 0 });

  /** keep the box inside the frame: measured once, at open, from its real size. */
  onMount(() => {
    const w = box?.offsetWidth ?? 0;
    const h = box?.offsetHeight ?? 0;
    at = {
      x: Math.max(2, Math.min(x, window.innerWidth - w - 2)),
      y: Math.max(2, Math.min(y, window.innerHeight - h - 2)),
    };
    // keyboard lands on the first action, not the container, so the menu is operable
    // without a pointer; the container stays the fallback when everything is disabled
    (firstEnabled() ?? box)?.focus();
  });
  /** the enabled verbs, in the order they are drawn */
  function firstEnabled(): HTMLButtonElement | null {
    return (box?.querySelector('button:not([disabled])') as HTMLButtonElement | null) ?? null;
  }
  function stepables(): HTMLButtonElement[] {
    return box ? Array.from(box.querySelectorAll('button:not([disabled])')) : [];
  }
  /** the capture-phase swallow: Escape closes, and Tab/arrows stay inside the menu so the
   * frame's own focus trap (the panel this menu was portalled out of) never fires behind it */
  function swallow(node: HTMLElement) {
    const onkey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        onclose();
        return;
      }
      const stops = stepables();
      if (!stops.length) return;
      const at = stops.indexOf(document.activeElement as HTMLButtonElement);
      if (e.key === 'Tab') {
        e.stopPropagation();
        e.preventDefault();
        const next = e.shiftKey ? (at <= 0 ? stops.length - 1 : at - 1) : (at < 0 || at >= stops.length - 1 ? 0 : at + 1);
        stops[next].focus();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
        e.stopPropagation();
        e.preventDefault();
        const next = e.key === 'Home' ? 0
          : e.key === 'End' ? stops.length - 1
          : e.key === 'ArrowDown' ? (at < 0 || at >= stops.length - 1 ? 0 : at + 1)
          : at <= 0 ? stops.length - 1 : at - 1;
        stops[next].focus();
      }
    };
    window.addEventListener('keydown', onkey, true);
    return { destroy: () => window.removeEventListener('keydown', onkey, true) };
  }

  /**
   * The box must not be a child of the panel it was opened in: a panel carries a `backdrop-filter`, which
   * makes it the containing block for a fixed child, and the panel's own overflow then clips the box. So
   * the node is moved onto the document body at mount — the one place `position: fixed` still means the
   * viewport — and removed with it. Handlers survive the move; the node keeps its own listeners.
   */
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  }

  function choose(it: MenuItem) {
    if (it.disabled) return;
    it.onpick();
    onclose();
  }
</script>

<div class="backdrop" role="presentation" use:portal onclick={onclose} oncontextmenu={(e) => { e.preventDefault(); onclose(); }}></div>
<div class="menu surface-popover" role="menu" tabindex="-1" use:swallow use:portal
     style="left:{at.x}px; top:{at.y}px" bind:this={box}
     aria-label="Item actions">
  {#each items as it}
    <button role="menuitem" class:danger={it.danger} disabled={it.disabled} onclick={() => choose(it)}>
      <span>{it.label}</span>
      {#if it.hint}<small>{it.hint}</small>{/if}
    </button>
  {:else}
    <p class="none">Nothing to do with this piece here.</p>
  {/each}
</div>

<style>
  .backdrop { position: fixed; inset: 0; z-index: calc(var(--z-popover) - 1); }
  .menu {
    position: fixed; z-index: var(--z-popover);
    min-width: clamp(100px, 7.74vw, 216px);
    max-width: clamp(188px, 14.52vw, 405px);
    display: flex; flex-direction: column;
    padding: var(--spacing-xs);
    outline: none;
  }
  .menu button {
    display: flex; align-items: baseline; gap: var(--spacing-xs);
    justify-content: space-between;
    text-align: left;
    font-size: var(--font-xs);
    background: none;
    border: 1px solid transparent;
    color: var(--text);
  }
  .menu button:hover:not(:disabled) { background: var(--inset); border-color: var(--line); }
  .menu button:disabled { opacity: .42; }
  .menu button.danger:hover:not(:disabled) { border-color: var(--hp); }
  .menu button.danger span { color: var(--hp); }
  .none { margin: 0; padding: var(--spacing-xs); font-size: var(--font-xs); color: var(--dim); }
</style>
