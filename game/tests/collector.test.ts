import { describe, it, expect } from 'vitest';
import { TOWN, BASES, eng } from '../src/engine/client';
import { col, setUnlocked, turnIn, heldCount, wants, newGrants } from '../src/sim/collector';
import { stashTabCount, stockOf, priceMinutes } from '../src/sim/town';
import { newGame } from '../src/sim/game';

const piece = (base: string, slot: string, quality = 'low') => ({
  slot, base, rarity: 'Common', quality, tier: 'T1', lines: [], q: 0, weight: 30,
});

describe('the three sets are the ones town.json names', () => {
  it('three sets, three set towns, and none of them pays gold', () => {
    expect(col.sets.length).toBe(3);
    expect(col.sets.map((s: any) => s.settlement).sort()).toEqual(['ashfall', 'bonegate', 'vermolch']);
    for (const s of col.sets) expect(s.pays_gold).toBe(false);
    expect(TOWN.settlements.filter((st: any) => st.npcs.includes('collector')).length).toBe(3);
  });

  it('a piece matches on Base, slot and the quality the set asks for', () => {
    const militia = col.setAt('ashfall');
    const reliquary = col.setAt('bonegate');
    const garden = col.setAt('vermolch');
    expect(col.matches(militia, piece('Hood', 'helmet'))).toBe(true);
    expect(col.matches(militia, piece('Sallet', 'helmet'))).toBe(false);
    expect(col.matches(militia, piece('Hood', 'chest'))).toBe(false);
    expect(col.matches(reliquary, piece('Plate Vest', 'chest'))).toBe(true);
    expect(col.matches(garden, piece('Circlet', 'helmet', 'low'))).toBe(false);
    expect(col.matches(garden, piece('Circlet', 'helmet', 'high'))).toBe(true);
  });

  it('a finished set stops wanting pieces', () => {
    const s = newGame(3);
    expect(wants(s, piece('Hood', 'helmet'))?.id).toBe('militia');
    s.collector.done.militia = true;
    expect(wants(s, piece('Hood', 'helmet'))).toBe(null);
  });
});

describe('turning a set in', () => {
  it('waits for Tier II standing in that settlement', () => {
    const s = newGame(4);
    const gate = TOWN.settlements.find((x: any) => x.id === 'bonegate');
    const set = col.setAt('bonegate');
    expect(setUnlocked(s, set)).toBe(false);
    expect(turnIn(s, 'bonegate').ok).toBe(false);
    s.counters.zoneKills[gate.zone] = Math.ceil(eng.BAND.high.kills_per_hr * gate.budget_hr * TOWN.standing.tiers[1].share);
    expect(setUnlocked(s, set)).toBe(true);
  });

  it('consumes one held piece per line and pays the item itself', () => {
    const s = newGame(5);
    const gate = TOWN.settlements.find((x: any) => x.id === 'bonegate');
    s.counters.zoneKills[gate.zone] = Math.ceil(eng.BAND.high.kills_per_hr * gate.budget_hr * TOWN.standing.tiers[1].share);
    const before = stashTabCount(s);
    const gold = s.counters.gold;
    s.bag.unshift(
      { ...piece('Sallet', 'helmet'), heldFor: 'reliquary' },
      { ...piece('Plate Vest', 'chest'), heldFor: 'reliquary' },
      { ...piece('Cuisses', 'pant'), heldFor: 'reliquary' },
    );
    expect(heldCount(s, 'reliquary', 'Plate Vest')).toBe(1);
    const r = turnIn(s, 'bonegate');
    expect(r.ok).toBe(true);
    expect(s.bag.length).toBe(0);
    expect(s.collector.done.reliquary).toBe(true);
    expect(s.grants.stash_tabs).toBe(1);
    expect(stashTabCount(s)).toBe(before + 1);
    expect(s.counters.gold).toBe(gold);
  });

  it('happens once per character, and a missing piece is refused', () => {
    const s = newGame(6);
    const gate = TOWN.settlements.find((x: any) => x.id === 'ashfall');
    s.counters.zoneKills[gate.zone] = Math.ceil(eng.BAND.low.kills_per_hr * gate.budget_hr * TOWN.standing.tiers[1].share);
    s.bag.unshift({ ...piece('Hood', 'helmet'), heldFor: 'militia' });
    expect(turnIn(s, 'ashfall').ok).toBe(false);
    s.bag.unshift({ ...piece('Ring Mail', 'chest'), heldFor: 'militia' }, { ...piece('Strapped Boots', 'boots'), heldFor: 'militia' });
    expect(turnIn(s, 'ashfall').ok).toBe(true);
    expect(turnIn(s, 'ashfall').why).toMatch(/already turned in/);
    expect(s.grants.banners.length).toBe(1);
    expect(s.grants.filter_presets).toBe(1);
  });

  it('reads held pieces from the stash as well as the bag', () => {
    const s = newGame(7);
    const gate = TOWN.settlements.find((x: any) => x.id === 'ashfall');
    s.counters.zoneKills[gate.zone] = Math.ceil(eng.BAND.low.kills_per_hr * gate.budget_hr * TOWN.standing.tiers[1].share);
    s.town.owned.push('stash_tab_1');
    s.bag.unshift({ ...piece('Hood', 'helmet'), heldFor: 'militia' });
    s.stash[0] = [
      { ...piece('Ring Mail', 'chest'), heldFor: 'militia' },
      { ...piece('Strapped Boots', 'boots'), heldFor: 'militia' },
    ];
    expect(turnIn(s, 'ashfall').ok).toBe(true);
    expect(s.stash[0].length).toBe(0);
  });
});

describe('the Collector panel has something to sell', () => {
  it('the hint line is stocked at each set town at its published price', () => {
    for (const town of ['ashfall', 'bonegate', 'vermolch']) {
      const ids = stockOf(town).map((r: any) => r.id);
      expect(ids).toContain('collector_hint');
      expect(priceMinutes(TOWN.repeatable.find((r: any) => r.id === 'collector_hint'), town)).toBe(col.HINT_PRICE_M);
    }
  });

  it('every set piece names a Base that exists in the frame table', () => {
    for (const set of col.sets) {
      for (const p of set.parsed) {
        const frame = BASES.bases.find((b: any) => b.name === p.name);
        expect(frame, `bases.json is missing ${p.name}`).toBeTruthy();
        expect(frame.slot).toBe(p.slot);
      }
    }
  });

  it('grants start empty', () => {
    expect(newGrants()).toEqual({ filter_presets: 0, stash_tabs: 0, titles: [], banners: [] });
  });
});
