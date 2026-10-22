/**
 * The player wiki - the page source, in one file, with no side effects.
 *
 * It is a **view**: every figure is a call to `engine/` or a read of `tools/data/*.json`, never a
 * number typed here, and it carries only what a player needs to play - no gate ids, no craft internals,
 * and no K value beyond the per-point yield a stat line prints. Two hosts render it:
 *
 *   game/src/wiki/main.ts    the live wiki - the browser calls this when the page opens, so a data
 *                            edit shows on the next reload and no stale artefact can exist
  *   tools/wiki.ts build      the same calls, written out to `docs/wiki/*.html` as a static site
 *
 * One source serves both, so a figure cannot be right in one place and stale in the other. The theme
 * is the client's own: the caller reads `game/src/styles/variables.css` and hands its `:root` block to
 * `renderDoc`, so a colour has exactly one home.
 *
 * Every figure carries its unit — a percent reads `%`, a duration reads `sec`, a count reads bare
 * (`fxVal` decides it from the stat, never from the wording around it). A number a player cannot place
 * is a number they cannot act on.
 */

// The wiki reads the engine, and only the engine: this is the same seam the client uses, so a page,
// a cage and the game all resolve to one module and one data file.
import { E as ENGINE, MODS as MODS_DATA, TOWN as TOWN_DATA, BASES as BASES_DATA, TREE_SPEC as TREE_DATA, SKILLS as SKILLS_DATA, eng, loot, sm, tree, road, farm, fieldwork, trade } from '../engine/client.ts';
import { STONE_NAME, PRESS_NAME } from '../../../engine/craft.ts';

/**
 * A strict view of the data. A key that is not there throws instead of printing `0` or an em dash on a
 * player page — the class of defect where a renamed field quietly turned the Mastery table into zeros.
 * A value that is legitimately open (`null`, a Cap with no Cap) passes through untouched; a name that
 * no longer exists is not a value, it is a page that must refuse to render.
 */
const PASS = ['toJSON', 'then', 'catch', 'finally', 'constructor', 'valueOf', 'nodeType', 'length'];
const VIEWS = new WeakMap<object, any>();
const strict = (obj: any, name: string): any => {
  if (obj === null || typeof obj !== 'object') return obj;
  const held = VIEWS.get(obj);
  if (held) return held;
  const view = new Proxy(obj, {
    get(target: any, key: any) {
      if (typeof key !== 'string' || key in target || PASS.includes(key) || key in Object.prototype) {
        const plain = Reflect.get(target, key);
        if (typeof plain === 'function') return plain.bind(target);
        // the same view further down the chain, so `E.craft.ascend_add_stone` fails as loudly as `E.craf`
        return plain !== null && typeof plain === 'object' ? strict(plain, `${name}.${key}`) : plain;
      }
      // A key the data does not carry YET is not a broken page: it reads as `undefined`, so a page's own
      // `?? '—'` fallback still works, and it says so on the console. That is what lets an element, a
      // status or a Mod land in the data one step ahead of the prose that describes it.
      console.warn(`wiki: ${name}.${key} is not in the data — reading it as undefined`);
      return undefined;
    },
  });
  VIEWS.set(obj, view);
  return view;
};
/** Every data block a page may touch, behind that view, named as the file that owns it. */
const E: any = strict(ENGINE, 'engine.json');
const MODS: any = strict(MODS_DATA, 'mods.json');
const TOWN: any = strict(TOWN_DATA, 'town.json');
const BASES: any = strict(BASES_DATA, 'bases.json');
const TREE_SPEC: any = strict(TREE_DATA, 'tree.json');
const SKILLS: any = strict(SKILLS_DATA, 'skills.json');

/**
 * A lookup by a name the data may legitimately not carry — a variant that pays no junk, a scale that
 * covers only some line counts. Presence is asked, never assumed, so the miss is a choice and not a
 * silent zero, while every plain `E.block.key` read still throws when the key has moved.
 */
const maybe = (o: any, k: any): any => (k in o ? o[k] : undefined);

/** Every reference build a press is printed against — the engine's own two. */
/** The engine's own published figures, behind the same view: a derived line that is renamed or 
 *  moved fails the page instead of printing an em dash where the number used to be. */
const DV: any = strict(eng.DERIVED, 'engine.DERIVED');
const EBAND: any = strict(eng.BAND, 'engine.BAND');
const EREF: any = strict(eng.REF, 'engine.REF');
const EREFERENCE: any = strict(eng.REFERENCE, 'engine.REFERENCE');

const REFS: any = EREF;
/** The skill types, in the order the roster prints them. */
const TYPES: string[] = SKILLS.meta.types;

// ---------------------------------------------------------------- rendering

const esc = (s: any): string => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
const n0 = (n: any): string => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—');
const n1 = (n: any): string => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—');
/** A published multiplier keeps its decimal: ×1.8 must never render as ×2. */
const xOf = (n: any): string => (Number.isFinite(Number(n)) ? String(Math.round(Number(n) * 10) / 10) : '—');
const list = (a: any): string => (a || []).map((x: any) => esc(x)).join(' · ');
const pctList = (a: any): string => (a || []).map((x: any) => `${(Number(x) * 100).toFixed(1)}%`).join(' · ');
const rowHtml = (cells: any[]): string => `<tr>${cells.map((c) => `<td>${c == null ? '' : String(c)}</td>`).join('')}</tr>`;
const table = (head: string[], rows: any[][]): string =>
  `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>` +
  rows.map((r) => rowHtml(r)).join('') +
  '</tbody></table>';
/**
 * One table, its rows split into tabbed groups. The strip above it is a radio group and the tabs are
 * `<tbody>`s, so a press swaps a body over the shared header and neither host needs a script — the static
 * build and the live wiki render the same markup.
 */
const tabbedTable = (name: string, head: string[], groups: { key: string; label: string; rows: any[][] }[]): string => {
  const strip = groups.map((g, i) =>
    `<input type="radio" name="${name}" id="${name}-${g.key}"${i === 0 ? ' checked' : ''}>` +
    `<label for="${name}-${g.key}">${esc(g.label)} <b>${g.rows.length}</b></label>`).join('');
  const bodies = groups.map((g) => `<tbody class="g-${g.key}">${g.rows.map((r) => rowHtml(r)).join('')}</tbody>`).join('');
  return `<div class="tabs">${strip}<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>${bodies}</table></div>`;
};
const block = (h: string, body: string, note = ''): string =>
  `<section><h2>${esc(h)}</h2>${note ? `<p class="note">${note}</p>` : ''}${body}</section>`;
const yes = (v: any): string => (v ? 'yes' : 'no');
/** The three Item quality bands, in ladder order, read from the level table that owns them. */
const QUAL_BANDS: string[] = (E.item_level.spans || []).map((sp: any) => sp.band);
/** Gold is `m` x the band's own gold-per-minute rate — the engine's published rate, never a typed one. */
/** A town price in gold: the engine's own `m` x the band's rate, the same call the town cage makes. */
const goldAt = (m: any, band: string): string => wrap(n0(eng.goldPrice(Number(m), band)));

type Page = { file: string; nav: string; title: string; lead: string; body: string[] };
const PAGES: Page[] = [];
const page = (p: Page): void => { PAGES.push(p); };
const wrap = (s: string) => `<span class="num">${s}</span>`;
/** The Cap keys the stats page prints, in the words a player reads them by. */
const CAP_LABEL: Record<string, string> = {
  crit_chance: 'Crit chance', evasion: 'Evasion', perfect_dodge: 'Perfect dodge', alignment: 'Alignment',
  elem_res: 'Elemental resistance', elem_res_max: 'Elemental resistance, unlocked', cdr: 'Cooldown reduction',
  attack_interval_sec: 'Attack interval (sec a swing)', accuracy: 'Accuracy', weight_overload: 'Weight overload',
  block: 'Block', stun: 'Stun',
};
/** A stone is named in one place — `engine/craft.ts` `STONE_NAME` — so a page cannot drift from the bench. */
const stone = (key: string, n: any): string => `${n0(n)} ${STONE_NAME[key]}${Number(n) === 1 ? '' : 's'}`;
/** The name of the press, from the same home. */
const pressOf = (op: string): string => PRESS_NAME[op] || op;

/**
 * The tree shape the data holds: the seven regions, their three kinds of node, and the keystone
 * bundles. Counting is a read of the built model, not a second copy of a catalogue number.
 */
const treeNodes = () => {
  const nodes = ((tree as any).nodes || []) as any[];
  const regions = ((tree as any).layout?.regions || (tree as any).branches || []) as string[];
  const ofRegion = (name: string, kind?: string) => nodes.filter((n) => n.wing === name && (!kind || n.kind === kind));
  const keystones = nodes.filter((n) => n.kind === 'keystone');
  return {
    count: nodes.length,
    regions,
    countsIn: (name: string, kind: string) => ofRegion(name, kind).length,
    /** What every rank on a region costs in tree points — Normal and Notable both pay tree. */
    costOf: (name: string) => ofRegion(name).reduce((s, n) => s + (n.currency === 'tree' ? (n.cost || 0) : 0), 0),
    keystones,
    pairs: (((tree as any).incompatibilities || []) as { a: string; b: string }[]),
  };
};
/** A keystone by its node id, in the name the board shows. */
const keystoneName = (id: string): string => ((tree.byId[id] as any)?.name || id.replace(/^keystone\./, ''));
const TREE_CURRENCY = (tree as any).currencies?.tree || {};
const QUEST_TREE_BONUS = (TOWN_DATA as any).quest_tree_bonus || {};
const TREE_POINT_CURVE = `base ${wrap(n0(TREE_CURRENCY.base ?? 0))}` + ((TREE_CURRENCY.level_ranges || []) as any[])
  .map((r: any) => ` + ${wrap(n0(r.per))} a level from ${wrap(n0(r.from))}–${wrap(n0(r.to))}`).join('');
const TREE_CFG = TREE_SPEC as any;
const weaponFrameCounts = (BASES.weapons || []).map((weapon: any) => ((BASES.weapon_frames as any)?.[weapon.name] || []).length);
const weaponFrameSummary = weaponFrameCounts.every((count: number) => count === weaponFrameCounts[0])
  ? `${n0(weaponFrameCounts[0])} frames for each weapon type`
  : `${n0(Math.min(...weaponFrameCounts))}–${n0(Math.max(...weaponFrameCounts))} frames per weapon type`;

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
      <li><strong>Pick a settlement</strong> and a zone. In the field, a player-set Camp opens gathering and cooking.</li>
      <li><strong>Fight</strong> — the character attacks on the clock; paid skills use flat Mana or current-HP costs, while auras reserve Max Mana.</li>
      <li><strong>Loot</strong> — kills pay XP and their separate gear, junk, stone and skill-piece rolls; hunting can also yield field provisions.</li>
      <li><strong>Decide</strong> — equip the piece, or feed it to the crafting stones.</li>
      <li><strong>Craft</strong> at a settlement: choose gear for the bench, right-click a stone, then click the item or a highlighted Mod line. Shift-click repeats; Esc cancels.</li>
      <li><strong>Climb</strong> to the next zone. A Push costs recovery time: a Field Camp in that zone receives you and ends the walk; otherwise the route resumes at its ambush block.</li>
    </ol>`, 'The whole game is one screen — the field — and the panels behind it.'),
    block('What is in the game', table(['', 'Count', 'What it is'], [
      ['Zones', wrap(n0(eng.ZONES.length)), 'each with its own level band and group size; spawn Elements come from each zone\'s Species cast'],
      ['Worn slots', wrap(n0(E.stat.item_slots)), `minute one starts them all empty · ${n0(E.opening.gear.length)} hand-authored reference frames wait in the data — every slot has its own frames and Mod pools`],
      ['Skills', wrap(n0(sm.all().length)), TYPES.map((t: string) => `${sm.of(t).length} ${t}`).join(' · ')],
      ['Mob Species', wrap(n0(E.mob.species.length)), 'grouped into fantasy Races'],
      ['Elements', wrap(n0(E.elements.order.length)), list(E.elements.order)],
      ['Settlements', wrap(n0(TOWN.settlements.length)), 'shops, storage, tasks and crafting'],
      ['Dungeons', wrap(n0(TOWN.settlements.length)), 'one per settlement — escrowed loot, forfeited on a Push'],
      ['Passive tree', wrap(n0(treeNodes().count)), `${treeNodes().regions.length} regions around one free Start · a Normal grants +1 of its region's Core attribute for 1 tree point, a Notable 3 tree points, a Keystone 1 attainment · ${n0(((tree as any).kinds?.keystone?.ranks ?? 1))} rank a node`],
    ])),
  ],
});


const press = (s: any, which: string, lv: number) => {
  const v = sm.perPress(s, { ...REFS[which], level: lv });
  return v == null ? '—' : n0(v);
};
const n2 = (n: any): string => Number(n).toFixed(2);
/** A figure as the page prints it: at most two decimals, trailing zeros dropped (`20`, `0.3`, `0.16`). */
const fig = (v: any): string => Number(Number(v).toFixed(2)).toLocaleString('en-US');
/** One point's yield, signed (`+5`, `+0.25`). */
const per = (v: any): string => `+${fig(v)}`;
const pc0 = (v: number): string => `${n0(v * 100)}%`;
const pc1 = (v: number): string => `${n1(v * 100)}%`;
/** a figure the data already states in percentage points, not as a fraction */
const pts = (v: number): string => `${n0(v)}%`;
/** The stats whose value is a percentage even when it is added flat: a crit chance and the Alignment gate,
    which every other page already reads as a percent. */
const PCT_FLAT = new Set(['elemental_alignment', 'crit_chance']);
/**
 * One effect value as the page prints it: the op decides the sign, the level decides the number, and the
 * stat decides the unit. A figure never ships bare — a percent keeps its `%`, a `*_sec` value says
 * seconds (added flat or not), a count stays a count, and a ratio is a `×`.
 */
const fxVal = (e: any, v: number): string => {
  if (e.op === 'mult') return `×${n2(v)}`;
  const abs = Number.isInteger(Math.abs(v)) ? n0(Math.abs(v)) : n1(Math.abs(v));
  // `_sec` is a duration — but a `_per_sec` stat is a rate, so its unit comes from its op (a percent a
  // second), never from the suffix.
  const unit = e.stat.endsWith('_sec') && !e.stat.endsWith('_per_sec') ? ' sec'
    : e.stat.endsWith('_pct') || e.op === 'add_pct' || PCT_FLAT.has(e.stat) ? '%' : '';
  return `${v < 0 ? '−' : '+'}${abs}${unit}`;
};
/**
 * The lines a row moves, one value a line wherever the column is drawn: each line names itself, says who
 * it lands on, and holds the value it has at that end of the skill-level ramp. A press leads the list on
 * an attack row, because its damage is that row's headline; an aura writes on the Field of Enemies
 * (`foe`) and a press or a curse on the mob it hits.
 */
const sideOf = (s: any, e: any): string =>
  e.subject === 'target' ? (s.type === 'aura' || s.type === 'buff' ? 'foe' : 'mob') : 'self';
