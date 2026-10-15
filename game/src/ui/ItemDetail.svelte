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
   * reading. A line prints as `<value> <plain words>` — no plus sign and no Mod-book name — while
   * Frame, Bound, and Unbound lines are named directly so fixed and editable Mods do not rely on
   * colour alone.
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
  const tierLabel = $derived(/^T\d+$/i.test(item.tier) ? `Tier ${item.tier.slice(1)}` : item.tier);

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
  const lineLabel = (i: number) => (i === 0 ? 'Frame' : i < craft.UNTOUCHABLE ? 'Bound' : 'Unbound');

  function compareText() {
    if (wornHere) return 'currently equipped';
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
  <header class="item-heading">
    <h4>{itemName(item)}</h4>
    <div class="item-meta">
      <span class="chip rare-chip">Item level {item.ilvl}</span>
      <span class="chip">{item.slot}</span>
      {#if rar}<span class="chip rar-chip">{rar.name}</span>{/if}
      <span class="meta-note">{item.quality} band · {tierLabel}</span>
    </div>
  </header>
  {#if (item.upgrade_lv || 0) > 0}
    <p class="tag up">+{item.upgrade_lv} Quality stone upgrades · cap {craft.C.upgrade_cap}</p>
  {/if}

  <section class="mods" aria-label="Item Mods">
    <div class="section-heading">
      <h5>Mods</h5>
      <p>Frame/Bound fixed · Unbound editable</p>
    </div>
    <ul class="lines">
      {#each item.lines as line, i}
        <li class="line {kindClass(i)}" class:fixed={kindClass(i) !== ''}>
          <span class="line-kind">{lineLabel(i)}</span>
          <span class="line-body">
            {#each modParts(line) as part, j}
              {#if j > 0}<span class="mod-sep" aria-hidden="true">·</span>{/if}
              <span class="mod-part"><img src={part.icon} alt="" aria-hidden="true" />{part.text}</span>
            {/each}
            {#if craftedMark(line)}<span class="crafted">{craftedMark(line)}</span>{/if}
          </span>
        </li>
      {:else}
        <li class="dim">no rolled lines</li>
      {/each}
    </ul>
  </section>

  {#if diff.length}
    <section class="comparison">
      <div class="section-heading">
        <h5>Changed stats</h5>
        <p>vs. {worn ? itemName(worn) : 'the worn item'}</p>
      </div>
      <ul class="cmp" aria-label={`versus the worn ${worn ? itemName(worn) : ''}`}>
        {#each diff as r (r.id + (r.element ?? ''))}
          <li class={r.kind}><img src={modIcon(r.id, undefined, r.element)} alt="" aria-hidden="true" />{cmpText(r)}</li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if gear.stat}
    <section class="gear" aria-label="Gear Mod">
      <div class="section-heading">
        <h5>Gear Mod</h5>
        <p>Inherent to this Base</p>
      </div>
      <div class="gear-row">
        <img src={modIcon(gear.stat)} alt="" aria-hidden="true" />
        <strong>{gear.value > 0 ? `${modValue(gear.stat, gear.value)} ${plainName(gear.stat)}` : plainName(gear.stat)}</strong>
      </div>
      <p class="gear-note">+{craft.C.gear_mod_per_level} per Quality stone</p>
    </section>
  {/if}

  <div class="summary">
    <p class="weight"><span>Weight:</span><strong>{Math.round(item.weight || 0)}</strong></p>
    <p class="compare-summary">{compareText()}</p>
  </div>

  {#if onequip && !wornHere}
    <button class="go" onclick={onequip}>Equip {itemName(item)}</button>
  {/if}
</div>

<style>
  .detail {
    width: min(clamp(280px, 19.36vw, 400px), calc(100vw - var(--screen-pad) - var(--screen-pad)));
    min-width: 0;
    background: var(--bg);
    /* the card leads with its rarity edge, the way the slot it came from does */
    border: 1px solid color-mix(in srgb, var(--rar, var(--line)) 45%, var(--line));
    border-radius: var(--radius-md);
    padding: var(--spacing-xs) var(--spacing-sm);
    display: grid;
    gap: var(--spacing-xs);
    font-size: var(--font-xs);
  }
  .item-heading { display: grid; gap: var(--spacing-2xs); }
  h4 { margin: 0; font-size: var(--font-sm); color: var(--rar, var(--text)); }
  .item-meta { display: flex; flex-wrap: wrap; gap: var(--spacing-2xs); align-items: center; color: var(--dim); font-size: var(--font-xs); }
  .chip { border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 0 var(--spacing-2xs); color: var(--dim); font-size: var(--font-xs); text-transform: uppercase; letter-spacing: clamp(0px, 0.05vw, 1px); }
  .rare-chip { color: var(--xp); border-color: var(--xp); }
  .rar-chip { color: var(--rar, var(--dim)); border-color: color-mix(in srgb, var(--rar, var(--line)) 60%, var(--line)); text-transform: capitalize; }
  .dim { color: var(--dim); }
  .meta-note { color: var(--dim); }
  .tag.up { margin: 0; color: var(--xp); font-size: var(--font-xs); }
  .section-heading { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: var(--spacing-2xs); margin-bottom: var(--spacing-2xs); }
  h5 { margin: 0; color: var(--gold-lit); font-size: var(--font-xs); }
  .section-heading p { margin: 0; color: var(--dim); font-size: var(--font-xs); }
  .lines { display: grid; gap: var(--spacing-3xs); list-style: none; margin: 0; padding: 0; }
  /* Every Mod line is a stamped bar: an ink-to-dark sweep with the words in the ink colour, so the
     value reads first and the kind is carried by the bar's edge and tint, never by the words. */
  .lines li {
    --bar-a: color-mix(in srgb, var(--line) 62%, var(--panel));
    --bar-b: color-mix(in srgb, var(--panel) 45%, var(--bg));
    display: flex; flex-wrap: wrap; align-items: flex-start; gap: var(--spacing-3xs) var(--spacing-xs);
    padding: var(--spacing-3xs) var(--spacing-xs);
    border-left: 1px solid var(--line);
    border-radius: var(--radius-sm);
    color: var(--text);
    font-variant-numeric: tabular-nums;
    background: linear-gradient(90deg, var(--bar-a), var(--bar-b) 62%, transparent);
  }
  .line-kind { flex: none; padding-top: var(--spacing-3xs); color: var(--dim); font-size: var(--font-xs); text-transform: uppercase; letter-spacing: clamp(0px, 0.05vw, 1px); }
  .line.frame .line-kind { color: var(--hp-lit); }
  .line.bound .line-kind { color: var(--xp-lit); }
  .line-body { display: flex; flex: 1 1 clamp(125px, 9.68vw, 200px); flex-wrap: wrap; align-items: center; gap: var(--spacing-3xs) var(--spacing-2xs); min-width: 0; }
  .mod-part { display: inline-flex; align-items: center; gap: var(--spacing-3xs); min-width: 0; white-space: normal; }
  .mod-part img, .cmp img, .gear-row img { width: var(--icon-xs); height: var(--icon-xs); flex: none; object-fit: contain; opacity: .9; }
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
  .comparison { padding-top: var(--spacing-2xs); border-top: 1px solid var(--line); }
  .cmp { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--spacing-3xs); font-size: var(--font-xs); }
  .cmp li { display: flex; align-items: center; gap: var(--spacing-3xs); padding: var(--spacing-3xs) var(--spacing-xs); border-radius: var(--radius-sm); color: var(--dim); font-variant-numeric: tabular-nums; background: color-mix(in srgb, var(--panel) 45%, transparent); }
  .cmp li.over, .cmp li.gained { color: var(--xp); }
  .cmp li.under, .cmp li.lost { color: var(--hp); }
  .gear { display: grid; gap: var(--spacing-2xs); padding-top: var(--spacing-2xs); border-top: 1px solid var(--line); }
  .gear-row { display: flex; align-items: center; gap: var(--spacing-xs); color: var(--text); font-variant-numeric: tabular-nums; }
  .gear-row strong { font-size: var(--font-xs); }
  .gear-note { margin: var(--spacing-3xs) 0 0; color: var(--dim); font-size: var(--font-xs); }
  .summary { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: baseline; gap: var(--spacing-sm); padding-top: var(--spacing-2xs); border-top: 1px solid var(--line); }
  .weight { display: flex; align-items: baseline; gap: var(--spacing-xs); margin: 0; color: var(--dim); font-size: var(--font-xs); }
  .weight strong { color: var(--text); font-variant-numeric: tabular-nums; }
  .compare-summary { margin: 0; color: var(--dim); font-size: var(--font-xs); text-align: right; }
  .go { width: 100%; border-color: var(--good); }
</style>
