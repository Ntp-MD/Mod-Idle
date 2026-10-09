/**
 * The player wiki — a static site built straight from `tools/data/*.json` and `engine/`.
 *
 *   node tools/wiki.ts build     write `wiki/**` (git-ignored, rebuildable)
 *
 * It is a **view**, and it reads the same data and calls the same engine functions the cages do, so it
 * cannot disagree with the game. It carries only what a player needs to play — no gate ids, no K value,
 * no craft internals — and it owns no number: every figure below is read, so a wrong table is a bug in
 * the data or in the engine, and `node tools/verify.ts` is what says which.
 *
 * The theme is the game's own: the `:root` tokens are lifted out of `game/src/app.css`, so the wiki
 * wears the same palette the client does and there is no second place for a colour to live.
 */

import fs from 'node:fs';
import path from 'node:path';
// The wiki reads the engine, and only the engine: this is the same seam the client uses
// (`game/src/engine/client.ts`), so a page, a gate and the game all see one set of numbers.
import { E, MODS, TOWN, BASES, TREE_SPEC, SKILLS, eng, loot, sm, tree } from '../game/src/engine/client.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'wiki');
/** Every reference build a press is printed against — the engine own two. */
const REFS = (eng as any).REF;
const TYPES: string[] = (SKILLS as any).meta.types;

// ---------------------------------------------------------------- rendering

const esc = (s: any): string => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
const n0 = (n: any): string => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—');
const n1 = (n: any): string => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—');
const list = (a: any): string => (a || []).map((x: any) => esc(x)).join(' · ');
const pctList = (a: any): string => (a || []).map((x: any) => `${(Number(x) * 100).toFixed(1)}%`).join(' · ');
const table = (head: string[], rows: any[][]): string =>
  `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>` +
  rows.map((r) => `<tr>${r.map((c) => `<td>${c == null ? '' : String(c)}</td>`).join('')}</tr>`).join('') +
  '</tbody></table>';
const block = (h: string, body: string, note = ''): string =>
  `<section><h2>${esc(h)}</h2>${note ? `<p class="note">${note}</p>` : ''}${body}</section>`;

type Page = { file: string; nav: string; title: string; lead: string; body: string[] };
const PAGES: Page[] = [];
const page = (p: Page): void => { PAGES.push(p); };
const wrap = (s: string) => `<span class="num">${s}</span>`;

/**
 * The tree shape the data holds: `branches` is keyed by branch name, and each branch holds its nodes
 * keyed by index. Counting is therefore a read, not a second copy of "63".
 */
const treeNodes = () => ({
  branches: Object.keys((TREE_SPEC as any).branches || {}).length,
  count: ((tree as any).nodes || []).length,
  perBranch: (name: string) => Object.keys((TREE_SPEC as any).branches?.[name] || {}).length,
});
const TREE_CFG = TREE_SPEC as any;

/** A Mod id as the name the player reads — the same table the engine rolls from. */
const modName = (id: any): string => (id ? ((MODS.mods || []).find((m: any) => m.id === id)?.name || String(id)) : '—');
/** One Mod's window per Item quality band, exactly as the data states its ladder. */
const modBands = (m: any): string => (m.bands || []).map((b: any) =>
  (b || []).map((w: any) => `${n0(w[0])}-${n0(w[1])}`).join(' → ')).join('  ·  ');

// ---------------------------------------------------------------- pages

page({
  file: 'index.html',
  nav: 'Start here',
  title: 'ModWorld — how to play',
  lead: 'An open-world idle RPG. Your character fights while the window is open and while it is shut.',
  body: [
    block('A run, in six steps', `<ol>
      <li><strong>Pick a settlement</strong>, then a zone attached to it.</li>
      <li><strong>Fight</strong> — the character attacks on the clock; skills fire on their own cooldowns and mana.</li>
      <li><strong>Loot</strong> — every mob pays XP, a chance at gear, crafting stones and junk.</li>
      <li><strong>Decide</strong> — equip the piece, or feed it to the crafting stones.</li>
      <li><strong>Craft</strong> at a settlement: reroll a line, refine it, ascend the whole piece.</li>
      <li><strong>Climb</strong> to the next zone. There is no death: a losing fight pushes you back to camp.</li>
    </ol>`, 'The whole game is one screen — the field — and the panels behind it.'),
    block('What is in the game', table(['', 'Count', 'What it is'], [
      ['Zones', wrap(n0(eng.ZONES.length)), 'each with its own level band, Element and group size'],
      ['Worn pieces', wrap(n0((E.opening?.gear || []).length)), `over ${n0(BASES.slots?.length ?? 0)} slot names — every slot has its own frames and Mod pools`],
      ['Skills', wrap(n0(sm.all().length)), TYPES.map((t: string) => `${sm.of(t).length} ${t}`).join(' · ')],
      ['Mob species', wrap(n0(E.mob.species.length)), 'each legal on one to three body classes'],
      ['Elements', wrap(n0(E.elements.order.length)), list(E.elements.order)],
      ['Settlements', wrap(n0(TOWN.settlements?.length ?? 0)), 'shops, storage, tasks and crafting'],
      ['Passive tree', wrap(n0(treeNodes().count)), `${treeNodes().branches} branches · ${n0(TREE_CFG.point_cost_per_rank)} point a rank`],
    ]), 'Read from the data, never typed here.'),
  ],
});


