// @ts-nocheck
/**
 * Imprint cage — the stone that carries a Mod's identity, and the verb/target matrix it sits in.
 *
 *   node tools/imprint.ts            help
 *   node tools/imprint.ts --checks   run IM1-IM8, exit 1 on FAIL
 *
 * One stone per Mod line in the game (`imprint_<id>`): it names one Unbound line and rewrites
 * it as its own Mod, rolling Tier and value fresh. The drop-count stamp (`unbound_at_drop`) keeps
 * the +2 Add cap net. IM4-IM8 hold the rest of the bench to the same reach rule: the Frame Mod is
 * redrawn by nothing, the Bound pair takes an identity but no value or count stone, a bulk press
 * costs the single-line price times the lines it edits, and every redraw stays inside the Base's
 * own pool. The sim behaviour in the live loop is covered by `game/tests/imprint.test.ts`.
 */

import path from 'node:path';
import { readJson } from './lib/json.ts';
import { createCraft, imprintStoneFor } from '../engine/craft.ts';
import { createLoot } from '../engine/loot.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const E = readJson(path.join(ROOT, 'tools/data/engine.json'));
const MODS = readJson(path.join(ROOT, 'tools/data/mods.json'));
const BASES = readJson(path.join(ROOT, 'tools/data/bases.json'));
const LOOT = createLoot(E, MODS);
const CRAFT = createCraft(E, LOOT);
const rng = () => 0.5;

// A piece on a real Base, so the pool a redraw draws from is the one `loot.poolFor` owns and the
// Frame line is the frame's own — not a fixture list the cage invents beside the data.
const CHEST = BASES.bases.find((b: any) => b.slot === 'chest' && (b.base_lines || []).length) || BASES.bases[0];
const POOL: string[] = LOOT.poolFor(BASES, CHEST.slot, CHEST, null).map((e: any) => e.id);
const FRAME_LINE = (CHEST.base_lines || [POOL[0]])[0];

const fixture = () => ({
  base: CHEST.name, slot: CHEST.slot,
  ilvl: 60, q: 1,
  lines: [
    { id: FRAME_LINE, value: 1, slice: 0 },
    ...POOL.filter((id) => id !== FRAME_LINE).slice(0, 4).map((id, i) => ({ id, value: 1, slice: i < 1 ? 0 : 2 })),
  ],
  unbound_at_drop: 2,
  mods_added: 0,
  baselines: {},
});