const fxEndCell = (s: any, level: number): string => {
  const fx: any[] = s.effects || [];
  if (s.type !== 'attack' && !fx.length) return '<span class="hy">—</span>';
  const at = sm.effectsAt(s, level);
  const items = fx.map((e: any, i: number) =>
    `<li><span class="fk">${esc(e.stat)}${e.element ? `:${esc(e.element)}` : ''}${e.condition ? ` <em>if ${esc(e.condition)}</em>` : ''}</span>` +
    `<span class="fs">${sideOf(s, e)}</span><span class="fv">${fxVal(e, at[i].value)}</span></li>`);
  if (s.type === 'attack') items.unshift(`<li><span class="fk">press</span><span class="fs">mob</span><span class="fv">${press(s, 'glass', level)}</span></li>`);
  return `<ul class="fx">${items.join('')}</ul>`;
};
const ST: any = (E as any).status || {};
page({
  file: 'skills.html',
  nav: 'Skills',
  title: 'Skills',
  lead: `Press damage = level-1 damage × <code>damagePct(level) / 100</code>. Effects use <code>effectPct</code>; Buffs and Auras use <code>buffEffectPct</code>. Special effects use their own ramp. Cap: ${n0(E.skill_xp.level_cap)}.`,
  body: [(() => {
    // Three tabs over one table. Active is the slot list — every type that is not on the toggle track —
    // read from the roster rather than typed, so a new type lands in the right tab by its own kind.
    const OFF_SLOT = ['buff', 'aura'];
    const GROUPS = [
      { key: 'active', label: 'Active Skill', types: TYPES.filter((t) => !OFF_SLOT.includes(t)) },
      { key: 'buff', label: 'Buff Skill', types: ['buff'] },
      { key: 'aura', label: 'Aura Skill', types: ['aura'] },
    ];
    const head = ['Skill', 'Cooldown', 'Cost', 'Min Effect (level 1)', `Max Effect (level ${E.skill_xp.level_cap})`, 'Targets', 'What it does'];
    const groups = GROUPS.map((g) => ({
      key: g.key,
      label: g.label,
      rows: g.types.flatMap((t: string) => sm.of(t).map((s: any) => {
        // A paid row names either its typed flat Mana or current-HP cost; an aura pays by holding a
        // share of Max Mana open instead.
        const cost = s.mana ? `${esc(s.mana)} Mana` : s.hp_cost ? `${esc(s.hp_cost)} current HP` : s.reserve ? `reserve ${sm.reservePct(s.reserve)}% Max Mana` : '';
        // An attack's effect columns lead with its press damage; a buff, an aura, a curse or a heal shows
        // the lines it moves. Each line names itself, so the two columns read on their own.
        // a row bound to one weapon says so beside its name (only the arrow rows carry one:
        // the `bow` family token covers both bow and crossbow)
        const name = `${esc(s.name)}${s.weapon ? ` <span class="hy">${esc(s.weapon)}</span>` : ''}`;
        return [name, s.cd ? `${n1(s.cd)} sec` : 'no cooldown', cost,
          fxEndCell(s, 1), fxEndCell(s, E.skill_xp.level_cap),
          esc(s.targets || ''), esc(s.effect || s.reserve || '')];
      })),
    }));
    return block('The roster', tabbedTable('skillkind', head, groups),
      `Press damage = level-1 damage × <code>damagePct(L) / 100</code>; the table shows L=1 and L=${n0(E.skill_xp.level_cap)}. Additive effect = <code>base × effectPct(L) / 100</code>; a multiplier scales its distance from 1. Buff/Aura additive values round to whole numbers.`);
  })(),
    block('Cost and Max HP terms', table(['Rule', 'How the press reads it', 'Data term'], [
      ['Mana cost', '<code>flat × (1 + max(0, L − 1) × costStep / 100) × AoE multiplier</code>', '<code>mana</code> · <code>aoe</code>'],
      ['HP cost', '<code>cost = flat × (1 + max(0, L − 1) × costStep / 100)</code>; use only if currentHP − cost ≥ 1', '<code>hp_cost</code>'],
      ['Caster Max HP', '<code>caster MaxHP × max_hp_pct / 100</code>, then skill-level and hit multipliers', '<code>max_hp_pct</code>'],
      ['Target Max HP', '<code>target MaxHP × max_hp_pct_damage / 100</code>', '<code>max_hp_pct_damage</code>'],
      ['Area premium', '<code>Mana cost × aoe.mana_mult</code> when the press hits multiple targets', '<code>aoe</code>'],
    ])),
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
        ['crippled', 'Slows the target&rsquo;s own attack clock — the timer its swings are counted on, so a second of its clock costs two — and slows cooldowns while it holds',
          `clock ×${n2(1 - ST.crippled.clock_pct / 100)} · cooldowns ×${n2(1 - ST.crippled.cd_pct / 100)}`,
          `no stacks — the cut is the whole status, and a second application only restarts it`,
          `${n0(ST.crippled.time_sec)} sec`],
        ['bleed', 'Physical damage over time off a landed hit. <strong>Not an Element</strong> — no resistance line answers it, Armour does not shrink it, and it cannot crit',
          `×${n2((E as any).K.K_BLEED)} of the hit that inflicted it, spread over ${n0((E as any).K.bleed_time_sec)} sec`,
          `no stacks — a new application refreshes the clock and keeps the stronger value`,
          `${n0((E as any).K.bleed_time_sec)} sec`],
        ['stun', 'The lightning stop — the only control in the game, and the shock line&rsquo;s stopped second rather than a status of its own',
          `${n1(ST.shock.stop_sec)} sec off the target&rsquo;s clock, on a chance the Alignment gate lets through`,
          `no stacks — one stop at a time, bounded so no fight can be locked out`,
          `${n1(ST.shock.stop_sec)} sec`],
      ]),
      `Rolled status: pass the Alignment gate, then roll ${pc0(ST.proc_chance)} on eligible Element hits. Directly declared statuses skip both rolls.`),
    block('The Alignment a status rides', (() => {
      const raw = DV.align_raw, focused = DV.align_path;
      const stun = (a: number) => `${n1(eng.stunChanceFrom(a))}% chance`;
      return table(['', 'What the engine does', 'From → to'], [
        ['Where it comes from', 'Dex × <code>K_DEX_ALIGN</code>, plus any flat line, times any multiplier on it',
          `stats alone ${n1(raw)}% → the reference build path ${n1(focused)}%`],
        ['The gate', 'EVERY rolled status passes it — an Element status, the bleed an axe&rsquo;s line grants, and a stun — so a build that cannot pass inflicts none of the three',
          `then ${pc0(ST.proc_chance)} of the Element hits that pass carry their status`],
        ['The damage', 'aligned damage a second = Elemental power × Alignment ÷ 100 × hits a second',
          `burn and poison together stop at ×${n1(ST.dot_cap)} of that figure`],
        ['What it buys', 'the lightning side converts it into a stun chance through <code>K_STUN_PER_ALIGN</code>',
          `${stun(raw)} → ${stun(focused)}`],
        ['What cuts it', 'shock is the one status that fights our own', `−${pc0(ST.shock.align_cut)} against the shocked mob`],
        ['Ceiling', '<code>caps.alignment</code>', 'no Cap — the build keeps every point it earns'],
      ]);
    })(), '<code>Alignment = (Dex × K_DEX_ALIGN + flat) × multiplier</code>. Status damage and stun chance read that value.'),
  ],
});

const IL: any = (E as any).item_level || {};
/** The band the odds are printed at — the middle one, so the table reads as a typical drop. */
const MID_BAND = Math.floor(((IL.spans || []).length || 1) / 2);
/** The Unbound lines a drop draws (`item_level.unbound_slots`), and how a range reads on the page. */
const NORM: { min: number; max: number } = IL.unbound_slots || { min: 0, max: 0 };
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