const press = (s: any, which: string, lv: number) => {
  const v = sm.perPress(s, { ...REFS[which], level: lv });
  return v == null ? '—' : n0(v);
};
const n2 = (n: any): string => Number(n).toFixed(2);
const pc0 = (v: number): string => `${n0(v * 100)}%`;
const pc1 = (v: number): string => `${n1(v * 100)}%`;
/** a figure the data already states in percentage points, not as a fraction */
const pts = (v: number): string => `${n0(v)}%`;
/** One effect value as the page prints it: the op decides the sign, the level decides the number. */
const fxVal = (e: any, v: number): string =>
  e.op === 'mult' ? `×${n2(v)}` : `${v < 0 ? '−' : '+'}${Number.isInteger(Math.abs(v)) ? n0(Math.abs(v)) : n1(Math.abs(v))}`;
/**
 * Every line one skill moves, from its level-1 value to the value it holds at the level cap — the two
 * ends the engine's own `effectsAt` prints, so a `special_level_effects` stat that does not ride the
 * ramp shows one number rather than a fake climb. `foe` marks a line an aura writes on the Field of
 * Enemies; `mob` marks one a press or a curse writes on the mob it landed on.
 */
const fxLadder = (s: any): string => {
  const fx: any[] = s.effects || [];
  if (!fx.length) return '';
  const one = sm.effectsAt(s, 1), top = sm.effectsAt(s, sm.LEVEL_CAP);
  return '<ul class="fx">' + fx.map((e: any, i: number) => {
    const a = one[i].value, b = top[i].value;
    const side = e.subject === 'target' ? (s.type === 'aura' || s.type === 'buff' ? 'foe' : 'mob') : 'self';
    return `<li><span class="fk">${esc(e.stat)}${e.element ? `:${esc(e.element)}` : ''}${e.condition ? ` <em>if ${esc(e.condition)}</em>` : ''}</span>` +
      `<span class="fs">${side}</span><span class="fv">${fxVal(e, a)}${Math.abs(b - a) > 0.004 ? ` → ${fxVal(e, b)}` : ''}</span></li>`;
  }).join('') + '</ul>';
};
const ST: any = (E as any).status || {};
page({
  file: 'skills.html',
  nav: 'Skills',
  title: 'Skills',
  lead: `Every skill is found as a drop and paid for with the same resource: <em>mana</em>. A skill levels up on kills with it in the list, up to ${E.skill_xp.level_cap} — and at that level it deals ${sm.damagePct(E.skill_xp.level_cap)}% of its level-1 damage and its effects are ${sm.effectPct(E.skill_xp.level_cap)}% as strong.`,
  body: [...TYPES.map((t: string) => {
    const rows = sm.of(t).map((s: any) => {
      const attack = s.type === 'attack';
      return [esc(s.name), s.cd ? `${n1(s.cd)} sec` : 'no cooldown', esc(s.mana),
        attack ? press(s, 'glass', 1) : '', attack ? press(s, 'glass', E.skill_xp.level_cap) : '',
        esc(s.targets || ''), esc(s.effect || s.reserve || ''), fxLadder(s) || '<span class="hy">writes no stat line</span>'];
    });
    const head = ['Skill', 'Cooldown', 'Mana', 'Damage (level 1)', `Damage (level ${E.skill_xp.level_cap})`, 'Targets', 'What it does', `Lines it moves (level 1 → ${E.skill_xp.level_cap})`];
    return block(`${t} — ${sm.of(t).length}`, table(head, rows),
      t === 'attack' ? 'Damage is one press on the reference character, before crit. The last column is every stat the row writes on, at level 1 and at the cap; a line with no arrow is one of the <code>special_level_effects</code>, which spend their level their own way.' : '');
  }),
    block('What a status changes, and how far it climbs', table(
      ['Status', 'What it does', 'At one stack / hit', 'At its ceiling', 'Holds'],
      [
        ['burn', `Elemental damage a second, plus a cut to the mob's HP regen`,
          `×${n1(ST.burn.k_dps)} aligned dps · regen −${pc0(ST.burn.regen_cut_per_stack)}`,
          `${n0(ST.burn.stack_max)} stacks — ×${n1(ST.burn.k_dps * ST.burn.stack_max)} aligned dps · regen −${pc0(ST.burn.regen_cut_max)}`,
          `${n0(ST.burn.time_sec)} sec`],
        ['chill', 'Slows the mob and blinds it, and cuts its Armour',
          `attack speed −${pts(ST.chill.aspd_pct)} · accuracy −${pts(ST.chill.acc_pct)} · Armour −${pc0(ST.chill.armour_cut)}`,
          `attack speed −${pts(ST.chill.aspd_cap)} · accuracy −${pts(ST.chill.acc_cap)}`,
          `${n0(ST.chill.time_sec)} sec`],
        ['shock', 'Stops the mob clock and cuts its speed — and cuts <em>our</em> Alignment against it',
          `clock stopped ${n1(ST.shock.stop_sec)} sec · attack speed −${pts(ST.shock.aspd_pct)} · Alignment −${pc0(ST.shock.align_cut)}`,
          `no stacks — one at a time · attack speed −${pts(ST.shock.aspd_cap)}`,
          `${n1(ST.shock.stop_sec)} sec`],
        ['poison', 'Elemental damage a second that outlives a weapon swap',
          `×${n2(ST.poison.k_dps)} aligned dps`,
          `${n0(ST.poison.stack_max)} stacks — ×${n1(ST.poison.k_dps * ST.poison.stack_max)} aligned dps`,
          `decays over ${n0(ST.poison.decay_sec)} sec`],
        ['mark', 'A growing multiplier on the hit it rides, plus leech',
          `damage +${pc1(ST.mark.k_dmg)} · leech +${pc1(ST.mark.k_leech)}`,
          `${n0(ST.mark.stack_max)} stacks — damage +${pc0(ST.mark.k_dmg * ST.mark.stack_max)} · leech +${pc1(ST.mark.k_leech * ST.mark.stack_max)}`,
          `decays over ${n0(ST.mark.decay_sec)} sec`],
      ]),
      `Every figure is the status table the roll reads. A status lands only when the Alignment gate lets it, and ${pc0(ST.proc_chance)} of the hits that pass the gate then carry it.`),
    block('The Alignment a status rides', (() => {
      const raw = eng.DERIVED?.align_raw ?? 0, path = eng.DERIVED?.align_path ?? 0;
      const stun = (a: number) => `${n1(eng.stunChanceFrom(a))}% chance`;
      return table(['', 'What the engine does', 'From → to'], [
        ['Where it comes from', 'Dex × <code>K_DEX_ALIGN</code>, plus any flat line, times any multiplier on it',
          `stats alone ${n1(raw)} → the reference build path ${n1(path)}`],
        ['The gate', 'a status lands only when the roll beats your Alignment',
          `then ${pc0(ST.proc_chance)} of the hits that pass carry it`],
        ['The damage', 'aligned damage a second = Elemental power × Alignment ÷ 100 × hits a second',
          `burn and poison together stop at ×${n1(ST.dot_cap)} of that figure`],
        ['What it buys', 'the lightning side converts it into a stun chance through <code>K_STUN_PER_ALIGN</code>',
          `${stun(raw)} → ${stun(path)}`],
        ['What cuts it', 'shock is the one status that fights our own', `−${pc0(ST.shock.align_cut)} against the shocked mob`],
        ['Ceiling', '<code>caps.alignment</code>', 'no Cap — the build keeps every point it earns'],
      ]);
    })(), 'Every figure is the engine reading its own table: <code>alignmentOf</code> and <code>stunChanceFrom</code> at the reference build, never a typed promise.'),
  ],
});