function checks() {
  const im1 = [];
  const im2 = [];
  const im3 = [];
  const src = E.loot.imprint_stone_sources || {};
  // IM1 · the mint and the price: a real elite chance, whole boss stones, one stone a use
  if (!(src.elite_imprint_chance > 0 && src.elite_imprint_chance <= 1)) {
    im1.push(`imprint elite chance ${src.elite_imprint_chance} is not a rate`);
  }
  if (!Number.isInteger(src.boss_imprint_stones) || src.boss_imprint_stones < 1) {
    im1.push(`imprint boss stones ${src.boss_imprint_stones} is not a whole count`);
  }
  if (E.craft.imprint_stones_per_use !== 1) {
    im1.push(`imprint costs ${E.craft.imprint_stones_per_use}, not one stone a use`);
  }
  // IM2 · one stone per Mod in the game, and the bench charges exactly that stone
  for (const m of MODS.mods) {
    const key = imprintStoneFor(m.id);
    const cost = CRAFT.costOf('imprint', fixture(), m.id);
    if (JSON.stringify(cost) !== JSON.stringify({ [key]: 1 })) {
      im2.push(`${m.id} costs ${JSON.stringify(cost)}, not one ${key}`);
    }
  }
  // IM3 · the verb: a fresh roll in the window, the baseline cleared, the locked lines refused
  const target = POOL.find((id) => id !== FRAME_LINE && !fixture().lines.some((l: any) => l.id === id))
    || MODS.mods.map((m: any) => m.id).find((id: string) => id !== FRAME_LINE);
  const r = CRAFT.imprint({ ...fixture(), baselines: { 3: 999 } }, 3, target, rng);
  if (!r.ok) im3.push(`imprint refused a clean Unbound line: ${r.why}`);
  else {
    const [lo, hi] = LOOT.rangeOf(target, 60, 1, r.item.lines[3].slice);
    if (r.item.lines[3].id !== target) im3.push('imprint did not write its Mod');
    if (r.item.lines[3].value < lo || r.item.lines[3].value > hi) im3.push('imprint value outside the fresh window');
    if (r.item.baselines && r.item.baselines[3] != null) im3.push('imprint kept the old baseline');
  }
  if (CRAFT.imprint(fixture(), 0, target, rng).ok) im3.push('imprint touched the Frame Mod');
  if (CRAFT.imprint(fixture(), 1, target, rng).ok) im3.push('imprint touched the Bound pair');
  const carried = fixture().lines[4].id;
  if (CRAFT.imprint(fixture(), 3, carried, rng).ok) im3.push('imprint stacked a carried Mod');
  if (CRAFT.payable({}, 'imprint', fixture())) im3.push('an empty purse pays for imprint');
  // the drop-count stamp: the +2 cap is net, so Remove refunds room; every press still charges one stone
  const grown = { ...fixture(), lines: [...fixture().lines, { id: 'x', value: 1, slice: 2 }, { id: 'y', value: 1, slice: 2 }], mods_added: 2 };
  if (CRAFT.add(grown, ['z'], rng).ok) im3.push('Add passed a piece already two over its drop count');

  // IM4 · the reach rule, per verb: the Frame Mod is redrawn by nothing, the Bound pair takes an
  // identity but no value stone and no count stone.
  const UNT = CRAFT.UNTOUCHABLE, FRAME = CRAFT.PIECE_FLOOR;
  const im4: string[] = [];
  const LINE_OPS: [string, (it: any, i: number) => any][] = [
    ['reroll', (it, i) => CRAFT.reroll(it, i, rng)],
    ['refine', (it, i) => CRAFT.refine(it, i, rng)],
    ['randomize', (it, i) => CRAFT.randomize(it, i, rng)],
    ['imprint', (it, i) => CRAFT.imprint(it, i, target, rng)],
    ['remove_at', (it, i) => CRAFT.removeAt(it, i)],
    ['reroll_mod', (it, i) => CRAFT.rerollMod(it, i, POOL, rng)],
    ['replace', (it, i) => CRAFT.replaceLine(it, i, POOL.find((id) => !it.lines.some((l: any) => l.id === id)) || target, POOL, rng)],
  ];
  for (const [op, call] of LINE_OPS) {
    if (call(fixture(), FRAME - 1).ok && FRAME > 0) im4.push(`${op} edited a line below the Frame Mod floor`);
    if (call(fixture(), 0).ok) im4.push(`${op} edited the Frame Mod`);
    const reachBound = UNT - 1 >= FRAME ? call(fixture(), UNT - 1).ok : true;
    if (op === 'reroll_mod' || op === 'replace') {
      if (!reachBound) im4.push(`${op} refused the Bound pair the owner opened to it`);
    } else if (call(fixture(), UNT - 1).ok) im4.push(`${op} crossed into the Bound pair`);
  }
  for (const op of ['reroll_random', 'reroll_mod_all', 'replace_all', 'polish']) {
    const before = fixture();
    const after = op === 'reroll_random' ? CRAFT.rerollRandom(before, rng)
      : op === 'reroll_mod_all' ? CRAFT.rerollModAll(before, POOL, rng)
        : op === 'replace_all' ? CRAFT.replaceAll(before, POOL, rng)
          : CRAFT.polish(before, rng);
    if (!after.ok) im4.push(`${op} refused a clean piece: ${after.why}`);
    else if (after.item.lines[0].id !== before.lines[0].id) im4.push(`${op} redrew the Frame Mod's identity`);
  }

  // IM5 · a bulk press costs the single-line price times the lines it edits — no discount, no premium,
  // and no second copy of a number beside it.
  const im5: string[] = [];
  const p = fixture(), n = p.lines.length - FRAME;
  const want = (stone: string, per: number) => ({ [stone]: per * n });
  const got = (op: string) => CRAFT.costOf(op, p);
  if (JSON.stringify(got('reroll_mod_all')) !== JSON.stringify(want('tier', E.craft.roll_stones_per_use))) {
    im5.push(`reroll_mod_all costs ${JSON.stringify(got('reroll_mod_all'))}, not the roll price × ${n} lines`);
  }
  if (JSON.stringify(got('replace_all')) !== JSON.stringify(want('replace', E.craft.replace_stones_per_use))) {
    im5.push(`replace_all costs ${JSON.stringify(got('replace_all'))}, not the Replace price × ${n} lines`);
  }
  if (JSON.stringify(got('reroll_random')) !== JSON.stringify(got('reroll'))) {
    im5.push('the stone that picks the line charges a different price than the one the player picks');
  }
  if (JSON.stringify(got('add_specific')) !== JSON.stringify(got('add'))) {
    im5.push('a chosen Add costs what a drawn Add does not — the choice must buy the identity, not the line');
  }
  if (CRAFT.costOf('randomize', p).tier !== E.craft.roll_stones_per_use) {
    im5.push('Randomize and Reroll mod do not read one roll price');
  }

  // IM6 · every redraw stays inside the Base's pool, never stacks a Mod the piece carries, never
  // crosses a blocked sibling, and never moves the line count or an Add charge.
  const im6: string[] = [];
  const takenOf = (it: any) => new Set(it.lines.flatMap((l: any) => [l.id, ...(l.extra || []).map((x: any) => x.id)]));
  for (let seed = 1; seed <= 40; seed++) {
    const roll = LOOT.mulberry32(seed);
    for (const res of [CRAFT.rerollModAll(fixture(), POOL, roll), CRAFT.replaceAll(fixture(), POOL, roll)]) {
      if (!res.ok) { im6.push(`a bulk redraw refused (seed ${seed}): ${res.why}`); continue; }
      const ids = res.item.lines.map((l: any) => l.id);
      for (const id of ids) if (!POOL.includes(id)) im6.push(`a redraw landed outside the Base pool: ${id}`);
      if (new Set(ids).size !== ids.length) im6.push(`a redraw stacked one Mod twice: ${ids.join(', ')}`);
      // `blockedBy` answers for the whole Stat Mod family, the member already on the piece included,
      // so the rule reads as the family it is: one member across the piece, the Frame line's own
      // sub-Mods counted — a redraw that brings a sibling in beside one the frame carries is the same
      // defect as one that brings two in beside each other.
      const onPiece = [...takenOf(res.item)].filter((id) => LOOT.STAT_IDS.includes(id));
      if (onPiece.length > 1) im6.push(`a redraw stacked the Stat Mod family: ${onPiece.join(', ')}`);
      if (res.item.lines.length !== p.lines.length) im6.push('a bulk redraw moved the line count');
      if ((res.item.mods_added || 0) !== 0 || res.item.unbound_at_drop !== p.unbound_at_drop) {
        im6.push('a bulk redraw moved an Add charge or the drop-count stamp');
      }
    }
  }
  const chosen = POOL.find((id) => !fixture().lines.some((l: any) => l.id === id)) || target;
  const spec = CRAFT.addSpecific({ ...fixture(), lines: fixture().lines.slice(0, UNT) }, POOL, chosen, rng);
  if (!spec.ok) im6.push(`Add specific refused a clean piece: ${spec.why}`);
  else if (spec.item.lines[spec.item.lines.length - 1].id !== chosen) im6.push('Add specific did not write the chosen Mod');
  if (CRAFT.addSpecific(fixture(), POOL, fixture().lines[2].id, rng).ok) im6.push('Add specific stacked a carried Mod');
  if (CRAFT.addSpecific(fixture(), ['not_a_mod_at_all'], fixture().lines[2].id, rng).ok) im6.push('Add specific accepted a line outside the pool');

  // IM7 · a corrupted piece closes every verb, new and old, and only Repair opens it again.
  const im7: string[] = [];
  const sealed = { ...fixture(), corrupted: true };
  for (const [op, call] of LINE_OPS) if (call(sealed, 3).ok) im7.push(`${op} ran on a corrupted piece`);
  for (const call of [() => CRAFT.rerollRandom(sealed, rng), () => CRAFT.rerollModAll(sealed, POOL, rng),
    () => CRAFT.replaceAll(sealed, POOL, rng), () => CRAFT.polish(sealed, rng),
    () => CRAFT.add(sealed, POOL, rng), () => CRAFT.remove(sealed, rng)]) {
    if (call().ok) im7.push('a whole-piece verb ran on a corrupted piece');
  }
  if (!CRAFT.repair({ ...fixture(), broken: true }).ok) im7.push('Repair cannot revive a Broken piece');
  if (CRAFT.removeAt(fixture(), 1).ok) im7.push('Remove reached the Bound pair');

  // IM8 · Rebirth redraws the Unbound set and nothing above it, for one stone however many lines it
  // takes, and it is minted inside the boss-stone ladder the notes describe.
  const im8: string[] = [];
  const RB = E.loot.rebirth_stone_sources, RF = E.loot.reforge_stone_sources, CS = E.loot.corrupt_stone_sources;
  if (!(RB.boss_rebirth_chance > 0 && RB.boss_rebirth_chance < 1)) im8.push(`boss Rebirth chance ${RB.boss_rebirth_chance} is not a rate`);
  if (!Number.isInteger(RB.boss_rebirth_stones) || RB.boss_rebirth_stones < 1) im8.push(`boss Rebirth stones ${RB.boss_rebirth_stones} is not a whole count`);
  if (RB.boss_rebirth_chance >= RF.boss_reforge_chance || RB.boss_rebirth_chance >= CS.boss_corrupt_chance) {
    im8.push('Rebirth is not the rarest of the three boss stones — the press is the widest');
  }
  if (E.craft.rebirth_stones_per_use !== 1) im8.push(`Rebirth costs ${E.craft.rebirth_stones_per_use}, not one stone a press`);
  const deep = { ...fixture(), lines: [...fixture().lines, { id: 'max_hp_flat', value: 1, slice: 2 }, { id: 'max_mana_flat', value: 1, slice: 2 }] };
  const rb = CRAFT.rebirth(deep, POOL, rng);
  if (!rb.ok) im8.push(`Rebirth refused a piece with Unbound lines: ${rb.why}`);
  else {
    if (rb.item.lines.slice(0, CRAFT.UNTOUCHABLE).map((l: any, i: number) => l.id).join(',')
      !== deep.lines.slice(0, CRAFT.UNTOUCHABLE).map((l: any) => l.id).join(',')) im8.push('Rebirth touched the Frame Mod or the Bound pair');
    if (rb.item.lines.length !== deep.lines.length) im8.push('Rebirth moved the line count');
    if ((rb.item.mods_added || 0) !== (deep.mods_added || 0)) im8.push('Rebirth spent an Add charge');
    const ids = rb.item.lines.map((l: any) => l.id);
    if (new Set(ids).size !== ids.length) im8.push(`Rebirth stacked one Mod twice: ${ids.join(', ')}`);
    for (const id of ids) if (!POOL.includes(id)) im8.push(`Rebirth landed outside the Base pool: ${id}`);
    if (!Array.isArray(rb.changed) || rb.changed.length !== CRAFT.editableCount(deep, CRAFT.UNTOUCHABLE)) {
      im8.push(`Rebirth redrawn ${Array.isArray(rb.changed) ? rb.changed.length : '?'} lines, not the ${CRAFT.editableCount(deep, CRAFT.UNTOUCHABLE)} it holds`);
    }
  }
  // a piece whose only lines are the head has nothing to redraw, and one stone buys the press whole
  if (CRAFT.rebirth({ ...fixture(), lines: fixture().lines.slice(0, CRAFT.UNTOUCHABLE) }, POOL, rng).ok) {
    im8.push('Rebirth ran on a piece with no Unbound line');
  }
  if (JSON.stringify(CRAFT.costOf('rebirth', deep)) !== JSON.stringify({ rebirth: 1 })) {
    im8.push(`a Rebirth press costs ${JSON.stringify(CRAFT.costOf('rebirth', deep))}, not one stone whatever the count`);
  }

  // IM9 · the crafted mark: only an Add stone stamps a line as crafted, no other verb ever does, the
  // head of the piece can never carry it, and an identity press that rewrites the line keeps the stamp —
  // the mark belongs to the slot, not to the Mod that happened to sit in it.
  const im9: string[] = [];
  const roll = LOOT.mulberry32(7);
  const rolled = CRAFT.add(fixture(), POOL, roll);
  if (!rolled.ok) im9.push(`Add refused a clean piece: ${rolled.why}`);
  else {
    const last = rolled.item.lines[rolled.item.lines.length - 1];
    if (!last.crafted) im9.push('Add did not stamp the line it filled');
    if (rolled.item.lines.slice(0, CRAFT.UNTOUCHABLE).some((l: any) => l.crafted)) im9.push('a head line carries a crafted mark');
    const swapped = CRAFT.replaceLine(rolled.item, rolled.item.lines.length - 1,
      POOL.find((id: string) => !rolled.item.lines.some((l: any) => l.id === id)), POOL, roll);
    if (!swapped.ok) im9.push(`Replace refused the crafted line: ${swapped.why}`);
    else if (!swapped.item.lines[swapped.item.lines.length - 1].crafted) im9.push('Replace dropped the crafted mark with the old identity');
    const born = CRAFT.rebirth(swapped.item, POOL, roll);
    if (!born.ok) im9.push(`Rebirth refused the crafted piece: ${born.why}`);
    else if (!born.item.lines[born.item.lines.length - 1].crafted) im9.push('Rebirth dropped the crafted mark');
    else if (born.item.lines.slice(0, CRAFT.UNTOUCHABLE).some((l: any) => l.crafted)) im9.push('Rebirth stamped the head of the piece');
  }
  // a fresh drop carries no crafted line: the mark is only ever a stone's doing
  for (let seed = 1; seed <= 12; seed++) {
    const drop = LOOT.frameModRoll(BASES, 'chest', CHEST, null, LOOT.mulberry32(seed), 60, 1, 1);
    if (drop.some((l: any) => l.crafted)) im9.push('the drop roller stamped a line crafted');
  }

  return { im1, im2, im3, im4, im5, im6, im7, im8, im9 };
}

