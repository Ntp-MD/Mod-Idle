<script lang="ts">
  import type { Snippet } from 'svelte';
  import { STORY } from '../../engine/client';
  import { icon } from '../../icon';
  import type { StoryIntent, StoryView } from './story-scene';

  /**
   * The single shared scene renderer (plan §7.2). It renders a StoryView built by
   * story-presenters and forwards intents to its host; it holds no GameState, RNG,
   * formulas or inventory access, and creates no popup or overlay.
   */
  let { view, onaction, controls }: {
    view: StoryView;
    onaction: (intent: StoryIntent) => void;
    controls?: Snippet;
  } = $props();

  const ROLE_SETS: Record<number, readonly string[]> = {
    1: ['anchor'], 2: ['left', 'anchor'], 3: ['left', 'right', 'anchor'],
    4: ['left', 'right', 'anchor', 'accent'],
  };
  const glyphs = $derived(STORY.media[view.media]?.glyphs ?? []);
  const staged = $derived(glyphs.map((glyph, index) => ({
    glyph, role: (ROLE_SETS[Math.min(4, glyphs.length)] ?? ROLE_SETS[1])[index] ?? 'anchor',
  })));

  let headingEl = $state<HTMLElement | null>(null);
  let sectionEl = $state<HTMLElement | null>(null);
  let inFlight = $state<string | null>(null);
  let manualActionId = $state<string | null>(null);
  let seenKey: string | null = null;
  let receiptSeen = '';
  let statusText = $state('');

  // A new receipt key and a manual action error are the only live announcements here;
  // countdown/fact rerenders stay silent (plan §7.2).
  $effect(() => {
    if (view.error) { statusText = view.error; return; }
    if (view.mode === 'receipt' && view.key !== receiptSeen) {
      receiptSeen = view.key;
      statusText = `Result: ${view.heading}`;
    } else if (view.mode !== 'receipt') statusText = '';
  });

  const commitIndex = $derived(view.actions.findIndex((entry) => entry.kind === 'commit'));

  function choose(actionId: string) {
    const guard = `${view.key}:${actionId}`;
    if (inFlight === guard) return;
    inFlight = guard;
    manualActionId = actionId;
    onaction({ key: view.key, actionId });
  }

  // A manual beat transition keeps focus on the same action when it is still legal,
  // otherwise the next legal action, otherwise the heading. Automatic receipts never
  // steal focus: the manual flag is only set by a click on this view.
  $effect(() => {
    const key = view.key;
    const manual = manualActionId;
    if (seenKey === null) { seenKey = key; return; }
    if (key === seenKey) return;
    seenKey = key;
    inFlight = null;
    if (manual === null) return;
    manualActionId = null;
    const next = view.actions.find((entry) => entry.id === manual) ?? view.actions.find((entry) => !entry.disabled) ?? view.actions[0];
    if (next) {
      sectionEl?.querySelector<HTMLElement>(`[data-story-action="${next.id}"]`)?.focus();
    } else {
      headingEl?.focus();
    }
  });

  const buttonClass = (id: string, kind: string, index: number) =>
    kind === 'commit' ? (index === commitIndex ? 'btn btn-gold' : 'btn btn-quiet') : 'btn btn-flat';
</script>