const IL: any = (E as any).item_level || {};
/** The band the odds are printed at — the middle one, so the table reads as a typical drop. */
const MID_BAND = Math.floor(((IL.spans || []).length || 1) / 2);
/** The Normal lines a drop draws (`item_level.stat_mod_slots`), and how a range reads on the page. */
const NORM: { min: number; max: number } = IL.stat_mod_slots || { min: 0, max: 0 };
const spacing = (r: { min: number; max: number }) => (r.min === r.max ? n0(r.min) : `${n0(r.min)}-${n0(r.max)}`);
/** The level range of the band the odds are printed at — the window a player reads is this band's own. */
const BAND_SPAN: any = (IL.spans || [])[MID_BAND] || {};
const isPct = (id: any): boolean => !!(MODS.mods || []).find((m: any) => m.id === id)?.pct;
/** The value window one Mod publishes at that band: its floor at the band's first level, its ceiling at its last. */
const winOf = (id: string): string => {
  const lo = loot.windowAt(id, BAND_SPAN.from ?? 1, MID_BAND)[0];
  const hi = loot.windowAt(id, BAND_SPAN.to ?? 1, MID_BAND)[1];
  return `${n0(lo)}-${n0(hi)}${isPct(id) ? '%' : ''}`;
};

page({
  file: 'items.html',
  nav: 'Items',
  title: 'Items',
  lead: 'A piece of gear is a <strong>frame</strong> plus the Mods that rolled on it. The frame decides what it can roll; the roll decides what it is worth.',
  body: [
    block('Slot by slot', BASES.slots.map((slot: string) => {
      const frames = (BASES.bases || []).filter((b: any) => b.slot === slot);
      // One possible-roll list per line kind, in the order a drop fills them: every entry names the Mod
      // this line can land, the value window it rolls in, and the chance the engine's own pool gives it —
      // read through `loot.poolChances` and renormalised over the lines this column may still draw. The
      // bar is the same chance drawn against the best line in the list, so the shape of the pool reads
      // before any number is compared.
      // Line 1 is the Base Mod. A frame NAMES the lines it carries and those are marked forced; only a
      // slot in `base_mod.drawn_line1_slots` draws line 1, and it draws it from the pool minus the Stat Mods.
      const SCALE: Record<string, number> = ((E.loot && E.loot.base_mod) || {}).value_scale || {};
      const DRAW_SLOTS: string[] = (BASES.base_mod?.drawn_line1_slots || []) as string[];
      /** The line-1 Mods the frame itself promises, read off the engine's floor roll — empty when line 1 is a draw. */
      const forced = (b: any): string[] => {
        if (DRAW_SLOTS.includes(slot)) return [];
        const line = (loot.baseModAtFloor(BASES, slot, b, null, 1, MID_BAND) as any[])[0];
        return line ? [line.id, ...((line.extra || []).map((x: any) => x.id))] : [];
      };
      const pool = (b: any) => (loot.poolChances(BASES, slot, b, null, MID_BAND) as any[]).sort((x: any, y: any) => y.chance - x.chance);
      /** the odds renormalised over the pool this line may still draw, the way `weightedPick` draws over it */
      const redraw = (list: any[]) => { const t = list.reduce((s: number, e: any) => s + e.chance, 0) || 1; return list.map((e: any) => ({ ...e, chance: e.chance / t })); };
      /** lines 2 and up: the frame own Mods are already on the piece, and a taken Stat Mod blocks its siblings */
      const laterPool = (b: any) => {
        const taken = new Set<string>(forced(b));
        const blocked = loot.blockedBy(taken) as Set<string>;
        return redraw(pool(b).filter((e: any) => !taken.has(e.id) && !blocked.has(e.id)));
      };
      const rollList = (entries: any[]) => {
        const top = entries.length ? Math.max(...entries.map((e: any) => e.chance)) : 1;
        return '<ul class="rolls">' + entries.map((e: any) =>
          `<li class="${e.forced ? 'forced' : ''}">` +
          (e.forced ? '' : `<i class="bar" style="width:${((e.chance / top) * 100).toFixed(1)}%"></i>`) +
          `<span class="rn">${esc(modName(e.id))}</span><span class="rv">${winOf(e.id)}</span><span class="rp">${e.forced ? 'forced' : `${(e.chance * 100).toFixed(1)}%`}</span></li>`).join('') + '</ul>';
      };
      const gearMod = (b: any) => `<div class="sub">Gear Mod: ${b.school
        ? `${esc(modName(b.school))} — the piece own flat defence, raised only by a Quality Stone`
        : 'none — this Base carries no school, so no Quality Stone can raise it'}</div>`;
      const baseCell = (b: any) => {
        const own = forced(b);
        if (own.length) {
          const shared = own.length > 1 ? `<div class="sub">one line; its ${own.length} Mods share one budget, ×${SCALE[String(own.length)]} each</div>` : '';
          return rollList(own.map((id) => ({ id, chance: 1, forced: true }))) + shared + gearMod(b);
        }
        return `<div class="sub">line 1 is drawn here — the slot has no Mod of its own, and no Stat Mod</div>`
          + rollList(redraw(pool(b).filter((e: any) => !(loot.STAT_IDS as string[]).includes(e.id)))) + gearMod(b);
      };
      // The three columns all draw the one slot pool; a Sub line and a Normal line have the same
      // possible rolls, because only the stone lock tells them apart.
      const rows = frames.map((b: any) => [
        esc(b.name), wrap(n1(b.weight)),
        baseCell(b),
        `<div class="sub">${n0(IL.sub_slots)} lines, rolled at drop and locked against every stone</div>` + rollList(laterPool(b)),
        `<div class="sub">${spacing(NORM)} lines drawn at drop, editable — the Add craft opens up to ${n0(IL.mods_added_cap)} more (${n0(IL.crafted_max)} in all)</div>` + rollList(laterPool(b)),
      ]);
      return `<h3>${esc(slot)}</h3>` + table(['Frame', 'Weight', 'Base Mod', 'Sub Mod', 'Normal Mod'], rows);
    }).join(''), `A drop is not one Mod. Line 1 is the frame own — and on an armour slot that line carries the flat defence lines the frame's name promises: one, two or all three of Armour flat, Evasion flat and Energy Shield flat, never a random draw, every value scaled as the line carries more Mods. The next ${n0(IL.sub_slots)} lines are the Sub pair: rolled at drop, locked against every stone. The Normal lines are rolled too — a drop draws ${spacing(NORM)} of them, so two pieces of one level and one band need not be the same width — and the Add craft opens up to ${n0(IL.mods_added_cap)} more for the ${n0(IL.crafted_max)}-line ceiling. Sub and Normal lines draw the same slot pool and only the stone lock tells them apart, which is why their two columns carry the same list. Beside every line is the value window it rolls in at the ${esc(BAND_SPAN.band || 'mid')} band — its floor at the band's first level, its ceiling at its last, so a higher Item level lifts the floor and never the ceiling. A Base Mod that shares one budget across several Mods is printed unscaled; the × note beside it says what the share does.`),
    block('How a drop rolls', table(['', 'Number', 'What it means'], [
      ['Lines on a drop', wrap(`${n0(IL.base_mod_slots + IL.sub_slots + NORM.min)}-${n0(IL.base_mod_slots + IL.sub_slots + NORM.max)}`), `${n0(IL.base_mod_slots)} Base Mod · ${n0(IL.sub_slots)} Sub · ${spacing(NORM)} Normal, drawn at drop — a slot whose pool runs out first publishes fewer`],
      ['Lines after crafting', wrap(n0(IL.crafted_max)), `the Add craft opens one more line per stone, up to ${n0(IL.mods_added_cap)} — the crafted ceiling`],
      ['Item level', 'the drop own level', 'every line on the piece rolls inside the window that level publishes'],
      ['Item quality', 'low · mid · high', IL.spans.map((sp: any) => `${sp.band} ${n0(sp.from)}-${n0(sp.to)}`).join(' · ')],
      ['Tier', 'T1 · T2 · T3', 'which third of the window the roll landed in — T3 is the top third'],
    ]), 'The window climbs with the Item level, and its floor starts from the band below, so a mid-band piece opens able to roll the low band own floor.'),
    block('Every Mod and the window it rolls in', table(['Mod', 'Range', 'Window by Item quality: low · mid · high'], [...(MODS.mods || [])].sort((a: any, b: any) => b.max - a.max).map((m: any) => [
      esc(m.name), `${n0(m.min)}-${n0(m.max)}${m.pct ? '%' : ''}`, modBands(m) || '—',
    ])), 'Each band own ladder, read straight out of the data the roll uses — a line gets stronger because the level moved, never because a second table says so.'),
  ],
});