const args = process.argv.slice(2);
if (args.includes('--checks')) {
  const { im1, im2, im3, im4, im5, im6, im7, im8, im9 } = checks();
  const say = (ok, text) => console.log(`${ok ? 'PASS' : 'FAIL'}  ${text}`);
  say(im1.length === 0, `IM1  elite ${E.loot.imprint_stone_sources?.elite_imprint_chance}/kill · boss ${E.loot.imprint_stone_sources?.boss_imprint_stones} stones · 1 a use${im1.length ? ' · ' + im1.join(' · ') : ''}`);
  say(im2.length === 0, `IM2  one stone per Mod (${MODS.mods.length} lines), each charging itself${im2.length ? ' · ' + im2.slice(0, 4).join(' · ') : ''}`);
  say(im3.length === 0, `IM3  fresh roll in-window, baseline cleared, locked lines refused, net +2 cap${im3.length ? ' · ' + im3.join(' · ') : ''}`);
  say(im4.length === 0, `IM4  reach per verb: the Frame Mod by nothing, the Bound pair by identity verbs only, and the four whole-piece presses never by identity${im4.length ? ' · ' + im4.join(' · ') : ''}`);
  say(im5.length === 0, `IM5  a bulk press costs the single-line price × ${CRAFT.editableCount(fixture(), CRAFT.PIECE_FLOOR)} lines; the drawn and chosen twin charge one price${im5.length ? ' · ' + im5.join(' · ') : ''}`);
  say(im6.length === 0, `IM6  every redraw stays in the ${POOL.length}-line Base pool, no stack, no blocked sibling, no moved count${im6.length ? ' · ' + im6.slice(0, 4).join(' · ') : ''}`);
  say(im7.length === 0, `IM7  a corrupted piece closes every verb and Repair opens it again${im7.length ? ' · ' + im7.join(' · ') : ''}`);
  say(im8.length === 0, `IM8  Rebirth redraws the Unbound set only, one stone a press whatever the count, minted inside the boss ladder (Corrupt ⊃ Reforge ⊃ Rebirth)${im8.length ? ' · ' + im8.join(' · ') : ''}`);
  say(im9.length === 0, `IM9  only Add stamps a line crafted, no verb puts the mark on the head, and an identity press keeps it${im9.length ? ' · ' + im9.join(' · ') : ''}`);
  const problems = [...im1, ...im2, ...im3, ...im4, ...im5, ...im6, ...im7, ...im8, ...im9];
  if (problems.length) {
    console.log(`\n${problems.length} problem(s):`);
    for (const p of problems) console.log(`  · ${p}`);
    process.exit(1);
  }
  console.log('\n9/9 gate PASS · 0 FAIL');
} else {
  console.log('imprint.ts — the identity stone and the bench verb matrix');
  console.log('  --checks   run IM1-IM9 (mint, roster, verb, reach, bulk price, pool, sealed piece, Rebirth, crafted mark)');
}