/** One slot's tables, shared by the Weapons and Equipment halls — the frame decides what it can roll. */
const slotSections = (names: string[]) => names.map((slot: string) => {
      const frames = (BASES.bases || []).filter((b: any) => b.slot === slot);
      // One possible-roll list per line kind, in the order a drop fills them: every entry names the Mod
      // this line can land, the value window it rolls in, and the chance the engine's own pool gives it —
      // read through `loot.poolChances` and renormalised over the lines this column may still draw. The
      // bar is the same chance drawn against the best line in the list, so the shape of the pool reads
      // before any number is compared.
      // Line 1 is the Frame Mod. A frame NAMES the lines it carries and those are marked forced; only a
      // slot in `frame_mod.drawn_line1_slots` draws line 1, and it draws it from the pool minus the Stat Mods.
      const SCALE: Record<string, number> = ((E.loot && E.loot.frame_mod) || {}).value_scale || {};
      const DRAW_SLOTS: string[] = (BASES.frame_mod?.drawn_line1_slots || []) as string[];
      /** The line-1 Mods the frame itself promises, read off the engine's floor roll — empty when line 1 is a draw. */
      const forced = (b: any): string[] => {
        if (DRAW_SLOTS.includes(slot)) return [];
        const line = (loot.frameModAtFloor(BASES_DATA, slot, b, null, 1, MID_BAND) as any[])[0];
        return line ? [line.id, ...((line.extra || []).map((x: any) => x.id))] : [];
      };
      const pool = (b: any) => (loot.poolChances(BASES_DATA, slot, b, null, MID_BAND) as any[]).sort((x: any, y: any) => y.chance - x.chance);
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
        ? `${esc(modName(b.school))} — the piece own flat defence, raised only by a ${STONE_NAME.quality}`
        : `none — this Base carries no school, so no ${STONE_NAME.quality} can raise it`}</div>`;
      const baseCell = (b: any) => {
        const own = forced(b);
        if (own.length) {
          const shared = own.length > 1 ? `<div class="sub">one line; its ${own.length} Mods share one budget, ×${SCALE[String(own.length)]} each</div>` : '';
          return `<div class="cell-stack">${rollList(own.map((id) => ({ id, chance: 1, forced: true })))}${shared}${gearMod(b)}</div>`;
        }
        return `<div class="cell-stack"><div class="sub">line 1 is drawn here — the slot has no Mod of its own, and no Stat Mod</div>`
          + rollList(redraw(pool(b).filter((e: any) => !(loot.STAT_IDS as string[]).includes(e.id)))) + gearMod(b) + '</div>';
      };
      // Bound and Unbound lines draw the one slot pool; only the stone lock tells them apart,
      // so the pool is printed once instead of in two identical columns.
      const rows = frames.map((b: any) => [
        esc(b.name), wrap(n1(b.weight)),
        baseCell(b),
        `<div class="cell-stack"><div class="sub">${n0(IL.bound_slots)} Bound, locked at drop · ${spacing(NORM)} Unbound, editable (+${n0(IL.mods_added_cap)} by Add)</div>` + rollList(laterPool(b)) + '</div>',
      ]);
      return `<h3>${esc(slot)}</h3><div class="twrap">` + table(['Frame', 'Weight', 'Frame Mod', 'Rollable lines'], rows) + `</div>`;
}).join('');
const EQUIP_SLOTS: string[] = (BASES.slots || []).filter((s: string) => s !== 'main hand');

page({
  file: 'items.html',
  nav: 'Items',
  title: 'Items',
  lead: 'A piece of gear is a <strong>frame</strong> plus the Mods that rolled on it. The frame decides what it can roll; the roll decides what it is worth.',
  body: [
    block('Two halls', `<p><a href="weapons.html">Weapons</a> lists main-hand frames. <a href="equipment.html">Equipment</a> lists every other slot.</p>`),
    block('How a drop rolls', table(['', 'Number', 'What it means'], [
      ['Lines on a drop', wrap(`${n0(IL.frame_mod_slots + IL.bound_slots + NORM.min)}-${n0(IL.frame_mod_slots + IL.bound_slots + NORM.max)}`), `${n0(IL.frame_mod_slots)} Frame Mod · ${n0(IL.bound_slots)} Bound · ${spacing(NORM)} Unbound, drawn at drop — a slot whose pool runs out first publishes fewer`],
      ['Lines after crafting', wrap(n0(IL.crafted_max)), `the Add craft opens one more line per stone, up to ${n0(IL.mods_added_cap)} — the crafted ceiling`],
      ['Item level', 'the drop own level', 'every line on the piece rolls inside the window that level publishes'],
      ['Item quality', 'low · mid · high', IL.spans.map((sp: any) => `${sp.band} ${n0(sp.from)}-${n0(sp.to)}`).join(' · ')],
      ['Tier', 'T1 · T2 · T3', 'which third of the window the roll landed in — T1 is the top third, and the rarest roll (' + pc0(1 - loot.TIER_SPLIT[1]) + ' T1 · ' + pc0(loot.TIER_SPLIT[1] - loot.TIER_SPLIT[0]) + ' T2 · ' + pc0(loot.TIER_SPLIT[0]) + ' T3)'],
    ]), `<code>drop lines = frame lines + Bound lines + rolled Unbound lines</code>; <code>crafted max = drop lines + ${n0(IL.mods_added_cap)}</code>. Tier odds: T1 ${pc0(1 - loot.TIER_SPLIT[1])}, T2 ${pc0(loot.TIER_SPLIT[1] - loot.TIER_SPLIT[0])}, T3 ${pc0(loot.TIER_SPLIT[0])}.`),
    block('Every Mod and the window it rolls in', table(['Mod', 'Range', 'Window by Item quality: low · mid · high'], [...(MODS.mods || [])].sort((a: any, b: any) => b.max - a.max).map((m: any) => [
      esc(m.name), `${n0(m.min)}-${n0(m.max)}${m.pct ? '%' : ''}`, modBands(m) || '—',
    ])), `<code>t = clamp((ItemLevel − band.from) / (band.to − band.from), 0, 1)</code>; <code>floor = round(lerp(previousBandFloor, currentBandFloor, t))</code>; ceiling = current band ceiling.`),
    block('God-roll seams', (() => {
      const rows = (E.item_level.spans || []).map((sp: any, q: number) => {
        const t1 = loot.rangeOf('max_hp_flat', sp.to, q, 0);
        const t3 = loot.rangeOf('max_hp_flat', sp.to, q, 2);
        return [`${esc(sp.band)} · level ${n0(sp.to)}`, `${n0(t1[0])}–${n0(t1[1])}`, `${n0(t3[0])}–${n0(t3[1])}`];
      });
      return table(['Band at its last level', 'T1 (top)', 'T3 (bottom)'], rows);
    })(), '<code>tier width = ceil((window ceiling − floor + 1) / 3)</code>. T1 takes the top third; T2 the middle; T3 the bottom.'),
  ],
});

page({
  file: 'weapons.html',
  nav: 'Weapons',
  title: 'Weapons',
  lead: `${n0((BASES.weapons || []).length)} main-hand types. <code>DPS index = attacksPerSecond × weaponMult / (sword attacksPerSecond × swordMult) × 100</code>. Frame windows use the mid band.`,
  body: [
    block('Weapon by weapon', ((BASES.weapons || []) as any[]).map((w: any) => {
      const weapon = (E.weapons as any[]).find((row: any) => row.name === w.name);
      const sword = (E.weapons as any[]).find((row: any) => row.name === 'one-handed sword');
      const dpsIndex = weapon.weapon_aspd * weapon.weapon_mult / (sword.weapon_aspd * sword.weapon_mult) * 100;
      const frames = (maybe(BASES.weapon_frames, w.name) || []) as any[];
      const rows = frames.map((f: any) => [esc(f.name), wrap(n2(f.drop_weight)), wrap(`×${n2(f.value_bias)}`),
        (f.frame_mod || []).map((id: any) => `<span class='rn'>${esc(modName(id))}</span> <span class='rv'>${winOf(id)}</span>`).join('<br>')]);
      return `<h3>${esc(w.name)} — ${esc(w.group)} · ${esc(w.damage)} · ${n1(weapon.weapon_aspd)} attacks/sec · ×${n2(weapon.weapon_mult)} damage · ${n0(dpsIndex)}% sword DPS · weight ${n1(w.weight)}</h3>` +
        table(['Frame', 'Drop weight', 'Value bias', 'Frame Mod lines'], rows);
    }).join(''), `<code>weapon DPS index = attacksPerSecond × weaponMult ÷ (swordAttacksPerSecond × swordMult) × 100</code>. Drop weight selects the frame; carried weight feeds encumbrance.`),
  ],
});

page({
  file: 'equipment.html',
  nav: 'Equipment',
  title: 'Equipment',
  lead: 'Every slot that is not a main hand, frame by frame. The frame decides what it can roll; the roll decides what it is worth.',
  body: [
    block('Slot by slot', slotSections(EQUIP_SLOTS), `<code>line value = tier slice(windowAt(Mod, ItemLevel, band))</code>. Frame Mods shared across n lines apply <code>shared value = line budget × frameScale[n]</code>. Bound, Unbound and Frame lines use the same slot pool; lock type controls which presses may edit them.`),
  ],
});

page({
  file: 'stats.html',
  nav: 'Stats & caps',
  title: 'Stats and caps',
  lead: 'Seven Core attributes feed derived stats through the formulas and caps below.',
  body: [
    block('Core attributes', table(['Attribute', 'Feeds', 'One point buys'], [
      ['Str', 'physical power · Armour · carry weight',
        `${per(E.K.K_STR)} power · ${per(E.K.K_ARMOUR)} Armour · ${per(E.K.K_STR_WEIGHT)} weight`],
      ['Vit', 'health · health regeneration · stun recovery',
        `${per(E.K.K_VIT_HP)} health · ${per(E.K.K_VIT_REGEN)}/s regen · ${per(E.K.K_VIT_STUNREC)}% stun recovery`],
      ['Dex', 'accuracy · Status alignment Chance',
        `${per(E.K.K_DEX_ACC)} accuracy · ${per(E.K.K_DEX_ALIGN)} alignment`],
      ['Agi', 'attack speed · evasion',
        `${per(E.K.K_AGI_ASPD)}% attack speed · ${per(E.K.K_EVASION)} evasion`],
      ['Wis', 'max Energy Shield · cooldown reduction',
        `${per(E.K.K_WIS_ES)} Energy Shield · ${per(E.K.K_WIS_CDR)} cooldown reduction`],
      ['Int', 'magic power · Elemental power · mana',
        `${per(E.K.K_INT)} magic power · ${per(E.K.K_ELEM)} Elemental power · ${per(E.K.K_INT_MP)} mana · ${per(E.K.K_INT_MREGEN)}/s mana regen`],
      ['Lck', 'crit · perfect dodge',
        `${per(E.K.K_LCK_CRIT)} crit pool · ${per(E.K.K_LCK_PDOGE)} perfect dodge`],
    ]), `<code>Core[k] = (statOf(allocatedPoints[k]) + flat[k]) × (1 + percent[k] / 100)</code>; derived lines apply their own <code>K_core</code>.`),
    block('What a level gives', table(['Line', 'Gain per level', 'Where it starts'], [
      ['Max HP', wrap(`+${n0(E.level_gain.hp_per_level)}`), wrap(n0(E.level_gain.hp_base))],
      ['Max Mana', wrap(`+${n0(E.level_gain.mp_per_level)}`), wrap(n0(E.level_gain.mana_base))],
      ['Carry weight', '—', wrap(n0(E.level_gain.weight_base))],
      ['Attribute points', `${wrap(n0(E.stat.points_per_level))} · ${wrap(n0(E.stat.paragon_points_per_level))} past level ${wrap(n0(E.stat.paragon_from))}`, 'spent by hand'],
      ['Tree points', wrap(((TREE_CURRENCY.level_ranges || []) as any[]).map((r: any) => `+${n0(r.per)} a level ${n0(r.from)}–${n0(r.to)}`).join(' · ') || `+${n0(TREE_CURRENCY.per_level ?? 0)} a level`), wrap(n0(TREE_CURRENCY.base ?? 0))],
    ]), `<code>pointsAt(L) = points_per_level × (min(L, paragon_from − 1) − 1) + paragon_points_per_level × max(0, min(L, level_cap) − (paragon_from − 1))</code> for attribute points; the tree reads its own rows: <code>treePoints = base + the level ranges + claimed quest bonuses − what the ranks spent</code>.`),
    block('Caps', table(['Line', 'Cap', 'What that means'], Object.entries(E.caps as Record<string, any>)
      .filter(([k, v]) => (typeof v === 'number' || v === null) && k !== 'elem_res_max')
      .map(([k, v]) => [esc(CAP_LABEL[k] || k), v === null ? 'no cap' : wrap(v < 1 ? n2(v) : n0(v)),
        v === null ? 'keeps climbing as you build for it'
          : k === 'elem_res' ? `a full build stops here, and this is the one Cap with an unlock — a passive-tree node lifts the ceiling to ${wrap(n0((E.caps as any).elem_res_max))}`
          : 'a full build stops here']))
      ),
  ],
});

page({
  file: 'world.html',
  nav: 'World',
  title: 'The world',
  lead: 'Zone Level drives HP/DPS curves; body class changes group size, evasion and DPS factor.',
  body: [
    block('Body classes', table(['Body', 'Damage', 'Base evasion', 'Comes in'], (E.mob.sizes || []).map((s: any) => [
      esc(s.id), `×${n1(s.ps)}`, `+${n0(s.evasion_pct)}%`, esc(s.group),
    ])), '<code>Mob evasion = min(evasionCap, Dex × K_EVASION × (1 + body.evasion_pct / 100))</code>. Bosses declare which body class weapons read.'),
    block('Zones', table(['#', 'Zone', 'Region', 'Levels', 'Band', 'Mob group', 'Its three sides', 'Elements'], eng.ZONES.map((z: any) => [
      wrap(n0(z.id)), esc(z.name), esc(z.region), `${n0(z.levels[0])}-${n0(z.levels[1])}`, esc(z.quality), esc(z.group),
      list((z.subzones || []).map((s: any) => `${s.name}: ${(s.spawn || {}).group || z.group} pack, ${(s.spawn || {}).elite_pct ?? Math.round(E.loot.elite_spawn_chance * 100)}% elite, ${eng.packWordOf((s.spawn || {}).pack)}`)),
      list(eng.zoneElements(z.id)),
    ])), 'Zone item band sets drop quality. The Element list is the union of its Species and Boss Elements.'),
    block('Dungeons', table(['Dungeon', 'Zone', 'Band', 'A run'], (TOWN.settlements || []).map((s: any) => [
      // the sheet prints the same name (tools/map.ts owns it); the wiki only reads it back
      esc(s.name + ' Dungeon'), wrap(n0(s.zone)), esc(s.band),
      `${n0(E.dungeon.mob_cap)} mobs · groups of ${n0(E.dungeon.group_cap)}`,
    ])), `Clear: receive escrowed loot. Retreat: keep ${n0(E.dungeon.retreat_keep_min)}–${n0(E.dungeon.retreat_keep_max)} random legal stacks; forfeit the rest. Push: forfeit all escrow. Cooldown: ${n0(E.dungeon.cooldown_sec / 60)} min.`),
    block('Species', table(['Species', 'Race', 'Zones', 'Body classes', 'Default damage', 'Attack Element', 'Resists', 'Weak to', 'What its body does', 'Health line'], (E.mob.species || []).map((sp: any) => [
      esc(sp.name), esc(sp.race), list(sp.zones), list(sp.sizes), esc(sp.damage), esc((sp as any).element),
      `${esc(sp.resistance.element)} ${n0(sp.resistance.pct)}%`, `${esc(sp.weakness.element)} +${n0(sp.weakness.taken_pct)}%`,
      list(eng.mechanicWordsOf((sp as any).mechanics)) || 'an ordinary body', esc(sp.trait || ''),
    ])), `Each Species attacks with one Element and authors one <code>resistance</code> line and one <code>weakness</code>; the two Elements never match. Bosses and Uniques inherit the Species profile. Race adds no combat modifier.`),
  ],
});

page({
  file: 'mobs.html',
  nav: 'Bestiary',
  title: 'Races, Species and Variants',
  lead: (() => {
    const variants = (E.mob as any).variants || {};
    const total = (E.mob.species || []).reduce((n: number, sp: any) => n + (variants[sp.id] || []).length, 0);
    const uniques = ((E.mob as any).uniques || []).length;
    const races = (E.mob.races?.set || []).length;
    return `${races} Races · ${E.mob.species.length} Species · ${total} Variants · ${uniques} Uniques. Counts describe the current world; Races and Species have no required roster size.`;
  })(),
  body: (() => {
    const variantsBySpecies = (E.mob as any).variants || {};
    const speciesRows = E.mob.species || [];
    const races: string[] = E.mob.races?.set || [];
    const variantCount = (sp: any) => (variantsBySpecies[sp.id] || []).length;
    const totalVariants = speciesRows.reduce((n: number, sp: any) => n + variantCount(sp), 0);
    const rarityRows = Object.entries((E.junk as any).rarities || {}) as [string, any][];
    const bandRows = ['low', 'mid', 'high'].map((band) => [
      esc(band),
      pc1(eng.dropChance(band)),
      pc1(farm.herbChance(band)),
      rarityRows.map(([rarity, row]) => `${esc(rarity)} ${pc1(row.drop_chance_per_kill)}`).join(' · '),
      pc1(farm.potionDropChance(band)),
    ]);
    const speciesCard = (sp: any) => {
      const variants: { name: string; levels: [number, number]; core?: Record<string, number>; damage?: string }[] = variantsBySpecies[sp.id] || [];
      const uniques: any[] = ((E.mob as any).uniques || []).filter((u: any) => u.species === sp.id);
      const coreText = (core?: Record<string, number>) => core
        ? ['str', 'agi', 'vit', 'dex', 'int', 'wis', 'lck'].map((key) => `${key.toUpperCase()} ${n0(core[key] || 0)}`).join(' · ')
        : '—';
      const dropRow = (name: string, level: string, role: string, extraDrops: string, core?: Record<string, number>, damage = sp.damage) => {
        const drop: any = maybe(E.mob.variant_drops, name);
        if (!drop) return [esc(name), level, role, esc(damage), coreText(core), 'No junk row', '—', '—', extraDrops];
        const chance = Number((E.junk as any).rarities?.[drop.rarity]?.drop_chance_per_kill || 0);
        const choices = [...new Set([drop.item, sp.junk_items?.[drop.rarity]].filter(Boolean))] as string[];
        const outcomePct = choices.length ? chance / choices.length : 0;
        const outcomes = choices.map((item) => `${esc(item)} ${pc1(outcomePct)}`).join(' · ');
        return [esc(name), level, role, esc(damage), coreText(core), outcomes || '—', `${esc(drop.rarity)} · ${pc1(chance)} total`, esc(drop.lean), extraDrops];
      };
      const drops = [
        ...variants.map((v) => dropRow(v.name, `${n0(v.levels[0])}–${n0(v.levels[1])}`, 'Variant',
          sp.potion_source ? 'Potion source · see band rates' : '—', v.core, v.damage ?? sp.damage)),
        ...uniques.map((unique) => dropRow(unique.name, 'wild', 'Unique',
          `Elite stones · XP ×${n0(E.xp.unique_mult)} · skill ${pc1(E.skill_drop.unique)}`, unique.core, unique.damage)),
      ];
      const facts = [
        ['Sizes', list(sp.sizes)],
        ['Default damage', esc(sp.damage)],
        ['Attack Element', esc(sp.element)],
        ['Resists', `${esc(sp.resistance.element)} ${n0(sp.resistance.pct)}%`],
        ['Weak to', `${esc(sp.weakness.element)} +${n0(sp.weakness.taken_pct)}%`],
        ['Zones', list(sp.zones)],
        ['Fixed levels', list(Object.entries(sp.zone_levels || {}).map(([zone, level]: [string, any]) => `Z${zone} · L${n0(level)}`))],
      ].map(([label, value]) => `<div><b>${esc(label)}</b><span>${value || '—'}</span></div>`).join('');
      return `<article class="species-entry">`
        + `<header><h4>${esc(sp.name)}</h4><span class="species-count">${n0(variants.length)} variants · ${n0(uniques.length)} uniques</span></header>`
        + `<div class="species-facts">${facts}</div>`
        + `<h4>Variants and junk drops</h4>`
        + table(['Variant', 'Selection band', 'Role', 'Damage', 'Core', 'Junk outcomes · each %', 'Base junk / kill', 'Lean', 'Extra drops'], drops)
        + `</article>`;
    };
    const raceSections = races.map((race) => {
      const members = speciesRows.filter((sp: any) => sp.race === race);
      const title = race[0].toUpperCase() + race.slice(1);
      return `<section class="race-group"><header><h3>${esc(title)}</h3><span>${n0(members.length)} Species</span></header>`
        + (members.length ? `<div class="species-roster">${members.map(speciesCard).join('')}</div>`
          : `<p class="race-empty">No Species in this Race yet.</p>`)
        + `</section>`;
    }).join('');
    return [
      block('Shared drop rates', table(['Zone band', 'Gear', 'Herbs', 'Junk by rarity', 'Potion · eligible Species'], bandRows),
        `<code>gear chance = base_drop_chance × (1 + LCK × K_LCK_DROP)</code> before mastery and loot leans. Junk item outcomes split the rarity chance equally across the Variant item and its Species alternative.`),
      block('Race → Species → Variant', `<div class="race-roster">${raceSections}</div>`,
        `<code>Species power = power_base + K_MOB_PS_STAT × (wPhys × STR + wMagic × INT)</code>; damage type selects the weights, and Variant may override it. Potion eligibility is a Species flag. Bosses and Uniques inherit their Species resistance and weakness.`),
    ];
  })(),
});

page({
  file: 'towns.html',
  nav: 'Towns',
  title: 'Settlements',
  lead: 'Stall price = listed income-minutes × the seller band’s gold-per-minute rate.',
  body: (() => {
    const NPC: Record<string, any> = Object.fromEntries((TOWN.npcs || []).map((n: any) => [n.id, n]));
    const LINE: Record<string, any> = Object.fromEntries([...(TOWN.one_time || []), ...(TOWN.repeatable || [])].map((l: any) => [l.id, l]));
    const SET: Record<string, any> = Object.fromEntries((TOWN.collector_sets || []).map((c: any) => [c.id, c]));
    /** A stock id is a stall line, or the settlement’s own Collector set. */
    const stockName = (id: string): string => LINE[id]?.item || (SET[id] ? `${SET[id].name} (Collector set)` : id);
    const TS: any = TOWN.task_sizing || {};
    const price = (l: any): string => (l.m_min != null
      ? `${goldAt(l.m_min, l.charge_band)}–${goldAt(l.m_max, l.charge_band)}`
      : l.charge === 'one_per_band'
        ? QUAL_BANDS.map((b: string) => `${esc(b)} ${goldAt(l.m, b)}`).join(' · ')
        : goldAt(l.m, l.charge_band));
    const extra = (l: any): string => [
      l.qty && l.qty > 1 ? `${n0(l.qty)} a purchase` : '',
      l.ladder ? `one of the ${esc(l.ladder)} ladder` : '',
      l.per_day_cap ? `${n0(l.per_day_cap)} a day` : '',
      l.charge ? esc(String(l.charge).replace(/_/g, ' ')) : '',
      l.m_per_block != null ? `${n0(l.m_per_block)} gold-minute a block walked` : '',
    ].filter(Boolean).join(' · ');
    return [
      block('Where', table(['Settlement', 'Zone', 'Band', 'Innate Element', 'Who is there', 'What it stocks'], (TOWN.settlements || []).map((s: any) => [
        `${esc(s.name)}${s.start ? ' <span class="tag">start</span>' : ''}${s.capital ? ' <span class="tag">capital</span>' : ''}`,
        wrap(n0(s.zone)), esc(s.band), list(s.innate),
        `<span class="hy">${list((s.npcs || []).map((id: string) => NPC[id]?.name || id))}</span>`,
        `<span class="hy">${list((s.stock || []).map(stockName)) || 'no ordinary stall stock'}</span>`,
      ])), 'Stock entries are explicit. Standing gates listed lines only; walking unlocks a Waypoint.'),
      block('Who sells what', table(['NPC', 'What they deal in', 'Where they are'], (TOWN.npcs || []).map((n: any) => [
        esc(n.name), esc(n.kind), esc(n.rule || ''),
      ])), 'The Black Market is the only gold shop that sells materials, craft stones or Skill XP.'),
      block('Standing', table(['Tier', 'Reach it at', 'Unlocks'], (TOWN.standing?.tiers || []).map((t: any) => [
        esc(t.name), `${n0(t.share * 100)}% of the settlement zone kill budget`, esc(t.unlocks),
      ])), `<code>Standing progress = zone kills + settlement Camp aid credit</code>; <code>tier threshold = ceil(tier.share × zone kill budget)</code>. Source: ${esc(String((TOWN.standing as any).earnt_from || ''))}.`),
      block('The task board', table(['', 'The number', 'Read from'], [
        ['Slots open at once', wrap(n0(TS.slots)), '<code>task_sizing.slots</code>'],
        ['A slot refills', TS.refill_sec >= 3600 ? `every ${n0(TS.refill_sec / 3600)} hours` : `every ${n0(TS.refill_sec / 60)} minutes`, '<code>task_sizing.refill_sec</code>'],
        ['A free skip', `${n0(TS.free_skip_per_day)} a day, plus a bought one on top`, '<code>task_sizing.free_skip_per_day</code>'],
        ['An Elite hunt asks for', wrap(n0(TS.elite_n)), '<code>task_sizing.elite_n</code>'],
        ['An Expedition asks for', `${n0(TS.elite_n)} target Species Elites in one named subzone`, '<code>task_sizing.elite_n</code> · <code>mob.zones[].subzones</code>'],
        ['Elite / Expedition share', `${pc1(TS.offer_weight_elite)} / ${pc1(TS.offer_weight_expedition)}`, 'same total Tier-stone offer share as before'],
        ['What it pays', `a slice of that band’s own stone income: ${n0(TS.reward_minutes_of_band_income)} minutes of it`, '<code>task_sizing.reward_minutes_of_band_income</code>'],
        ['A Boss hunt pays', Object.entries(TS.boss_reward || {}).map(([k, v]: any) => `${n0(v)} ${esc(String(k).replace(/_/g, ' '))}`).join(' + '), 'winner’s choice, exactly as the board writes it'],
      ]), `${(() => {
        const pay = (b: string) => {
          const p: any = eng.taskPayout(b, TS.reward_minutes_of_band_income);
          return `${stone('tier', p.tier)} · ${stone('add', p.add)} · ${stone('reroll_value', p.reroll_value)}`;
        };
        return `${n0(TS.reward_minutes_of_band_income)}-minute slice: low ${pay('low')} · mid ${pay('mid')} · high ${pay('high')}`;
      })()}. <code>stone payout = round(stonesPerHour(band) × reward_minutes / 60)</code>. Expeditions count the target Species’ Elites in the named subzone.`),
      block('One-time lines', table(['Item', 'Sold by', 'Buys', 'Costs, in gold at that band', 'Note'], (TOWN.one_time || []).map((l: any) => [
        esc(l.item), esc(NPC[l.npc]?.name || l.npc || ''), esc(l.kind), price(l),
        `<span class="hy">${[extra(l), l.discount ? `at ${esc((TOWN.settlements || []).find((s: any) => s.id === l.discount.settlement)?.name || l.discount.settlement)} it costs ${goldAt(l.discount.m, (TOWN.settlements || []).find((s: any) => s.id === l.discount.settlement)?.band || l.charge_band)}` : ''].filter(Boolean).join(' · ')}</span>`,
      ])), '<code>Gold price = roundConfigured(listed minutes × goldPerMinute(charge_band))</code>; one-time lines cannot be bought again.'),
      block('Repeatable lines', table(['Item', 'Sold by', 'Buys', 'Costs, in gold at that band', 'Note'], (TOWN.repeatable || []).map((l: any) => [
        esc(l.item), esc(NPC[l.npc]?.name || 'no vendor — see note'), esc(l.kind), price(l),
        `<span class="hy">${extra(l)}</span>`,
      ])), '<code>Gold price = roundConfigured(listed minutes × goldPerMinute(charge_band))</code>; repeat and daily limits are shown per line.'),
      block('The Collector', table(['Set', 'At', 'School', 'Pieces it wants', 'Quality', 'Pays'], (TOWN.collector_sets || []).map((c: any) => [
        esc(c.name || c.id), esc((TOWN.settlements || []).find((s: any) => s.id === c.settlement)?.name || c.settlement),
        esc(c.school), list(c.pieces || []), esc(c.quality || 'any'),
        `<span class="hy">${esc(c.reward || '')}${c.pays_gold === false ? ' · never gold, never a Mod' : ''}</span>`,
      ])), 'Collector sets reserve requested pieces before the filter runs. Rewards are data-authored.'),
    ];
  })(),
});

page({
  file: 'economy.html',
  nav: 'Economy',
  title: 'The two currencies',
  lead: 'Trade quote = item value integrated over the town’s demand curve. Stall prices use band income; Crafting lists stone costs.',
  body: [
    block('Crafting', `<p>Every verb, price and stone source lives on the <a href="crafting.html">Crafting</a> page.</p>`),
    block('Gold: where it comes from', table(['Band', 'Kills an hour', 'Junk an hour', 'Gold a minute'],
      (QUAL_BANDS as string[]).map((b: string) => [
        esc(b), wrap(n0(EBAND[b].kills_derived)), wrap(n0(EBAND[b].junk_per_hr)),
        `${n1(eng.goldPerMinute(b))} gold`,
      ])),
      '<code>goldPerMinute = junkPerHour / 60</code>; expected base gold per kill = <code>sellGold × rarityChance</code>.'),
    block('Town buyers and trade routes', table(['Town', 'Import needs', 'Abundant exports', 'Why it buys'], TOWN.settlements.map((town: any) => {
      const profile = TOWN.trade.towns[town.id];
      const words = (entries: string[]) => entries.map((id) => trade.byId[id]?.name || id.replace('junk:', '')).join(' · ');
      return [esc(town.name), esc(words(profile.imports)), esc(words(profile.exports)), esc(profile.needs)];
    })), `<code>quote = volume × floorMult + ((remaining² − max(0, remaining − volume)²) / (2 × capacity)) × (peak − floorMult)</code>; <code>volume = count × baseValue</code>. Peak is import/export/neutral by town; remaining demand recovers by <code>elapsed × capacity / recoverySec</code>.`),
    block('Haggling', `<p><code>level = min(cap, floor(sqrt(XP / levelDivisor)) + 1)</code>; <code>progress = (level − 1) / (cap − 1)</code>.</p><p><code>saleMult = 1 + progress × saleBonusMax / 100</code>; <code>deliveryMult = 1 + progress × deliveryBonusMax / 100</code>; <code>serviceMult = 1 − progress × serviceDiscountMax / 100</code>. A completed Delivery pays XP once.</p>`),
    block('Regional gathering', table(['Town field', 'Mine bonus', 'Grove bonus', 'Grove forage'], TOWN.settlements.map((town: any) => {
      const source = (E.fieldwork as any).regional_sources[town.zone];
      return [esc(town.name), esc(fieldwork.materialById[source.mine].name), esc(fieldwork.materialById[source.grove].name), esc(fieldwork.foodById[source.food].name)];
    })), `<code>harvestBonus = reachedMilestones × bonusPerMilestone</code>; <code>dropChance = min(1, baseChance × (1 + min(cap, (max(0, skill − 1) × skillRate + max(0, mastery − 1) × masteryRate)) / 100))</code>. Regional source selects Mine, Grove and forage goods by zone.`),
    block('Delivery wants', `<p><code>offer roll = trigger_chance</code> at each online interval for each visited town. The displayed reward and deadline are fixed when offered; each hand-in pays the live market quote, and the completion bonus pays once at the full count.</p><p>Deadlines use credited game time and pause during Camp recovery or dungeon runs. Offline time creates no offers. A full bag refuses the final hand-in without spending goods or progress.</p>`),
    block('Black Market', table(['Rule', 'The number'], [
      ['Offers per settlement', `${n0(TOWN.black_market.offers_per_refresh)} at a time`],
      ['Refresh', `every ${n0(TOWN.black_market.refresh_interval_sec / 60)} online minutes, per visited town`],
      ['Material price', `peak trade value × ${n2(TOWN.black_market.resale_cover_multiplier)} resale cover × its rarity multiplier`],
      ['Skill XP Level bands', TOWN.black_market.skill_level_offers.map((row: any) => `Level ${n0(row.level)} · ${n0(row.price_gold)} gold`).join(' · ')],
    ]), `<code>material price = peakTradeValue × resaleCover × rarityMultiplier</code>. Stock is per town and refreshes online. Skill offers only grant or raise a skill; they never lower level or add duplicate rungs.`),
    block('Workshop cargo', table(['Finished good', 'Field skill', 'Materials', 'Base value'], (E.fieldwork as any).workshop_recipes.map((recipe: any) => [
      esc(recipe.name), `${esc(recipe.skill)} Lv ${n0(recipe.level)}`, esc(Object.entries(recipe.materials).map(([id, count]) => `${count} ${fieldwork.materialById[id].name}`).join(' · ')), `${n2(trade.byId[`material:${recipe.id}`].value)} gold`,
    ])), `<code>finishedGoodValue = (Σ materialCount × materialValue) × workshop_value_mult / recipeYield</code>. Sale gold is the town quote at current demand.`),
    block('Gold: what it buys', table(['Buys', 'Lines that buy it', 'Written as', 'What a line is worth'],
      (['space', 'time', 'information', 'appearance'] as string[]).map((kind: string) => {
        const lines = [...(TOWN.one_time || []), ...(TOWN.repeatable || [])].filter((l: any) => l.kind === kind);
        const cents = lines.flatMap((l: any) => [l.m, l.m_min, l.m_max].filter((x: any) => typeof x === 'number'));
        return [esc(kind), wrap(n0(lines.length)),
          cents.length ? `${n0(Math.min(...cents))}–${n0(Math.max(...cents))} minutes of the band’s income` : '<span class="hy">none</span>',
          `<span class="hy">${esc(lines.map((l: any) => l.item).join(' · '))}</span>`];
      })),
      '<code>service gold = roundToCurrencyDecimals(listed income-minutes × goldPerMinute(charge band))</code>. Black Market prices use their own multiplier.'),
    block('What is deliberately absent', `<ul class="fx">
      <li><span class="fk">One sanctioned sink sells power.</span><span class="fs">exception</span><span class="fv">the Black Market sells named Skill XP Levels and craft stones for gold — every other stall still sells space, time, information and appearance</span></li>
      <li><span class="fk">No player auction.</span><span class="fs">rule</span><span class="fv">trade is between the character and town buyers</span></li>
      <li><span class="fk">No prestige currency.</span><span class="fs">rule</span><span class="fv">nothing resets what you earned — <a href="builds.html">Builds</a></span></li>
      <li><span class="fk">No timed shop, no sale.</span><span class="fs">rule</span><span class="fv">time is not a design constraint, so no screen sells urgency</span></li>
    </ul>`),
  ],
});

page({
  file: 'crafting.html',
  nav: 'Crafting',
  title: 'Crafting',
  lead: 'Stones change what a piece <em>is</em>; two of them also move how high it sits — Ascend the band, Upgrade the Gear line. At the settlement Craft bench, right-click a stone and click an equipped or carried item, or a highlighted Mod line for a targeted use. Hold Shift to keep using the stone; Esc or right-click cancels. Every price below is read, never typed.',
  body: [
    block('Use the Craft bench', `<ol>
      <li>Drag a piece from Equipped or Inventory into the central bench slot.</li>
      <li>Hover a gear piece to inspect its full item detail and current Mod lines.</li>
      <li>Drag a stone from the stack onto the selected piece. Direct presses apply on drop; presses that need a line or Mod choice prepare the action for review and confirmation.</li>
      <li>Hover the gear again after the press to read its updated Mod lines.</li>
    </ol>`, 'Gear crafting is a Settlement service. Camp cooking is the field exception; it does not craft gear.'),
    block('The stones, one by one', (() => {
      /** one heading per stone, then the presses that stone buys — a press is never a stone */
      const perStone = (key: string, presses: any[][]): string =>
        `<h3>${esc(STONE_NAME[key])}</h3>` + table(['Press', 'Target', 'Cost', 'What it does'], presses);
      const perLine = (key: string, n: any): string => `${stone(key, n)} a line × the lines it edits`;
      /**
       * The Target cell is one clause in a fixed order: which line is picked · how many · what kind
       * of line · what happens to it. A swap closes with what arrives. Same order every row, so the
       * column reads down like a table instead of being parsed like prose.
       */
      const tok = (...w: (string | number)[]): string =>
        w.map((x) => `<span class="tag">${esc(String(x))}</span>`).join(' ');
      const UNB = 'unbound mod';
      const ANY = 'unbound or bound mod';
      const BOTH = 'unbound + bound mod';
      const ALL3 = 'unbound + bound + frame mod';
      const SET = `${n0(E.item_level.unbound_slots.min)}-${n0(E.item_level.unbound_slots.max)}`;
      /** the Vaal table, said in the same words as every other row */
      const CORRUPT_WORDS: Record<string, string> = {
        nothing: 'nothing',
        reroll_values: 'reroll value on every line',
        add_mod: 'adds one unbound mod, marked (crafted)',
        remove_mod: 'removes one unbound mod',
        reroll_element: 'rerolls the Element',
        gear_mod_up: 'raises the Gear line',
        quality_down: 'one Item quality band down',
      };
      return [
        perStone('reroll_value', [
          [pressOf('reroll'), tok('select', 1, UNB, 'reroll value'), stone('reroll_value', E.craft.reroll_value_stones_per_use), 'the Mod stays and its value rolls again inside its own Tier, never below the floor this slot has held'],
          [pressOf('reroll_random'), tok('random', 1, UNB, 'reroll value'), stone('reroll_value', E.craft.reroll_value_stones_per_use), 'the same press with the line drawn rather than named'],
        ]),
        perStone('tier', [
          [pressOf('refine'), tok('select', 1, UNB, 'raise tier by 1'), stone('tier', E.craft.refine_stones_per_use), 'the Mod stays and never moves past the top Tier'],
          [pressOf('randomize'), tok('select', 1, UNB, 'reroll tier'), stone('tier', E.craft.roll_stones_per_use), 'the Mod stays, its Tier and value roll again: the line can come back lower'],
          [pressOf('reroll_mod'), tok('select', 1, ANY, 'reroll mod'), stone('tier', E.craft.roll_stones_per_use), 'a new Mod out of the Base pool with a fresh Tier and value; the line count and the frame mod are untouched'],
          [pressOf('reroll_mod_all'), tok('all', BOTH, 'reroll mod'), perLine('tier', E.craft.roll_stones_per_use), 'the same roll spent on every line in scope at once'],
        ]),
        perStone('add', [
          [pressOf('add'), tok('add', 1, UNB, 'random'), stone('add', E.item_level.add_stones_per_fill[0]), 'one line joins the set, marked (crafted); the piece stops at ' + n0(E.item_level.mods_added_cap) + ' presses'],
          [pressOf('add_specific'), tok('add', 1, UNB, 'select'), 'the same price as the drawn press', 'the Mod is chosen and the price is not: the choice buys the identity, never a cheaper line'],
        ]),
        perStone('remove', [
          [pressOf('remove'), tok('remove', 'random', 1, UNB), stone('remove', E.craft.remove_stones_per_use), 'a line leaves the set and the Add charge it took is refunded'],
          [pressOf('remove_at'), tok('remove', 'select', 1, UNB), stone('remove', E.craft.remove_stones_per_use), 'the same press with the line named'],
        ]),
        perStone('replace', [
          [pressOf('replace'), tok('select', 1, ANY, 'set mod', 'with select'), stone('replace', E.craft.replace_stones_per_use), 'both ends are chosen by the player; the Tier the new Mod lands on is the stone roll'],
          [pressOf('replace_random'), tok('random', 1, UNB, 'set mod', 'with select'), stone('replace', E.craft.replace_stones_per_use), 'the Mod is named, the line is drawn from the Unbound set'],
          [pressOf('replace_all'), tok('all', BOTH, 'set mod', 'with random'), perLine('replace', E.craft.replace_stones_per_use), 'every line in scope at the one-stone Replace price; what arrives is drawn, not named'],
        ]),
        perStone('imprint', [
          [`${pressOf('imprint')} · one Mod you hold (${n0(MODS.mods.length)} stones in the game)`, tok('select', 1, UNB, 'set mod', 'with the stone mod'), `${n0(E.craft.imprint_stones_per_use)} stone of that one Mod`, 'a fresh Tier and value on the Mod the stone carries: no Add charge, no line count moved'],
        ]),
        perStone('quality', [
          [pressOf('upgrade'), tok('item', 'raise level by 1'), 'the ladder below — 1 up to ' + n0(E.craft.upgrade_costs[E.craft.upgrade_costs.length - 1]) + ' a step', `the piece own Gear line climbs (${n0(E.craft.gear_mod_per_level)} a step): not a Mod, so no line is added and nothing rerolls`],
        ]),
        perStone('repair', [
          [pressOf('repair'), tok('item', 'clear broken'), stone('repair', E.craft.repair_stones), 'the piece returns one upgrade level below its pre-break level and its protection is refilled'],
        ]),
        perStone('corrupt', [
          [pressOf('corrupt'), tok('all', ALL3, 'roll once', 'and close'), '1 stone · the piece is closed to stones after', (E.craft.corrupt_outcomes || []).map((o: any) => `${n0(o.weight)}% ${CORRUPT_WORDS[String(o.kind)] || esc(String(o.kind).replace(/_/g, ' '))}`).join(' · ')],
        ]),
        perStone('polish', [
          [pressOf('polish'), tok('all', ALL3, 'reroll value'), stone('polish', E.craft.polish_stones_per_use), 'every value rolls inside its own Tier at once: no Tier moves, no Mod identity moves, no line count moves'],
        ]),
        perStone('reforge', [
          [pressOf('reforge'), tok('all', ALL3, 'reroll tier', 'then reroll value'), stone('reforge', E.craft.reforge_stones_per_use), 'one Tier drawn for the piece, then every value rolled inside it — the whole piece climbs or falls together'],
        ]),
        perStone('rebirth', [
          [pressOf('rebirth'), tok('all', SET, UNB, 'reroll mod', 'with random'), stone('rebirth', E.craft.rebirth_stones_per_use), 'every line the Unbound set holds — the (crafted) ones included — draws a new Mod at once; the bound pair and the frame mod keep theirs, no line is added or removed, no Add charge is spent'],
        ]),
        `<h3>Not a stone — presses that spend other stones</h3>` + table(['Press', 'Target', 'Cost', 'What it does'], [
          [pressOf('ascend'), tok('item', 'raise quality by 1'), `${stone('add', E.craft.ascend_add_stones)} + ${stone('tier', E.craft.ascend_tier_stones)}`, 'the value window moves with the band and every line rolls again inside the same Tier third it held'],
          ['Condense a potion', tok('potion', 'raise effect by ' + n0(E.potions.condensed.effect_mult)), `${n0(E.potions.condensed.cost_bottles)} bottles + ${stone('reroll_value', E.potions.condensed.cost_reroll_value_stones)}`, 'one bottle does the work of many, at one weight'],
        ]),
      ].join('');
    })(), '<code>bulk cost = single-press cost × editable line count</code>. Rebirth is one fixed per-piece cost. Add cost follows <code>add_stones_per_fill[min(mods_added, 1)]</code>.'),
    block('Quality ladder', table(['Step', 'Quality Stones', 'Odds'], (() => {
      const EP = E.craft.upgrade_success_endpoints;
      return (E.craft.upgrade_costs || []).map((c: number, i: number) => {
        const step = i + 1;
        const odds = step <= EP.safe_to ? 'safe'
          : step < E.craft.upgrade_breaks_from ? `${n0(EP.mid[0])}% down to ${n0(EP.mid[1])}% — a fail drops one level`
          : `${n0(EP.high[0])}% down to ${n0(EP.high[1])}% — a fail breaks the piece`;
        return [`+${n0(step)}`, wrap(n0(c)), odds];
      });
    })()), `<code>successPct(step)</code> is linear between configured endpoints; failure below +${n0(E.craft.upgrade_breaks_from)} drops one level, failure at or above it spends 1 protection or breaks the item. <code>Upgrade Gear Mod gain = successful level × ${n0(E.craft.gear_mod_per_level)}</code>. Repair restores one level below the break level and refills ${n0(E.craft.protection_start)} protection.`),
    block('Where stones come from', (() => {
      const pct = (v: any) => { const p = Number(v) * 100; return (Number.isInteger(p) ? n0(p) : n1(p)) + '%'; };
      const chance = (v: any) => Number(v) < 1 ? pct(v) + ' per kill' : n0(v) + (Number(v) === 1 ? ' stone' : ' stones');
      return table(['Stone', 'Elite', 'Boss', 'Every kill'], [
        [STONE_NAME.reroll_value, '—', '—', `${n0(E.salvage.alchemy.value_yield)} per ${n0(E.salvage.alchemy.scrap_cost)} Scrap via Alchemy`],
        [STONE_NAME.tier, chance(E.loot.elite_tier_stones), chance(E.loot.boss_tier_stones), '—'],
        [STONE_NAME.add, chance(E.loot.elite_add_stone_chance), chance(E.loot.boss_add_stones), '—'],
        [STONE_NAME.quality, chance(E.loot.quality_stone_sources.elite_quality_chance), chance(E.loot.quality_stone_sources.boss_quality_stones), chance(E.loot.quality_stone_sources.monster_quality_chance)],
        [STONE_NAME.repair, chance(E.loot.repair_stone_sources.elite_repair_chance), chance(E.loot.repair_stone_sources.boss_repair_stones), 'elites and bosses only'],
        [STONE_NAME.replace, chance(E.loot.replace_stone_sources.elite_replace_chance), chance(E.loot.replace_stone_sources.boss_replace_chance), '—'],
        ['Imprint (any of ' + n0(MODS.mods.length) + ')', chance(E.loot.imprint_stone_sources.elite_imprint_chance), `${n0(E.loot.imprint_stone_sources.boss_imprint_stones)} stones`, 'uniform over the Mod roster'],
        [STONE_NAME.corrupt, '—', chance(E.loot.corrupt_stone_sources.boss_corrupt_chance), 'bosses only'],
        [STONE_NAME.polish, chance(E.loot.polish_stone_sources.elite_polish_chance), chance(E.loot.polish_stone_sources.boss_polish_chance), 'one step tighter than Replace on the Elite half, and Replace own Boss half'],
        [STONE_NAME.reforge, '—', chance(E.loot.reforge_stone_sources.boss_reforge_chance), 'bosses only, on half the Corrupt chance — the bench spends it on the whole piece'],
        [STONE_NAME.rebirth, '—', chance(E.loot.rebirth_stone_sources.boss_rebirth_chance), 'bosses only, inside the same boss draw again (Corrupt ⊃ Reforge ⊃ Rebirth) — the widest press of the three, so the rarest stone'],
      ]);
    })(), 'Elite and Boss values are per kill.'),
    block('How many lines a piece can gain', `<code>craftedLines = droppedUnboundLines + successfulAdds − removals</code>; Add allows at most ${n0(E.item_level.mods_added_cap)} lifetime presses. Remove frees a slot but does not refund Add pricing history.`),
  ],
});

page({
  file: 'progression.html',
  nav: 'Progression',
  title: 'Progression',
  lead: `XP to next level = kills at that level × XP per kill. Skill, field-skill and Mastery tracks use separate XP curves.`,
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
    })()), '<code>XP to next = killsToLevel(L) × per_kill × min(L, mob_level_cap)</code>; <code>kills at own level = XP to next / XP per kill</code>. At the plateau, XP is fixed and mob XP still follows the level cap.'),
    block('Weapon Mastery', table(['Bonus', 'What it gives', 'Where it stops'], [
      ['While held', `−${pts((BASES.mastery as any).weight_discount_per_level_pct)} weapon weight a level`, `<code>weight_discount_cap_pct</code> ${pts((BASES.mastery as any).weight_discount_cap_pct)}`],
      ['Matching skill', `+${n1((BASES.mastery as any).skill_bonus_per_level_pct)}% skill damage a level from Mastery level ${n0((BASES.mastery as any).skill_bonus_from_level)}`, `full bonus · cap ${pts((BASES.mastery as any).skill_bonus_cap_pct)}`],
      ['Other skill', 'half the held weapon’s skill damage bonus', `cap ${pts((BASES.mastery as any).skill_bonus_cap_pct * (BASES.mastery as any).skill_bonus_off_type_mult)}`],
      ['Account-wide', `+${pts((BASES.mastery as any).drop_bonus_per_type_pct)} drop rate per weapon type once that type reaches Mastery ${n0((BASES.mastery as any).drop_bonus_level_required)}`, `across ${n0((BASES.weapons || []).length)} types — <code>mastery.dropMultiplier</code>`],
      ['The ladder', `${n0((BASES.mastery as any).xp_per_kill)} Mastery XP a kill, the same curve shape as the herb farm, capped at ${n0((BASES.mastery as any).level_cap)}`, '<code>engine/mastery.ts</code>'],
    ]), `<code>MasteryLevel = min(cap, floor(sqrt(XP / divisor)) + 1)</code>; <code>weightDiscount = min(cap, level × perLevel)</code>. Matching skills get full skill bonus; other skills get <code>full × offTypeMultiplier</code>.`),
    block('The passive tree', table(['Region', 'Normal', 'Notable', 'Keystone', 'Tree points'], treeNodes().regions.map((name: string) => [
      esc(name), wrap(n0(treeNodes().countsIn(name, 'normal'))), wrap(n0(treeNodes().countsIn(name, 'notable'))),
      wrap(n0(treeNodes().countsIn(name, 'keystone'))), wrap(n0(treeNodes().costOf(name))),
    ])), `Every node holds one rank and opens from any owned neighbour; Start is free and every region opens from it. A Normal grants exactly +1 of its region's Core attribute for 1 tree point. A Notable grants its written profile of flat and percent lines for 3 tree points. A Keystone changes a mechanic for 1 attainment point and never spends tree points. <code>treePoints = ${TREE_POINT_CURVE} + claimed quest bonuses − spent tree</code>; a Town task or Delivery offer carries a ${pts((QUEST_TREE_BONUS.chance ?? 0) * 100)} chance of +${n0(QUEST_TREE_BONUS.amount ?? 0)} tree point, rolled into the stored reward and paid only when the reward is actually claimed. Respec at a settlement is free and hands both wallets back at the prices the spec charged. The tree is a new character's: an older character is refused with its own message rather than rewritten.`),
    block('The Keystones', tabbedTable('tree-keystones', ['Keystone', 'Region', 'What it changes'], treeNodes().regions.map((region: string) => ({
      key: region,
      label: region,
      rows: treeNodes().keystones.filter((node: any) => node.wing === region)
        .map((node: any) => [esc(node.name || node.id), esc(node.wing), esc(node.description || '')]),
    }))), 'Each Keystone is bought with attainment and may be held with any other except the pairs below. The same text is on the board when a node is selected.'),
    block('Keystone pairs that cannot be held together', tabbedTable('tree-conflicts', ['Keystone', 'May not be held with'], (() => {
      const bySide = new Map<string, string[]>();
      for (const pair of treeNodes().pairs) {
        const rows = bySide.get(pair.a) || [];
        rows.push(pair.b);
        bySide.set(pair.a, rows);
      }
      return [{ key: 'pairs', label: 'Pairs', rows: [...bySide].map(([a, bs]) => [esc(keystoneName(a)), list(bs.map(keystoneName))]) }];
    })()), 'Exclusivity is pairwise only: a pair that is not listed may be held together, and there is no transitive chain — holding the middle Keystone does not block both ends.'),
  ],
});

page({
  file: 'elements.html',
  nav: 'Elements',
  title: 'Elements',
  lead: 'Every Element names the status its hits leave. A Species attacks with one Element and authors a separate resistance and weakness; no Element counters another. An Element declared ahead of its content reads a dash until its status and its skill rows land.',
  body: [
    block('Where an Element is resisted', table(['Element', 'Resisted by', 'Weak to'], E.elements.order.map((el: string) => [
      esc(el),
      list((E.mob.species || []).filter((sp: any) => sp.resistance.element === el).map((sp: any) => `${sp.name} ${n0(sp.resistance.pct)}%`)) || '—',
      list((E.mob.species || []).filter((sp: any) => sp.weakness.element === el).map((sp: any) => `${sp.name} +${n0(sp.weakness.taken_pct)}%`)) || '—',
    ])), `<code>resistance(Element) = min(resistanceCap, authored pct)</code>; a weakness multiplies that Element's damage taken by <code>1 + taken_pct / 100</code>. Every other Element meets 0% resistance. Bosses and Uniques inherit their Species profile.`),
    block('What each Element leaves behind', table(['Element', 'Its mark'], E.elements.order.map((e: string) => [
      esc(e), esc(E.elements.status_of?.[e]?.name || E.elements.status_of?.[e] || '—'),
    ])), '<code>status outcome = configured status effect</code>; resistance is applied to the Element damage before its status roll.'),
  ],
});