page({
  file: 'stats.html',
  nav: 'Stats & caps',
  title: 'Stats and caps',
  lead: 'Seven Core stats, and every point is yours to spend. Some lines stop at a cap — the table says which ones, and whether a real build can reach it.',
  body: [
    block('Core stats', table(['Stat', 'Feeds'], [
      ['Str', 'physical power and carry weight'], ['Vit', 'health and regeneration'], ['Dex', 'accuracy, evasion and Elemental alignment'],
      ['Agi', 'attack speed and evasion'], ['Wis', 'mana and cooldown reduction'], ['Int', 'magic power and mana'],
      ['Lck', 'crit, perfect dodge and drop chance'],
    ]), 'Every stat also has one utility line, so no point is wasted.'),
    block('Caps', table(['Line', 'Cap', 'What that means'], Object.entries(E.caps as Record<string, any>)
      .filter(([k, v]) => typeof v === 'number' || v === null)
      .map(([k, v]) => [esc(k), v === null ? 'no cap' : wrap(n0(v)), v === null ? 'keeps climbing as you build for it' : 'a full build stops here'])),
      'A cap that no build can reach is not a limit, it is decoration — the engine proves which ones bind.'),
  ],
});

page({
  file: 'world.html',
  nav: 'World',
  title: 'The world',
  lead: 'Zones climb in level and in what they pay. A body class is the shape of a fight, not a stat.',
  body: [
    block('Body classes', table(['Body', 'Health', 'Damage', 'Evasion', 'Comes in'], (E.mob.sizes || []).map((s: any) => [
      esc(s.id), `×${n1(s.hp)}`, `×${n1(s.ps)}`, `×${n1(s.evasion)}`, esc(s.group),
    ])), 'A boss is not a size — it is a species that happens to be huge, and it reads as Large.'),
    block('Zones', table(['#', 'Zone', 'Region', 'Levels', 'Band', 'Mob group', 'Elements'], eng.ZONES.map((z: any) => [
      wrap(n0(z.id)), esc(z.name), esc(z.region), `${n0(z.levels[0])}-${n0(z.levels[1])}`, esc(z.quality), esc(z.group), list(z.elements),
    ])), 'The band decides the Item quality of what drops there.'),
    block('Species', table(['Species', 'Zones', 'Body classes', 'Damage', 'Element bias', 'Health line'], (E.mob.species || []).map((sp: any) => [
      esc(sp.name), list(sp.zones), list(sp.sizes), esc(sp.damage), list(sp.element_bias), esc(sp.trait || ''),
    ])), 'Resistance is per Element, so a zone is easier for the build that brings the right one.'),
  ],
});

