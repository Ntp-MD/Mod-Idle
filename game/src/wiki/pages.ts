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
const list = (a: any): string => (a || []).map((x: any) => esc(x)).join(' · ');
/** A cell as a compact bullet list, one fact per line — easier to scan than a `·`-packed run. */
const plist = (items: string[]): string =>
  `<ul class="plist">${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
/** A range collapses to one figure when both ends agree (a mob's level is static). */
const span = (a: any, b: any): string => (n0(a) === n0(b) ? n0(a) : `${n0(a)}–${n0(b)}`);
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
 * The tree shape the data holds: `branches` is keyed by branch name, and each branch holds its nodes
 * keyed by index. Counting is therefore a read, not a second copy of "63".
 */
const treeNodes = () => ({
  branches: Object.keys((TREE_SPEC as any).branches || {}).length,
  count: ((tree as any).nodes || []).length,
  perBranch: (name: string) => Object.keys((TREE_SPEC as any).branches?.[name] || {}).length,
});
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
      <li><strong>Craft</strong> at a settlement: drag gear to the bench and a stone stack to the target; hover a piece to inspect its Mods.</li>
      <li><strong>Climb</strong> to the next zone. A Push costs recovery time: a Field Camp in that zone receives you and ends the walk; otherwise the route resumes at its ambush block.</li>
    </ol>`, 'The whole game is one screen — the field — and the panels behind it.'),
    block('What is in the game', table(['', 'Count', 'What it is'], [
      ['Zones', wrap(n0(eng.ZONES.length)), 'each with its own level band, Element and group size'],
      ['Worn pieces', wrap(n0(E.opening.gear.length)), `over ${n0(BASES.slots.length)} slot names — every slot has its own frames and Mod pools`],
      ['Skills', wrap(n0(sm.all().length)), TYPES.map((t: string) => `${sm.of(t).length} ${t}`).join(' · ')],
      ['Mob Species', wrap(n0(E.mob.species.length)), 'grouped into fantasy Races'],
      ['Elements', wrap(n0(E.elements.order.length)), list(E.elements.order)],
      ['Settlements', wrap(n0(TOWN.settlements.length)), 'shops, storage, tasks and crafting'],
      ['Dungeons', wrap(n0(TOWN.settlements.length)), 'one per settlement — escrowed loot, forfeited on a Push'],
      ['Passive tree', wrap(n0(treeNodes().count)), `${treeNodes().branches} wings · a centre start, cross-links at ranks ${list((TREE_CFG.graph as any).crosslink_ranks)} · ${n0(TREE_CFG.point_cost_per_rank)} point a rank`],
    ]), 'Read from the data, never typed here.'),
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
  lead: `Every skill is found as a drop. New buffs and auras enter the collection switched off; turn them on in Skills when you want their effects. A paid row uses one typed flat Mana or current-HP cost; an aura reserves Max Mana. Each owned skill earns XP once per kill while slotted or toggled on; repeating it in the rotation grants no extra XP. A skill levels up to ${E.skill_xp.level_cap} — and at that level a press deals ${sm.damagePct(E.skill_xp.level_cap)}% of its level-1 damage, a buff's or an aura's effect climbs to ${sm.buffEffectPct(E.skill_xp.level_cap)}%, and every other effect reaches ${sm.effectPct(E.skill_xp.level_cap)}%.`,
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
      'Min and Max are the same list at the two ends of the skill-level ramp: a press reads its damage, everything else the lines it moves, and each line names itself. The damage figure is a press on the reference character, before crit. Only the arrow rows carry a weapon tag (`bow` = bow or crossbow) and fire solely while one is held; every other row is open to any weapon.');
  })(),
    block('Cost and Max HP terms', table(['Rule', 'How the press reads it', 'Data term'], [
      ['Flat cost', 'A paid active skill has either a Mana cost or an HP cost, never both; skill level raises the configured flat price.', '<code>mana</code> · <code>hp_cost</code>'],
      ['HP safety', 'HP cost comes from current HP and cannot spend the final point.', '<code>hp_cost</code>'],
      ['Caster Max HP', 'A skill may add a share of the caster’s Max HP before the skill-level ramp, crit, weapon and damage-bucket multipliers.', '<code>max_hp_pct</code>'],
      ['Target Max HP', 'A separate skill effect may add a share of the target’s Max HP; it is not the caster term.', '<code>max_hp_pct_damage</code>'],
      ['Area premium', 'Only a Mana-cost press receives the configured AoE cost premium.', '<code>aoe</code>'],
    ]), 'Mana pool size changes how many presses are affordable, not their flat price. HP pool size does not change an HP price either; HP costs leave one point.'),
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
      `Every figure is the status table the roll reads. A ROLLED status — an Element status, the bleed an axe&rsquo;s line grants, or a stun — lands only when the Alignment gate lets it, and ${pc0(ST.proc_chance)} of the Element hits that pass then carry their status. A row that declares its status outright is not a roll and never meets the gate.`),
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
    })(), 'Every figure is the engine reading its own table: <code>alignmentOf</code> and <code>stunChanceFrom</code> at the reference build, never a typed promise.'),
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
        : 'none — this Base carries no school, so no ${STONE_NAME.quality} can raise it'}</div>`;
      const baseCell = (b: any) => {
        const own = forced(b);
        if (own.length) {
          const shared = own.length > 1 ? `<div class="sub">one line; its ${own.length} Mods share one budget, ×${SCALE[String(own.length)]} each</div>` : '';
          return rollList(own.map((id) => ({ id, chance: 1, forced: true }))) + shared + gearMod(b);
        }
        return `<div class="sub">line 1 is drawn here — the slot has no Mod of its own, and no Stat Mod</div>`
          + rollList(redraw(pool(b).filter((e: any) => !(loot.STAT_IDS as string[]).includes(e.id)))) + gearMod(b);
      };
      // Bound and Unbound lines draw the one slot pool; only the stone lock tells them apart,
      // so the pool is printed once instead of in two identical columns.
      const rows = frames.map((b: any) => [
        esc(b.name), wrap(n1(b.weight)),
        baseCell(b),
        `<div class="sub">${n0(IL.bound_slots)} Bound, locked at drop · ${spacing(NORM)} Unbound, editable (+${n0(IL.mods_added_cap)} by Add)</div>` + rollList(laterPool(b)),
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
    block('Two halls', `<p>Every piece lives in one of two halls — <a href="weapons.html">Weapons</a>, the eleven main-hand types and their frames, or <a href="equipment.html">Equipment</a>, every other slot frame by frame. A third hall opens here when the jewel system lands.</p>`),
    block('How a drop rolls', table(['', 'Number', 'What it means'], [
      ['Lines on a drop', wrap(`${n0(IL.frame_mod_slots + IL.bound_slots + NORM.min)}-${n0(IL.frame_mod_slots + IL.bound_slots + NORM.max)}`), `${n0(IL.frame_mod_slots)} Frame Mod · ${n0(IL.bound_slots)} Bound · ${spacing(NORM)} Unbound, drawn at drop — a slot whose pool runs out first publishes fewer`],
      ['Lines after crafting', wrap(n0(IL.crafted_max)), `the Add craft opens one more line per stone, up to ${n0(IL.mods_added_cap)} — the crafted ceiling`],
      ['Item level', 'the drop own level', 'every line on the piece rolls inside the window that level publishes'],
      ['Item quality', 'low · mid · high', IL.spans.map((sp: any) => `${sp.band} ${n0(sp.from)}-${n0(sp.to)}`).join(' · ')],
      ['Tier', 'T1 · T2 · T3', 'which third of the window the roll landed in — T1 is the top third, and the rarest roll (' + pc0(1 - loot.TIER_SPLIT[1]) + ' T1 · ' + pc0(loot.TIER_SPLIT[1] - loot.TIER_SPLIT[0]) + ' T2 · ' + pc0(loot.TIER_SPLIT[0]) + ' T3)'],
    ]), 'The window climbs with the Item level, and its floor starts from the band below, so a mid-band piece opens able to roll the low band own floor.'),
    block('Every Mod and the window it rolls in', table(['Mod', 'Range', 'Window by Item quality: low · mid · high'], [...(MODS.mods || [])].sort((a: any, b: any) => b.max - a.max).map((m: any) => [
      esc(m.name), `${n0(m.min)}-${n0(m.max)}${m.pct ? '%' : ''}`, modBands(m) || '—',
    ])), 'Each band own ladder, read straight out of the data the roll uses — a line gets stronger because the level moved, never because a second table says so.'),
    block('God-roll seams', (() => {
      const rows = (E.item_level.spans || []).map((sp: any, q: number) => {
        const t1 = loot.rangeOf('max_hp_flat', sp.to, q, 0);
        const t3 = loot.rangeOf('max_hp_flat', sp.to, q, 2);
        return [`${esc(sp.band)} · level ${n0(sp.to)}`, `${n0(t1[0])}–${n0(t1[1])}`, `${n0(t3[0])}–${n0(t3[1])}`];
      });
      return table(['Band at its last level', 'T1 (top)', 'T3 (bottom)'], rows);
    })(), 'Max HP flat, read off the engine at each band own last level: the seams overlap, so a low-band T1 outrolls the next band own T3 — and every T1 floor still rises, so the top third always wins outright. That overlap is the god-roll window: a lucky low-zone drop stays worth wearing into the next band.'),
  ],
});

page({
  file: 'weapons.html',
  nav: 'Weapons',
  title: 'Weapons',
  lead: `${n0((BASES.weapons || []).length)} main-hand types with different attack damage multipliers, each with ${weaponFrameSummary}. Sword stays the DPS anchor; frame variants roll by their own drop weight. Windows read at the mid band, like every window on this wiki.`,
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
    }).join(''), 'The type sets its attack tempo and damage multiplier. Each named frame chooses its archetype lines and weighted chance; its drop weight is unrelated to the weapon’s carried weight. Bound and Unbound lines also draw from the type-specific weapon pool.'),
  ],
});

page({
  file: 'equipment.html',
  nav: 'Equipment',
  title: 'Equipment',
  lead: 'Every slot that is not a main hand, frame by frame. The frame decides what it can roll; the roll decides what it is worth.',
  body: [
    block('Slot by slot', slotSections(EQUIP_SLOTS), `A drop is not one Mod. Line 1 is the frame own — and on an armour slot it carries the flat defence lines the frame promises: one, two or all three of Armour, Evasion and Energy Shield; on a Shield off-hand it locks Block Chance with that frame's Armour, Energy Shield or Armour + Energy Shield profile. These lines are never a random draw, and every value scales as the line carries more Mods. The next ${n0(IL.bound_slots)} lines are the Bound pair: rolled at drop, protected from Unbound-only presses. Identity presses can change these Mods; Polish and Reforge can reroll their values. The Unbound lines are rolled too — a drop draws ${spacing(NORM)} of them, so two pieces of one level and one band need not be the same width — and the Add craft opens up to ${n0(IL.mods_added_cap)} more for the ${n0(IL.crafted_max)}-line ceiling. Bound and Unbound lines draw the same slot pool and only the stone lock tells them apart, so the pool is printed once. Beside every line is the value window it rolls in at the ${esc(BAND_SPAN.band || 'mid')} band — its floor at the band's first level, its ceiling at its last, so a higher Item level lifts the floor and never the ceiling. A Frame Mod that shares one budget across several Mods is printed unscaled; the × note beside it says what the share does.`),
  ],
});

page({
  file: 'stats.html',
  nav: 'Stats & caps',
  title: 'Stats and caps',
  lead: 'Seven Core stats, and every point is yours to spend. Some lines stop at a cap — the table says which ones, and whether a real build can reach it.',
  body: [
    block('Core stats', table(['Stat', 'Feeds', 'One point buys'], [
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
    ]), `Every stat also has one utility line, so no point is wasted. The last column is what a single point buys: every stat line is <code>Base + K_core</code> through the one K table (<code>engine.json K</code>), and the attack-speed and drop figures are already in the units the game adds them in.`),
    block('What a level gives', table(['Line', 'Gain per level', 'Where it starts'], [
      ['Max HP', wrap(`+${n0(E.level_gain.hp_per_level)}`), wrap(n0(E.level_gain.hp_base))],
      ['Max Mana', wrap(`+${n0(E.level_gain.mp_per_level)}`), wrap(n0(E.level_gain.mana_base))],
      ['Carry weight', '—', wrap(n0(E.level_gain.weight_base))],
      ['Stat points', `${wrap(n0(E.stat.points_per_level))} · ${wrap(n0(E.stat.paragon_points_per_level))} past level ${wrap(n0(E.stat.paragon_from))}`, 'spent by hand'],
      ['Tree points', wrap(n0(E.stat.tree_points_per_level)), wrap(n0(E.stat.tree_points_base))],
    ]), `A level pays the pools their flat term and hands over points; no stat line rises on its own (<code>level_gain</code> · <code>stat</code>). Respec is town-only.`),
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
  lead: 'Zones climb in level and in what they pay. A body class is the shape of a fight, not a stat.',
  body: [
    block('Body classes', table(['Body', 'Health', 'Damage', 'Base evasion', 'Comes in'], (E.mob.sizes || []).map((s: any) => [
      esc(s.id), `×${n1(s.hp)}`, `×${n1(s.ps)}`, `+${n0(s.evasion_pct)}%`, esc(s.group),
    ])), 'A boss is not a size. Each boss declares the body class a weapon reads it as; the default is Large. The base evasion is a percent on top of the Species Dex line.'),
    block('Zones', table(['#', 'Zone', 'Region', 'Levels', 'Band', 'Mob group', 'Its three sides', 'Elements'], eng.ZONES.map((z: any) => [
      wrap(n0(z.id)), esc(z.name), esc(z.region), `${n0(z.levels[0])}-${n0(z.levels[1])}`, esc(z.quality), esc(z.group),
      list((z.subzones || []).map((s: any) => `${s.name}: ${(s.spawn || {}).group || z.group} pack, ${(s.spawn || {}).elite_pct ?? Math.round(E.loot.elite_spawn_chance * 100)}% elite, ${eng.packWordOf((s.spawn || {}).pack)}`)),
      list(eng.zoneElements(z.id)),
    ])), 'The band decides the Item quality of what drops there. Each side of a zone fields its own pack, Elite rate and body mix, and a zone\u2019s three sides average back to the group and the Elite rate published above — a crowded side and a heavy side are a choice of ground, not a rate. The Elements column is what a spawn here actually wears — each Species’ own Element, plus the zone Boss’ declared one — read off the cast, so it is never a limit on what can appear.'),
    block('Dungeons', table(['Dungeon', 'Zone', 'Band', 'A run'], (TOWN.settlements || []).map((s: any) => [
      // the sheet prints the same name (tools/map.ts owns it); the wiki only reads it back
      esc(s.name + ' Dungeon'), wrap(n0(s.zone)), esc(s.band),
      `${n0(E.dungeon.mob_cap)} mobs · groups of ${n0(E.dungeon.group_cap)}`,
    ])), `One dungeon per zone, entered at wild-side index ${n0((E.fieldwork as any).wild_site_index.dungeon)}. Same mobs, same rolls as the zone — but loot waits in escrow until the last mob falls, a Push forfeits it, and a cleared run cools down ${n0(E.dungeon.cooldown_sec / 60)} minutes.`),
    block('Species', table(['Species', 'Race', 'Zones', 'Body classes', 'Damage', 'Element', 'What its body does', 'Health line'], (E.mob.species || []).map((sp: any) => [
      esc(sp.name), esc(sp.race), list(sp.zones), list(sp.sizes), esc(sp.damage), esc((sp as any).element),
      list(eng.mechanicWordsOf((sp as any).mechanics)) || 'an ordinary body', esc(sp.trait || ''),
    ])), 'Each Species owns one Element and resists it wherever it stands — any other Element lands on it with no resistance at all. A zone Boss may declare its own Element and resistance. A Race is taxonomy only; it does not grant the member Species shared mechanics.'),
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
      const variants: { name: string; levels: [number, number]; core?: Record<string, number> }[] = variantsBySpecies[sp.id] || [];
      const uniques: any[] = ((E.mob as any).uniques || []).filter((u: any) => u.species === sp.id);
      const coreText = (core?: Record<string, number>) => core
        ? ['str', 'agi', 'vit', 'dex', 'int', 'wis', 'lck'].map((key) => `${key.toUpperCase()} ${n0(core[key] || 0)}`).join(' · ')
        : '—';
      const dropRow = (name: string, level: string, role: string, extraDrops: string, core?: Record<string, number>) => {
        const drop: any = maybe(E.mob.variant_drops, name);
        if (!drop) return [esc(name), level, role, coreText(core), 'No junk row', '—', '—', extraDrops];
        const chance = Number((E.junk as any).rarities?.[drop.rarity]?.drop_chance_per_kill || 0);
        const choices = [...new Set([drop.item, sp.junk_items?.[drop.rarity]].filter(Boolean))] as string[];
        const outcomePct = choices.length ? chance / choices.length : 0;
        const outcomes = choices.map((item) => `${esc(item)} ${pc1(outcomePct)}`).join(' · ');
        return [esc(name), level, role, coreText(core), outcomes || '—', `${esc(drop.rarity)} · ${pc1(chance)} total`, esc(drop.lean), extraDrops];
      };
      const drops = [
        ...variants.map((v) => dropRow(v.name, `${n0(v.levels[0])}–${n0(v.levels[1])}`, 'Variant',
          sp.potion_source ? 'Potion source · see band rates' : '—', v.core)),
        ...uniques.map((unique) => dropRow(unique.name, 'wild', 'Unique',
          `Elite stones · XP ×${n0(E.xp.unique_mult)} · skill ${pc1(E.skill_drop.unique)}`)),
      ];
      const facts = [
        ['Sizes', list(sp.sizes)],
        ['Damage', esc(sp.damage)],
        ['Element', esc(sp.element)],
        ['Zones', list(sp.zones)],
      ].map(([label, value]) => `<div><b>${esc(label)}</b><span>${value || '—'}</span></div>`).join('');
      return `<article class="species-entry">`
        + `<header><h4>${esc(sp.name)}</h4><span class="species-count">${n0(variants.length)} variants · ${n0(uniques.length)} uniques</span></header>`
        + `<div class="species-facts">${facts}</div>`
        + `<h4>Variants and junk drops</h4>`
        + table(['Variant', 'Level', 'Role', 'Core', 'Junk outcomes · each %', 'Base junk / kill', 'Lean', 'Extra drops'], drops)
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
        'Base chances per kill before LCK, mastery, Variant leans and subzone environment leans. Each Variant pays its listed junk rarity; its own item and any Species alternative for that rarity are equally likely.'),
      block('Race → Species → Variant', `<div class="race-roster">${raceSections}</div>`,
        `Races group Species for world taxonomy only. Each Species may have any number of Variants, authored Core forms and optional Uniques (${totalVariants} Variants currently). Potion drops use an explicit per-Species flag, not Race membership: the six tribal lines — Goblin · Orc · Kobold · Human · Lizardman · Elf — mint the flasks, and the rest of the same Race does not.`),
    ];
  })(),
});

page({
  file: 'towns.html',
  nav: 'Towns',
  title: 'Settlements',
  lead: 'A settlement is where you spend what the field paid: space, time and information — never power. A price here is written as <code>m</code>, minutes of your own junk income, and charged at the band of the place that sells it.',
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
        `<span class="hy">${list((s.stock || []).map(stockName)) || 'nothing yet — a Standing tier opens more'}</span>`,
      ])), 'A settlement adds no clicks to automate and no power. Its stall stock grows with your Standing there, and the Waypoint is opened by walking to it — see <a href="travel.html">Travel</a>.'),
      block('Who sells what', table(['NPC', 'What they deal in', 'Where they are'], (TOWN.npcs || []).map((n: any) => [
        esc(n.name), esc(n.kind), esc(n.rule || ''),
      ])), 'A vendor never sells gear, Mods, potions or stones — gold buys space, time, information and appearance only (<code>economy.md</code> rule, printed on <a href="economy.html">Economy</a>).'),
      block('Standing', table(['Tier', 'Reach it at', 'Unlocks'], (TOWN.standing?.tiers || []).map((t: any) => [
        esc(t.name), `${n0(t.share * 100)}% of the band's kills`, esc(t.unlocks),
      ])), `Earned from ${esc(String((TOWN.standing as any).earnt_from || ''))} — and Standing is never bought. What it grants: ${list((TOWN.standing as any).grants || [])}.`),
      block('The task board', table(['', 'The number', 'Read from'], [
        ['Slots open at once', wrap(n0(TS.slots)), '<code>task_sizing.slots</code>'],
        ['A slot refills', TS.refill_sec >= 3600 ? `every ${n0(TS.refill_sec / 3600)} hours` : `every ${n0(TS.refill_sec / 60)} minutes`, '<code>task_sizing.refill_sec</code>'],
        ['A free skip', `${n0(TS.free_skip_per_day)} a day, plus a bought one on top`, '<code>task_sizing.free_skip_per_day</code>'],
        ['An Elite hunt asks for', wrap(n0(TS.elite_n)), '<code>task_sizing.elite_n</code>'],
        ['What it pays', `a slice of that band’s own stone income: ${n0(TS.reward_minutes_of_band_income)} minutes of it`, '<code>task_sizing.reward_minutes_of_band_income</code>'],
        ['A Boss hunt pays', Object.entries(TS.boss_reward || {}).map(([k, v]: any) => `${n0(v)} ${esc(String(k).replace(/_/g, ' '))}`).join(' + '), 'winner’s choice, exactly as the board writes it'],
      ]), `${(() => {
        const pay = (b: string) => {
          const p: any = eng.taskPayout(b, TS.reward_minutes_of_band_income);
          return `${stone('tier', p.tier)} · ${stone('add', p.add)} · ${stone('reroll_value', p.reroll_value)}`;
        };
        return `Read through <code>engine.taskPayout</code>, so a task is a slice of the income you would have earned anyway — the board never mints a stone out of nothing. At the ${n0(TS.reward_minutes_of_band_income)}-minute slice: low band ${pay('low')} · mid band ${pay('mid')} · high band ${pay('high')}`;
      })()}. A plain kill-count task is gone: the board asks for Elites and bosses, and pays stones only. Claim rewards at a settlement; if the character bag is full, the task stays claimable until there is room.`),
      block('One-time lines', table(['Item', 'Sold by', 'Buys', 'Costs, in gold at that band', 'Note'], (TOWN.one_time || []).map((l: any) => [
        esc(l.item), esc(NPC[l.npc]?.name || l.npc || ''), esc(l.kind), price(l),
        `<span class="hy">${[extra(l), l.discount ? `at ${esc((TOWN.settlements || []).find((s: any) => s.id === l.discount.settlement)?.name || l.discount.settlement)} it costs ${goldAt(l.discount.m, (TOWN.settlements || []).find((s: any) => s.id === l.discount.settlement)?.band || l.charge_band)}` : ''].filter(Boolean).join(' · ')}</span>`,
      ])), 'Bought once. A ladder step gets dearer in order, which is the whole reason the price column is minutes rather than a shape.'),
      block('Repeatable lines', table(['Item', 'Sold by', 'Buys', 'Costs, in gold at that band', 'Note'], (TOWN.repeatable || []).map((l: any) => [
        esc(l.item), esc(NPC[l.npc]?.name || 'no vendor — see note'), esc(l.kind), price(l),
        `<span class="hy">${extra(l)}</span>`,
      ])), 'Bought again and again, most of it capped per day. The Waypoint warp sits here and is stocked by no settlement: it is priced off the blocks the walk would have crossed (<a href="travel.html">Travel</a>).'),
      block('The Collector', table(['Set', 'At', 'School', 'Pieces it wants', 'Quality', 'Pays'], (TOWN.collector_sets || []).map((c: any) => [
        esc(c.name || c.id), esc((TOWN.settlements || []).find((s: any) => s.id === c.settlement)?.name || c.settlement),
        esc(c.school), list(c.pieces || []), esc(c.quality || 'any'),
        `<span class="hy">${esc(c.reward || '')}${c.pays_gold === false ? ' · never gold, never a Mod' : ''}</span>`,
      ])), 'A piece that improves what you wear stays available for Auto Equip. The Collector reserves non-upgrades before a filter can dissolve them (<code>collector_sets.rule</code>). The Collector pays neither gold nor a Mod — that is what keeps it out of the power economy.'),
    ];
  })(),
});