// ---------------------------------------------------------------- the player's other five questions
//
// Combat, survival, the bag, the walk and the finish line. These pages exist because a player asks
// them and nothing above answered them. Every figure is still a call or a read: `engine.DERIVED`, an
// `engine` function, `createRoad`, `createFarm`, or a field of `tools/data/*.json`. The prose names a
// key and never a number.

const S: any = (E as any).stat;
/** The even-split line the whole design is priced against, at the level cap. */
const EVEN = eng.statAt(S.level_cap);
const capCell = (v: any): string => (v === null || v === undefined ? '<span class="hy">no Cap</span>' : wrap(n0(v)));
const capOf = (key: string): string => capCell((E as any).caps?.[key]);
const row = (label: string, value: string, cap: string, reads: string): string[] =>
  [esc(label), value, cap, `<span class="hy">${reads}</span>`];

page({
  file: 'combat.html',
  nav: 'Combat',
  title: 'Combat',
  lead: 'One incoming hit resolves in a fixed order — avoidance, then Armour, then Elemental resistance, then a pool. Every number is the engine at the reference build (every point spent evenly across the seven Core attributes, level ' +
    wrap(n0(S.level_cap)) + '), so it is the line your own sheet is measured against, not a promise about it.',
  body: [
    block('The order a hit resolves', table(['Step', 'What it decides', 'Cap', 'What the reference build holds'], [
      row('Perfect dodge', '<code>rate = Lck × K_LCK_PDOGE × (1 + pct / 100)</code>; <code>chance = rate / (rate + K_PDOGE) × 100</code>',
        capOf('perfect_dodge'), `${pts(DV.perfect_dodge)} from ${n1(DV.pdogge_rate)} rating — <code>perfectDodgeChance</code>`),
      row('Evasion', '<code>r = max(0, rating)</code>; <code>effective = min(r, opening) × share + max(0, r − opening) × earnedMult</code>; chance = <code>min(cap, effective / (effective + Accuracy) × 100)</code>',
        capOf('evasion'), `${n1(eng.evasionRating(EVEN))} rating at the even split alone, before any gear line — <code>evasionRating</code>, <code>evasionChance</code>`),
      row('Block', '<code>chance = Block%</code>; a block reduces the hit by <code>Armour / 10</code>',
        capOf('block'), 'the Shield offhand&rsquo;s own line, plus the charges an Earth Wall grants — each charge cuts one hit by the same rule — <code>caps.block_note</code>'),
      row('Armour', '<code>cut = Armour / (Armour + armour_divisor × rawPhysical)</code>',
        '<span class="hy">no Cap on the rating</span>', `${n0(DV.armour_ceil)} — <code>armourOf</code> — removing ${pc1(DV.armour_vs_zone9_boss)} of a boss-priced hit and ${pc1(DV.armour_vs_zone9_trash)} of a trash-priced one (<code>armour_vs_zone9_boss</code>, <code>armour_vs_zone9_trash</code>)`),
      row('Elemental resistance', '<code>cut = min(resistanceCap, rawResistance × multiplier) / 100</code>',
        `${wrap(n0(E.caps.elem_res))} <span class="hy">or</span> ${wrap(n0(E.caps.elem_res_max))}`, `${pts(DV.res_three)} raw from three pieces, which <code>resistanceOf</code> then holds at the Cap — and <code>res_raw</code> is ${n0(DV.res_raw)}, because no Core attribute feeds it: it is a gear line alone. The current tree grants no Cap unlock, so the base Cap is the live one — <code>elemResCapOf</code>`),
      row('Energy Shield', '<code>MaxES = (Wis × K_WIS_ES + flat) × (1 + pct / 100)</code>; regen waits for the no-hit delay',
        '<span class="hy">no Cap</span>', `${n0(DV.es_pool)} pool, ${n1(DV.es_regen)} a second, a full pool back in ${n0(DV.es_recover_sec)} sec, worth ${pc1(DV.es_share_of_hp)} of your Health — <code>maxEsOf</code>, <code>esRegenOf</code>`),
      row('Health', '<code>MaxHP = (base + Vit × K_VIT_HP + hp_per_level × (L − 1) + flat) × (1 + pct / 100)</code>',
        '<span class="hy">no Cap</span>', `${n0(DV.hp)} — <code>DERIVED.hp</code>`),
    ]), '<code>Hit order: Perfect dodge → Evasion → Block → Armour → resistance → ES → HP</code>. Poison and bleed DoT bypass ES.'),
    block('Pools, reservations and Low Life', table(['', 'The rule', 'Read from'], [
      ['Full Max and usable', 'reservations lower the share healing and spending may reach, never the Max shown on the bar', `aura stakes, <code>35</code> at 25% Full HP and <code>34</code> at 40% Full Mana are fixed; the rest scale`],
      ['Low Life', `current HP at or below ${wrap(n0((tree as any).mechanics?.low_life_pct ?? 50))}% of Full Max HP; a reservation that lowers usable HP does not cause it`, '<code>tree.mechanics.low_life_pct</code>'],
      ['Chaos Inoculation', 'Max HP is 1 and chaos damage is fully prevented; damage the HP cannot take goes through Energy Shield, and the overflow to HP; HP cannot be reserved or paid', 'keystone <code>55</code> — never Low Life'],
      ['An aura&rsquo;s pool', 'each aura reserves Full Mana by default; with <code>54</code> an aura may reserve HP instead, which lowers usable HP only', 'reservation % of the aura&rsquo;s row'],
      ['Aura Resonance', 'with <code>64</code>, N active auras (trigger auras count) give <code>b = min(cap, per × N)</code>: each reserve ×<code>(1 − b)</code> and each aura effect ×<code>(1 + b)</code>', 'the discount and the effect are separate caps'],
      ['The combat clock', `progress is stored in ${wrap(n0((tree as any).mechanics?.combat_time_units_per_sec ?? 1))} units a second; a rate change never adds or rewinds a hit already accumulated`, '<code>tree.mechanics.combat_time_units_per_sec</code>'],
    ]), 'A reservation that would leave no usable pool is refused whole; turning every aura off is always available.'),
    block('Hit chance, both directions', table(['', 'The engine’s own names', 'The reference figure'], [
      ['You hitting a mob', '<code>hitChance = Accuracy / (Accuracy + MobEvasion)</code>',
        `${pc1(DV.hit_chance)} against the mean Species on a Medium body, which holds ${n1(DV.mob_evasion_ref)} Evasion`],
      ['A mob hitting you', '<code>evasionChance = min(cap, effectiveRating / (effectiveRating + attackerAccuracy) × 100)</code>, then avoidance',
        `you hold ${wrap(n0(DV.accuracy))} of accuracy yourself, so the same roll runs backwards on you`],
      ['Crit', '<code>pool = Lck × K_LCK_CRIT + flat; chance = min(pool, cap); damage = 100 + bonus + (pool − chance) × K_CRIT_OVERFLOW</code>',
        `${pts(DV.crit_chance)} chance · ${pts(DV.crit_dmg)} damage — anything the pool holds past what the chance line takes is spent on damage, never wasted`],
      ['Stun', '<code>chance = max(0, Alignment × K_STUN_PER_ALIGN + gearPct)</code>; stop = duration × (1 − VitRecovery / 100)',
        `${n1(eng.stunChanceFrom(DV.align_path))}% a hit · Vit lets you shake off ${pts(eng.stunRecoveryOf(EVEN))} of a mob’s stop time`],
    ]), '<code>hitChance = Accuracy / (Accuracy + Evasion)</code>; Evasion and Stun use their own caps (Stun has none).'),
    block('What shape of fight pays what', table(['Body', 'Health', 'Damage', 'Comes in', 'What a weapon does to it'],
      (E.mob.sizes || []).filter((s: any) => s.id !== 'boss').map((s: any) => {
        const lean = (Object.entries((E.weapon_size_mult as any).ladder || {}) as any[])
          .filter(([, v]: any) => Number(v[s.id]) !== 1)
          .map(([w, v]: any) => `${w === 'one-handed sword' ? 'sword' : w === 'one-handed axe' ? 'axe' : w} ×${n2(v[s.id])}`);
        return [esc(s.name), '<span class="hy">the curve</span>', `×${n1(s.ps)}`, esc(s.group),
          `<span class="hy">${lean.join(' · ') || 'every weapon meets it evenly'}</span>`];
      })),
      '<code>finalHit = mitigatedHit × (1 − physShare × (1 − weaponSizeMult))</code>. Only the physical share is scaled; Boss profiles choose the body class.'),
    block('The reach queue', table(['Weapon', 'Queue slots it may hit', 'Band'],
      Object.entries((E.mob.reach as any).weapons || {}).map(([w, slots]: any) => [
        esc(w), wrap(n0(slots)),
        esc(Object.entries((E.mob.reach as any).bands || {}).find(([, v]: any) => v === slots)?.[0] || '—'),
      ])),
      '<code>target slots = 1..weaponReach</code>. Melee waits for the front slot to close; ranged attacks keep their authored reach.'),
    block('Area, bolts and conversion', table(['Line', 'What it does', 'The number'], [
      ['Area damage', '<code>damage per target = hit × per_target_pct / 100</code>; targets come from reach slots',
        `${pts((E.aoe as any).per_target_pct)} each · ${wrap(n0((E.aoe as any).target_cap))} targets · ×${n2((E.aoe as any).mana_mult)} mana — <code>aoe</code>`],
      ['A bolt', '<code>bolt damage = finished hit × bolt_share_pct / 100</code>; it uses the attack clock',
        `${pts((E.weapon_size_mult as any).bolt_share_pct)} of a finished hit — <code>weapon_size_mult.bolt_share_pct</code> · <code>basicAttackOf</code>`],
      ['Conversion', '<code>converted Element = physical × min(total conversionPct, 100) / 100</code>; remainder stays physical',
        '<code>convertDamageOf</code> — the budget is the whole hit and overflow is wasted, never a multiplier'],
      ['Caster Max HP press', '<code>caster MaxHP × max_hp_pct / 100</code>, before skill/crit/weapon multipliers',
        '<code>max_hp_pct</code> — the caster pool is read'],
      ['Target Max HP press', '<code>target MaxHP × max_hp_pct_damage / 100</code>, then apply the Boss share',
        '<code>max_hp_press.boss_pct</code> — the row states the percent, this states the boss cut'],
    ]), '<code>max_hp_pct</code> reads caster MaxHP; <code>max_hp_pct_damage</code> reads target MaxHP. A magic weapon uses its bolt line.'),
    block('Bleed, the one damage-over-time that is not an Element', table(['', 'The rule', 'Read from'], [
      ['Who puts it on', 'the axe&rsquo;s own <code>Chance to bleed %</code> line, or a press whose row grants the proc', '<code>bleed.note</code> &mdash; no curse carries it any more'],
      ['What lets it land', 'bleed is a rolled status, so it passes the same Alignment gate a stun does <em>before</em> its own chance is rolled', '<code>bleedChanceFrom</code> · <code>K_BLEED_CHANCE</code> · the axe&rsquo;s line'],
      ['Does it stack', yes((E.bleed as any).stacks), `<code>bleed.stacks</code> — a new application ${((E.bleed as any).refreshes) ? 'refreshes the duration instead' : 'does not refresh it'}`],
      ['Is it an Element', yes((E.bleed as any).is_element), '<code>bleed.is_element</code> — Elemental resistance does not answer it'],
      ['Can it crit', yes((E.bleed as any).can_crit), '<code>bleed.can_crit</code>'],
      ['Does Armour shrink it', yes((E.bleed as any).affected_by_armour), '<code>bleed.affected_by_armour</code> — its DoT bypasses Energy Shield; healing can recover the Health it spends'],
      ['What it scales with', 'the physical of one hit, not your swing count', '<code>bleed.note</code> — a slow heavy weapon is the bleed build'],
      ['On the mob side', 'the heavy physical lineages put bleed on us out of the damage they are already priced at', '<code>bleed.mob_side</code> — no extra power, so no health line moves'],
    ]), `<code>Bleed total = landedPhysicalHit × K_BLEED</code>; <code>Bleed DPS = total / bleed_time_sec</code>. Chance = axe line + curse proc, capped at 100%.`),
    block('Elite, Unique and Boss', table(['Rank', 'HP', 'DPS', 'Spawn'], [
      ['Elite', `<code>BaseHP(L, Variant Core) × ${xOf((E.mob.elite as any).hp)}</code>`,
        `<code>mobPsAt(L) × ${xOf((E.mob.elite as any).ps)} / zoneBodyFactor × speciesPsMult</code>`, `${pc1((E.loot as any).elite_spawn_chance)} of kills`],
      ['Boss', `<code>BaseHP(L, Boss Core)</code>`,
        `<code>mobPsAt(L) × ${xOf((E.mob.sizes.find((s: any) => s.id === 'boss') || {} as any).ps)} / zoneBodyFactor × profilePsMult</code>`,
        `${n1((E.loot as any).boss_per_hour)} an hour · online only`],
      ['Unique', `<code>BaseHP(zoneTop, Unique Core)</code>`,
        `<code>mobPsAt(zoneTop) × ${xOf((E.mob.sizes.find((s: any) => s.id === 'boss') || {} as any).ps)} / zoneBodyFactor × profilePsMult</code>`,
        `${pc1((E.loot as any).unique_chance)} of spawns`],
    ]), `<code>BaseHP(L, Core) = mobHpAt(L) + hp_per_level × (L − 1) + Core.VIT × K_VIT_HP</code>. <code>speciesPsMult</code> is profile power ÷ zone-mean species power; profile power = <code>power_base + K_MOB_PS_STAT × (wPhys × STR + wMagic × INT)</code>. L is the Species zone level; Unique replaces a normal spawn at zone top level. Boss and Unique have no extra HP multiplier. XP multipliers: Elite ×${n0(E.xp.elite_mult)} · Boss ×${n0(E.xp.boss_mult)} · Unique ×${n0(E.xp.unique_mult)}.`),
  ],
});