page({
  file: 'mobs.html',
  nav: 'Mob sheet',
  title: 'Every mob',
  lead: 'One row per spawn the field can send: every zone, every race that stands in it, every body class it is legal on, plus the Elite and the Boss of the zone. The numbers are <code>engine.mobRoster()</code> — the same roster the world cage gates — read at the zone\'s own level range.',
  body: (() => {
    const ROSTER: any[] = eng.mobRoster();
    const ELITE: any = (E.mob as any).elite || {};
    const BOSS: any = (E.mob.sizes || []).find((s: any) => s.id === 'boss') || {};
    const bandOf = (q: string) => String(q || 'low').split(' ')[0];
    const variantPool = (z: any, spId: string, kind: string) => {
      const v: string[] = ((E.mob as any).variants || {})[spId] || [];
      const elite = new Set((z.subzones || []).map((s: any) => s.elite).filter(Boolean));
      const norm = new Set((z.subzones || []).flatMap((s: any) => s.normal || []));
      if (kind === 'elite') return v.filter((n) => elite.has(n));
      if (kind === 'boss') return v.filter((n) => !elite.has(n) && !norm.has(n));
      return v.filter((n) => norm.has(n) && !elite.has(n));
    };
    const junkOf = (n: string) => ((E.mob as any).variant_drops || {})[n];
    const dropCell = (band: string, sp: any, names: string[], kind: string) => {
      const herb = band === 'high' ? E.herbs.high_chance : band === 'mid' ? E.herbs.mid_chance : 0;
      const parts = [`gear ${pc0(eng.dropChance(band))}`, `herb ${pc0(herb)}`];
      const j = names.map(junkOf).filter(Boolean);
      if (j.length) parts.push(`junk ${list([...new Set(j.map((x: any) => x.item))])}`);
      const leans = [...new Set(j.map((x: any) => x.lean).filter((l: string) => l && l !== 'none'))];
      if (leans.length) parts.push(`the variants lean ${list(leans)} by ${pts(E.loot.variant_lean.shift_pct)} of the mass`);
      const stones = (v: number) => (v < 1 ? n2(v) : n0(v));
      if (kind === 'elite') parts.push(`${stones(E.loot.elite_tier_stones)} Reroll tier stone a kill · ${pc1(E.loot.elite_add_stone_chance)} Add stone`);
      if (kind === 'boss') parts.push(`${stones(E.loot.boss_tier_stones)} Reroll tier stone · ${stones(E.loot.boss_add_stones)} Add stone · no potion`);
      if (kind === 'normal' && sp.humanoid) parts.push('potions (humanoid line)');
      return `<span class="hy">${parts.join(' · ')}</span>`;
    };
    const HEAD = ['Race', 'Name', 'Element', 'Level', 'Size', 'Core Stat', 'Offensive', 'Defensive', 'What it drops', 'XP', 'Zone'];
    const rowOf = (r: any) => {
      const sp: any = eng.speciesById(r.speciesId) || {};
      const kind = r.kind === ELITE.name ? 'elite' : String(r.kind).startsWith(BOSS.name || 'Boss') ? 'boss' : 'normal';
      const names = variantPool(eng.zoneById(r.zone), r.speciesId, kind);
      const shown = kind === 'boss' ? [String(r.kind).replace(/^Boss\s*·\s*/, '')] : names;
      const sizeId = kind === 'normal' ? String(r.kind).toLowerCase() : 'large';
      const res = eng.mobResByElementOf(sp);
      return [
        esc(r.species) + (sp.humanoid ? ' <span class="tag">humanoid</span>' : '') + (r.weapon ? ' <span class="tag">weapon</span>' : ''),
        `<span class="hy">${list(shown)}</span>`,
        list(r.innate),
        wrap(`${n0(r.levels[0])}-${n0(r.levels[1])}`),
        `<span class="hy">${kind === 'elite' ? `${esc(ELITE.name)} on a Large body` : kind === 'boss' ? `${esc(BOSS.name || 'Boss')} (reads as ${esc(BOSS.reads_as || 'large')})` : esc(r.kind)} · ${esc(r.group)}</span>`,
        `<span class="hy">${Object.entries(eng.mobStatsOf(r.speciesId) || {}).map(([k, v]) => `${esc(k)} ${n1(v)}`).join(' · ')}</span>`,
        `<span class="hy">${esc(r.damage)} · PS ${wrap(n0(r.ps))} (base ${n2(sp.power_base)} + stat ${n2(eng.speciesPowerStatOf(sp))} over the zone mean) · hit ${wrap(n0(r.acc))} · crit ${wrap(n1(r.crit))}% · status gate ${wrap(n1(r.align))}</span>`,
        `<span class="hy">HP ${wrap(`${n0(r.hpFrom)}-${n0(r.hpTo)}`)} · Armour ${wrap(n0(r.armour))} · Evasion ${wrap(n0(eng.mobEvasion(r.levels[1], sp.stats?.dex ?? 1, sizeId)))} · dodge ${wrap(n1(r.dodge))}% · res ${Object.entries(res).map(([e, v]) => `${esc(e)} ${n0(v)}`).join(' · ')}</span>`,
        dropCell(bandOf(eng.zoneById(r.zone)?.quality), sp, names, kind),
        wrap(`${n0(r.xpFrom)}-${n0(r.xpTo)}`),
        `<span class="hy">${n0(r.zone)} · ${esc(r.zoneName)}</span>`,
      ];
    };
    return [...eng.ZONES.map((z: any) => {
      const rows = ROSTER.filter((r: any) => r.zone === z.id).map(rowOf);
      return `<section><h3>Zone ${n0(z.id)} · ${esc(z.name)} — ${esc(z.region)}</h3>`
        + `<p class="note">Levels ${n0(z.levels[0])}-${n0(z.levels[1])} · band ${esc(z.quality)} · Elements ${list(z.elements)} · group ${esc(z.group)}</p>`
        + table(HEAD, rows) + '</section>';
    }), block('How to read the sheet', table(['Column', 'What it is'], [
    ['Race', 'the species row in <code>mob.species</code>. A weapon tag means its lineage may be the source of a weapon-slot piece; a humanoid tag adds the potion stream.'],
    ['Name', 'the variant names that zone actually pays (<code>mob.variants</code> ∩ the sub-zone lists). A variant is a drop identity, not a stat line — the numbers are the species and the body.'],
    ['Element', 'the Elements this race can spawn with inside that zone: its own bias ∩ the zone list. The roll weighs the bias at ×<code>mob.element_roll.bias_weight</code> against any other Element the zone carries at ×<code>mob.element_roll.other_weight</code>.'],
    ['Level', 'the zone range. A mob spawns at the attacker\'s level clamped into that range, so the HP and XP columns are printed as a range too.'],
    ['Size', 'the body class and the group it comes in. Elite is a rarity flag on a Large body, never a fifth size; a Boss reads as a body class for a weapon\'s <code>size_mult</code>.'],
    ['Core Stat', 'the mob\'s <strong>fixed</strong> seven-stat block: the one flat base (<code>mob.stat.base</code>) through the species vector, with no level term — the same body at level 1 and at level 180, because only HP, PS and XP climb. Read through <code>mobStatsOf()</code>.'],
    ['Offensive', 'what its hit is made of, and its damage per second — its own power (<code>mob.species[].power_base</code> + <code>K_MOB_PS_STAT</code> × the Str or Int its <code>damage</code> tag reads, over the zone mean) times the published <code>mob_PS(L)</code> — plus its accuracy rating, its crit chance and its Elemental Alignment, the number that decides how often its innate status lands.'],
    ['Defensive', 'health at both ends of the zone, Armour, Evasion (capped where the player is capped), its own dodge against a same-level attacker, and its per-Element resistance.'],
    ['What it drops', 'the gear roll and the herb roll at that band, the junk the named variants pay, which stream they lean, and the stones an Elite or a Boss adds.'],
    ['XP', 'what one kill pays at the two ends of the zone: <code>xpPerKill(mob level)</code>, with the Elite and Boss multipliers already on the row.'],
  ]), 'Nothing here is typed: the sheet is <code>mobRoster()</code>, <code>mobEvasion()</code>, <code>mobResByElementOf()</code>, <code>speciesPowerStatOf()</code> and <code>dropChance()</code> printed out, so a wrong figure is a bug in the data or the engine, and <code>node tools/verify.ts</code> is what says which.'),
    ];
  })(),
});