page({
  file: 'economy.html',
  nav: 'Economy',
  title: 'The two currencies',
  lead: 'Crafting stones buy power. Gold buys convenience. They never convert into each other.',
  body: [
    block('Crafting', `<p>Every verb, price and stone source lives on the <a href="crafting.html">Crafting</a> page.</p>`),
    block('Gold: where it comes from', table(['Band', 'Kills an hour', 'Junk an hour', 'Gold a minute'],
      (QUAL_BANDS as string[]).map((b: string) => [
        esc(b), wrap(n0(EBAND[b].kills_derived)), wrap(n0(EBAND[b].junk_per_hr)),
        `${n1(eng.goldPerMinute(b))} gold`,
      ])),
      'These are reference junk values before market demand, and town service prices still use this baseline. The Counterhand also buys gathered materials, provisions and farm herbs. Actual payment depends on the buyer, the quantity and how much of that category the town has already received.'),
    block('Town buyers and trade routes', table(['Town', 'Import needs', 'Abundant exports', 'Why it buys'], TOWN.settlements.map((town: any) => {
      const profile = TOWN.trade.towns[town.id];
      const words = (entries: string[]) => entries.map((id) => trade.byId[id]?.name || id.replace('junk:', '')).join(' · ');
      return [esc(town.name), esc(words(profile.imports)), esc(words(profile.exports)), esc(profile.needs)];
    })), `At full demand, imported goods pay up to ×${n2(TOWN.trade.import_peak)} base value; abundant exports pay up to ×${n2(TOWN.trade.export_peak)}. Deliveries consume the shared category pool of ${n0(TOWN.trade.capacity_gold)} base gold and the price approaches ×${n2(TOWN.trade.floor_mult)}. Demand recovers over ${n0(TOWN.trade.recovery_sec / 3600)} game hours, including credited away time. A bulk quote includes the whole price decline; splitting a stack earns the same total. Open Market to compare buyers, walking distance, warp fees and net proceeds, then select Map route. Goods can be sold only while standing in that town.`),
    block('Regional gathering', table(['Town field', 'Mine bonus', 'Grove bonus', 'Grove forage'], TOWN.settlements.map((town: any) => {
      const source = (E.fieldwork as any).regional_sources[town.zone];
      return [esc(town.name), esc(fieldwork.materialById[source.mine].name), esc(fieldwork.materialById[source.grove].name), esc(fieldwork.foodById[source.food].name)];
    })), 'Regional bonuses supplement common ore, timber and rarewood. Keep stock for Camp and recipes, or carry it to a town that needs it. Mining and Woodcutting improve bonus chances and harvests.'),
    block('Workshop cargo', table(['Finished good', 'Field skill', 'Materials', 'Base value'], (E.fieldwork as any).workshop_recipes.map((recipe: any) => [
      esc(recipe.name), `${esc(recipe.skill)} Lv ${n0(recipe.level)}`, esc(Object.entries(recipe.materials).map(([id, count]) => `${count} ${fieldwork.materialById[id].name}`).join(' · ')), `${n2(trade.byId[`material:${recipe.id}`].value)} gold`,
    ])), 'Use the Market Workshop while standing in a settlement. Finished cargo has a derived base value above its inputs, but the buyer’s remaining demand still decides the actual offer. Making a good spends its listed materials and grants field skill XP. A full bag refuses the action without spending anything.'),
    block('Gold: what it buys', table(['Buys', 'Lines that buy it', 'Written as', 'What a line is worth'],
      (['space', 'time', 'information', 'appearance'] as string[]).map((kind: string) => {
        const lines = [...(TOWN.one_time || []), ...(TOWN.repeatable || [])].filter((l: any) => l.kind === kind);
        const cents = lines.flatMap((l: any) => [l.m, l.m_min, l.m_max].filter((x: any) => typeof x === 'number'));
        return [esc(kind), wrap(n0(lines.length)),
          cents.length ? `${n0(Math.min(...cents))}–${n0(Math.max(...cents))} minutes of the band’s income` : '<span class="hy">none</span>',
          `<span class="hy">${esc(lines.map((l: any) => l.item).join(' · '))}</span>`];
      })),
      'Gold never buys gear, a Mod, a potion or a stone. A better build earns gold faster without ever turning gold into power.'),
    block('What is deliberately absent', `<ul class="fx">
      <li><span class="fk">No sink that sells power.</span><span class="fs">rule</span><span class="fv">the loot funnel is the only road to a stronger piece</span></li>
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
  lead: 'Stones change what a piece <em>is</em>; two of them also move how high it sits — Ascend the band, Upgrade the Gear line. Use the settlement Craft bench to drag stones from your stack onto an equipped or carried target. Every price below is read, never typed.',
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
    })(), 'Every Target cell reads the same way: <b>which line</b> (<i>select</i> = you name it · <i>random</i> = the stone draws it · <i>all</i> = every line in scope) · <b>how many</b> · <b>what kind</b> (<i>unbound mod</i> is the set past the Bound pair, <i>bound mod</i> the pair fixed at drop, <i>frame mod</i> line 1) · <b>what happens</b>, and a swap closes with what arrives. The frame mod belongs to no press except Corrupt, Polish and Reforge — those three are the only ones that touch it.'),
    block('Quality ladder', table(['Step', 'Quality Stones', 'Odds'], (() => {
      const EP = E.craft.upgrade_success_endpoints;
      return (E.craft.upgrade_costs || []).map((c: number, i: number) => {
        const step = i + 1;
        const odds = step <= EP.safe_to ? 'safe'
          : step < E.craft.upgrade_breaks_from ? `${n0(EP.mid[0])}% down to ${n0(EP.mid[1])}% — a fail drops one level`
          : `${n0(EP.high[0])}% down to ${n0(EP.high[1])}% — a fail breaks the piece`;
        return [`+${n0(step)}`, wrap(n0(c)), odds];
      });
    })()), `Protection: ${n0(E.craft.protection_start)} per piece from birth — each would-be break spends one and drops a level instead. Losing an Upgrade level also removes its Gear Mod points. A Repair stone revives one upgrade level below the pre-break level and refills protection. Broken gear has no combat effects and must be repaired before equipping. Online only.`),
    block('Where stones come from', (() => {
      const pct = (v: any) => { const p = Number(v) * 100; return (Number.isInteger(p) ? n0(p) : n1(p)) + '%'; };
      const chance = (v: any) => Number(v) < 1 ? pct(v) + ' per kill' : n0(v) + (Number(v) === 1 ? ' stone' : ' stones');
      return table(['Stone', 'Elite', 'Boss', 'Every kill'], [
        [STONE_NAME.reroll_value, '—', '—', 'one per dissolved piece, plus one ' + STONE_NAME.tier + ' per ' + n0(E.salvage.pieces_per_tier_stone) + ' dissolved'],
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
    })(), 'Elite and boss chances are per kill; a whole-stone value pays out whole.'),
    block('How many lines a piece can gain', `<p>A piece remembers how many Unbound lines it dropped with, and Add stones may add ${n0(E.item_level.mods_added_cap)} more in total — one line a press, never a bundle, and the fill price climbs with every press the piece has taken.</p>`, `Remove refunds room — but every stone taken still counts toward the climbing fill price.`),
  ],
});

page({
  file: 'progression.html',
  nav: 'Progression',
  title: 'Progression',
  lead: `Character levels come from kills. Combat skill levels come from kills with that skill, field skill levels from their actions, and Weapon Mastery from kills with that weapon. Nothing is priced by the clock.`,
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
    block('Weapon Mastery', table(['Bonus', 'What it gives', 'Where it stops'], [
      ['While held', `−${pts((BASES.mastery as any).weight_discount_per_level_pct)} weapon weight a level`, `<code>weight_discount_cap_pct</code> ${pts((BASES.mastery as any).weight_discount_cap_pct)}`],
      ['Matching skill', `+${n1((BASES.mastery as any).skill_bonus_per_level_pct)}% skill damage a level from Mastery level ${n0((BASES.mastery as any).skill_bonus_from_level)}`, `full bonus · cap ${pts((BASES.mastery as any).skill_bonus_cap_pct)}`],
      ['Other skill', 'half the held weapon’s skill damage bonus', `cap ${pts((BASES.mastery as any).skill_bonus_cap_pct * (BASES.mastery as any).skill_bonus_off_type_mult)}`],
      ['Account-wide', `+${pts((BASES.mastery as any).drop_bonus_per_type_pct)} drop rate per weapon type once that type reaches Mastery ${n0((BASES.mastery as any).drop_bonus_level_required)}`, `across ${n0((BASES.weapons || []).length)} types — <code>mastery.dropMultiplier</code>`],
      ['The ladder', `${n0((BASES.mastery as any).xp_per_kill)} Mastery XP a kill, the same curve shape as the herb farm, capped at ${n0((BASES.mastery as any).level_cap)}`, '<code>engine/mastery.ts</code>'],
    ]), 'Mastery never adds damage to a weapon’s basic attack. It answers the weight question (<a href="idle.html">Away &amp; bag</a>) and the drop question (<a href="items.html">Items</a>), while matching skills get the full damage bonus and other skills get half. It climbs at full rate while you are away.'),
    block('The passive tree', table(['Wing', 'Nodes', 'Ranks', 'Points'], Object.keys(TREE_CFG.branches || {}).map((name: string) => [
      esc(name), wrap(n0(treeNodes().perBranch(name))), wrap(n0(TREE_CFG.rank_tiers?.shallow?.length ?? 3)), wrap(n0(TREE_CFG.point_cost_per_rank * (TREE_CFG.rank_tiers?.shallow?.length ?? 3) * treeNodes().perBranch(name))),
    ])), `${n0(TREE_CFG.point_cost_per_rank)} point a rank · a free centre connects the first node of each wing. Owned paths branch to adjacent nodes; cross-links reconnect the wings at ranks ${list((TREE_CFG.graph as any).crosslink_ranks)}. A rank pays ${pctList(TREE_CFG.rank_tiers?.shallow)} of the line at shallow nodes and ${pctList(TREE_CFG.rank_tiers?.deep)} at deep ones — a deep node of the same line is always the stronger buy. ${n0(E.stat.tree_points_base)} points are in hand at character creation and one arrives with every level (<code>stat.tree_points_base</code>, <code>stat.tree_points_per_level</code>), so points are choices across the tree and cannot rank every node at once. Weapon nodes only grant their line while that exact weapon type is held. The control wing’s resistance node raises its Cap to ${wrap(n0(E.caps.elem_res_max))}. Every node pays one real stat line; there are no keystones.`),
  ],
});

page({
  file: 'elements.html',
  nav: 'Elements',
  title: 'Elements',
  lead: 'Every Element names the status its hits leave. A Species resists its own Element; no Element counters another. An Element declared ahead of its content reads a dash until its status and its skill rows land.',
  body: [
    block('Where an Element is resisted', table(['Element', 'Species that own it'], E.elements.order.map((el: string) => [
      esc(el), list((E.mob.species || []).filter((sp: any) => (sp as any).element === el).map((sp: any) => sp.name)) || '—',
    ])), `Each Species owns one Element (\`mob.species[].element\`) and answers it at a flat \`mob.species_res_pct\` in every zone it lives in. Its Race does not set resistance. Every other Element lands on it unresisted.`),
    block('What each Element leaves behind', table(['Element', 'Its mark'], E.elements.order.map((e: string) => [
      esc(e), esc(E.elements.status_of?.[e]?.name || E.elements.status_of?.[e] || '—'),
    ])), 'A status is answered by regeneration and by removing the tick, not by mitigation.'),
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
  lead: 'One incoming hit resolves in a fixed order — avoidance, then Armour, then Elemental resistance, then a pool. Every number is the engine at the reference build (every point spent evenly across the seven Core stats, level ' +
    wrap(n0(S.level_cap)) + '), so it is the line your own sheet is measured against, not a promise about it.',
  body: [
    block('The order a hit resolves', table(['Step', 'What it decides', 'Cap', 'What the reference build holds'], [
      row('Perfect dodge', 'deletes the hit outright, and nothing the attacker has opposes it',
        capOf('perfect_dodge'), `${pts(DV.perfect_dodge)} from ${n1(DV.pdogge_rate)} rating — <code>perfectDodgeChance</code>`),
      row('Evasion', `the dodge roll: Agi and gear build a rating; the first ${n0(E.evasion_roll.opening_rating)} points count at ${pc0(E.evasion_roll.opening_share)}, then earned rating grows at ×${n1(E.evasion_roll.earned_mult)} before meeting attacker Accuracy. Opening chance stays below ${n0(E.evasion_roll.opening_max_chance_pct)}% against zone-one mobs`,
        capOf('evasion'), `${n1(eng.evasionRating(EVEN))} rating at the even split alone, before any gear line — <code>evasionRating</code>, <code>evasionChance</code>`),
      row('Block', 'rolled last of the three avoidances; a blocked hit is cut by a flat amount read off your Armour rather than deleted',
        capOf('block'), 'the Shield offhand&rsquo;s own line, plus the charges an Earth Wall grants — each charge cuts one hit by the same rule — <code>caps.block_note</code>'),
      row('Armour', 'shrinks only the non-Element part of the hit, as a diminishing ratio',
        '<span class="hy">no Cap on the rating</span>', `${n0(DV.armour_ceil)} — <code>armourOf</code> — removing ${pc1(DV.armour_vs_zone9_boss)} of a boss-priced hit and ${pc1(DV.armour_vs_zone9_trash)} of a trash-priced one (<code>armour_vs_zone9_boss</code>, <code>armour_vs_zone9_trash</code>)`),
      row('Elemental resistance', 'shrinks the Element part of the hit, separately per Element',
        `${wrap(n0(E.caps.elem_res))} <span class="hy">or</span> ${wrap(n0(E.caps.elem_res_max))}`, `${pts(DV.res_three)} raw from three pieces, which <code>resistanceOf</code> then holds at the Cap — and <code>res_raw</code> is ${n0(DV.res_raw)}, because no Core stat feeds it: it is a gear line alone. This is the one Cap with an unlock: the control wing’s last node raises it to ${n0(E.caps.elem_res_max)} — <code>elemResCapOf</code>`),
      row('Energy Shield', 'the caster’s second pool, spent before Health, and shut out for a moment after any hit',
        '<span class="hy">no Cap</span>', `${n0(DV.es_pool)} pool, ${n1(DV.es_regen)} a second, a full pool back in ${n0(DV.es_recover_sec)} sec, worth ${pc1(DV.es_share_of_hp)} of your Health — <code>maxEsOf</code>, <code>esRegenOf</code>`),
      row('Health', 'the pool every layer above exists to protect',
        '<span class="hy">no Cap</span>', `${n0(DV.hp)} — <code>DERIVED.hp</code>`),
    ]), 'Hits of every Element, including chaos, and burn DoT spend Energy Shield before Health. Poison and bleed DoT go straight to Health. A status lands on its own roll — the Alignment gate is on <a href="skills.html">Skills</a>.'),
    block('Hit chance, both directions', table(['', 'The engine’s own names', 'The reference figure'], [
      ['You hitting a mob', '<code>playerAccuracy</code> · <code>hitChance</code> · <code>hitVs</code>',
        `${pc1(DV.hit_chance)} against the mean Species on a Medium body, which holds ${n1(DV.mob_evasion_ref)} Evasion`],
      ['A mob hitting you', '<code>evasionChance</code>, then the three avoidance layers above',
        `you hold ${wrap(n0(DV.accuracy))} of accuracy yourself, so the same roll runs backwards on you`],
      ['Crit', '<code>critPool</code> · <code>critChanceOf</code> · <code>critDmgOf</code>',
        `${pts(DV.crit_chance)} chance · ${pts(DV.crit_dmg)} damage — anything the pool holds past what the chance line takes is spent on damage, never wasted`],
      ['Stun', '<code>stunChanceFrom</code> · <code>stunRecoveryOf</code> · <code>stunStopSec</code>',
        `${n1(eng.stunChanceFrom(DV.align_path))}% a hit · Vit lets you shake off ${pts(eng.stunRecoveryOf(EVEN))} of a mob’s stop time`],
    ]), 'A stopped clock is not a locked one: our stun chance has no Cap (<code>caps.stun</code>) and a mob can never be stun-locked — the control bounds are on the status table in <a href="skills.html">Skills</a>.'),
    block('What shape of fight pays what', table(['Body', 'Health', 'Damage', 'Comes in', 'What a weapon does to it'],
      (E.mob.sizes || []).filter((s: any) => s.id !== 'boss').map((s: any) => {
        const lean = (Object.entries((E.weapon_size_mult as any).ladder || {}) as any[])
          .filter(([, v]: any) => Number(v[s.id]) !== 1)
          .map(([w, v]: any) => `${w === 'one-handed sword' ? 'sword' : w === 'one-handed axe' ? 'axe' : w} ×${n2(v[s.id])}`);
        return [esc(s.name), '<span class="hy">the curve</span>', `×${n1(s.ps)}`, esc(s.group),
          `<span class="hy">${lean.join(' · ') || 'every weapon meets it evenly'}</span>`];
      })),
      'The multiplier rides the <em>physical</em> share of a finished hit, after mitigation, so a spell is exempt and a staff’s own swing is not — <code>applySizeMult</code>. A Boss is not a fifth body; each Boss declares its own body-class read, with the default set to ' +
      esc((E.mob.sizes || []).find((s: any) => s.id === 'boss')?.reads_as || 'large') + '.'),
    block('The reach queue', table(['Weapon', 'Queue slots it may hit', 'Band'],
      Object.entries((E.mob.reach as any).weapons || {}).map(([w, slots]: any) => [
        esc(w), wrap(n0(slots)),
        esc(Object.entries((E.mob.reach as any).bands || {}).find(([, v]: any) => v === slots)?.[0] || '—'),
      ])),
      'A group is a queue, front line first, and only the front slot swings at you. A reach-1 attack that loses its front target waits a beat for the group to close; reach 2 and 3 keep pressing — <code>mob.reach.rules</code>.'),
    block('Area, bolts and conversion', table(['Line', 'What it does', 'The number'], [
      ['Area damage', 'each target hit takes a share of the hit, and the targets come out of the reach queue',
        `${pts((E.aoe as any).per_target_pct)} each · ${wrap(n0((E.aoe as any).target_cap))} targets · ×${n2((E.aoe as any).mana_mult)} mana — <code>aoe</code>`],
      ['A bolt', 'a magic weapon has no swing: its filler is a press on the attack clock, with no mana and no cooldown',
        `${pts((E.weapon_size_mult as any).bolt_share_pct)} of a finished hit — <code>weapon_size_mult.bolt_share_pct</code> · <code>basicAttackOf</code>`],
      ['Conversion', 'a percent of the finished physical share, routed into a named Element <em>before</em> mitigation, so that half answers resistance instead of Armour',
        '<code>convertDamageOf</code> — the budget is the whole hit and overflow is wasted, never a multiplier'],
      ['Caster Max HP press', 'a skill may add a share of the <em>caster&rsquo;s</em> Max HP before skill level, crit, weapon and damage-bucket multipliers',
        '<code>max_hp_pct</code> — the caster pool is read'],
      ['Target Max HP press', 'Earth Splitter adds a share of the <em>target&rsquo;s own</em> maximum pool, so the hit scales with what it lands on rather than with the caster — and a boss answers half of it',
        '<code>max_hp_press.boss_pct</code> — the row states the percent, this states the boss cut'],
    ]), 'Caster Max HP (`max_hp_pct`) and target Max HP (`max_hp_pct_damage`) are separate press terms. Whether a weapon swings or casts a bolt is read off its own damage line, so a wand cannot be a bolt in one file and a swing in another.'),
    block('Bleed, the one damage-over-time that is not an Element', table(['', 'The rule', 'Read from'], [
      ['Who puts it on', 'the axe&rsquo;s own <code>Chance to bleed %</code> line, or a press whose row grants the proc', '<code>bleed.note</code> &mdash; no curse carries it any more'],
      ['What lets it land', 'bleed is a rolled status, so it passes the same Alignment gate a stun does <em>before</em> its own chance is rolled', '<code>bleedChanceFrom</code> · <code>K_BLEED_CHANCE</code> · the axe&rsquo;s line'],
      ['Does it stack', yes((E.bleed as any).stacks), `<code>bleed.stacks</code> — a new application ${((E.bleed as any).refreshes) ? 'refreshes the duration instead' : 'does not refresh it'}`],
      ['Is it an Element', yes((E.bleed as any).is_element), '<code>bleed.is_element</code> — Elemental resistance does not answer it'],
      ['Can it crit', yes((E.bleed as any).can_crit), '<code>bleed.can_crit</code>'],
      ['Does Armour shrink it', yes((E.bleed as any).affected_by_armour), '<code>bleed.affected_by_armour</code> — its DoT bypasses Energy Shield; healing can recover the Health it spends'],
      ['What it scales with', 'the physical of one hit, not your swing count', '<code>bleed.note</code> — a slow heavy weapon is the bleed build'],
      ['On the mob side', 'the heavy physical lineages put bleed on us out of the damage they are already priced at', '<code>bleed.mob_side</code> — no extra power, so no health line moves'],
    ]), 'It is on this page rather than under <a href="elements.html">Elements</a> because it is the one damage-over-time no resistance answers.'),
    block('Elite and Boss', table(['', 'Health', 'Damage', 'Base evasion', 'Comes in', 'How often'], [
      ['Elite', `×${n0((E.mob.elite as any).hp)}`, `×${n0((E.mob.elite as any).ps)}`, `+${n0((E.mob.elite as any).evasion_pct)}%`, esc((E.mob.elite as any).group),
        `${pc1((E.loot as any).elite_spawn_chance)} of kills`],
      ['Boss', `×${n0((E.mob.sizes.find((s: any) => s.id === 'boss') || {} as any).hp)}`, `×${n0((E.mob.sizes.find((s: any) => s.id === 'boss') || {} as any).ps)}`, '<span class="hy">reads as a body</span>', 'alone',
        `${n1((E.loot as any).boss_per_hour)} an hour, and online only`],
      ['Unique', `×${n0((E.mob.sizes.find((s: any) => s.id === 'boss') || {} as any).hp)}`, `×${n0((E.mob.sizes.find((s: any) => s.id === 'boss') || {} as any).ps)}`, '<span class="hy">reads as a body</span>', 'alone',
        `${pc1((E.loot as any).unique_chance)} of spawns`],
    ]), `An Elite is a spawn flag forced onto a Large body, never a fifth size, so no two multipliers ever stack — it keeps the selected Variant's name and junk. A Boss is one named creature per zone (${n0((E.mob.bosses || []).length)} of them) and is the only place the Add, Replace and Corrupt stones are paid — see <a href="idle.html">Away &amp; bag</a>. A Species may have no Unique or several (${n0(((E.mob as any).uniques || []).length)} total): each is a wild boss that replaces its Species' spawn, paying Elite stones with ×${n0(E.xp.unique_mult)} XP. A mob uses its Variant's authored level band (<code>mob.variants[].levels</code>), which is why <a href="mobs.html">the Bestiary</a> prints each band.`),
  ],
});

page({
  file: 'survival.html',
  nav: 'Survival',
  title: 'Survival, field skills and provisions',
  lead: 'A fight you lose costs time, never a piece and never a level. Read the pools, player-set Field Camp, Hunger, field provisions and the farm that feeds alchemy.',
  body: [
    block('The pools', table(['Pool', 'What it is', 'Full at the reference build', 'How it comes back'], [
      ['Health', 'the pool every avoidance layer protects', wrap(n0(DV.hp)), `${n1(eng.hpRegenOf(EVEN))} a second off the Vit line — <code>hpRegenOf</code>`],
      ['Mana', 'the pool Mana-cost skills spend from; HP-cost skills debit the current HP pool, while auras reserve Max Mana', wrap(n0(DV.mana)),
        `${n1(DV.mana_regen)} a second, so an empty pool refills in ${n0(DV.pool_regen_sec)} sec — <code>manaRegenOf</code>`],
      ['Energy Shield', 'the caster’s second pool, spent before Health, and player-only', wrap(n0(DV.es_pool)),
        `${n1(DV.es_regen)} a second, but only once ${n0((E.energy_shield as any).delay_sec)} sec have passed without a hit — <code>esRegenOf</code>`],
    ]), 'Respec is free wherever a settlement is (<code>stat.respec_cost</code> reads ' + wrap(n0(S.respec_cost)) + '), because a locked build would punish you harder than a lost fight does.'),
    block('What a Push costs', `<ul class="fx">
      <li><span class="fk">There is no death.</span><span class="fs">rule</span><span class="fv">a fight you lose rests you at camp and costs time only</span></li>
      <li><span class="fk">A Push on the walk is the ordinary Push.</span><span class="fs">rule</span><span class="fv">with a Field Camp in this zone, recovery returns there and ends the walk; otherwise the route resumes at its ambush block (<code>road.push_rule</code>)</span></li>
      <li><span class="fk">A dungeon run forfeits its escrow.</span><span class="fs">rule</span><span class="fv">the one place a Push costs loot — <a href="world.html">World</a></span></li>
      <li><span class="fk">Your preset goes back to the main one.</span><span class="fs">rule</span><span class="fv">and a cooldown already counting keeps counting (<code>presets.cooldowns_persist_on_push</code>)</span></li>
      <li><span class="fk">A broken piece contributes nothing.</span><span class="fs">rule</span><span class="fv">the Armourer clears it and refills protection — <a href="crafting.html">Crafting</a></span></li>
    </ul>`, 'Nothing on this list is a number: a Push is the cost of the fight, not a tax on the character.'),
    block('Field Camp and life skills', table(['Skill', 'Field site', 'What it yields'], [
      ['Mining', `wild-side index ${n0((E.fieldwork as any).wild_site_index.mine)}`, `${n0((E.fieldwork as any).actions.mine.yield)} ore every ${n0((E.fieldwork as any).actions.mine.interval_sec)} sec · rich-vein chance scales with Mining and Mine Mastery`],
      ['Woodcutting', `wild-side index ${n0((E.fieldwork as any).wild_site_index.grove)}`, `${n0((E.fieldwork as any).actions.grove.yield)} timber per action · rarewood and herb chances scale with Woodcutting and Grove Mastery`],
      ['Hunting', 'bare field hexes', `raw meat and lineage provision chances and quantities scale with Hunting and each lineage’s Mastery`],
      ['Cooking', 'active Field Camp', 'turn raw food, fruit, edible herbs and ingredients into timed combat meals'],
    ]), `The first Field Camp and one relocation are free; later moves cost ${n0((E.fieldwork as any).camp.relocate_ore)} ore and ${n0((E.fieldwork as any).camp.relocate_timber)} timber. It is safe ground in its zone, allows field gathering and cooking, and receives a Push. Only one meal buff is active at a time. Field skill XP and Mastery are separate from character XP.`),
    block('Field-skill progression', table(['Progress', 'Benefit', 'Read from'], [
      ['Harvest milestones', `+${n0((E.fieldwork as any).progression.harvest_bonus_per_level)} unit per action at Skill levels ${list((E.fieldwork as any).progression.harvest_bonus_levels)}`, '<code>fieldwork.progression.harvest_bonus_*</code>'],
      ['Field drop rate', `+${n1((E.fieldwork as any).progression.drop_rate_bonus_per_skill_level_pct)}% per Skill level after 1 and +${n1((E.fieldwork as any).progression.drop_rate_bonus_per_mastery_level_pct)}% per resource Mastery level after 1, up to +${n0((E.fieldwork as any).progression.drop_rate_bonus_cap_pct)}%`, '<code>fieldwork.progression.drop_rate_bonus_*</code>'],
    ]), 'The field-drop bonus increases each configured material or provision chance multiplicatively; gear and crafting-stone drops are unchanged. Skill levels increase harvest quantity at the listed milestones, and Hunting applies that quantity bonus to raw meat and lineage provisions.'),
    block('Food drops from hunts', table(['Lineage', 'Provision', 'Chance', 'Quantity'],
      ((E.fieldwork as any).hunt.food_drops || []).map((drop: any) => [
        esc(drop.species.join(' · ')),
        esc((E.fieldwork as any).foods.find((food: any) => food.id === drop.food_id)?.name || drop.food_id),
        pc1(drop.chance), `${n0(drop.min)}–${n0(drop.max)}`,
      ])),
      'These lineage drops are separate from the raw-meat roll. Goblins may leave raw haunches, human patrols may leave cooked rations, and forest folk can yield edible moonmint.'),
    block('Ore and timber from kills', table(['Lineage', 'Material', 'Chance', 'Quantity'],
      ((E.fieldwork as any).hunt.material_drops || []).map((drop: any) => [
        esc(drop.species.join(' · ')),
        esc(drop.resource),
        pc1(drop.chance), `${n0(drop.min)}–${n0(drop.max)}`,
      ])),
      'A body that is already metal or wood can leave a piece of it, paid into the same Material store the `mine` and `grove` sites fill. The site stays the bulk source — it owns the rate, the Skill XP and the Mastery — so a kill is the chance you meet on the way there, never the way to cap a Material.'),
    block('Hunger and provisions', table(['Food', 'Kind', 'Hunger restored', 'Source'],
      fieldwork.foods.map((food: any) => [
        esc(food.name), esc(food.kind), food.edible ? `+${n0(food.hunger_restore)}` : 'cooking ingredient', esc(food.source || '—'),
      ])),
      `Walking, hunting and gathering drain Hunger at their own configured rates. Town and a safe idle Camp pause it. Auto Eat defaults to ${n0((E.fieldwork as any).hunger.auto_eat.threshold_default)}%, uses cooked food → fruit → edible herbs, and saves raw food for empty-Hunger emergencies unless opted in earlier. At empty Hunger, HP regeneration is cut by ${n0((E.fieldwork as any).hunger.empty_hp_regen_cut_pct)}%; Energy Shield recharge stays unchanged. Each crossed road block also rolls a separate supply or rest event, in addition to its usual ambush chance.`),
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
      'Cook at a player-set Field Camp. A cooked meal restores Hunger and replaces the one active meal buff. Cooking, brewing and condensing count the bag space freed by their ingredients; if the output still cannot fit, nothing is spent.'),
    block('Potions', table(['Draught', 'Pool', 'Band', 'Effect', 'Brewed from'],
      ((E.potions as any).list || []).map((p: any) => [
        esc(p.name), esc(p.pool), esc(p.tier),
        wrap(`${n0(farm.potionEffect(p))}% of the pool, instantly`),
        `<span class="hy">${n0((E.potions as any).craft[p.tier].herbs)} herbs + ${n0((E.potions as any).craft[p.tier].reroll_value_stones)} ${STONE_NAME.reroll_value}s</span>`,
      ])),
      `Provisioning, not power: one shared cooldown of ${n0((E.potions as any).shared_cooldown_sec)} sec, at most ${n0((E.potions as any).max_uses_per_fight)} a fight, switched off entirely on a Boss (<code>potions.boss_suppressed</code>), ${n0((E.potions as any).weight)} weight each. Auto-use starts on at ${pts((E.potions as any).auto_use_default.hp_pct)} Health and ${pts((E.potions as any).auto_use_default.mana_pct)} Mana. That is why no potion moves a health line anywhere in the design.`),
    block('Condensed', table(['', 'What it takes', 'What it gives'], [
      ['A Condensed draught', `${n0((E.potions as any).condensed.cost_bottles)} bottles + ${n0((E.potions as any).condensed.cost_reroll_value_stones)} ${STONE_NAME.reroll_value}s`,
        `×${n0((E.potions as any).condensed.effect_mult)} effect, at ${n0((E.potions as any).condensed.weight)} weight (${n0((E.potions as any).condensed.weight_loose)} carried loose)`],
    ]), 'The one craft that turns a stack into a smaller stack: it buys bag space, never a bigger pool.'),
    block('The herb farm', table(['', 'The number', 'Read from'], [
      ['Plots', `${n0((E.farm as any).plots.base)} to start, ${n0((E.farm as any).plots.shop_deeds)} bought, ${n0(farm.plotsMax)} at most`, '<code>farm.plots</code>'],
      ['A grow', `${n1(farm.growthSec / 3600)} hours, then ${n0((E.farm as any).yield_per_harvest)} herbs`, '<code>farm.growth_hours</code> · <code>farm.yield_per_harvest</code>'],
      ['A replant', `${n0(farm.seedCostHerbs)} herb of the harvest goes back into the ground`, '<code>farm.seed_cost_herbs</code>'],
      ['A day', `${n0((E.farm as any).taps_per_day)} taps, and up to ${n1(farm.offlineCapSec / 3600)} hours of growth are paid while you are away`, '<code>farm.taps_per_day</code> · <code>farm.offline_cap_hours</code>'],
      ['A level', `cap ${n0((E.farm as any).level_cap)} · ${n0((E.farm as any).xp_per_harvest)} XP a harvest · the same curve as Weapon Mastery`, '<code>farm.level_*</code>'],
      ['Which draughts open', `low from ${n0((E.farm as any).tier_unlock_level.low)} · mid from ${n0((E.farm as any).tier_unlock_level.mid)} · high from ${n0((E.farm as any).tier_unlock_level.high)}`, '<code>farm.tier_unlock_level</code>'],
    ]), 'Settlement Farming provisions herbs for alchemy. Mining, Woodcutting, Hunting and Cooking are separate field skills; none of their XP is character XP.'),
    block('Herbs from the ground versus herbs from a fight', table(['Zone band', 'A bundle a kill', 'A bundle holds', 'A brewable draught a kill'],
      QUAL_BANDS.map((b: string) => [
        esc(b), pc1(farm.herbChance(b)), `${n0((E.herbs as any).bundle_min)}-${n0((E.herbs as any).bundle_max)} herbs`, pc1(farm.potionDropChance(b)),
      ])),
      'The bundle roll is its own, separate from gear and stones, and the lowest band pays nothing on it (<code>herbs</code> reads the mid and high chances only). A plot out-taps a hunt; a hunt out-pays a plot in everything else.'),
  ],
});

page({
  file: 'idle.html',
  nav: 'Away & bag',
  title: 'Away, and what you can carry',
  lead: 'The game keeps earning while the window is shut — at the same kill rate and the same loot count, on the shallowest quality the zone can roll. Nothing is deleted and nothing is auto-converted while you are not there to decide.',
  body: [
    block('While the window is shut', table(['', 'The number', 'Read from'], [
      ['How long it keeps paying', wrap(n0((E.inventory as any).offline_cap_hr)) + ' hours', '<code>inventory.offline_cap_hr</code>'],
      ['The farm while away', wrap(n1(farm.offlineCapSec / 3600)) + ' hours', '<code>farm.offline_cap_hours</code>'],
      ['Snapshots', `${n0((E.save as any).snapshot_slots)} walking copies, one every ${n0((E.save as any).snapshot_interval_min)} minutes`, '<code>save.snapshot_*</code>'],
      ['What else writes one', list((E.save as any).snapshot_triggers || []), '<code>save.snapshot_triggers</code> — a level up, and a successful Ascend or Refine'],
    ]), 'A snapshot guards the file against corruption only. A restore rewinds the whole account, so it is never an undo button for a decision you did not like.'),
    block('What away rolls at', table(['Zone band', 'Its Item-level window', 'Away drop band', 'Away Item level'],
      (E.item_level.spans || []).map((sp: any) => [
        `${esc(sp.band)} ${n0(sp.from)}-${n0(sp.to)}`, `<span class="hy">${n0(sp.from)}-${n0(sp.to)}</span>`,
        esc(sp.band), wrap(n0(eng.floorLevelOf(sp.band))),
      ])),
      'Away keeps the zone’s Item quality band and clamps the Item level to the first level of that band (<code>floorLevelOf</code>). Online drops use the mob’s level.'),
    block('The streams an Elite or a Boss owns', table(['Stone or piece', 'Every kill', 'An Elite', 'A Boss'], [
      [STONE_NAME.tier, 'one per ' + n0((E.salvage as any).pieces_per_tier_stone) + ' pieces dissolved', wrap(n2((E.loot as any).elite_tier_stones)), wrap(n0((E.loot as any).boss_tier_stones))],
      [STONE_NAME.reroll_value, 'one per piece dissolved', '<span class="hy">same</span>', '<span class="hy">same</span>'],
      [STONE_NAME.add, 'never', pc1((E.loot as any).elite_add_stone_chance), wrap(n0((E.loot as any).boss_add_stones))],
      ['Quality', pc1((E.loot as any).quality_stone_sources.monster_quality_chance), pc1((E.loot as any).quality_stone_sources.elite_quality_chance),
        wrap(n0((E.loot as any).quality_stone_sources.boss_quality_stones))],
      ['Repair', 'never', pc1((E.loot as any).repair_stone_sources.elite_repair_chance), wrap(n0((E.loot as any).repair_stone_sources.boss_repair_stones))],
      ['Replace', 'never', pc1((E.loot as any).replace_stone_sources.elite_replace_chance), pc1((E.loot as any).replace_stone_sources.boss_replace_chance)],
      ['Imprint', 'never', pc1((E.loot as any).imprint_stone_sources.elite_imprint_chance), wrap(n0((E.loot as any).imprint_stone_sources.boss_imprint_stones))],
      ['Corrupt', 'never', 'never', pc1((E.loot as any).corrupt_stone_sources.boss_corrupt_chance)],
      ['A skill piece', pc1((E.skill_drop as any).normal), pc1((E.skill_drop as any).elite), pc1((E.skill_drop as any).boss)],
    ]), 'The value half of the craft engine keeps running while you are away, because a dissolved piece pays it. Everything else on this table is a reason to be in the chair — see <a href="crafting.html">Crafting</a> for what each stone spends.'),
    block('The two bags', table(['Bag', 'Slots', 'What goes in it', 'How it stacks', 'What it weighs'], [
      ['Adventure bag', wrap(n0((E.inventory as any).adventure_slots)), 'gear loot, one piece per slot', 'one piece a slot', 'counted against your weight capacity'],
      ['Character bag', wrap(n0((E.inventory as any).character_slots)), 'stones, herbs, potions, field materials and provisions',
        `stones ${n0((E.inventory as any).stack_size.stone)} a slot · herbs and potions ${n0((E.inventory as any).stack_size.herb)} · materials ${n0((E.inventory as any).stack_size.material)} · provisions ${n0((E.inventory as any).stack_size.food)} a slot`,
        `stones ${n2((E.inventory as any).unit_weight.stone)} · herbs and potions ${n2((E.inventory as any).unit_weight.herb)} · materials ${n2((E.inventory as any).unit_weight.material)} · provisions ${n2((E.inventory as any).unit_weight.food)} each`],
      ['Gold', 'no slot at all (<code>gold_uses_slot</code>)', 'the junk money', '—', '—'],
      ['Junk', `${n0((E.junk as any).stack)} a slot`, 'what the Counterhand buys', 'deep stacks', `${n2((E.junk as any).unit_weight)} each`],
    ]), `A full bag is a pause, never a loss: <code>inventory.overflow</code> reads “${esc((E.inventory as any).overflow)}” — pickups stop, nothing auto-converts and nothing is deleted, and the client says which happened. A piece that cannot be carried is left on the ground. Manual salvage also waits if its Value stone, or a milestone Tier stone, cannot fit. Gear crafting and Stash are settlement services; Camp cooking is the field exception. The Stash is one warehouse that every settlement’s counter opens.`),
    block('Weight', table(['Carried', 'The cut to your attack speed', 'Read from'], [
      ['Your capacity', wrap(n1(eng.weightCapacityOf(EVEN))) + ' at the even split — Str is the only line that lifts it', '<code>weightCapacityOf</code>'],
      ['At capacity or under', `${pc1(eng.encumbranceOf(eng.weightCapacityOf(EVEN), EVEN))} cut`, '<code>encumbranceOf</code>'],
      ['A tenth over', `${pc1(eng.encumbranceOf(eng.weightCapacityOf(EVEN) * 1.1, EVEN))} cut`, '<code>encumbranceOf</code>'],
      ['Half again over', `${pc1(eng.encumbranceOf(eng.weightCapacityOf(EVEN) * 1.5, EVEN))} cut, and that is the bound — <code>caps.weight_overload</code> is where the tax stops climbing`, '<code>encumbranceOf</code>'],
    ]), 'The tax is a slowdown, never a slot lock: a full bag swings slower and still swings. A heavy frame is therefore a weight question before it is a damage question, and Mastery answers it — ' +
      `−${pts((BASES.mastery as any).weight_discount_per_level_pct)} weight a level while that weapon is held (<code>masteryBonus</code>).`),
    block('The bag filter', table(['Line', 'What it does', 'The number'], [
      ['Upgrade margin', 'keeps a piece only when it beats what you wear in the same slot by more than noise', wrap(pts((E.loot as any).filter.upgrade_margin_pct))],
      ['Keep a missing Element', 'keeps Elemental resistance of an Element you do not hold', yes((E.loot as any).filter.rules.default_keep_missing_element)],
      ['On by default', 'a fresh character keeps every drop and dissolves nothing', yes((E.loot as any).filter.rules.default_enabled)],
      ['Stored per slot', 'a player setting, so a raised threshold is never a second copy of the number', '<span class="hy"><code>loot.filter.rules</code></span>'],
    ]), 'Only a slot whose filter is armed dissolves a piece, and a dissolved piece pays the Value stone. Manual salvage keeps the piece if its payout cannot fit. Auto Equip preserves locked worn pieces and skips Broken gear. Stones are always kept.'),
    block('Junk: reference values', table(['Junk kind', 'Base value', 'A kill pays it', 'Expected base gold a kill'],
      Object.entries((E.junk as any).rarities || {}).map(([r, v]: any) => [
        esc(r), wrap(`${n0(v.sell_gold)} gold`), pc1(v.drop_chance_per_kill), wrap(n2(v.sell_gold * v.drop_chance_per_kill)),
      ])),
      'Each Species may add junk alternatives in selected rarities to its Variants’ own items. The last column is the reference stream before town demand: rarity changes drop frequency while preserving expected base value. The town buyer and its remaining category demand decide actual gold. Junk weighs nothing and stacks deep; compare buyers on the Economy page and in Market.'),
  ],
});

page({
  file: 'travel.html',
  nav: 'Travel',
  title: 'Travel and the Waypoint',
  lead: 'The world is a hex sheet and a walk is a count of blocks. Blocks come out of the lattice coordinates, never a typed distance, so a route has a length and never a price.',
  body: [
    block('One block', table(['', 'The number', 'Read from'], [
      ['Time', wrap(n0(road.blockSec)) + ' sec a block', '<code>road.block_sec</code>'],
      ['An encounter a block', pc1(road.encounterChance()), '<code>road.encounter_chance_pct</code>'],
      ['A trail event a block', pc1((E.fieldwork as any).travel_events.chance_per_block), 'an independent supply or rest roll; it never replaces the encounter roll'],
      ['What ambushes you', 'an ordinary mob group from the lower of the two zones the walk joins, at that zone’s own level range and at the pack of the side it walks onto — the zone’s own pack on bare ground', '<code>road.encounter_rule</code>'],
      ['What it pays', 'the ordinary per-kill drop roll and nothing else', '<code>road.encounter_rule</code> — no purse, no chest, no Standing, no stone'],
      ['Losing one', 'a same-zone Field Camp receives you and ends the walk; without one, recover and resume at the ambush block', '<code>road.push_rule</code>'],
    ]), 'Walking pays no gold directly. It can carry cargo to a buyer with better demand; compare the extra sale value with travel time, provisions and any Waypoint fee in Market.'),
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
    })(), 'A warp is priced per block at the destination settlement’s own band (<code>waypoint_warp.m_per_block</code> against <code>goldPerMinute</code>), so a short hop is cheap and a crossing of the map is not. It buys back the walk’s time and nothing else.'),
    block('The Waypoint', table(['', 'The rule', 'Read from'], [
      ['Earning one', 'arriving on foot, once', '<code>road.waypoint_rule</code>'],
      ['What it reaches', 'any settlement you have already walked to', '<code>road.waypoint_rule</code>'],
      ['What it never does', 'gate a zone — no gold opens a Waypoint the foot has not earned', '<code>road.waypoint_rule</code>'],
      ['Where the price lives', 'the destination band’s rate, not a seller’s markup', `<code>town.json waypoint_warp</code> · <code>engine.goldPerMinute</code>`],
      ['Later', 'a Waystone will be a second destination kind on the same rule', '<code>road.waypoint_rule</code>'],
    ]), `Every pair of the ${n0((TOWN.settlements || []).length)} settlements is walkable: there is no edge list and no route to buy (<code>road.graph_rule</code>). The sheet’s cells, pins and walk stretches are gated against the same lattice, so a distance on this page is the distance on the ground — see <a href="world.html">World</a>.`),
  ],
});