page({
  file: 'survival.html',
  nav: 'Survival',
  title: 'Survival, field skills and provisions',
  lead: 'HP, Mana and Energy Shield use separate Core formulas. Fieldwork, Hunger and food use the rates below.',
  body: [
    block('The pools', table(['Pool', 'What it is', 'Full at the reference build', 'How it comes back'], [
      ['Health', 'the pool every avoidance layer protects', wrap(n0(DV.hp)), `${n1(eng.hpRegenOf(EVEN))} a second off the Vit line — <code>hpRegenOf</code>`],
      ['Mana', 'the pool Mana-cost skills spend from; HP-cost skills debit the current HP pool, while auras reserve Max Mana', wrap(n0(DV.mana)),
        `${n1(DV.mana_regen)} a second, so an empty pool refills in ${n0(DV.pool_regen_sec)} sec — <code>manaRegenOf</code>`],
      ['Energy Shield', 'the caster’s second pool, spent before Health, and player-only', wrap(n0(DV.es_pool)),
        `${n1(DV.es_regen)} a second, but only once ${n0((E.energy_shield as any).delay_sec)} sec have passed without a hit — <code>esRegenOf</code>`],
    ]), `<code>MaxHP = (hp_base + Vit × K_VIT_HP + hp_per_level × (L − 1) + flat) × (1 + pct / 100)</code>; <code>MaxMana = (mana_base + Int × K_INT_MP + mp_per_level × (L − 1) + flat) × (1 + pct / 100)</code>; <code>MaxES = (Wis × K_WIS_ES + flat) × (1 + pct / 100)</code>.`),
    block('Your combat readout', '<p>The You card shows HP, Energy Shield, Mana and combat feedback. Objectives shows the run target and tracked Delivery wants; Chronicle records combat and loot.</p>'),
    block('What a Push costs', `<ul class="fx">
      <li><span class="fk">There is no death.</span><span class="fs">rule</span><span class="fv">a fight you lose rests you at camp and costs time only</span></li>
      <li><span class="fk">A Push on the walk is the ordinary Push.</span><span class="fs">rule</span><span class="fv">with a Field Camp in this zone, recovery returns there and ends the walk; otherwise the route resumes at its ambush block (<code>road.push_rule</code>)</span></li>
      <li><span class="fk">A dungeon run forfeits its escrow.</span><span class="fs">rule</span><span class="fv">the one place a Push costs loot — <a href="world.html">World</a></span></li>
      <li><span class="fk">Your preset goes back to the main one.</span><span class="fs">rule</span><span class="fv">and a cooldown already counting keeps counting (<code>presets.cooldowns_persist_on_push</code>)</span></li>
      <li><span class="fk">A broken piece contributes nothing.</span><span class="fs">rule</span><span class="fv">the Armourer clears it and refills protection — <a href="crafting.html">Crafting</a></span></li>
    </ul>`),
    block('Field Camp and life skills', table(['Skill', 'Field site', 'What it yields'], [
      ['Mining', `wild-side index ${n0((E.fieldwork as any).wild_site_index.mine)}`, `${n0((E.fieldwork as any).actions.mine.yield)} ore every ${n0((E.fieldwork as any).actions.mine.interval_sec)} sec · rich-vein chance scales with Mining and Mine Mastery`],
      ['Woodcutting', `wild-side index ${n0((E.fieldwork as any).wild_site_index.grove)}`, `${n0((E.fieldwork as any).actions.grove.yield)} timber per action · rarewood and herb chances scale with Woodcutting and Grove Mastery`],
      ['Hunting', 'bare field hexes', `raw meat and lineage provision chances and quantities scale with Hunting and each lineage’s Mastery`],
      ['Fishing', 'Field Camp in a zone with an authored fishing source', `${n0((E.fieldwork as any).fishing.yield)} catch of ${(E.fieldwork as any).fishing.foods.map((id: string) => fieldwork.foodById[id]?.name || id).join(' or ')} every ${n0((E.fieldwork as any).fishing.interval_sec)} sec`],
      ['Smithing', 'safe and idle at a settlement', (E.fieldwork as any).smithing_recipes.map((recipe: any) => `${esc(recipe.name)} · ${Object.entries(recipe.materials).map(([id, count]) => `${count} ${fieldwork.materialById[id]?.name || id}`).join(' + ')}`).join(' · ')],
      ['Cooking', 'active Field Camp', 'turn raw food, fruit, edible herbs and ingredients into timed combat meals'],
    ]), `Camp relocation after the free moves costs ${n0((E.fieldwork as any).camp.relocate_ore)} ore + ${n0((E.fieldwork as any).camp.relocate_timber)} timber. Field Skill XP and Mastery are separate tracks.`),
    block('Camp encounters', `<p>A Field Camp can draw one encounter at a time while you stand at it, online, not hunting and not already in a fight. Each character keeps its own seeded Camp stream: the encounter, its offers and its prepared group are frozen when it appears, so previewing it, refusing it, reloading and going offline never reroll it. The warning, the choice and Camp exposure run on credited online time only.</p>`
      + table(['Encounter', 'What it is', 'What you can do'], [
        ['Sounds', 'a noise just off the Camp', 'Investigate surveys the Camp and its neighbours once and shows the prepared group, then you Fight or Withdraw; Stay quiet lets it pass'],
        ['Prowler', 'a silhouette at the fire', 'Fight the prepared normal group, or Secure supplies and wait it out with your work stopped and nothing deducted'],
        ['Traveler', 'a traveller at the fire', 'Listen for news, which surveys the blocks around you; Trade provisions for ore or timber; or Decline'],
        ['Nest', 'a nest at the worksite', 'mining and woodcutting stop while it is there; Clear it with one normal fight or wait it out — no nest record survives it'],
        ['Herd', 'tracks toward a scouted Expedition subzone', 'Follow starts an ordinary walk and an ordinary hunt on arrival; nothing is reserved and no task is credited'],
        ['Injured', 'a traveller from the Camp’s settlement', 'give provisions or one ordinary HP draught for one-time Standing credit, or Decline'],
        ['Discovered', 'your Camp has been found', 'Fight, Shelter through the warning, or move the Camp by the ordinary relocation'],
      ])
      + `<p>The Camp policy decides what happens when you do not answer:</p>`
      + table(['Policy', 'What it does'], [
        ['Avoid fights', 'the work stops and you shelter through the warning and the choice, then the threat passes'],
        ['Defend Camp', 'you fight only when the warned threat reaches the Camp at the end of the choice'],
        ['Engage early', 'you start the prepared fight as soon as the warning ends, before the threat reaches the fire'],
      ])
      + `<p>An encounter fight is an ordinary normal group from the Camp’s own zone: no Elite, no Unique, no extra reward, and the ordinary per-kill drop still pays. Walking, warping, relocating the Camp or leaving to hunt ends the offer once; what you already earned stays earned, and a policy never spends, trades or follows for you. Camp exposure grows while you camp and fades while you are away, and moving the tent does not clear it.</p>`
      + `<code>check every ${n0((E.fieldwork as any).camp_encounters.check_interval_sec)} sec</code> · <code>grace ${n0((E.fieldwork as any).camp_encounters.arrival_grace_sec)} sec</code> · <code>chance ${pc1((E.fieldwork as any).camp_encounters.chance_per_check)}</code> · <code>warning ${n0((E.fieldwork as any).camp_encounters.warning_sec)} sec</code> · <code>choice ${n0((E.fieldwork as any).camp_encounters.choice_sec)} sec</code> · <code>quiet ${n0((E.fieldwork as any).camp_encounters.cooldown_sec)} sec</code> · <code>exposure ${n0((E.fieldwork as any).camp_encounters.exposure_threshold_sec)} sec</code>`),
    block('Field-skill progression', table(['Progress', 'Benefit', 'Read from'], [
      ['Harvest milestones', `+${n0((E.fieldwork as any).progression.harvest_bonus_per_level)} unit per action at Skill levels ${list((E.fieldwork as any).progression.harvest_bonus_levels)}`, '<code>fieldwork.progression.harvest_bonus_*</code>'],
      ['Field drop rate', `+${n1((E.fieldwork as any).progression.drop_rate_bonus_per_skill_level_pct)}% per Skill level after 1 and +${n1((E.fieldwork as any).progression.drop_rate_bonus_per_mastery_level_pct)}% per resource Mastery level after 1, up to +${n0((E.fieldwork as any).progression.drop_rate_bonus_cap_pct)}%`, '<code>fieldwork.progression.drop_rate_bonus_*</code>'],
    ]), `<code>harvest quantity = base yield + reached milestones × bonusPerMilestone</code>. <code>drop chance = min(1, base chance × (1 + capped Skill/Mastery bonus))</code>; gear and stone chances are unchanged.`),
    block('Food drops from hunts', table(['Lineage', 'Provision', 'Chance', 'Quantity'],
      ((E.fieldwork as any).hunt.food_drops || []).map((drop: any) => [
        esc(drop.species.join(' · ')),
        esc((E.fieldwork as any).foods.find((food: any) => food.id === drop.food_id)?.name || drop.food_id),
        pc1(drop.chance), `${n0(drop.min)}–${n0(drop.max)}`,
      ])),
      '<code>Expected provision per kill = chance × average(quantity range)</code>. Each lineage roll is separate from the raw-meat roll.'),
    block('Ore and timber from kills', table(['Lineage', 'Material', 'Chance', 'Quantity'],
      ((E.fieldwork as any).hunt.material_drops || []).map((drop: any) => [
        esc(drop.species.join(' · ')),
        esc(drop.resource),
        pc1(drop.chance), `${n0(drop.min)}–${n0(drop.max)}`,
      ])),
      '<code>Expected material per kill = chance × average(quantity range)</code>. Mine and Grove actions use their own harvest formulas.'),
    block('Hunger and provisions', table(['Food', 'Kind', 'Hunger restored', 'Source'],
      fieldwork.foods.map((food: any) => [
        esc(food.name), esc(food.kind), food.edible ? `+${n0(food.hunger_restore)}` : 'cooking ingredient', esc(food.source || '—'),
      ])),
      `<code>Hunger(t) = max(0, Hunger₀ − configured drain × elapsed time)</code>. At zero Hunger, HP regen ×${n2(1 - (E.fieldwork as any).hunger.empty_hp_regen_cut_pct / 100)}; ES recharge is unchanged. Auto Eat threshold: ${n0((E.fieldwork as any).hunger.auto_eat.threshold_default)}%.`),
    block('Camp kitchen menu', table(['Menu', 'Dish', 'Cooking level', 'Ingredients', 'Hunger and timed effect'],
      ((E.fieldwork as any).recipes || []).map((recipe: any) => {
        const foods = Object.entries(recipe.foods).map(([id, amount]) =>
          `${n0(amount)} ${(E.fieldwork as any).foods.find((food: any) => food.id === id)?.name || id}`);
        const materials = Object.entries(recipe.materials).map(([id, amount]) => `${n0(amount)} ${id}`);
        const herbs = Object.entries(recipe.herbs).map(([tier, amount]) => `${n0(amount)} ${tier} herb`);
        const menu = recipe.menu === 'hearth' ? 'Hearth' : 'Wild forage';
        return [esc(menu), esc(recipe.name), n0(recipe.level), esc([...foods, ...materials, ...herbs].join(' · ') || '—'),
          `+${n0(recipe.hunger_restore)} Hunger · ${n0(recipe.duration_sec / 60)} min · +${n0(recipe.damage_pct)}% damage · +${n1(recipe.hp_regen_pct)}% Max HP regen/sec`];
      })),
      '<code>Hunger after meal = min(HungerCap, Hunger + hunger_restore)</code>. A new meal replaces the active meal buff; capacity is checked before ingredients are spent.'),
    block('Potions', table(['Draught', 'Pool', 'Band', 'Effect', 'Brewed from'],
      ((E.potions as any).list || []).map((p: any) => [
        esc(p.name), p.pool === 'both' ? 'HP + Mana' : esc(p.pool), esc(p.tier),
        wrap(p.pool === 'both'
          ? `${n0(farm.potionPct(p, 'hp'))}% Max HP + ${n0(farm.potionPct(p, 'mana'))}% Max Mana, instantly`
          : `${n0(farm.potionEffect(p))}% of the pool, instantly`),
        `<span class="hy">${n0((E.potions as any).craft[p.tier].herbs)} herbs + ${n0((E.potions as any).craft[p.tier].reroll_value_stones)} ${STONE_NAME.reroll_value}s</span>`,
      ])),
      `<code>pool restored = MaxPool × potionPct / 100</code>. One shared ${n0((E.potions as any).shared_cooldown_sec)} sec cooldown; cap ${n0((E.potions as any).max_uses_per_fight)} uses per fight. Boss use: ${String((E.potions as any).boss_suppressed)}.`),
    block('Condensed', table(['', 'What it takes', 'What it gives'], [
      ['A Condensed draught', `${n0((E.potions as any).condensed.cost_bottles)} bottles + ${n0((E.potions as any).condensed.cost_reroll_value_stones)} ${STONE_NAME.reroll_value}s`,
        `×${n0((E.potions as any).condensed.effect_mult)} effect, at ${n0((E.potions as any).condensed.weight)} weight (${n0((E.potions as any).condensed.weight_loose)} carried loose)`],
    ]), `<code>condensed effect = base effect × ${n0((E.potions as any).condensed.effect_mult)}</code>; weight = ${n0((E.potions as any).condensed.weight)}.`),
    block('The herb farm', table(['', 'The number', 'Read from'], [
      ['Plots', `${n0((E.farm as any).plots.base)} to start, ${n0((E.farm as any).plots.shop_deeds)} bought, ${n0(farm.plotsMax)} at most`, '<code>farm.plots</code>'],
      ['A grow', `${n1(farm.growthSec / 3600)} hours, then ${n0((E.farm as any).yield_per_harvest)} herbs`, '<code>farm.growth_hours</code> · <code>farm.yield_per_harvest</code>'],
      ['A replant', `${n0(farm.seedCostHerbs)} herb of the harvest goes back into the ground`, '<code>farm.seed_cost_herbs</code>'],
      ['A day', `${n0((E.farm as any).taps_per_day)} taps, and up to ${n1(farm.offlineCapSec / 3600)} hours of growth are paid while you are away`, '<code>farm.taps_per_day</code> · <code>farm.offline_cap_hours</code>'],
      ['A level', `cap ${n0((E.farm as any).level_cap)} · ${n0((E.farm as any).xp_per_harvest)} XP a harvest · the same curve as Weapon Mastery`, '<code>farm.level_*</code>'],
      ['Which draughts open', `low from ${n0((E.farm as any).tier_unlock_level.low)} · mid from ${n0((E.farm as any).tier_unlock_level.mid)} · high from ${n0((E.farm as any).tier_unlock_level.high)}`, '<code>farm.tier_unlock_level</code>'],
    ]), `<code>farmLevel = min(cap, floor(sqrt(XP / level_divisor)) + 1)</code>; <code>XP for level L = (L − 1)² × level_divisor</code>.`),
    block('Herbs from the ground versus herbs from a fight', table(['Zone band', 'A bundle a kill', 'A bundle holds', 'A brewable draught a kill'],
      QUAL_BANDS.map((b: string) => [
        esc(b), pc1(farm.herbChance(b)), `${n0((E.herbs as any).bundle_min)}-${n0((E.herbs as any).bundle_max)} herbs`, pc1(farm.potionDropChance(b)),
      ])),
      '<code>expected herbs per kill = bundleChance × average(bundle size)</code>; the low band chance is 0.'),
  ],
});