page({
  file: 'towns.html',
  nav: 'Towns',
  title: 'Settlements',
  lead: 'A settlement is where you spend what the field paid: space, time and information — never power.',
  body: [
    block('Where', table(['Settlement', 'Zone', 'Band', 'Innate Element', 'NPCs'], (TOWN.settlements || []).map((s: any) => [
      `${esc(s.name)}${s.start ? ' <span class="tag">start</span>' : ''}${s.capital ? ' <span class="tag">capital</span>' : ''}`,
      wrap(n0(s.zone)), esc(s.band), list(s.innate), list((s.npcs || []).map((id: string) => (TOWN.npcs || []).find((n: any) => n.id === id)?.name || id)),
    ])), ''),
    block('Who sells what', table(['NPC', 'Sells'], (TOWN.npcs || []).map((n: any) => [
      esc(n.name), esc(n.kind), esc(n.rule || ''),
    ])).replace('<th>Sells</th><th></th>', '<th>Kind</th><th>Where</th>'), ''),
    block('Standing', table(['Tier', 'Reach it at', 'Unlocks'], (TOWN.standing?.tiers || []).map((t: any) => [
      esc(t.name), `${n0((t.share ?? 0) * 100)}% of the band's kills`, esc(t.unlocks),
    ])), 'Standing is earned by fighting in a settlement own band — no purchase.'),
    block('Collector sets', table(['Set', 'Pieces', 'Pays'], (TOWN.collector_sets || []).map((c: any) => [
      esc(c.name || c.id), list(c.pieces || c.items || []), esc(c.pays || c.payment || ''),
    ])), ''),
  ],
});

