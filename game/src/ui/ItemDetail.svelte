<script lang="ts">
  import { craft } from '../sim/craft';
  import { MODS } from '../engine/client';
  import { gearModOf } from '../sim/gear';
  import { vsWorn } from './bag';
  import type { Item } from '../sim/types';

  /**
   * The detail card a slot shows on hover. The whole card is a projection: every value and every name
   * comes out of the rolled line and `mods.json`, so it cannot drift from the drop the player is
   * reading (`harness/decisions.md` D-113, D-132). A line prints as `<value> <plain words>` — no plus
   * sign, no Tier chip, no Mod-book name — and the two fixed kinds are told apart by colour alone:
   * the Base Mod red, the Legacy pair yellow, the editable Mods plain.
   *
   * The skeleton reads top to bottom (`item-base.md`): line 1 is the Base Mod the frame owns, lines
   * 2-3 the Legacy pair, lines 4-7 the Mods the stones may edit. The decision itself is the Equip
   * button, never an automatic swap (D-089): gold comes from junk sold by hand, and a rejected piece
   * turns into a stone instead (`economy.md` · `loot.md` §4).
   */
  let { item, worn = null, onequip = null, wornHere = false }: {
    item: Item;
    worn?: Item | null;
    onequip?: (() => void) | null;
    wornHere?: boolean;
  } = $props();

  const gear = $derived(gearModOf(item));
  const delta = $derived(vsWorn(item, worn));

  /** A Mod's name as plain words, its book suffixes stripped — `Max HP %` reads `max hp`. */
  function plainName(id: string): string {
    if (id === 'all_stat_flat') return 'all stats';
    const name: string = (MODS.mods.find((m: any) => m.id === id)?.name) || id;
    return name.trim().endsWith('%')
      ? name.replace(/%\s*$/, '').trim().toLowerCase()
      : name.replace(/\s*flat\s*$/i, '').trim().toLowerCase();
  }

  /**
   * One Mod as the card prints it: the value, then the plain words for what it feeds. The name is
   * read out of `mods.json` and stripped of its book suffixes, never re-typed here — `Max HP %` reads
   * as `8% max hp`, `Energy Shield flat` as `28 energy shield`, a Stat Mod as the Core stat it baked
   * (`8 dex`), and an Elemental line as the Element that rolled on it (`120 lightning damage`).
   */
  /**
   * The noun an Element the line rolled reads as — only the Mods that carry one at drop read as a
   * named Element, and the noun is the Mod's own meaning: the Elemental power pair deals it, the
   * Elemental resistance line resists it (`elemental_alignment` is alignment to all of them, so it
   * keeps the generic reading below).
   */
  const ELEM_NOUN: Record<string, string> = {
    elemental_power: 'damage', elemental_power_flat: 'damage', elemental_resistance: 'resistance',
  };

  function slim(e: { id: string; value: number; stat?: string; element?: string }): string {
    const name: string = (MODS.mods.find((m: any) => m.id === e.id)?.name) || e.id;
    if (e.id === 'stat_mod_flat') return `${e.value} ${e.stat || 'stat'}`;
    if (e.id === 'all_stat_flat') return `${e.value} all stats`;
    const noun = ELEM_NOUN[e.id];
    if (noun && e.element) return `${e.value}${name.trim().endsWith('%') ? '%' : ''} ${e.element} ${noun}`;
    return `${e.value}${name.trim().endsWith('%') ? '%' : ''} ${plainName(e.id)}`;
  }

  /** A line is one Mod plus the Mods its Base Mod carries in `extra` — the card joins them. */
  const slimLine = (line: any): string => [line, ...(line.extra || [])].map(slim).join(' · ');

  /** Which fixed kind a line position is, for the colour class: Base, Legacy, or an editable Mod. */
  const kindClass = (i: number) => (i === 0 ? 'base' : i < craft.UNTOUCHABLE ? 'legacy' : '');

  function compareText() {
    if (wornHere) return 'the piece being worn now';
    if (!worn) return 'nothing of this slot is worn — this would be the first';
    if (delta == null) return '';
    if (delta > 0) return `${delta.toFixed(0)}% stronger than the worn ${worn.base}`;
    if (delta < 0) return `${Math.abs(delta).toFixed(0)}% weaker than the worn ${worn.base}`;
    return `level with the worn ${worn.base}`;
  }
</script>

<div class="detail" class:rare={item.rarity !== 'Common'}>
  <h4>{item.base}</h4>
  <p class="tag">
    <span class="chip rare-chip">{item.rarity}</span>
    <span class="chip">{item.slot}</span>
    <span class="dim">{item.quality} quality · {item.tier}</span>
  </p>
  {#if (item.upgrade_lv || 0) > 0}
    <p class="tag up">+{item.upgrade_lv} of {craft.C.upgrade_cap} Quality Stone</p>
  {/if}

  <ul class="lines">
    {#each item.lines as line, i}
      <li class="line {kindClass(i)}" class:fixed={kindClass(i) !== ''}>{slimLine(line)}</li>
    {:else}
      <li class="dim">no rolled lines</li>
    {/each}
  </ul>

  {#if gear.stat}
    <p class="gear">
      <span class="kind">Gear</span> {gear.value > 0 ? `${gear.value} ${plainName(gear.stat)}` : plainName(gear.stat)}
      <small>+{craft.C.gear_mod_per_level} a step — this Base’s own line</small>
    </p>
  {/if}

  <p class="foot">weighs {Math.round(item.weight || 0)} · {compareText()}</p>

  {#if onequip && !wornHere}
    <button class="go" onclick={onequip}>Equip {item.base}</button>
  {/if}
</div>

<style>
  .detail {
    min-width: 15rem;
    max-width: 21rem;
    background: #10131a;
    border: 1px solid var(--line);
    border-left: 3px solid var(--dim);
    padding: .5rem .6rem;
    font-size: .78rem;
  }
  .detail.rare { border-left-color: var(--xp); }
  h4 { margin: 0; font-size: .9rem; }
  .tag { display: flex; flex-wrap: wrap; gap: .25rem; align-items: baseline; margin: .1rem 0 .4rem; color: var(--dim); font-size: .72rem; }
  .tag.up { color: var(--xp); }
  .chip { border: 1px solid var(--line); border-radius: 2px; padding: 0 .25rem; color: var(--dim); font-size: .66rem; text-transform: uppercase; letter-spacing: .03em; }
  .rare-chip { color: var(--xp); border-color: var(--xp); }
  .dim { color: var(--dim); }
  .lines { list-style: none; margin: 0 0 .3rem; padding: 0; }
  .lines li { padding: .05rem 0; font-variant-numeric: tabular-nums; }
  .lines li.fixed { border-bottom: 1px solid #1b2029; }
  /* the two fixed kinds read by colour alone: Base Mod red, Legacy pair yellow (D-132) */
  .line.base { color: var(--hp); }
  .line.legacy { color: var(--xp); }
  .gear { margin: .3rem 0; display: flex; gap: .35rem; align-items: baseline; }
  .gear small { display: block; color: var(--dim); margin-left: auto; font-size: .68rem; }
  .kind { min-width: 2.9rem; color: var(--dim); font-size: .62rem; text-transform: uppercase; letter-spacing: .04em; }
  .foot { margin: .35rem 0 .25rem; color: var(--dim); font-size: .72rem; }
  .go { width: 100%; border-color: var(--good); }
</style>
