<script lang="ts">
  import { craft, craftedMark } from '../sim/craft';
  import { MODS } from '../engine/client';
  import { gearModOf } from '../sim/gear';
  import { itemName } from '../sim/item-name';
  import { vsWorn, compareLines, pieceRank, type LineCmp } from './bag';
  import { modIcon } from '../icon';
  import type { Item } from '../sim/types';

  /**
   * The detail card a slot shows on hover. The whole card is a projection: every value and every name
   * comes out of the rolled line and `mods.json`, so it cannot drift from the drop the player is
   * reading. A line prints as `<value> <plain words>` — no plus
   * sign, no Tier chip, no Mod-book name — and the two fixed kinds are told apart by colour alone:
   * the Frame Mod red, the Bound pair yellow, the editable Mods plain.
   *
   * The skeleton reads top to bottom (`item-base.md`): line 1 is the Frame Mod the frame owns, lines
   * 2-3 the Bound pair, then the Unbound lines the drop drew — the Mods the stones may edit. The
   * decision itself is the Equip
   * button, never an automatic swap: gold comes from junk sold by hand, and a rejected piece
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
  const rar = $derived(pieceRank(item));

  /** The Mod book owns both the printed name and whether its number is flat or a percentage. */
  function modSourceName(id: string): string {
    return (MODS.mods.find((m: any) => m.id === id)?.name) || id;
  }

  const isPercentMod = (id: string) => modSourceName(id).trim().endsWith('%');
  const modValue = (id: string, value: number) => `${value}${isPercentMod(id) ? '%' : ' flat'}`;

  /** A Mod's name as plain words, its book suffixes stripped — `Max HP %` reads `max hp`. */
  function plainName(id: string): string {
    if (id === 'all_stat_flat') return 'all stats';
    const name = modSourceName(id);
    return name.trim().endsWith('%')
      ? name.replace(/%\s*$/, '').trim().toLowerCase()
      : name.replace(/\s*flat\s*$/i, '').trim().toLowerCase();
  }

  /**
   * One Mod as the card prints it: the value with its unit, then the plain words for what it feeds.
   * The unit comes from the Mod book name, so a stripped suffix still reads as either percent or flat.
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
    const value = modValue(e.id, e.value);
    if (e.id === 'stat_mod_flat') return `${value} ${e.stat || 'stat'}`;
    if (e.id === 'all_stat_flat') return `${value} all stats`;
    const noun = ELEM_NOUN[e.id];
    if (noun && e.element) return `${value} ${e.element} ${noun}`;
    return `${value} ${plainName(e.id)}`;
  }

  /** A line is one Mod plus the Mods its Frame Mod carries in `extra`; each gets its own matching mark. */
  const modParts = (line: any) => [line, ...(line.extra || [])].map((entry) => ({
    icon: modIcon(entry.id, entry.stat, entry.element),
    text: slim(entry),
  }));

  /** Which fixed kind a line position is, for the colour class: Frame, Bound, or an editable Mod. */
  const kindClass = (i: number) => (i === 0 ? 'frame' : i < craft.UNTOUCHABLE ? 'bound' : '');

  function compareText() {
    if (wornHere) return 'the piece being worn now';
    if (!worn) return 'nothing of this slot is worn — this would be the first';
    if (delta == null) return '';
    if (delta > 0) return `${delta.toFixed(0)}% stronger than the worn ${itemName(worn)}`;
    if (delta < 0) return `${Math.abs(delta).toFixed(0)}% weaker than the worn ${itemName(worn)}`;
    return `level with the worn ${itemName(worn)}`;
  }

  /**
   * The line-by-line pairing is the bag view model's (`compareLines`): it reads the candidate and the
   * worn piece and returns only the lines the swap changes. The card names those rows and colours
   * them — no number here is typed, both sides come off the two drops.
   */
  const diff = $derived(wornHere ? [] : compareLines(item, worn));
  const cmpName = (r: LineCmp): string => (r.element ? `${r.element} ${plainName(r.id)}` : plainName(r.id));
  const cmpText = (r: LineCmp): string =>
    r.cand == null ? `${cmpName(r)} −${modValue(r.id, r.worn ?? 0)}`
      : r.worn == null ? `${cmpName(r)} +${modValue(r.id, r.cand)}`
        : `${cmpName(r)} ${modValue(r.id, r.worn)} → ${modValue(r.id, r.cand)}`;
</script>

