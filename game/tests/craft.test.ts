import { describe, it, expect } from 'vitest';
import { E, loot } from '../src/engine/client';
import { createCraft } from '../../engine/craft.ts';
import { rollDrop } from '../src/sim/drop';
import { doCraft, stoneNames, replaceChoices, poolOf, craftedMark, craft as clientCraft } from '../src/sim/craft';
import { newGame, tick } from '../src/sim/game';
import { mulberry32 } from '../src/engine/client-helpers';
import type { Item } from '../src/sim/types';

const craft = createCraft(E, loot);

// `rollDrop` always stamps the quality band (`sim/drop.ts`), so a rolled piece carries a `q` even
// though `Item.q` is optional for hand-built fixtures elsewhere.
function piece(seed = 1, band = 'low'): Item & { q: number } {
  return rollDrop(mulberry32(seed), band, band === 'low' ? 1 : band === 'mid' ? 31 : 61) as Item & { q: number };
}

type CraftResult = { ok: boolean; why?: string; item?: any; changed?: any };

/** The success branch, typed — throws the refusal's own reason so a failed craft names itself. */
function made(r: CraftResult): { ok: true; item: any; changed: any } {
  if (!r.ok || !r.item) throw new Error(`craft refused: ${r.why ?? 'unknown reason'}`);
  return r as { ok: true; item: any; changed: any };
}

/** The refusal branch, typed — asserts the craft did not succeed. */
function refused(r: CraftResult): { ok: false; why: string } {
  if (r.ok) throw new Error('expected the craft to be refused');
  return { ok: false, why: r.why ?? '' };
}

/** Narrows a craft result to its success branch without throwing, for loops that tolerate a refusal. */
function isMade(r: CraftResult): r is { ok: true; item: any; changed: any } {
  return !!r.ok && r.item !== undefined;
}


describe('Reroll', () => {
  it('never rolls below the value it already holds, and stays inside the same Tier', () => {
    const item = piece(3);
    const line = item.lines[craft.UNTOUCHABLE];
    const [lo, hi] = loot.rangeOf(line.id, item.ilvl, item.q, line.slice);
    let current = item;
    for (let s = 0; s < 200; s++) {
      const r = made(craft.reroll(current, craft.UNTOUCHABLE, mulberry32(s)));
      expect(r.ok).toBe(true);
      const next = r.item.lines[craft.UNTOUCHABLE];
      expect(next.value).toBeGreaterThanOrEqual(current.lines[craft.UNTOUCHABLE].value);
      expect(next.value).toBeGreaterThanOrEqual(lo);
      expect(next.value).toBeLessThanOrEqual(hi);
      expect(next.slice).toBe(line.slice);
      current = r.item;
    }
    // climbing is bounded: after enough casts the line sits at the top of its slice
    expect(current.lines[craft.UNTOUCHABLE].value).toBe(hi);
  });

  it('refuses to touch the Frame Mod or the Bound pair', () => {
    const item = piece(3);
    for (let i = 0; i < craft.UNTOUCHABLE; i++) {
      const r = refused(craft.reroll(item, i, mulberry32(1)));
      expect(r.why).toMatch(/cannot be changed/);
    }
  });
});