page({
  file: 'idle.html',
  nav: 'Away & bag',
  title: 'Away, and what you can carry',
  lead: `Away time paid = min(elapsed away, ${n0((E.inventory as any).offline_cap_hr)} hours). Away gear uses the band’s floor Item level; loot is not auto-converted.`,
  body: [
    block('While the window is shut', table(['', 'The number', 'Read from'], [
      ['How long it keeps paying', wrap(n0((E.inventory as any).offline_cap_hr)) + ' hours', '<code>inventory.offline_cap_hr</code>'],
      ['The farm while away', wrap(n1(farm.offlineCapSec / 3600)) + ' hours', '<code>farm.offline_cap_hours</code>'],
      ['Snapshots', `${n0((E.save as any).snapshot_slots)} walking copies, one every ${n0((E.save as any).snapshot_interval_min)} minutes`, '<code>save.snapshot_*</code>'],
      ['What else writes one', list((E.save as any).snapshot_triggers || []), '<code>save.snapshot_triggers</code> — a level up, and a successful Ascend or Refine'],
    ]), `<code>snapshot count = snapshot_slots</code>; periodic interval = <code>snapshot_interval_min</code>. Restore rolls the whole account back to that snapshot.`),
    block('What away rolls at', table(['Zone band', 'Its Item-level window', 'Away drop band', 'Away Item level'],
      (E.item_level.spans || []).map((sp: any) => [
        `${esc(sp.band)} ${n0(sp.from)}-${n0(sp.to)}`, `<span class="hy">${n0(sp.from)}-${n0(sp.to)}</span>`,
        esc(sp.band), wrap(n0(eng.floorLevelOf(sp.band))),
      ])),
      '<code>awayItemLevel = floorLevelOf(zoneBand)</code>. Online drops use the mob level.'),
    block('The streams an Elite or a Boss owns', table(['Stone or piece', 'Every kill', 'An Elite', 'A Boss'], [
      [STONE_NAME.tier, `${n0(E.salvage.alchemy.outputs_per_tier_stone)} eligible Value from Alchemy`, wrap(n2((E.loot as any).elite_tier_stones)), wrap(n0((E.loot as any).boss_tier_stones))],
      [STONE_NAME.reroll_value, 'via Alchemy — one per dissolved piece’s Scrap', '<span class="hy">same</span>', '<span class="hy">same</span>'],
      [STONE_NAME.add, 'never', pc1((E.loot as any).elite_add_stone_chance), wrap(n0((E.loot as any).boss_add_stones))],
      ['Quality', pc1((E.loot as any).quality_stone_sources.monster_quality_chance), pc1((E.loot as any).quality_stone_sources.elite_quality_chance),
        wrap(n0((E.loot as any).quality_stone_sources.boss_quality_stones))],
      ['Repair', 'never', pc1((E.loot as any).repair_stone_sources.elite_repair_chance), wrap(n0((E.loot as any).repair_stone_sources.boss_repair_stones))],
      ['Replace', 'never', pc1((E.loot as any).replace_stone_sources.elite_replace_chance), pc1((E.loot as any).replace_stone_sources.boss_replace_chance)],
      ['Imprint', 'never', pc1((E.loot as any).imprint_stone_sources.elite_imprint_chance), wrap(n0((E.loot as any).imprint_stone_sources.boss_imprint_stones))],
      ['Corrupt', 'never', 'never', pc1((E.loot as any).corrupt_stone_sources.boss_corrupt_chance)],
      ['A skill piece', pc1((E.skill_drop as any).normal), pc1((E.skill_drop as any).elite), pc1((E.skill_drop as any).boss)],
    ]), '<code>expected stones per hour = killsPerHour × rankSpawnRate × stoneChance</code>; fixed Boss income = <code>bossesPerHour × stonesPerBoss</code>. Alchemy adds Value/Tier output from Scrap.'),
    block('The bag', table(['Carried', 'Slots', 'What goes in it', 'How it stacks', 'What it weighs'], [
      ['The bag', wrap(n0((E.inventory as any).character_slots)), 'everything you carry on the hunt: gear loot, and stones, herbs, potions, field materials and provisions',
        `gear one piece a slot · stones ${n0((E.inventory as any).stack_size.stone)} a slot · herbs and potions ${n0((E.inventory as any).stack_size.herb)} · materials ${n0((E.inventory as any).stack_size.material)} · provisions ${n0((E.inventory as any).stack_size.food)} a slot`,
        `gear each piece · stones weightless (${n2((E.inventory as any).unit_weight.stone)}) · herbs and potions ${n2((E.inventory as any).unit_weight.herb)} · materials ${n2((E.inventory as any).unit_weight.material)} · provisions ${n2((E.inventory as any).unit_weight.food)} each`],
      ['Gold', 'no slot at all (<code>gold_uses_slot</code>)', 'the junk money', '—', '—'],
      ['Junk', `${n0((E.junk as any).stack)} a slot`, 'what the Counterhand buys', 'deep stacks, and it shares the bag', `${n2((E.junk as any).unit_weight)} each`],
    ]), `<code>usedSlots = gearPieces + ceil(stones / ${n0((E.inventory as any).stack_size.stone)}) + ceil(herbsAndPotions / ${n0((E.inventory as any).stack_size.herb)}) + ceil(materials / ${n0((E.inventory as any).stack_size.material)}) + ceil(food / ${n0((E.inventory as any).stack_size.food)}) + ceil(junk / ${n0((E.junk as any).stack)})</code>. Pickup succeeds only if the complete output bundle fits.`),
    block('Weight', table(['Carried', 'The cut to your attack speed', 'Read from'], [
      ['Your capacity', wrap(n1(eng.weightCapacityOf(EVEN))) + ' at the even split — Str is the only line that lifts it', '<code>weightCapacityOf</code>'],
      ['At capacity or under', `${pc1(eng.encumbranceOf(eng.weightCapacityOf(EVEN), EVEN))} cut`, '<code>encumbranceOf</code>'],
      ['A tenth over', `${pc1(eng.encumbranceOf(eng.weightCapacityOf(EVEN) * 1.1, EVEN))} cut`, '<code>encumbranceOf</code>'],
      ['Half again over', `${pc1(eng.encumbranceOf(eng.weightCapacityOf(EVEN) * 1.5, EVEN))} cut, and that is the bound — <code>caps.weight_overload</code> is where the tax stops climbing`, '<code>encumbranceOf</code>'],
    ]), `<code>usedWeight = Σ(itemCount × unitWeight) + Σ(gearWeight)</code>; <code>encumbrance = min(weight_overload_cap, max(0, (usedWeight − capacity) / capacity))</code>; <code>ASPD = baseASPD × (1 − encumbrance)</code>. Mastery reduces held weapon weight by ${pts((BASES.mastery as any).weight_discount_per_level_pct)} per level up to its cap.`),
    block('The bag filter', table(['Line', 'What it does', 'The number'], [
      ['Upgrade margin', 'keeps a piece only when it beats what you wear in the same slot by more than noise', wrap(pts((E.loot as any).filter.upgrade_margin_pct))],
      ['Keep a missing Element', 'keeps Elemental resistance of an Element you do not hold', yes((E.loot as any).filter.rules.default_keep_missing_element)],
      ['On by default', 'a fresh character keeps every drop and dissolves nothing', yes((E.loot as any).filter.rules.default_enabled)],
      ['Stored per slot', 'a player setting, so a raised threshold is never a second copy of the number', '<span class="hy"><code>loot.filter.rules</code></span>'],
    ]), `<code>score(item) = Σ(weight(Mod) × value / Mod.max)</code>. Keep if <code>score &gt; wornScore × (1 + margin)</code> or it carries an uncovered Element; otherwise dissolve when filtering is enabled.`),
    block('Junk: reference values', table(['Junk kind', 'Base value', 'A kill pays it', 'Expected base gold a kill'],
      Object.entries((E.junk as any).rarities || {}).map(([r, v]: any) => [
        esc(r), wrap(`${n0(v.sell_gold)} gold`), pc1(v.drop_chance_per_kill), wrap(n2(v.sell_gold * v.drop_chance_per_kill)),
      ])),
      '<code>expected base gold per kill = sellGold × rarityDropChance</code>. Actual gold is the town quote at current category demand.'),
  ],
});