page({
  file: 'economy.html',
  nav: 'Economy',
  title: 'The two currencies',
  lead: 'Seven crafting stones buy power. Gold buys convenience. They never convert into each other.',
  body: [
    block('Crafting stones', table(['Verb', 'Cost', 'What it does'], [
      ['Reroll', `${n0(E.craft.reroll_value_stones_per_use)} Reroll value stones`, 'rerolls one line inside its own Tier'],
      ['Refine', `${n0(E.craft.refine_stones_per_use)} Reroll tier stones`, 'moves one line up one step'],
      ['Ascend', `${n0(E.craft.ascend_add_stones)} Add mod stones + ${n0(E.craft.ascend_tier_stones)} Reroll tier stones`, 'raises the whole piece one band'],
      ['Remove', `${n0(E.craft.remove_stones_per_use)} Remove mod stones`, 'pulls one editable line off'],
      ['Upgrade', `up to ${n0(E.craft.upgrade_cap)} steps`, `raises the piece own Gear line (${n0(E.craft.gear_mod_per_level)} a step)`],
      ['Repair', `${n0(E.craft.repair_stones)} Repair stones`, 'revives a broken piece'],
    ]), 'Stones come from junk that dissolves, from Elite and from bosses — never from the clock.'),
    block('Gold', `<p>Gold has one mint: <strong>mob junk sold by hand</strong>. It buys space, time, information and appearance at the town stalls, and it never buys gear, Mods, potions or stones.</p>`,
      'That is why a better build earns gold faster without ever turning gold into power.'),
  ],
});

page({
  file: 'progression.html',
  nav: 'Progression',
  title: 'Progression',
  lead: `Levels come from kills. Skill levels come from kills with that skill. Weapon Mastery comes from kills with that weapon. Nothing is priced by the clock.`,
  body: [
    block('Level steps', table(['Level', 'XP to next', 'Cumulative XP', 'Kills at your own level'], (() => {
      const cap = E.stat.level_cap;
      const rows: any[][] = [];
      let cumXp = 0, cumKills = 0;
      for (let l = 1; l < cap; l++) {
        const xp = eng.xpToNext(l), k = xp / eng.xpPerKill(l);
        cumXp += xp; cumKills += k;
        rows.push([wrap(n0(l)), wrap(n0(xp)), wrap(n0(cumXp)), wrap(n0(k))]);
      }
      return rows;
    })()), 'One row per level: the XP a level asks for is its own, read through the engine curve, never a second copy of it. The kill count is not an added rule — the curve is authored in kills (<code>xp.kills_anchors</code>) and a kill pays <code>xpPerKill(mob level)</code>, so this is how many kills the level costs when you fight mobs at your own level. Fight a dearer zone and the count falls; fight a cheaper one and it rises. Past <code>xp.plateau_from</code> the bar holds flat while the kill count keeps falling, because a higher level pays the same bar against a mob at <code>stat.mob_level_cap</code>.'),
    block('Weapon Mastery', table(['Bonus', 'What it gives'], [
      ['While held', `−${n1((BASES.mastery?.weight_per_level_pct ?? 0) * 100)}% weight and +${n1((BASES.mastery?.skill_dmg_per_level_pct ?? 0) * 100)}% skill damage a level, from level ${n0(BASES.mastery?.skill_dmg_from_level ?? 0)}`],
      ['Account-wide', `+${n1(BASES.mastery?.drop_bonus_per_type_pct ?? 0)}% drop per weapon type at Mastery ${n0(BASES.mastery?.drop_bonus_from_level ?? 0)}`],
    ]), 'Mastery never adds damage to a weapon type itself — that would make one type the right one.'),
    block('The passive tree', table(['Branch', 'Nodes', 'Ranks', 'Points'], Object.keys(TREE_CFG.branches || {}).map((name: string) => [
      esc(name), wrap(n0(treeNodes().perBranch(name))), wrap(n0(TREE_CFG.rank_tiers?.shallow?.length ?? 3)), wrap(n0(TREE_CFG.point_cost_per_rank * (TREE_CFG.rank_tiers?.shallow?.length ?? 3) * treeNodes().perBranch(name))),
    ])), `${n0(TREE_CFG.point_cost_per_rank)} point a rank · a rank pays ${pctList(TREE_CFG.rank_tiers?.shallow)} of the line at the shallow nodes and ${pctList(TREE_CFG.rank_tiers?.deep)} at the deep ones — a deep node of the same line is always the stronger buy.`),
  ],
});

page({
  file: 'elements.html',
  nav: 'Elements',
  title: 'Elements',
  lead: `Five Elements, and a counter table: bring the right one and the fight is shorter.${E.elements.weak_mult ? ` A Weak hit deals ×${n1(E.elements.weak_mult)}.` : ''}`,
  body: [
    block('Attack against target', table(['You ↓ / Target →', ...E.elements.order.map((e: string) => esc(e))],
      E.elements.order.map((atk: string) => [esc(atk), ...E.elements.order.map((def: string) => wrap(`×${n1(E.elements.counter?.[atk]?.[def] ?? 1)}`))])),
      'Above 1 is the counter — the number is the multiplier on that hit, before resistance.'),
    block('What each Element leaves behind', table(['Element', 'Its mark'], E.elements.order.map((e: string) => [
      esc(e), esc(E.elements.status_of?.[e]?.name || E.elements.status_of?.[e] || '—'),
    ])), 'A status is answered by regeneration and by removing the tick, not by mitigation.'),
  ],
});