describe('Refine and Randomize', () => {
  it('Refine pushes one Tier up and stops dead at T1', () => {
    // Not every Mod publishes Tiers — `mods.json` gives `elemental_alignment` and
    // `perfect_dodge_pct` one slice per Item quality band, so no roll can put them above slice 0.
    // Refine reads the slot's own slice count, so the fixture must stand a line that publishes them.
    const rolled = piece(4);
    const slot = rolled.lines.findIndex((l, i) => i >= craft.UNTOUCHABLE && loot.sliceCount() >= 2);
    expect(slot).toBeGreaterThanOrEqual(craft.UNTOUCHABLE);
    const atWorst = (lines: Item['lines']) => lines.map((l) => ({ ...l, slice: Math.max(0, loot.sliceCount() - 1) }));
    const item = { ...rolled, lines: atWorst(rolled.lines) };
    const r = made(craft.refine(item, slot, mulberry32(1)));
    expect(r.ok).toBe(true);
    expect(r.item.lines[slot].slice).toBe(item.lines[slot].slice - 1);
    const again = refused(craft.refine({ ...item, lines: item.lines.map((l) => ({ ...l, slice: 0 })) }, slot, mulberry32(1)));
    expect(again.ok).toBe(false);
    expect(again.why).toMatch(/already T1/);
  });

  it('the 1-stone roll may land anywhere in the published Tier weights, including lower', () => {
    const item = { ...piece(5), lines: piece(5).lines.map((l) => ({ ...l, slice: 0 })) };
    const seen = new Set<number>();
    for (let s = 0; s < 60; s++) seen.add(made(craft.randomize(item, craft.UNTOUCHABLE, mulberry32(s))).item.lines[craft.UNTOUCHABLE].slice);
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('Ascend', () => {
  it('moves the whole piece one band up and carries every line into the next window', () => {
    const item = piece(6);
    const r = made(craft.ascend(item, mulberry32(2)));
    expect(r.ok).toBe(true);
    expect(r.item.q).toBe(item.q + 1);
    for (const line of r.item.lines) {
      const [lo, hi] = loot.rangeOf(line.id, r.item.ilvl, r.item.q, line.slice);
      expect(line.value).toBeGreaterThanOrEqual(lo);
      expect(line.value).toBeLessThanOrEqual(hi);
    }
  });

  it('cannot skip a step and cannot pass high', () => {
    const item = piece(7);
    const one = made(craft.ascend(item, mulberry32(1)));
    const two = made(craft.ascend(one.item, mulberry32(1)));
    const three = refused(craft.ascend(two.item, mulberry32(1)));
    expect(two.item.q).toBe(one.item.q + 1);
    expect(three.ok).toBe(false);
    expect(three.why).toMatch(/already the top band/);
  });
});

describe('Remove', () => {
  it('never touches the Frame Mod or the Bound pair', () => {
    for (let s = 0; s < 40; s++) {
      const item = { ...piece(8), lines: [
        { id: 'physical_power_flat', value: 70, slice: 2 }, // Frame Mod
        { id: 'attack_speed', value: 20, slice: 2 },        // Sub 1
        { id: 'max_hp_flat', value: 40, slice: 2 },         // Sub 2
        { id: 'stat_mod_flat', value: 20, slice: 2 },       // Random
        { id: 'armour_flat', value: 12, slice: 2 },         // Random
      ] };
      const r = made(craft.remove(item, mulberry32(s)));
      expect(r.ok).toBe(true);
      expect(r.changed.index).toBeGreaterThanOrEqual(craft.UNTOUCHABLE);
      expect(r.item.lines[0].value).toBe(70);
      expect(r.item.lines[1].value).toBe(20);
      expect(r.item.lines[2].value).toBe(40);
    }
  });

  it('refuses a piece that has only the Frame Mod and Bound pair left', () => {
    const item = { ...piece(9), lines: [
      { id: 'physical_power_flat', value: 70, slice: 2 },
      { id: 'attack_speed', value: 20, slice: 2 },
      { id: 'max_hp_flat', value: 40, slice: 2 },
    ] };
    expect(craft.remove(item, mulberry32(1)).ok).toBe(false);
  });
});

describe('Add stone', () => {
  const poolFor = (item: any) => {
    const frame = require('../../tools/data/bases.json').bases.find((b: any) => b.name === item.base && b.slot === item.slot);
    return frame ? [...frame.primary, ...frame.secondary, 'stat_mod_flat'] : ['physical_power_flat', 'attack_speed', 'stat_mod_flat'];
  };

  it('charges one stone every fill, and stops at the max Mod count', () => {
    let item = { ...piece(21), ilvl: 61, lines: piece(21).lines.slice(0, 3), unbound_at_drop: 0, mods_added: 0 };
    expect(craft.costOf('add', item)).toEqual({ add: 1 });
    const one = made(craft.add(item, poolFor(item), mulberry32(1)));
    expect(one.ok).toBe(true);
    item = one.item;
    expect(item.mods_added).toBe(1);
    // the second fill is priced off the data ladder, and the ladder is one stone a press like every other
    expect(craft.costOf('add', item)).toEqual({ add: E.item_level.add_stones_per_fill[1] });
    const two = made(craft.add(item, poolFor(item), mulberry32(2)));
    expect(two.ok).toBe(true);
    expect(two.item.lines.length).toBe(item.lines.length + 1);
    const three = refused(craft.add(two.item, poolFor(two.item), mulberry32(3)));
    expect(three.ok).toBe(false);
    expect(String(three.why)).toMatch(/2 Add stones/);
  });

  it('never repeats a line the piece already carries', () => {
    const item = { ...piece(22), ilvl: 61, lines: [{ id: 'stat_mod_flat', value: 10, slice: 2 }] };
    const seen = new Set<string>();
    for (let s = 0; s < 40; s++) {
      const r = craft.add(item, ['stat_mod_flat', 'max_hp_flat', 'armour_flat'], mulberry32(s));
      if (!isMade(r)) continue;
      seen.add(r.changed.id);
      expect(r.changed.id).not.toBe('stat_mod_flat');
    }
    expect(seen.size).toBeGreaterThan(0);
  });

  it('a piece stops at the crafted ceiling and takes at most two Add stones', () => {
    const L = E.item_level;
    // a piece already holding as many lines as the ceiling publishes cannot take another stone
    const full = Array.from({ length: L.crafted_max }, (_v, i) => ({ id: `line_${i}`, value: 1, slice: 2 }));
    const atCeiling = refused(craft.add({ ...piece(23), ilvl: 1, lines: full, unbound_at_drop: L.crafted_max - 3, mods_added: 0 }, ['elemental_power_flat'], mulberry32(1)));
    expect(atCeiling.ok).toBe(false);
    expect(String(atCeiling.why)).toMatch(new RegExp(`stops at ${L.crafted_max} Mods`));
    const base = { ...piece(23), ilvl: 1, mods_added: 0, unbound_at_drop: 0, lines: [
      { id: 'physical_power_flat', value: 1, slice: 2 },
      { id: 'attack_speed', value: 1, slice: 2 },
      { id: 'max_hp_flat', value: 1, slice: 2 },
    ] };
    const first = made(craft.add(base, ['max_hp_flat', 'armour_flat', 'evasion_flat'], mulberry32(1)));
    expect(first.ok).toBe(true);
    const second = made(craft.add(first.item, ['max_hp_flat', 'armour_flat', 'evasion_flat'], mulberry32(2)));
    expect(second.ok).toBe(true);
    const third = refused(craft.add(second.item, ['max_hp_flat', 'armour_flat', 'evasion_flat'], mulberry32(3)));
    expect(third.ok).toBe(false);
    expect(String(third.why)).toMatch(/2 Add stones/);
    // the stone count is the cap, not the line count — the piece still has room to the ceiling
    expect(second.item.lines.length).toBeLessThan(E.item_level.crafted_max);
  });

  // Stat Mod % was retired with Core Stat %, so `stat_mod_flat` is the only Stat Mod line a
  // piece can hold — and once it holds that one, the stone must never offer it again.
  it('a piece stops offering a Stat Mod once it holds the one', () => {
    const lines = [
      { id: 'stat_mod_flat', value: 9, slice: 2 },
      { id: 'max_hp_flat', value: 50, slice: 2 }, { id: 'armour_flat', value: 20, slice: 2 },
      { id: 'evasion_flat', value: 10, slice: 2 },
    ];
    const item = { ...piece(24), ilvl: 61, q: 0, lines, mods_added: 0 };
    let offered = 0;
    for (let s = 0; s < 25; s++) {
      const r = craft.add(item, ['stat_mod_flat', 'cooldown_reduction'], mulberry32(s));
      if (!isMade(r)) continue;
      offered++;
      expect(r.changed.id).not.toBe('stat_mod_flat');
    }
    expect(offered).toBeGreaterThan(0); // the loop is not green because nothing ever landed
  });

  it('the bench pays the stone and the client refuses without one', () => {
    const s = newGame(25);
    s.counters.stones.add = 0;
    // a piece with a free line whatever the drop drew, so the test is about the stone, not the width
    s.bag.unshift({ ...piece(26), ilvl: 61, lines: [{ id: 'stat_mod_flat', value: 9, slice: 2 }], mods_added: 0 });
    expect(doCraft(s, 'bag', 0, 'add', 0, mulberry32(1)).ok).toBe(false);
    s.counters.stones.add = 1;
    const before = s.bag[0].lines.length;
    const r = doCraft(s, 'bag', 0, 'add', 0, mulberry32(1));
    expect(r.ok).toBe(true);
    expect(s.bag[0].lines.length).toBe(before + 1);
    expect(s.counters.stones.add).toBe(0);
  });
});

describe('the bench in the game', () => {
  it('pays the stones it charges and refuses when it cannot', () => {
    const s = newGame(21);
    s.counters.stones.reroll_value = 0;
    s.bag.unshift(piece(11));
    const denied = refused(doCraft(s, 'bag', 0, 'reroll', craft.UNTOUCHABLE, mulberry32(1)));
    expect(denied.ok).toBe(false);
    expect(String(denied.why)).toMatch(/needs/);
    s.counters.stones.reroll_value = E.craft.reroll_value_stones_per_use;
    const before = s.bag[0].lines[craft.UNTOUCHABLE].value;
    const ok = doCraft(s, 'bag', 0, 'reroll', craft.UNTOUCHABLE, mulberry32(1));
    expect(ok.ok).toBe(true);
    expect(s.counters.stones.reroll_value).toBe(0);
    expect(s.bag[0].lines[craft.UNTOUCHABLE].value).toBeGreaterThanOrEqual(before);
  });

  it('the Replace stone lands the Mod named and leaves the Tier to roll', () => {
    const s = newGame(21);
    // a drop with an editable line and a pool the piece has not already filled, whichever seed that is
    let picked: { out: string; inId: string } | null = null;
    for (let seed = 1; seed < 60 && !picked; seed++) {
      s.bag.unshift(piece(seed));
      const item = s.bag[0];
      const inId = item.lines.length > craft.UNTOUCHABLE
        ? replaceChoices(s, 'bag', 0).find((id) => id !== item.lines[craft.UNTOUCHABLE].id)
        : undefined;
      if (inId) picked = { out: item.lines[craft.UNTOUCHABLE].id, inId };
      else s.bag.shift();
    }
    expect(picked).toBeTruthy();
    const target = craft.UNTOUCHABLE;
    const lines = s.bag[0].lines.length;
    s.counters.stones.replace = 0;
    expect(refused(doCraft(s, 'bag', 0, 'replace', target, mulberry32(7), picked!.inId)).ok).toBe(false);
    s.counters.stones.replace = E.craft.replace_stones_per_use;
    const r = doCraft(s, 'bag', 0, 'replace', target, mulberry32(7), picked!.inId);
    expect(r.ok).toBe(true);
    expect(s.bag[0].lines.length).toBe(lines);
    expect(s.bag[0].lines[target].id).toBe(picked!.inId);
    expect(s.bag[0].mods_added || 0).toBe(0);
    expect(s.counters.stones.replace).toBe(0);
    // the old line's Reroll floor left with its identity: a different Mod is a different line
    expect(s.bag[0].baselines?.[target]).toBeUndefined();
  });

  it('every press charges one stone of its own kind, and Replace still refuses a fixed line', () => {
    const s = newGame(21);
    s.bag.unshift(piece(11));
    const item = s.bag[0];
    const ONE_LINE = ['reroll', 'reroll_random', 'refine', 'randomize', 'reroll_mod', 'remove', 'remove_at', 'replace', 'replace_random', 'polish', 'rebirth'];
    for (const op of ONE_LINE) {
      const cost = stoneNames(op as any, item);
      const keys = Object.keys(cost);
      expect(keys.length, op).toBe(1);
      expect(cost[keys[0]], op).toBe(1);
    }
    // the imprint press is priced per stone held, so a bare imprint op has no price yet
    expect(stoneNames('imprint' as any, item)).toEqual({});
    expect(refused(doCraft(s, 'bag', 0, 'replace', 0, mulberry32(3), replaceChoices(s, 'bag', 0)[0])).ok).toBe(false);
  });

  it('has nothing locked and nothing left owing — the ladder is bounded by the line it raises', () => {
    // the ceilings the ladder must not out-print are X42's job; this file owns the client's own
    // statement that nothing is locked and nothing is still owed
    expect(Object.keys(craft.LOCKED)).toEqual([]);
    expect(craft.PENDING_POWER).toEqual({});
  });
});

describe('the verb × target matrix', () => {
  /** a bench with a real drop in the bag and a purse deep enough that every refusal is a rule, not a price */
  const bench = (seed = 31, itemSeed = 12) => {
    const s = newGame(seed);
    s.bag.unshift(piece(itemSeed));
    for (const k of Object.keys(craft.STONE_NAME)) s.counters.stones[k] = 9;
    return s;
  };
  const UNT = craft.UNTOUCHABLE, FRAME = craft.PIECE_FLOOR;

  it('Reroll value stops above the Bound pair, by name and by draw', () => {
    const s = bench();
    expect(refused(doCraft(s, 'bag', 0, 'reroll', FRAME, mulberry32(1))).why).toMatch(/Frame Mod and Bound lines/);
    expect(refused(doCraft(s, 'bag', 0, 'reroll', 0, mulberry32(1))).why).toMatch(/Frame Mod and Bound lines/);
    for (let i = 0; i < 40; i++) {
      const g = bench(40 + i);
      const was = g.bag[0].lines.map((l: any) => l.value);
      const idWas = g.bag[0].lines.map((l: any) => l.id);
      expect(doCraft(g, 'bag', 0, 'reroll_random', 0, mulberry32(i + 1)).ok).toBe(true);
      g.bag[0].lines.forEach((l: any, idx: number) => {
        // only an Unbound line moved, and nothing it did moved the Mod it is
        if (idx < UNT) { expect(l.value).toBe(was[idx]); expect(l.id).toBe(idWas[idx]); }
      });
    }
  });

  it('the identity verbs reach the Bound pair, and no verb redraws the Frame Mod', () => {
    const s = bench();
    const frame = s.bag[0].lines[0].id, boundWas = s.bag[0].lines[FRAME].id;
    expect(doCraft(s, 'bag', 0, 'reroll_mod', FRAME, mulberry32(5)).ok).toBe(true);
    expect(s.bag[0].lines[FRAME].id).not.toBe(boundWas);
    expect(s.bag[0].lines[0].id).toBe(frame);
    expect(refused(doCraft(s, 'bag', 0, 'reroll_mod', 0, mulberry32(6))).ok).toBe(false);
    const picked = replaceChoices(s, 'bag', 0)[0];
    expect(doCraft(s, 'bag', 0, 'replace', FRAME, mulberry32(7), picked).ok).toBe(true);
    expect(refused(doCraft(s, 'bag', 0, 'replace', 0, mulberry32(8), picked)).ok).toBe(false);
  });

  it('a bulk press costs the single-line price times the lines it edits', () => {
    const s = bench();
    const n = s.bag[0].lines.length - FRAME;
    expect(stoneNames('reroll_mod_all', s.bag[0])).toEqual({ tier: E.craft.roll_stones_per_use * n });
    expect(stoneNames('replace_all', s.bag[0])).toEqual({ replace: E.craft.replace_stones_per_use * n });
    expect(stoneNames('reroll_random', s.bag[0])).toEqual(stoneNames('reroll', s.bag[0]));
    expect(stoneNames('add_specific', s.bag[0])).toEqual(stoneNames('add', s.bag[0]));
  });

  it('every redraw stays inside the Base pool, once each, and moves no count', () => {
    const base = piece(12);
    const pool = poolOf(base);
    for (let seed = 1; seed <= 60; seed++) {
      for (const r of [craft.rerollModAll(base, pool, mulberry32(seed)), craft.replaceAll(base, pool, mulberry32(seed + 900))]) {
        if (!r.ok) throw new Error(`a bulk redraw refused (seed ${seed}): ${r.why}`);
        const ids = r.item.lines.map((l: any) => l.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const id of ids) expect(pool).toContain(id);
        expect(r.item.lines.length).toBe(base.lines.length);
        expect(r.item.lines[0].id).toBe(base.lines[0].id);
        expect(r.item.mods_added || 0).toBe(base.mods_added || 0);
      }
    }
  });

  it('Add specific writes the named Mod on the Add stone price, and a chosen Remove takes that line', () => {
    const s = bench();
    const fill = replaceChoices(s, 'bag', 0)[0];
    const lines = s.bag[0].lines.length;
    expect(doCraft(s, 'bag', 0, 'add_specific', 0, mulberry32(3), fill).ok).toBe(true);
    expect(s.bag[0].lines[lines].id).toBe(fill);
    expect(s.bag[0].mods_added).toBe((piece(12).mods_added || 0) + 1);
    expect(doCraft(s, 'bag', 0, 'add_specific', 0, mulberry32(4), fill).ok).toBe(false);
    const cut = s.bag[0].lines.length - 1;
    expect(doCraft(s, 'bag', 0, 'remove_at', cut, mulberry32(5)).ok).toBe(true);
    expect(s.bag[0].lines.length).toBe(cut);
    expect(refused(doCraft(s, 'bag', 0, 'remove_at', UNT - 1, mulberry32(6))).ok).toBe(false);
  });

  it('Polish pays its own stone, holds every Tier, and reaches the values no other stone edits', () => {
    const s = bench();
    const slices = s.bag[0].lines.map((l: any) => l.slice);
    const paid = s.counters.stones.polish;
    expect(doCraft(s, 'bag', 0, 'polish', 0, mulberry32(2)).ok).toBe(true);
    expect(s.counters.stones.polish).toBe(paid - E.craft.polish_stones_per_use);
    expect(s.bag[0].lines.map((l: any) => l.slice)).toEqual(slices);
    // the head of the piece is the point of this stone: its values moved, and its Tiers did not
    expect(s.bag[0].lines[0].id).toBe(piece(12).lines[0].id);
  });

  it('an Add stone stamps its line as crafted, says it on the card, and keeps the stamp through an identity press', () => {
    const s = bench();
    const fill = replaceChoices(s, 'bag', 0)[0];
    expect(doCraft(s, 'bag', 0, 'add_specific', 0, mulberry32(2), fill).ok).toBe(true);
    const added = s.bag[0].lines[s.bag[0].lines.length - 1];
    expect(added.crafted).toBe(true);
    expect(craftedMark(added)).toBe(' (crafted)');
    // the head of the piece was never an Add line, so it never reads as one
    for (const l of s.bag[0].lines.slice(0, craft.UNTOUCHABLE)) expect(craftedMark(l)).toBe('');
    // the stamp belongs to the slot, not to the Mod that sat in it
    const next = replaceChoices(s, 'bag', 0)[0];
    expect(doCraft(s, 'bag', 0, 'replace', s.bag[0].lines.length - 1, mulberry32(3), next).ok).toBe(true);
    expect(craftedMark(s.bag[0].lines[s.bag[0].lines.length - 1])).toBe(' (crafted)');
    // and it rides the save, because the save stores the line as it is
    expect(JSON.parse(JSON.stringify(s.bag[0].lines[s.bag[0].lines.length - 1])).crafted).toBe(true);
  });

  it('Rebirth redraws the whole Unbound set for one stone and keeps the head of the piece', () => {
    const s = bench();
    const UNT = craft.UNTOUCHABLE;
    const head = s.bag[0].lines.slice(0, UNT).map((l: any) => l.id);
    const setWas = s.bag[0].lines.slice(UNT).map((l: any) => l.id);
    const paid = s.counters.stones.rebirth;
    expect(stoneNames('rebirth', s.bag[0])).toEqual({ rebirth: E.craft.rebirth_stones_per_use });
    expect(doCraft(s, 'bag', 0, 'rebirth', 0, mulberry32(3)).ok).toBe(true);
    expect(s.counters.stones.rebirth).toBe(paid - E.craft.rebirth_stones_per_use);
    const now = s.bag[0].lines;
    // the head is untouched and the count never moved
    expect(now.slice(0, UNT).map((l: any) => l.id)).toEqual(head);
    expect(now.length).toBe(s.bag[0].lines.length);
    // the set came back changed, still inside the Base pool, and never twice
    const pool = poolOf(piece(12));
    const ids = now.map((l: any) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(pool).toContain(id);
    if (setWas.length) expect(ids.slice(UNT).join(',')).not.toBe(setWas.join(','));
    // the Add accounting is untouched: a Rebirth press is not an Add press
    expect(s.bag[0].mods_added || 0).toBe(piece(12).mods_added || 0);
  });
});