page({
  file: 'travel.html',
  nav: 'Travel',
  title: 'Travel and the Waypoint',
  lead: '<code>blocks = (|Δq| + |Δr| + |Δq + Δr|) / 2</code>; <code>walk time = blocks × block_sec</code>.',
  body: [
    block('One block', table(['', 'The number', 'Read from'], [
      ['Time', wrap(n0(road.blockSec)) + ' sec a block', '<code>road.block_sec</code>'],
      ['An encounter a block', pc1(road.encounterChance()), '<code>road.encounter_chance_pct</code>'],
      ['A trail event a block', pc1((E.fieldwork as any).travel_events.chance_per_block), 'an independent local-food or rest roll; it never replaces the encounter roll'],
      ['What ambushes you', 'an ordinary mob group from the lower of the two zones the walk joins, at each Species’ fixed zone level and at the pack of the side it walks onto', '<code>road.encounter_rule</code> · <code>mob.species[].zone_levels</code>'],
      ['What it pays', 'the ordinary per-kill drop roll and nothing else', '<code>road.encounter_rule</code> — no purse, no chest, no Standing, no stone'],
      ['Losing one', 'a same-zone Field Camp receives you and ends the walk; without one, recover and resume at the ambush block', '<code>road.push_rule</code>'],
      ['Forward', 'walks to the next already-open settlement when the current zone’s level band is behind', '<code>travel = forward</code> · online only'],
      ['Patrol', `${n0(E.road.patrol.max_stops)} subzones · ${n0(E.road.patrol.groups_per_stop)} groups per stop`, 'choose the order; repeat or stop whenever you want'],
      ['Auto-Return', `${n0(E.road.patrol.auto_return_threshold_pct)}% of the bag's slots used`, 'stashes unlocked gear at town and resumes Patrol if space was freed'],
    ]), '<code>blocks = hexDistance</code>; <code>walkSeconds = blocks × block_sec</code>; <code>P(at least one encounter) = 1 − (1 − chancePerBlock)^blocks</code>. Patrol changes the active subzone pool.'),
    block('The map journal and trail sites', `<p>Approaching a block scouts its landmark, creatures and supplies. Standing on it records it as explored. The journal survives saving; offline time does not explore a route. Older saves retain their known settlements and current position.</p><p>Authored trail sites can be investigated once per character after walking there. Abandoned Camps restore Hunger, Provision Caravans offer the region's food, and Hunting Tracks survey nearby blocks. A full food bag leaves a caravan available. Investigation stops hunting and cannot run during travel, recovery, a dungeon or an active fight. Setting or relocating Field Camp also requires a clear field. Both actions pause Patrol without clearing its itinerary. Sites add no currency, stones, XP or loot-RNG draws.</p><p>Patrol still uses its existing stop and group rules. The map's numbered flags show the selected order; offline hunting stays at the current stop. Field Camp scenery follows the active gathering activity, while visited settlements display their earned Standing.</p>`),
    block('Every settlement, from the start', (() => {
      const start: any = (TOWN.settlements || []).find((s: any) => s.start) || (TOWN.settlements || [])[0];
      const warp: any = (TOWN.repeatable || []).find((l: any) => l.id === 'waypoint_warp') || { m_per_block: 0 };
      const rows = (TOWN.settlements || [])
        .filter((s: any) => s.id !== start.id)
        .map((s: any) => ({ s, blocks: road.blocksBetween(start.id, s.id) }))
        .sort((a: any, b: any) => a.blocks - b.blocks)
        .map(({ s, blocks }: any) => [
          `${esc(s.name)}${s.capital ? ' <span class="tag">capital</span>' : ''}`, wrap(n0(s.zone)), esc(s.band),
          wrap(n0(blocks)), wrap(n1(road.secBetween(start.id, s.id) / 60)) + ' min',
          goldAt((warp as any).m_per_block * blocks, s.band),
        ]);
      return table(['Settlement', 'Zone', 'Item quality band', 'Blocks from ' + esc(start.name), 'On foot', 'A warp back there, in gold'], rows);
    })(), '<code>warpGold = roundConfigured(max(1, blocks) × m_per_block × goldPerMinute(destinationBand))</code>; <code>blocks = (|Δq| + |Δr| + |Δq + Δr|) / 2</code>.'),
    block('The Waypoint', table(['', 'The rule', 'Read from'], [
      ['Earning one', 'arriving on foot, once', '<code>road.waypoint_rule</code>'],
      ['What it reaches', 'any settlement you have already walked to', '<code>road.waypoint_rule</code>'],
      ['What it never does', 'gate a zone — no gold opens a Waypoint the foot has not earned', '<code>road.waypoint_rule</code>'],
      ['Where the price lives', 'the destination band’s rate, not a seller’s markup', `<code>town.json waypoint_warp</code> · <code>engine.goldPerMinute</code>`],
      ['Later', 'a Waystone will be a second destination kind on the same rule', '<code>road.waypoint_rule</code>'],
    ]), `<code>blocks = (|Δq| + |Δr| + |Δq + Δr|) / 2</code>. Every lattice cell is walkable; a Waypoint requires a settlement first reached on foot.`),
  ],
});