<section class="story-scene card-read" data-story-source={view.source} data-story-key={view.key} bind:this={sectionEl}>
  {#if view.mode === 'decision'}
    <div class="story-media media-{view.media}" aria-hidden="true">
      {#each staged as stage (stage.glyph)}
        <span class="story-glyph icon-mask" class:role-left={stage.role === 'left'} class:role-right={stage.role === 'right'}
          class:role-anchor={stage.role === 'anchor'} class:role-accent={stage.role === 'accent'}
          style={`--glyph:url(${icon(stage.glyph)})`}></span>
      {/each}
    </div>
  {/if}
  <header class="story-head">
    <p class="story-speaker">{view.speaker}</p>
    <h3 class="story-heading" tabindex="-1" bind:this={headingEl}>{view.heading}</h3>
  </header>
  <p class="story-line">{view.line}</p>
  {#if view.facts.length}
    <dl class="story-facts">
      {#each view.facts as fact (fact.id)}
        <div class="story-fact tone-{fact.tone}"><dt>{fact.label}</dt><dd>{fact.value}</dd></div>
      {/each}
    </dl>
  {/if}
  {#if controls}{@render controls()}{/if}
  {#if view.actions.length}
    <div class="story-actions">
      {#each view.actions as entry, index (entry.id)}
        <button class={buttonClass(entry.id, entry.kind, index)} type="button"
          data-story-action={entry.id} disabled={entry.disabled}
          aria-describedby={entry.disabled && entry.reason ? `story-reason-${entry.id}` : undefined}
          onclick={() => choose(entry.id)}>{entry.label}</button>
        {#if entry.disabled && entry.reason}<small id={`story-reason-${entry.id}`} class="story-reason">{entry.reason}</small>{/if}
      {/each}
    </div>
  {/if}
  {#if view.error}<p class="story-error">{view.error}</p>{/if}
  <p class="story-status" role="status" aria-live="polite">{statusText}</p>
</section>

<style>
  .story-scene { display: grid; gap: var(--card-gap); padding: var(--card-pad); }
  .story-scene p, .story-scene h3 { margin: 0; }
  .story-media { position: relative; aspect-ratio: 16 / 5; overflow: hidden; border-radius: var(--radius-card); color: var(--dim); }
  .story-glyph { position: absolute; }
  .role-left { left: 4%; bottom: 0; width: 34%; height: 90%; opacity: .3; }
  .role-right { right: 4%; bottom: 0; width: 30%; height: 80%; opacity: .25; }
  .role-anchor { left: 39%; bottom: 0; width: 22%; height: 64%; opacity: .85; }
  .role-accent { left: 64%; bottom: 0; width: 10%; height: 28%; opacity: 1; }
  .media-camp { background: var(--ground-3); }
  .media-trail { background: var(--ground); }
  .media-discovery { background: var(--ground-2); }
  .media-dungeon { background: var(--ground); }
  .media-market { background: var(--hud-face); }
  .media-forge { background: var(--ground-2); }
  .media-camp .role-anchor { color: var(--glow-moss); }
  .media-trail .role-anchor { color: var(--glow-dusk); }
  .media-discovery .role-anchor { color: var(--gold); }
  .media-dungeon .role-anchor { color: var(--dim); }
  .media-market .role-anchor { color: var(--gold); }
  .media-forge .role-anchor { color: var(--hot-deep); }
  .story-head { display: grid; gap: var(--spacing-xs); }
  .story-speaker { color: var(--sheet-ink); font-size: var(--font-xs); }
  .story-heading { color: var(--gold-lit); font-size: var(--font-sm); }
  .story-line { color: var(--text); font-size: var(--font-sm); line-height: 1.5; }
  .story-facts { display: grid; gap: var(--spacing-xs); margin: 0; }
  .story-fact { display: flex; align-items: baseline; justify-content: space-between; gap: var(--spacing-sm); }
  .story-facts dt { color: var(--sheet-ink); font-size: var(--font-xs); }
  .story-facts dd { margin: 0; font-size: var(--font-sm); font-variant-numeric: tabular-nums; text-align: right; }
  .tone-good dd { color: var(--good-lit); }
  .tone-loss dd { color: var(--alarm); }
  .tone-muted dd { color: var(--dim); }
  .story-actions { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); }
  .story-reason { color: var(--alarm); font-size: var(--font-xs); align-self: center; }
  .story-error, .story-status { color: var(--alarm); font-size: var(--font-xs); }
  .story-status { min-height: 0; }
  .story-status:empty { display: none; }
</style>