// ---------------------------------------------------------------- shell

const tokens = (() => {
  try {
    const css = fs.readFileSync(path.join(ROOT, 'game', 'src', 'app.css'), 'utf8');
    const m = css.match(/:root\s*\{[\s\S]*?\n\}/);
    return m ? m[0] : ':root { --bg:#0f1217; --panel:#1c2027; --line:#2c3340; --text:#e3e9f2; --dim:#8b96a8; --gold:#e8c169; --ui: sans-serif; --num: monospace; }';
  } catch {
    return ':root { --bg:#0f1217; --panel:#1c2027; --line:#2c3340; --text:#e3e9f2; --dim:#8b96a8; --gold:#e8c169; --ui: sans-serif; --num: monospace; }';
  }
})();

const CSS = `${tokens}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.55 var(--ui); }
a { color: var(--gold); text-decoration: none; }
a:hover { text-decoration: underline; }
.layout { display: flex; align-items: flex-start; gap: 2rem; max-width: 84rem; margin: 0 auto; padding: 2rem 1.5rem 4rem; }
nav { position: sticky; top: 2rem; min-width: 11rem; display: flex; flex-direction: column; gap: .35rem; }
nav a { color: var(--dim); }
nav a.on { color: var(--gold); }
main { flex: 1; min-width: 0; }
h1 { margin: 0 0 .3rem; font-size: 1.5rem; }
.lead { color: var(--dim); margin: 0 0 2rem; }
section { margin: 0 0 2.2rem; }
h2 { font-size: 1.05rem; margin: 0 0 .3rem; border-bottom: 1px solid var(--line); padding-bottom: .3rem; }
h3 { font-size: .9rem; margin: 1.1rem 0 .3rem; color: var(--dim); text-transform: uppercase; letter-spacing: .05em; }
.note { color: var(--dim); font-size: .82rem; margin: .3rem 0 .6rem; }
table { border-collapse: collapse; width: 100%; font-size: .86rem; }
th, td { text-align: left; padding: .3rem .5rem; border-bottom: 1px solid var(--line); vertical-align: top; }
th { color: var(--dim); font-weight: 600; }
td:first-child { white-space: nowrap; }
.rolls { list-style: none; margin: .25rem 0 0; padding: 0; font-size: .78rem; }
.rolls li { position: relative; display: flex; gap: .35rem; align-items: baseline; padding: .02rem .25rem; }
.rolls .bar { position: absolute; left: 0; top: 0; bottom: 0; background: var(--line); opacity: .55; }
.rolls .rn { position: relative; flex: 1; }
.rolls .rv { position: relative; font-family: var(--num); color: var(--text); font-size: .72rem; white-space: nowrap; opacity: .8; }
.rolls .rp { position: relative; font-family: var(--num); color: var(--dim); font-size: .72rem; white-space: nowrap; }
td .hy { color: var(--dim); font-size: .8rem; }
.fx { list-style: none; margin: .2rem 0 0; padding: 0; font-size: .74rem; }
.fx li { display: flex; gap: .35rem; align-items: baseline; padding: .04rem 0; border-bottom: 1px dotted var(--line); }
.fx li:last-child { border-bottom: 0; }
.fx .fk { flex: 1; font-family: var(--num); color: var(--dim); }
.fx .fk em { color: var(--text); font-style: normal; }
.fx .fs { color: var(--dim); font-size: .66rem; text-transform: uppercase; letter-spacing: .04em; }
.fx .fv { font-family: var(--num); white-space: nowrap; }
td .sub { display: block; color: var(--dim); font-size: .78rem; margin-top: .15rem; }
.rolls .forced .rn { color: var(--gold); }
.rolls .forced .rp { color: var(--gold); font-family: var(--ui); font-size: .72rem; }
.num { font-family: var(--num); }
.tag { border: 1px solid var(--line); border-radius: 2px; padding: 0 .25rem; color: var(--dim); font-size: .68rem; text-transform: uppercase; }
ol { margin: .2rem 0; padding-left: 1.3rem; }
li { margin: .15rem 0; }
`;

const render = (p: Page, active: string): string => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.title)}</title><style>${CSS}</style></head>
<body><div class="layout">
<nav>${PAGES.map((q) => `<a class="${q.file === active ? 'on' : ''}" href="${q.file}">${esc(q.nav)}</a>`).join('')}</nav>
<main><h1>${esc(p.title)}</h1><p class="lead">${p.lead}</p>${p.body.join('\n')}
<p class="note">Rendered from <span class="num">tools/data/*.json</span> and <span class="num">engine/</span> — nothing here is typed by hand.</p>
</main></div></body></html>
`;

if (process.argv[2] === 'build') {
  fs.mkdirSync(OUT, { recursive: true });
  for (const p of PAGES) fs.writeFileSync(path.join(OUT, p.file), render(p, p.file), 'utf8');
  console.log(`wrote wiki/ (${PAGES.length} pages) · ${PAGES.map((p) => path.basename(p.file, '.html')).join(' · ')}`);
  console.log(`open: file://${path.join(OUT, 'index.html').replace(/\\/g, '/')}`);
} else {
  console.log(`player wiki — a static view over tools/data/*.json and engine/

  node tools/wiki.ts build    write wiki/** (git-ignored)
`);
}