page({
  file: 'builds.html',
  nav: 'Builds',
  title: 'Builds, skill pieces and the finish line',
  lead: '<code>TTK = target HP / build DPS</code>. Skill duplicates, damage and effect levels use separate progress curves.',
  body: [
    block('Finding a skill', table(['From', 'A skill piece a kill', 'What it means'], [
      ['A normal mob', pc1((E.skill_drop as any).normal), 'the slow path — a skill is a find, not a purchase'],
      ['An Elite', pc1((E.skill_drop as any).elite), `about ${n0(Math.round((E.skill_drop as any).elite / (E.skill_drop as any).normal))}× the normal rate`],
      ['A Boss', pc1((E.skill_drop as any).boss), 'the only place duplicates come thick, and the only place a Boss fight is open to you'],
    ]), '<code>skill drop = per-rank chance per kill</code>, independent of gear and stone rolls. See <a href="skills.html">Skills</a> for the roster.'),
    block('The duplicate ladder', table(['Step', 'Cooldown reduction it buys', 'Duplicates for the step', 'Duplicates to reach it'],
      (sm.LADDER as any[]).map((l: any) => [
        wrap(n0(l.step)), pts(l.cdr), wrap(n0(l.cost)), wrap(n0(sm.ladderCostToStep(l.step))),
      ])),
      `<code>duplicatesToStep = Σ ladder.cost through step</code>. Skill level XP is earned per kill while active; ladder CDR and skill-level effects are independent.`),
    block('What an aura holds back', table(['Aura', 'Reserve tier', 'Mana it holds open', 'What it writes'],
      sm.of('aura').map((a: any) => [
        esc(a.name), esc(a.reserve), wrap(`${n0(sm.reservePct(a.reserve))}%`),
        `<span class="hy">${esc(a.effect || '')}</span>`,
      ])),
      `<code>availableMana = MaxMana × (1 − Σ active reservePct / 100)</code>; total reserve is capped at ${n0(sm.RESERVATION_LIMIT)}%. Skill costs use their own level formula.`),
    block('Presets', table(['', 'The number', 'Read from'], [
      ['Sets you can store', wrap(n0((E.presets as any).sets)), '<code>presets.sets</code>'],
      ['Which one is main', `index ${n0((E.presets as any).main_index)}`, '<code>presets.main_index</code> — where a Push sends you back'],
      ['Auto-select by zone', yes((E.presets as any).auto_select_by_zone), 'the game switches on its own as you climb'],
      ['Cooldowns across a Push', yes((E.presets as any).cooldowns_persist_on_push), 'a bar already counting keeps counting'],
    ]), 'Keys are client settings, not character state — a preset is a loadout, never a key map. A preset activates only owned skills and obeys the same aura reservation limit as the Skills screen.'),
    block('The two builds every published number is measured on', table(['', 'Physical', 'Magic', 'Elemental', 'Alignment'],
      Object.entries(EREF).map(([k, v]: any) => [
        esc(k), wrap(n0(v.phys)), wrap(n0(v.magic)), wrap(n0(v.elem)), wrap(n1(v.align)),
      ])),
      `<code>TTK = target HP / DPS</code>. Reference at level ${n0(EREFERENCE.anchorLevel)}: ${n0(EREFERENCE.line.dps)} DPS evenly split (${n1(EREFERENCE.ttk)} sec) vs ${n0(EREFERENCE.focused.dps)} focused (${n2(EREFERENCE.focusedTtk)} sec).`),
    block('The finish line', table(['Level', 'Kills to reach it', 'What it is'], [
      ...Object.entries((eng as any).CHECKPOINTS_KILLS || {}).map(([k, v]: any) => {
        const lv = Number(String(k).split('_')[1]);
        return [esc(`level ${n0(lv)}`), wrap(n0(v)),
          lv === S.level_cap ? 'the level Cap' : lv === S.paragon_from - 1 ? 'Paragon starts here' : lv === S.mob_level_cap ? 'the mob level bound' : ''];
      }),
      ['The win', 'one fight', `<strong>${esc((eng.winTarget() as any).name)}</strong> — zone ${n0((eng.winTarget() as any).zone)}, level ${n0((eng.winTarget() as any).level)}, ${n0((eng.winTarget() as any).hp)} health, killed inside a single spawn without being Pushed`],
      ['Past the Cap', wrap(n0((eng as any).PUSH_KILLS_91_100)) + ' kills', 'the stretch from level 90 to level 100, counted in the same currency as everything else (<code>PUSH_KILLS_91_100</code>)'],
    ]), `<code>goal progress = counted items, kills or level checkpoints</code>. Level Cap ${n0(S.level_cap)}; Paragon starts at ${n0(S.paragon_from)}.`),
    block('Counted, never timed', table(['Goal', 'What it spends', 'Read from'], [
      ['A full Ascend set', `${n0((E.craft as any).ascend_items_per_set)} pieces, each climbed one band`, '<code>craft.ascend_items_per_set</code>'],
      ['A full Refine pass', `${STONE_NAME.tier} at <code>refine_stones_per_use</code> a cast, on every line you choose to climb`, '<code>craft.refine_stones_per_use</code>'],
      [`Every weapon type to Mastery ${n0((BASES.mastery as any).level_cap)}`, `${n0((BASES.weapons || []).length)} ladders, and the account-wide drop bonus is the reason to walk them`, '<code>engine/mastery.ts</code>'],
      ['One skill to its top', `${n0(sm.LADDER_MAX_DUPLICATES)} duplicates`, '<code>skills.json ladder</code>'],
    ])),
  ],
});

page({
  file: 'icons.html',
  nav: 'Icons',
  title: 'Icon Gallery',
  lead: `Every SVG the game ships, in one place. Search by name, filter by category, star icons to find them again, or mark unwanted icons to hide them until you're ready to remove them in a batch.`,
  body: ['<div id="icons-gallery"></div>'],
});

// ---------------------------------------------------------------- shell

/** The nav order: the reference first, then the two questions a fight raises, then the town. */
const ORDER = [
  'index.html', 'combat.html', 'skills.html', 'items.html', 'weapons.html', 'equipment.html',
  'stats.html', 'survival.html', 'idle.html', 'world.html', 'travel.html', 'mobs.html',
  'towns.html', 'economy.html', 'crafting.html', 'progression.html', 'builds.html', 'elements.html',
  'icons.html',
];
PAGES.sort((a, b) => ((ORDER.indexOf(a.file) + 1) || 999) - ((ORDER.indexOf(b.file) + 1) || 999));


// ---------------------------------------------------------------- shell (pure: the caller supplies the tokens)

/** The client's own `:root` block, read out of the `variables.css` text - a colour never lives twice. */
export const extractTokens = (css: string): string => {
  // matched by brace, not by line: the browser gets back the stylesheet Vite processed, where the
  // newlines the file carries are gone — and the static build reads the raw file, so both must agree.
  const m = css.match(/:root\s*\{[^}]*\}/);
  if (!m) throw new Error('wiki: variables.css carries no :root block to wear');
  return m[0];
};

/** The wiki's layout rules. They name tokens only, so this file holds no colour of its own. */
export const LAYOUT = `* { box-sizing: border-box; }
body { margin: 0; display: flex; justify-content: center; background: var(--bg); color: var(--text); font: var(--font-xs)/1.55 var(--ui); }
a { color: var(--gold); text-decoration: none; }
a:hover { text-decoration: underline; }
.layout { display: flex; align-items: flex-start; gap: var(--spacing-xl); width: 100%; max-width: 116rem; padding: 2rem 2.5rem 4rem; }
nav { position: sticky; top: 2rem; min-width: 11rem; display: flex; flex-direction: column; gap: var(--spacing-sm); }
nav a { color: var(--dim); }
nav a.on { color: var(--gold); }
main { display: flex; flex: 1; flex-direction: column; gap: var(--spacing-xl); min-width: 0; }
.page-head { display: grid; gap: var(--spacing-xs); }
.page-content { display: grid; gap: var(--spacing-xl); }
h1 { font-size: var(--font-md); }
.lead { color: var(--dim); }
section { display: grid; gap: var(--spacing-sm); }
h2 { font-size: var(--font-sm); border-bottom: 1px solid var(--line); padding-bottom: .3rem; }
h3 { font-size: var(--font-xs); color: var(--dim); text-transform: uppercase; letter-spacing: .05em; }
.note { color: var(--dim); font-size: var(--font-xs); }
h1, h2, h3, h4, p, ul, ol { margin: 0; }
table { border-collapse: collapse; width: 100%; font-size: var(--font-xs); }
th, td { text-align: left; padding: .3rem .5rem; border-bottom: 1px solid var(--line); vertical-align: top; }
th { color: var(--dim); font-weight: 600; }
thead th { position: sticky; background: var(--panel); z-index: 1; }
thead tr:first-child th { top: 0; }
tbody tr:nth-child(even) { background: rgba(255,255,255,.028); }
tbody tr:hover { background: rgba(255,255,255,.06); }
/* One table, its rows split into tabbed groups: the strip is a radio group, each tab is a <tbody>, and a
   press swaps which body shows over the shared header — no script, so the static build and the live wiki
   behave alike. Generic over the group count a page declares (three here). */
.tabs { display: flex; flex-wrap: wrap; gap: var(--spacing-xs); }
.tabs > input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.tabs > label {
  display: inline-flex; align-items: baseline; gap: var(--spacing-sm); padding: .3em .9em;
  border: 1px solid var(--line); border-bottom: 0; border-radius: var(--radius-card);
  color: var(--dim); font-size: var(--font-xs); cursor: pointer;
}
.tabs > label b { color: var(--mob); font-weight: 500; }
.tabs > label:hover { color: var(--text); }
.tabs > input:checked + label { color: var(--gold); border-color: color-mix(in srgb, var(--gold) 45%, var(--line)); background: color-mix(in srgb, var(--gold) 10%, transparent); }
.tabs > input:checked + label b { color: var(--gold); }
.tabs > input:focus-visible + label { outline: 2px solid var(--focus); outline-offset: 2px; }
.tabs tbody { display: none; }
.tabs input:checked:nth-of-type(1) ~ table tbody:nth-of-type(1),
.tabs input:checked:nth-of-type(2) ~ table tbody:nth-of-type(2),
.tabs input:checked:nth-of-type(3) ~ table tbody:nth-of-type(3) { display: table-row-group; }
.tabs table { flex: 1 0 100%; width: 100%; }
.twrap { overflow: hidden; padding: 0 0.25rem; border: 1px solid var(--line); border-radius: var(--radius-card); background: var(--panel); }
.twrap table { width: 100%; min-width: 0; table-layout: fixed; }
.twrap th, .twrap td { overflow-wrap: anywhere; }
.twrap td:first-child { white-space: normal; }
td:first-child { white-space: nowrap; }
.rolls { list-style: none; display: grid; gap: var(--spacing-xs); padding: 0; font-size: var(--font-xs); }
.rolls li { position: relative; display: flex; gap: var(--spacing-sm); align-items: baseline; padding: .02rem .25rem; }
.rolls .bar { position: absolute; left: 0; top: 0; bottom: 0; background: var(--line); opacity: .55; }
.rolls .rn { position: relative; flex: 1; }
.rolls .rv { position: relative; font-family: var(--num); color: var(--text); font-size: var(--font-xs); white-space: nowrap; opacity: .8; }
.rolls .rp { position: relative; font-family: var(--num); color: var(--dim); font-size: var(--font-xs); white-space: nowrap; }
.cell-stack { display: grid; gap: var(--spacing-xs); }
td .hy { color: var(--dim); font-size: var(--font-xs); }
.fx { list-style: none; display: grid; gap: var(--spacing-xs); padding: 0; font-size: var(--font-xs); }
.fx li { display: flex; gap: var(--spacing-sm); align-items: baseline; padding: .04rem 0; border-bottom: 1px dotted var(--line); }
.fx li:last-child { border-bottom: 0; }
.fx .fk { flex: 1; font-family: var(--num); color: var(--dim); }
.fx .fk em { color: var(--text); font-style: normal; }
.fx .fs { color: var(--dim); font-size: var(--font-xs); text-transform: uppercase; letter-spacing: .04em; }
.fx .fv { font-family: var(--num); white-space: nowrap; }
td .sub { display: block; color: var(--dim); font-size: var(--font-xs); }
.rolls .forced .rn { color: var(--gold); }
.rolls .forced .rp { color: var(--gold); font-family: var(--ui); font-size: var(--font-xs); }
.zone { display: grid; gap: var(--spacing-xs); border: 1px solid var(--line); border-radius: var(--radius-card); background: var(--panel); }
.zone > summary { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: var(--spacing-xs) var(--spacing-md); padding: .65rem .8rem; cursor: pointer; }
.zone > summary:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.zone > summary::marker { color: var(--gold); }
.zone-title { font-weight: 600; }
.zone-meta { color: var(--dim); font-size: var(--font-xs); }
.zone[open] > summary { border-bottom: 1px solid var(--line); }
.zone-body { display: grid; gap: var(--spacing-sm); padding: .1rem .8rem .8rem; }
@media (max-width: 40rem) { .zone > summary { display: grid; gap: var(--spacing-xs); } .zone-meta { display: block; } }
.race-roster { display: grid; gap: var(--spacing-md); }
.race-group { display: grid; gap: var(--spacing-sm); border: 1px solid var(--line); border-radius: var(--radius-card); background: var(--inset); padding: .65rem; }
.race-group > header { display: flex; align-items: baseline; justify-content: space-between; gap: var(--spacing-md); border-bottom: 1px solid var(--line); padding: 0 .2rem .4rem; color: var(--dim); }
.race-group > header h3 { color: var(--gold); font-size: var(--font-xs); }
.race-group > header span, .species-count { font-family: var(--num); font-size: var(--font-xs); }
.race-empty { color: var(--dim); font-size: var(--font-xs); }
.species-roster { display: grid; gap: var(--spacing-md); }
.species-entry { display: grid; gap: var(--spacing-sm); border: 1px solid var(--line); border-radius: var(--radius-card); background: var(--panel); padding: .65rem .8rem .8rem; }
.species-entry > header { display: flex; align-items: baseline; justify-content: space-between; gap: var(--spacing-md); border-bottom: 1px solid var(--line); padding-bottom: .4rem; }
.species-entry h4 { color: var(--dim); font-size: var(--font-xs); text-transform: uppercase; letter-spacing: .05em; }
.species-entry > header h4 { color: var(--text); font-size: var(--font-sm); text-transform: none; letter-spacing: 0; }
.species-count { color: var(--gold); }
.species-facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--spacing-sm) var(--spacing-md); }
.species-facts div { display: grid; gap: var(--spacing-xs); min-width: 0; font-size: var(--font-xs); overflow-wrap: anywhere; }
.species-facts b { color: var(--dim); font-size: var(--font-xs); text-transform: uppercase; letter-spacing: .04em; }
.species-entry table { font-size: var(--font-xs); }
.species-entry th, .species-entry td { padding: .28rem .4rem; overflow-wrap: anywhere; }
@media (max-width: 58rem) { .species-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 36rem) { .species-facts { grid-template-columns: 1fr 1fr; } .species-entry { padding: .6rem; } }
.legend { display: grid; gap: var(--spacing-xs); padding-left: 1.1rem; font-size: var(--font-xs); color: var(--dim); }
.legend strong { color: var(--text); }
.num { font-family: var(--num); font-variant-numeric: tabular-nums; }.tag { border: 1px solid var(--line); border-radius: var(--radius-card); padding: 0 .25rem; color: var(--dim); font-size: var(--font-xs); text-transform: uppercase; }
ol { display: flex; flex-direction: column; gap: var(--spacing-xs); padding-left: 1.3rem; }`;

/** Everything inside <body>: the theme, the nav and the page. */
export const pageBody = (p: Page, active: string, tokens: string): string =>
  `<style>${tokens}
${LAYOUT}</style><div class="layout">
<nav>${PAGES.map((q) => `<a class="${q.file === active ? 'on' : ''}" href="${q.file}">${esc(q.nav)}</a>`).join('')}</nav>
<main><header class="page-head"><h1>${esc(p.title)}</h1><p class="lead">${p.lead}</p></header>
<div class="page-content">${p.body.join('\n')}</div>
</main></div>`;

/** A whole document, for the static build. */
export const renderDoc = (p: Page, active: string, tokens: string): string =>
  `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.title)}</title></head>
<body>` + pageBody(p, active, tokens) + '</body></html>';

export { PAGES };
export type { Page };