page({
  file: 'builds.html',
  nav: 'Builds',
  title: 'Builds, skill pieces and the finish line',
  lead: 'Skills are found, not bought, and a skill you already own is climbed by finding the same piece again. What a build is measured against is published, so the target is a number you can check rather than a guide someone wrote.',
  body: [
    block('Finding a skill', table(['From', 'A skill piece a kill', 'What it means'], [
      ['A normal mob', pc1((E.skill_drop as any).normal), 'the slow path — a skill is a find, not a purchase'],
      ['An Elite', pc1((E.skill_drop as any).elite), `about ${n0(Math.round((E.skill_drop as any).elite / (E.skill_drop as any).normal))}× the normal rate`],
      ['A Boss', pc1((E.skill_drop as any).boss), 'the only place duplicates come thick, and the only place a Boss fight is open to you'],
    ]), 'A skill piece is its own stream, separate from gear and stones (<code>skill_drop.note</code>). The roster itself is on <a href="skills.html">Skills</a>.'),
    block('The duplicate ladder', table(['Step', 'Cooldown reduction it buys', 'Duplicates for the step', 'Duplicates to reach it'],
      (sm.LADDER as any[]).map((l: any) => [
        wrap(n0(l.step)), pts(l.cdr), wrap(n0(l.cost)), wrap(n0(sm.ladderCostToStep(l.step))),
      ])),
      `${n0(sm.LADDER_MAX_DUPLICATES)} duplicates is the whole ladder. A skill’s own level climbs on kills while it is slotted or toggled on, up to ${n0(sm.LEVEL_CAP)}, and that level is account-wide (<code>presets.skill_xp_is_account_wide</code>) — the two ramps are independent: the ladder buys cooldown, the level buys damage and effect strength.`),
    block('What an aura holds back', table(['Aura', 'Reserve tier', 'Mana it holds open', 'What it writes'],
      sm.of('aura').map((a: any) => [
        esc(a.name), esc(a.reserve), wrap(`${n0(sm.reservePct(a.reserve))}%`),
        `<span class="hy">${esc(a.effect || '')}</span>`,
      ])),
      `Reserve tiers are <code>skills.json reserve_tiers</code>, and the total may not reach ${n0(sm.RESERVATION_LIMIT)}% — an aura’s cost is a budget you read up front, not a number you recompute mid-fight. A paid row has one typed flat cost: Mana or current HP. Both climb only with the skill’s own level; pool size controls affordability, not price. HP costs leave one HP, and only Mana costs receive the AoE premium.`),
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
      `The shape the data writes for the physical line: <code>${esc((E.build as any).reference_split)}</code>. <code>engine.REFERENCE</code> prices a full set on it at anchor level ${n0(EREFERENCE.anchorLevel)}: ${n0(EREFERENCE.line.dps)} damage a second on the even split against ${n0(EREFERENCE.focused.dps)} on a build that spends every item on one stat — a kill in ${n1(EREFERENCE.ttk)} sec against ${n2(EREFERENCE.focusedTtk)} sec.`),
    block('The finish line', table(['Level', 'Kills to reach it', 'What it is'], [
      ...Object.entries((eng as any).CHECKPOINTS_KILLS || {}).map(([k, v]: any) => {
        const lv = Number(String(k).split('_')[1]);
        return [esc(`level ${n0(lv)}`), wrap(n0(v)),
          lv === S.level_cap ? 'the level Cap' : lv === S.paragon_from - 1 ? 'Paragon starts here' : lv === S.mob_level_cap ? 'the mob level bound' : ''];
      }),
      ['The win', 'one fight', `<strong>${esc((eng.winTarget() as any).name)}</strong> — zone ${n0((eng.winTarget() as any).zone)}, level ${n0((eng.winTarget() as any).level)}, ${n0((eng.winTarget() as any).hp)} health, killed inside a single spawn without being Pushed`],
      ['Past the Cap', wrap(n0((eng as any).PUSH_KILLS_91_100)) + ' kills', 'the stretch from level 90 to level 100, counted in the same currency as everything else (<code>PUSH_KILLS_91_100</code>)'],
    ]), `There is no prestige and no reset: the level Cap is ${n0(S.level_cap)}, Paragon points run from ${n0(S.paragon_from)}, and the tree pays ${n0(S.tree_points_per_level)} point a level (<code>stat.tree_points_per_level</code>). Remaining goals are counted, never timed — see <a href="crafting.html">Crafting</a> and <a href="progression.html">Progression</a>.`),
    block('Counted, never timed', table(['Goal', 'What it spends', 'Read from'], [
      ['A full Ascend set', `${n0((E.craft as any).ascend_items_per_set)} pieces, each climbed one band`, '<code>craft.ascend_items_per_set</code>'],
      ['A full Refine pass', `${STONE_NAME.tier} at <code>refine_stones_per_use</code> a cast, on every line you choose to climb`, '<code>craft.refine_stones_per_use</code>'],
      [`Every weapon type to Mastery ${n0((BASES.mastery as any).level_cap)}`, `${n0((BASES.weapons || []).length)} ladders, and the account-wide drop bonus is the reason to walk them`, '<code>engine/mastery.ts</code>'],
      ['One skill to its top', `${n0(sm.LADDER_MAX_DUPLICATES)} duplicates`, '<code>skills.json ladder</code>'],
    ]), 'How long any of it takes is your own pace — the design gates nothing on it.'),
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
body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.55 var(--ui); }
a { color: var(--gold); text-decoration: none; }
a:hover { text-decoration: underline; }
.layout { display: flex; align-items: flex-start; gap: 2rem; max-width: 116rem; margin: 0 auto; padding: 2rem 2.5rem 4rem; }
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
thead th { position: sticky; background: var(--panel); z-index: 1; }
thead tr:first-child th { top: 0; }
tbody tr:nth-child(even) { background: rgba(255,255,255,.028); }
tbody tr:hover { background: rgba(255,255,255,.06); }
/* One table, its rows split into tabbed groups: the strip is a radio group, each tab is a <tbody>, and a
   press swaps which body shows over the shared header — no script, so the static build and the live wiki
   behave alike. Generic over the group count a page declares (three here). */
.tabs { margin: .9rem 0 1.4rem; }
.tabs > input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.tabs > label {
  display: inline-flex; align-items: baseline; gap: .45em; padding: .3em .9em; margin: 0 .25rem -.0625rem 0;
  border: 1px solid var(--line); border-bottom: 0; border-radius: var(--radius-sm);
  color: var(--dim); font-size: .88rem; cursor: pointer;
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
.tabs table { margin-top: 0; }
.twrap { overflow: hidden; margin: 0 -0.25rem; padding: 0 0.25rem; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--panel); }
.twrap table { width: 100%; min-width: 0; table-layout: fixed; }
.twrap th, .twrap td { overflow-wrap: anywhere; }
.twrap td:first-child { white-space: normal; }
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
.plist { list-style: none; margin: .15rem 0 0; padding: 0; font-size: .78rem; }
/* one grid for the whole cell: every key shares track one at the width of the longest key in that
   cell, every value takes track two — display:contents promotes each key/value pair to the grid,
   so a spelled-out label like "damage per second" costs no wrap and nothing runs into its number */
.plist { display: grid; grid-template-columns: minmax(4rem, max-content) minmax(2.5rem, 1fr); column-gap: .5rem; row-gap: .03rem; }
.plist li { display: contents; }
.plist .pk { font-family: var(--ui); color: var(--dim); }
.plist .pv { font-family: var(--num); font-variant-numeric: tabular-nums; min-width: 0; }
.zone { margin: .65rem 0; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--panel); }
.zone > summary { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: .25rem .8rem; padding: .65rem .8rem; cursor: pointer; }
.zone > summary:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.zone > summary::marker { color: var(--gold); }
.zone-title { font-weight: 600; }
.zone-meta { color: var(--dim); font-size: .8rem; }
.zone[open] > summary { border-bottom: 1px solid var(--line); }
.zone-body { padding: .1rem .8rem .8rem; }
@media (max-width: 40rem) { .zone > summary { display: block; } .zone-meta { display: block; margin-top: .25rem; } }
.race-roster { display: grid; gap: .9rem; margin-top: .5rem; }
.race-group { border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--inset); padding: .65rem; }
.race-group > header { display: flex; align-items: baseline; justify-content: space-between; gap: .6rem; border-bottom: 1px solid var(--line); padding: 0 .2rem .4rem; color: var(--dim); }
.race-group > header h3 { margin: 0; color: var(--gold); font-size: .9rem; }
.race-group > header span, .species-count { font-family: var(--num); font-size: .75rem; }
.race-empty { margin: .55rem .2rem .2rem; color: var(--dim); font-size: .8rem; }
.species-roster { display: grid; gap: .65rem; margin-top: .6rem; }
.species-entry { border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--panel); padding: .65rem .8rem .8rem; }
.species-entry > header { display: flex; align-items: baseline; justify-content: space-between; gap: .6rem; border-bottom: 1px solid var(--line); padding-bottom: .4rem; }
.species-entry h4 { margin: .45rem 0 .2rem; color: var(--dim); font-size: .72rem; text-transform: uppercase; letter-spacing: .05em; }
.species-entry > header h4 { margin: 0; color: var(--text); font-size: 1rem; text-transform: none; letter-spacing: 0; }
.species-count { color: var(--gold); }
.species-facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .45rem .8rem; margin: .55rem 0 .75rem; }
.species-facts div { display: grid; gap: .1rem; min-width: 0; font-size: .8rem; overflow-wrap: anywhere; }
.species-facts b { color: var(--dim); font-size: .68rem; text-transform: uppercase; letter-spacing: .04em; }
.species-entry table { font-size: .78rem; }
.species-entry th, .species-entry td { padding: .28rem .4rem; overflow-wrap: anywhere; }
@media (max-width: 58rem) { .species-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 36rem) { .species-facts { grid-template-columns: 1fr 1fr; } .species-entry { padding: .6rem; } }
.legend { margin: 0; padding-left: 1.1rem; font-size: .82rem; color: var(--dim); }
.legend li { margin: .3rem 0; }
.legend strong { color: var(--text); }
.num { font-family: var(--num); font-variant-numeric: tabular-nums; }.tag { border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 0 .25rem; color: var(--dim); font-size: .68rem; text-transform: uppercase; }
ol { margin: .2rem 0; padding-left: 1.3rem; }
li { margin: .15rem 0; }`;

/** Everything inside <body>: the theme, the nav and the page. */
export const pageBody = (p: Page, active: string, tokens: string): string =>
  `<style>${tokens}
${LAYOUT}</style><div class="layout">
<nav>${PAGES.map((q) => `<a class="${q.file === active ? 'on' : ''}" href="${q.file}">${esc(q.nav)}</a>`).join('')}</nav>
<main><h1>${esc(p.title)}</h1><p class="lead">${p.lead}</p>${p.body.join('\n')}
<p class="note">Rendered from <span class="num">tools/data/*.json</span> and <span class="num">engine/</span> — nothing here is typed by hand.</p>
</main></div>`;

/** A whole document, for the static build. */
export const renderDoc = (p: Page, active: string, tokens: string): string =>
  `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.title)}</title></head>
<body>` + pageBody(p, active, tokens) + '</body></html>';

export { PAGES };
export type { Page };