<div class="detail" style:--rar={rar ? rar.tone : null}>
  <h4>{itemName(item)}</h4>
  <p class="tag">
    <span class="chip rare-chip">level {item.ilvl}</span>
    <span class="chip">{item.slot}</span>
    {#if rar}<span class="chip rar-chip">{rar.name}</span>{/if}
    <span class="dim">{item.quality} band · {item.tier}</span>
  </p>
  {#if (item.upgrade_lv || 0) > 0}
    <p class="tag up">+{item.upgrade_lv} of {craft.C.upgrade_cap} Quality stone</p>
  {/if}

  <ul class="lines">
    {#each item.lines as line, i}
      <li class="line {kindClass(i)}" class:fixed={kindClass(i) !== ''}>
        {#each modParts(line) as part, j}
          {#if j > 0}<span class="mod-sep" aria-hidden="true">·</span>{/if}
          <span class="mod-part"><img src={part.icon} alt="" aria-hidden="true" />{part.text}</span>
        {/each}
        {#if craftedMark(line)}<span class="crafted">{craftedMark(line)}</span>{/if}
      </li>
    {:else}
      <li class="dim">no rolled lines</li>
    {/each}
  </ul>

  {#if diff.length}
    <ul class="cmp" aria-label={`versus the worn ${worn ? itemName(worn) : ''}`}>
      {#each diff as r (r.id + (r.element ?? ''))}
        <li class={r.kind}><img src={modIcon(r.id, undefined, r.element)} alt="" aria-hidden="true" />{cmpText(r)}</li>
      {/each}
    </ul>
  {/if}

  {#if gear.stat}
    <p class="gear">
      <span class="kind">Gear</span><span class="gear-stat"><img src={modIcon(gear.stat)} alt="" aria-hidden="true" />{gear.value > 0 ? `${modValue(gear.stat, gear.value)} ${plainName(gear.stat)}` : plainName(gear.stat)}</span>
      <small>+{craft.C.gear_mod_per_level} a step — this Base’s own line</small>
    </p>
  {/if}

  <p class="foot">weighs {Math.round(item.weight || 0)} · {compareText()}</p>

  {#if onequip && !wornHere}
    <button class="go" onclick={onequip}>Equip {itemName(item)}</button>
  {/if}
</div>

<style>
  .detail {
    min-width: var(--box-300);
    max-width: var(--box-420);
    background: var(--bg);
    /* the card leads with its rarity edge, the way the slot it came from does */
    border: 1px solid var(--line);
    border-left: 3px solid var(--rar, var(--dim));
    padding: var(--spacing-xs) var(--spacing-sm);
    font-size: var(--font-xs);
  }
  h4 { margin: 0; font-size: var(--font-sm); color: var(--rar, var(--text)); }
  .tag { display: flex; flex-wrap: wrap; gap: var(--spacing-2xs); align-items: baseline; margin: var(--seam) 0 var(--spacing-xs); color: var(--dim); font-size: var(--font-xs); }
  .tag.up { color: var(--xp); }
  .chip { border: 1px solid var(--line); border-radius: 2px; padding: 0 var(--spacing-2xs); color: var(--dim); font-size: var(--font-xs); text-transform: uppercase; letter-spacing: clamp(0px, 0.05vw, 1px); }
  .rare-chip { color: var(--xp); border-color: var(--xp); }
  .rar-chip { color: var(--rar, var(--dim)); border-color: color-mix(in srgb, var(--rar, var(--line)) 60%, var(--line)); text-transform: capitalize; }
  .dim { color: var(--dim); }
  .lines { list-style: none; margin: 0 0 var(--spacing-2xs); padding: 0; }
  /* Every Mod line is a stamped bar: an ink-to-dark sweep with the words in the ink colour, so the
     value reads first and the kind is carried by the bar's edge and tint, never by the words. */
  .lines li {
    --bar-a: color-mix(in srgb, var(--line) 62%, var(--panel));
    --bar-b: color-mix(in srgb, var(--panel) 45%, var(--bg));
    display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-3xs) var(--spacing-xs);
    margin: var(--spacing-3xs) 0;
    padding: var(--seam) var(--spacing-xs);
    border-left: 2px solid var(--line);
    border-radius: 2px;
    color: var(--text);
    font-variant-numeric: tabular-nums;
    background: linear-gradient(90deg, var(--bar-a), var(--bar-b) 62%, transparent);
  }
  .mod-part, .gear-stat { display: inline-flex; align-items: center; gap: var(--spacing-3xs); white-space: nowrap; }
  .mod-part img, .cmp img, .gear-stat img { width: var(--icon-xs); height: var(--icon-xs); flex: none; object-fit: contain; opacity: .9; }
  .mod-sep { color: var(--dim); }
  .crafted { color: var(--dim); }
  /* the two fixed kinds keep their colour in the bar, not in the words: Frame Mod red, Bound pair yellow */
  .line.frame {
    --bar-a: color-mix(in srgb, var(--hp) 26%, var(--panel));
    --bar-b: color-mix(in srgb, var(--hp) 7%, var(--bg));
    border-left-color: var(--hp);
  }
  .line.bound {
    --bar-a: color-mix(in srgb, var(--xp) 24%, var(--panel));
    --bar-b: color-mix(in srgb, var(--xp) 6%, var(--bg));
    border-left-color: var(--xp);
  }
  .lines li.fixed { border-bottom: 1px solid var(--line); }
  /* the line-by-line read against the worn piece: gained and over in yellow (the same "up" the
     upgrade tag wears), lost and under in red — the aggregate % on the foot is still the headline. */
  .cmp { list-style: none; margin: var(--spacing-2xs) 0 0; padding: 0; display: flex; flex-direction: column; gap: var(--spacing-3xs); font-size: var(--font-xs); }
  .cmp li { display: flex; align-items: center; gap: var(--spacing-3xs); padding: var(--seam) var(--spacing-xs); border-radius: 2px; color: var(--dim); font-variant-numeric: tabular-nums; background: color-mix(in srgb, var(--panel) 45%, transparent); }
  .cmp li.over, .cmp li.gained { color: var(--xp); }
  .cmp li.under, .cmp li.lost { color: var(--hp); }
  .gear { margin: var(--spacing-2xs) 0; display: flex; gap: var(--spacing-2xs); align-items: baseline; }
  .gear small { display: block; color: var(--dim); margin-left: auto; font-size: var(--font-xs); }
  .kind { min-width: var(--icon-xl); color: var(--dim); font-size: var(--font-xs); text-transform: uppercase; letter-spacing: clamp(0px, 0.05vw, 1px); }
  .foot { margin: var(--spacing-2xs) 0 var(--spacing-2xs); color: var(--dim); font-size: var(--font-xs); }
  .go { width: 100%; border-color: var(--good); }
</style>
