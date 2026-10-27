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
import { E as ENGINE, MODS as MODS_DATA, TOWN as TOWN_DATA, BASES as BASES_DATA, SKILLS as SKILLS_DATA, MOB_SKILLS as MOB_SKILLS_DATA, eng, loot, sm, tree, road, farm, fieldwork, trade } from '../engine/client.ts';
import { STONE_NAME, PRESS_NAME } from '../../../engine/craft.ts';
import { keystoneDef } from '../../../engine/keystones.ts';
import { buildPassiveTreeView, treeOrbitPath, treeViewNodeRadius } from '../ui/passive-tree/passive-tree-view.ts';
import { describeSkill } from '../sim/combat/skill-copy.ts';
import { WIKI_RUNTIME } from './runtime.ts';

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
const escAttr = (s: any): string => esc(s).replace(/"/g, '&quot;');
const n0 = (n: any): string => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—');
const n1 = (n: any): string => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—');
/** A published multiplier keeps its decimal: ×1.8 must never render as ×2. */
const xOf = (n: any): string => (Number.isFinite(Number(n)) ? String(Math.round(Number(n) * 10) / 10) : '—');
const list = (a: any): string => (a || []).map((x: any) => esc(x)).join(' · ');
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

type ChapterId = 'start' | 'character' | 'combat' | 'gear' | 'world' | 'trade' | 'appendix';
type Page = { file: string; nav: string; title: string; lead: string; body: string[]; group?: ChapterId };
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
const KEYSTONE_COST = Number((tree as any).kinds?.keystone?.cost ?? 1);
/** The Notable a Keystone hangs off — the only entrance the tree allows. */
const keystoneEntrance = (node: any): string => {
  const id = (node.needs || []).find((n: string) => /^notable\./.test(n));
  return id ? keystoneName(id) : '—';
};
/** The authored bundle parameters, with the unit the registry declares for each name. */
const keystoneNumbers = (node: any): string => {
  const effect = (node.effects || [])[0];
  if (!effect || effect.kind !== 'keystone' || !effect.key) return '';
  const def = keystoneDef(effect.key);
  return Object.entries(effect.params || {}).map(([name, value]: [string, any]) => {
    if (typeof value !== 'number') return `<code>${esc(name)} ${esc(value)}</code>`;
    const kind = def.params[name];
    const unit = kind === 'pct' || kind === 'pct-positive' ? '%' : kind === 'sec' ? ' sec' : kind === 'rate' ? '/sec' : kind === 'points' ? ' pts' : '';
    return kind === 'mult' ? `<code>${esc(name)} ×${fig(value)}</code>` : `<code>${esc(name)} ${fig(value)}${unit}</code>`;
  }).join(' ');
};
const TREE_CURRENCY = (tree as any).currencies?.tree || {};
const QUEST_REWARDS = TOWN_DATA.quest_rewards;
const TREE_POINT_CURVE = `base ${wrap(n0(TREE_CURRENCY.base ?? 0))}` + ((TREE_CURRENCY.level_ranges || []) as any[])
  .map((r: any) => ` + ${wrap(n0(r.per))} a level from ${wrap(n0(r.from))}–${wrap(n0(r.to))}`).join('');
const TREE_REGION_NAMES: Record<string, string> = {
  str: 'Strength', agi: 'Agility', dex: 'Dexterity', int: 'Intelligence',
  wis: 'Wisdom', vit: 'Vitality', lck: 'Luck',
};
const treeKindLabel = (kind: string): string => kind === 'normal' ? 'Passive' : kind.charAt(0).toUpperCase() + kind.slice(1);
/** A short, player-shaped line: `+1 str`, `+15 mana`, `+10% max hp`. */
const TREE_LINE_NAMES: Record<string, string> = {
  max_hp: 'max hp', hp: 'max hp', mana: 'mana', armour: 'armour', evasion: 'evasion',
  accuracy: 'accuracy', attack_speed: 'attack speed', crit_chance: 'crit chance',
  crit_damage: 'crit damage', crit_dmg: 'crit damage', physical_power: 'phys',
  magic_power: 'magic', elemental_power: 'elemental', elemental_resistance: 'elemental res',
  all_resistance: 'all res', hp_regen: 'hp regen', mana_regen: 'mana regen',
  life_regen: 'hp regen', energy_shield: 'energy shield', es_regen: 'es regen',
  leech: 'leech', life_leech: 'leech', block: 'block', perfect_dodge: 'perfect dodge',
  stun_chance: 'stun', bleed_chance: 'bleed', armour_pen: 'armour pen',
  res_cap: 'res cap', elemental_resistance_cap: 'res cap', cdr: 'cdr',
  weight: 'weight', move_speed: 'move speed', damage: 'damage', damage_taken: 'damage taken',
};
const TREE_MOD_BY_ID = new Map(((MODS as any).mods || []).map((m: any) => [m.id, m]));
const TREE_LINE_SHORT: Record<string, string> = {
  ...TREE_LINE_NAMES,
  all_resistance: 'all res', armour_pen: 'armour pen', attack_damage: 'attack damage',
  attack_speed: 'attack speed', bleed_chance: 'bleed', block_chance: 'block', cooldown_reduction: 'cooldown',
  critical_chance: 'crit chance', critical_damage: 'crit damage', elemental_alignment: 'alignment',
  elemental_power: 'elemental', elemental_resistance: 'elemental res', energy_shield: 'energy shield',
  energy_shield_regen: 'es regen', evasion: 'evasion', life_regen: 'hp regen', magic_power: 'magic',
  mana_regen: 'mana regen', max_energy_shield: 'energy shield', max_hp: 'max hp', max_mana: 'mana',
  perfect_dodge: 'perfect dodge', physical_power: 'phys', spell_damage: 'spell damage',
  stat_mod: 'core stat', status_resistance: 'status res', stun_chance: 'stun',
};
const treeGrantText = (grant: any, value?: number): string => {
  const v = value ?? (grant.values || [])[0] ?? 0;
  if (grant.stat) return `+${fig(v)} ${grant.stat}`;
  const id = String(grant.id || '');
  const mod: any = TREE_MOD_BY_ID.get(id);
  const modName = String(mod?.name || '');
  const pct = mod ? / %$/.test(modName) : /_pct$/.test(id);
  const base = id.replace(/_(?:flat|pct)$/, '');
  const fallback = modName.replace(/\s+(?:%|flat)$/i, '').toLowerCase() || base.replace(/_/g, ' ');
  const label = TREE_LINE_SHORT[base] || fallback;
  return `+${fig(v)}${pct ? '%' : ''} ${label}`;
};
const treeGrantSummary = (grants: any[]): string =>
  [...new Set((grants || []).map((g) => treeGrantText(g)))].join(' · ');
const treeCurrencyLabel = (currency: string): string =>
  currency === 'tree' ? 'tree point' : currency === 'attainment' ? 'attainment point' : String(currency || 'point');
const treeKindCost = (kind: string): number =>
  Number(((tree as any).kinds?.[kind]?.cost) ?? (kind === 'notable' ? 3 : 1));
/** The name the board prints: a normal names its Core line, a named node its name, an unnamed
 *  Notable the lines it grants. */
const treeNodeTitle = (node: any): string => {
  if (node.kind === 'normal' && node.grants?.[0]) return treeGrantText(node.grants[0]);
  if (node.kind === 'notable') return treeGrantSummary(node.grants) || node.name || node.id;
  if (node.name && !/^[A-Z]{3} Focus \d+$/.test(node.name)) return node.name;
  return treeGrantSummary(node.grants) || node.name || node.id;
};
const treeNodeDetail = (node: any): string => node.kind === 'keystone' ? (node.description || '') : '';
const treeNodeMeta = (node: any): string =>
  `${treeKindLabel(node.kind)} · ${TREE_REGION_NAMES[node.wing] || node.wing} · ${n0(node.cost ?? treeKindCost(node.kind))} ${treeCurrencyLabel(node.currency)}${Number(node.cost) === 1 ? '' : 's'}`;

const treeIconRoot = '../../game/src/icon';
const treeWingIcons: Record<string, string> = {
  str: `${treeIconRoot}/gear/weapon/crossed-swords-1.png`,
  agi: `${treeIconRoot}/gear/armour/winged-boots.png`,
  dex: `${treeIconRoot}/gear/weapon/bow-arrow.png`,
  int: `${treeIconRoot}/gear/weapon/staff.png`,
  wis: `${treeIconRoot}/skill/eye.png`,
  vit: `${treeIconRoot}/skill/heart-beats.png`,
  lck: `${treeIconRoot}/gear/accessory/gem-pendant.png`,
};
/** The same PNG the game's board puts in the node; normal nodes keep the core dot at overview scale. */
const treeNodeIcon = (node: any): string => {
  const wing = treeWingIcons[node.wing] || `${treeIconRoot}/gear/accessory/gem-pendant.png`;
  if (node.kind === 'normal') return wing;
  const text = [node.id, node.description, ...(node.grants || []).map((grant: any) => grant.id), ...(node.effects || []).map((effect: any) => effect.key)].join(' ').toLowerCase();
  if (/armour|block|shield|resist/.test(text)) return `${treeIconRoot}/gear/offhand/shield-crest.png`;
  if (/life|hp|regen|leech|blood/.test(text)) return `${treeIconRoot}/skill/heart-beats.png`;
  if (/speed|move|evade|dodge/.test(text)) return `${treeIconRoot}/gear/armour/winged-boots.png`;
  if (/fire|cold|lightning|element|burn/.test(text)) return `${treeIconRoot}/skill/fireball.png`;
  if (/spell|mana|cast|aura/.test(text)) return `${treeIconRoot}/gear/weapon/staff.png`;
  if (/crit|accuracy|projectile|bow/.test(text)) return `${treeIconRoot}/gear/weapon/bow-arrow.png`;
  if (/attack|physical|weapon|melee|bleed/.test(text)) return `${treeIconRoot}/gear/weapon/crossed-swords-1.png`;
  return wing;
};

/** The same canonical board the game draws: node positions, `needs` roads, cross-region links and
 *  the seven region anchors. The runtime adds pan/zoom and the node detail panel. */
const treeViewer = (): string => {
  const layout: any = (tree as any).layout || { nodeRadius: 4 };
  const graph: any = (tree as any).graph || { start: { x: 0, y: 0 } };
  const model = buildPassiveTreeView((tree as any).nodes || [], graph.start);
  const nodeRadius = (node: any): number => treeViewNodeRadius(node, layout);
  const edgeMap = new Map<string, string>();
  const draw = (aId: string, bId: string, shape = 'line'): void => {
    const key = [aId, bId].sort().join('|');
    if (edgeMap.has(key)) return;
    const a = aId === 'start' ? graph.start : model.byId[aId];
    const b = model.byId[bId];
    if (!a || !b) return;
    const aNode = model.byId[aId], bNode = model.byId[bId];
    const cross = !!aNode && !!bNode && aNode.wing !== bNode.wing;
    const path = shape === 'arc' ? treeOrbitPath(a, b, graph.start) : `M${a.x} ${a.y}L${b.x} ${b.y}`;
    edgeMap.set(key, `<path class="tree-link${cross ? ' cross' : ''}" d="${path}"/>`);
  };
  for (const node of model.nodes) for (const parent of node.needs || []) draw(parent, node.id);
  for (const link of ((tree as any).links || [])) draw(link.a, link.b, link.shape);
  const nodes = model.nodes as any[];
  const regionSvg = model.regions.map((region) =>
    `<g class="tree-region ${region.id}" transform="translate(${region.x} ${region.y})">
      <text class="region-code" text-anchor="middle">${esc(region.id.toUpperCase())}</text>
      <text class="region-name" text-anchor="middle" y="17">${esc(TREE_REGION_NAMES[region.id] || region.id)}</text>
    </g>`).join('');
  const nodeSvg = nodes.map((node) => {
    const r = nodeRadius(node);
    const title = treeNodeTitle(node);
    const detail = treeNodeDetail(node);
    const meta = treeNodeMeta(node);
    const corners = node.kind === 'keystone'
      ? `<path class="tree-keystone-corners" d="M${-r - 4} -5v-9h9M${r + 4} -5v-9h-9M${-r - 4} 5v9h9M${r + 4} 5v9h-9"/>`
      : '';
    const iconSize = r * (node.kind === 'keystone' ? 1.02 : 1.32);
    const face = node.kind === 'normal'
      ? `<circle class="tree-node-core" r="${(r * 0.34).toFixed(1)}"/>`
      : `<image class="tree-node-icon" href="${treeNodeIcon(node)}" x="${(-iconSize / 2).toFixed(1)}" y="${(-iconSize / 2).toFixed(1)}" width="${iconSize.toFixed(1)}" height="${iconSize.toFixed(1)}" clip-path="url(#wiki-tree-icon-clip)"/>`;
    return `<g class="wiki-tree-node ${node.wing} ${node.kind}" data-node-id="${escAttr(node.id)}"
        data-name="${escAttr(title)}" data-meta="${escAttr(meta)}" data-detail="${escAttr(detail)}"
        data-x="${node.x}" data-y="${node.y}" transform="translate(${node.x} ${node.y})" role="img"
        aria-label="${escAttr(`${title} — ${meta}`)}">
      <circle class="tree-node-halo" r="${(r + 4).toFixed(1)}"/>
      ${node.kind === 'normal' ? '' : `<circle class="tree-node-rim" r="${(r + 1.6).toFixed(1)}"/>`}
      <circle class="tree-node-face" r="${r.toFixed(1)}"/>
      ${face}
      ${corners}
      <circle class="tree-node-hit" r="${Math.max(r + 2, 8).toFixed(1)}"/>
    </g>`;
  }).join('');
  const notables = nodes.filter((node) => node.kind === 'notable').length;
  const keystones = nodes.filter((node) => node.kind === 'keystone').length;
  return `<div class="wiki-tree-view" data-tree-view>
    <div class="wiki-tree-bar">
      <div class="wiki-tree-heading">
        <p class="eyebrow">Interactive tree</p>
        <strong>${n0(nodes.length)} nodes · ${n0(notables)} notables · ${n0(keystones)} keystones</strong>
      </div>
      <div class="wiki-tree-controls" role="group" aria-label="Tree view controls">
        <button type="button" class="tree-tool" data-tree-fit aria-label="Fit the tree to the view"><span class="icon-mask tree-tool-icon" aria-hidden="true"></span></button>
        <button type="button" class="tree-tool" data-tree-zoom="0.8" aria-label="Zoom out"><span class="icon-mask tree-tool-icon" aria-hidden="true"></span></button>
        <span class="tree-zoom" data-tree-zoom-label aria-live="polite">100%</span>
        <button type="button" class="tree-tool" data-tree-zoom="1.25" aria-label="Zoom in"><span class="icon-mask tree-tool-icon" aria-hidden="true"></span></button>
      </div>
    </div>
    <div class="wiki-tree-chips" role="group" aria-label="Jump to a region">
      ${model.regions.map((region) => `<button type="button" class="tree-chip ${region.id}" data-tree-region="${region.id}" aria-pressed="false" aria-label="Show the ${escAttr(TREE_REGION_NAMES[region.id] || region.id)} region">${esc(region.id.toUpperCase())}</button>`).join('')}
    </div>
    <div class="wiki-tree-stage" data-tree-stage tabindex="0" role="group" aria-label="Passive tree board. Drag or use the arrow keys to pan; plus and minus zoom; zero fits the tree.">
      <svg class="wiki-tree-svg" data-tree-svg viewBox="${model.bounds.x} ${model.bounds.y} ${model.bounds.width} ${model.bounds.height}" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Passive skill tree and its roads">
        <defs><clipPath id="wiki-tree-icon-clip" clipPathUnits="objectBoundingBox"><circle cx=".5" cy=".5" r=".5"/></clipPath></defs>
        <g class="tree-links">${[...edgeMap.values()].join('')}</g>
        <g class="tree-regions">${regionSvg}</g>
        <g class="tree-origin" transform="translate(${graph.start.x} ${graph.start.y})">
          <circle class="origin-ornament" r="56"/><circle class="origin-rim" r="30"/><circle class="origin-face" r="24"/>
          <image class="origin-mark" href="${treeIconRoot}/plant/oak.png" x="-19" y="-19" width="38" height="38"/><text class="origin-label" text-anchor="middle" y="78">ORIGIN</text>
        </g>
        <g class="tree-nodes">${nodeSvg}</g>
      </svg>
      <div class="wiki-tree-card" data-tree-card role="tooltip" hidden></div>
      <p class="wiki-tree-hint">Drag to pan · Scroll to zoom · Pinch on touch</p>
      <div class="wiki-tree-legend" aria-hidden="true">
        <span class="l-normal">Passive</span><span class="l-notable">Notable</span><span class="l-keystone">Keystone</span><span class="l-cross">Cross-region road</span>
      </div>
    </div>
  </div>`;
};
/** A Mod id as the name the player reads — the same table the engine rolls from. */
const modName = (id: any): string => (id ? ((MODS.mods || []).find((m: any) => m.id === id)?.name || String(id)) : '—');
/** A flat value is the number without `%`; the word itself is noise in player copy. */
const modLabel = (id: any): string => modName(id).replace(/\s+flat\b/gi, '').trim();
/** One Mod's window per Item quality band, exactly as the data states its ladder. */
const modBands = (m: any): string => (m.bands || []).map((b: any) =>
  (b || []).map((w: any) => `${n0(w[0])}-${n0(w[1])}`).join(' → ')).join('  ·  ');

// ---------------------------------------------------------------- pages

page({
  file: 'index.html',
  nav: 'Overview',
  title: 'ModWorld — how to play',
  lead: 'An open-world idle RPG. Your character fights while the window is open and while it is shut.',
  body: [
    block('A run, in six steps', `<ol>
      <li><strong>Pick a settlement</strong> and a zone. In the field, a player-set Camp opens gathering and cooking.</li>
      <li><strong>Fight</strong> — the character attacks on the clock; paid skills use Mana or current-HP costs, while auras reserve Max Mana.</li>
      <li><strong>Loot</strong> — kills pay XP and their separate gear, junk, stone and skill-piece rolls; hunting can also yield field provisions.</li>
      <li><strong>Decide</strong> — equip the piece, or feed it to the crafting stones.</li>
      <li><strong>Craft</strong> at a settlement: choose gear for the bench, right-click a stone, then click the item or a highlighted Mod line. Shift-click repeats; Esc cancels.</li>
      <li><strong>Climb</strong> to the next zone. A Push costs recovery time: a Field Camp in that zone receives you and ends the walk; otherwise the route resumes at its interrupted block.</li>
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
    `<li><span class="fk">${esc(e.stat)}${e.element ? `:${esc(e.element)}` : ''}${e.status ? `:${esc(e.status)}` : ''}${e.condition ? ` <em>if ${esc(e.condition)}</em>` : ''}</span>` +
    `<span class="fs">${sideOf(s, e)}</span><span class="fv">${fxVal(e, at[i].value)}</span></li>`);
  if (s.type === 'attack') items.unshift(`<li><span class="fk">press</span><span class="fs">mob</span><span class="fv">${press(s, 'glass', level)}</span></li>`);
  return `<ul class="fx">${items.join('')}</ul>`;
};
const ST: any = (E as any).status || {};
page({
  file: 'skills.html',
  nav: 'Skills',
  title: 'Skills',
  lead: `How a press is timed, paid and resolved. The full row list is on <a href="skills-roster.html">Skill roster</a>; statuses and the Alignment gate are on <a href="statuses.html">Statuses</a>.`,
  body: [
    block('When a skill fires', table(['Leg', 'Holds when', 'Reads'], [
      ['boss', 'the front target is a Boss or Unique', 'target kind'],
      ['hpBelowPct', 'our missing HP share reaches the number', 'character pool'],
      ['statusMissing', 'the target lacks the status or curse this row applies', 'row + status store'],
      ['minTargets', 'the fight holds at least this many bodies', 'group width'],
      ['manaFloorPct', 'the press would leave at least this share of usable Mana', 'pool after cost'],
      ['statusPresent', 'the target holds the status this row exploits', 'row effect + status store'],
      ['statusStacksAtLeast', 'that status holds at least this many stacks', 'row effect + status store'],
      ['selfDebuffed', 'the character carries any live status', 'character statuses'],
    ]), 'Every enabled leg is an OR; a row may wait on more than one fact. Each slot is <code>always</code>, <code>never</code> or <code>conditional</code>.'),
    block('Windup, release and impact', (() => {
      const profiles = SKILLS.meta.action_profiles || {};
      return table(['Delivery', 'Windup', 'Impact delay', 'Projectile speed', 'Hit radius', 'Recovery'],
        Object.entries(profiles).map(([delivery, p]: any) => [
          esc(delivery), `${n2(p.windup_sec)} sec`, `${n2(p.impact_delay_sec)} sec`,
          p.projectile_speed_mps ? `${n1(p.projectile_speed_mps)} m/sec` : '—',
          `${n2(p.hit_radius_m)} m`, `${n2(p.recovery_sec)} sec`,
        ]));
    })(), 'A live cast pays its Mana or HP and starts its cooldown at release, not when the windup begins. Damage and statuses land at impact: melee checks range then, a projectile travels from its release aim and may meet another body, and a ground circle tests living positions at its committed centre. A canceled windup costs nothing; recovery blocks the next primary cast. A held target stays selected during tracking and windup; release does not silently acquire a different body. A skill hit that crits can fire a crit-trigger aura without taking over the primary cast.'),
    block('Setup → payoff', table(['Effect', 'How the press reads it', 'What it spends'], [
      ['bonus_vs_status', '<code>press × (1 + bonus% / 100)</code> while the target holds the named status', 'nothing'],
      ['consume_status', '<code>stacks = min(live, cap)</code>; <code>press × (1 + stacks × per-stack% / 100)</code>', 'the stacks it spends, after the hit'],
      ['spread_status', 'copies the live line to up to N other targets the row reaches', 'nothing; the copy keeps stacks and remaining seconds'],
    ]), 'Payoff rows are <strong>Detonate</strong> (burn), <strong>Shatter</strong> (chill), <strong>Overload</strong> (shock), <strong>Catalyst</strong> (poison), <strong>Ruin</strong> (mark) and <strong>Aftershock</strong> (cripple). A payoff row names its status once, in its own effect.'),
    block('Cost and Max HP terms', table(['Rule', 'How the press reads it', 'Data term'], [
      ['Mana cost', '<code>mana × (1 + max(0, L − 1) × costStep / 100)</code>; the same typed price on one target or many', '<code>mana</code>'],
      ['HP cost', '<code>cost = base × (1 + max(0, L − 1) × costStep / 100)</code>; use only if currentHP − cost ≥ 1', '<code>hp_cost</code>'],
      ['Caster Max HP', '<code>caster MaxHP × max_hp_pct / 100</code>, then skill-level and hit multipliers', '<code>max_hp_pct</code>'],
      ['Target Max HP', '<code>target MaxHP × max_hp_pct_damage / 100</code>', '<code>max_hp_pct_damage</code>'],
    ])),
    block('Finding a skill', table(['From', 'A skill piece a kill', 'What it means'], [
      ['A normal mob', pc1((E.skill_drop as any).normal), 'the slow path — a skill is a find, not a purchase'],
      ['An Elite', pc1((E.skill_drop as any).elite), `about ${n0(Math.round((E.skill_drop as any).elite / (E.skill_drop as any).normal))}× the normal rate`],
      ['A Boss', pc1((E.skill_drop as any).boss), 'the only place duplicates come thick'],
    ]), '<code>skill drop = per-rank chance per kill</code>, independent of gear and stone rolls.'),
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
  ],
});

page({
  file: 'skills-roster.html',
  nav: 'Skill roster',
  title: 'Skill roster',
  lead: `Every live skill row, grouped by type. Press damage = level-1 damage × <code>damagePct(level) / 100</code>; effects use <code>effectPct</code>, Buffs and Auras use <code>buffEffectPct</code>. Cap: ${n0(E.skill_xp.level_cap)}.`,
  body: [(() => {
    // Three tabs over one table. Active is the slot list — every type that is not on the toggle track —
    // read from the roster rather than typed, so a new type lands in the right tab by its own kind.
    const OFF_SLOT = ['buff', 'aura'];
    const GROUPS = [
      { key: 'active', label: 'Active Skill', types: TYPES.filter((t) => !OFF_SLOT.includes(t)) },
      { key: 'buff', label: 'Buff Skill', types: ['buff'] },
      { key: 'aura', label: 'Aura Skill', types: ['aura'] },
    ];
    const head = ['Skill', 'Type', 'Target', 'Range', 'Area', 'Element', 'SP / Reserve', 'Delay', 'Duration', 'Hits', 'Min Effect (level 1)', `Max Effect (level ${E.skill_xp.level_cap})`, 'What it does'];
    const groups = GROUPS.map((g) => ({
      key: g.key,
      label: g.label,
      rows: g.types.flatMap((t: string) => sm.of(t).map((s: any) => {
        const copy = describeSkill(s);
        // a row bound to one weapon says so beside its name (only the arrow rows carry one:
        // the `bow` family token covers both bow and crossbow)
        const name = `${esc(s.name)}${s.weapon ? ` <span class="hy">${esc(s.weapon)}</span>` : ''}`;
        return [name, esc(copy.type), esc(copy.target), esc(copy.range), esc(copy.area || ''), esc(copy.element),
          esc(copy.sp || copy.reservation || ''), esc(copy.delay || ''), esc(copy.duration || ''), esc(copy.hits || ''),
          fxEndCell(s, 1), fxEndCell(s, E.skill_xp.level_cap), esc(s.effect || '')];
      })),
    }));
    return block('The roster', tabbedTable('skillkind', head, groups),
      `Press damage = level-1 damage × <code>damagePct(L) / 100</code>; the table shows L=1 and L=${n0(E.skill_xp.level_cap)}. Additive effect = <code>base × effectPct(L) / 100</code>; a multiplier scales its distance from 1. Buff/Aura additive values round to whole numbers. Range rounds the row's metres to a cell count; Area is twice its radius.`);
  })()],
});

page({
  file: 'statuses.html',
  nav: 'Statuses',
  title: 'Statuses and the Alignment gate',
  lead: 'What each status changes, how far it climbs, and the Alignment gate every rolled status passes. Element resistance and its status map are on <a href="elements.html">Elements</a>; presses that apply statuses are on <a href="skills.html">Skills</a>.',
  body: [
    block('What a status changes, and how far it climbs', table(
      ['Status', 'What it does', 'Per application', 'Cap / duration', 'Payoff', 'Player ↔ Mob'],
      [
        ['burn', `Elemental damage a second, plus a cut to the mob's HP regen`,
          `×${n1(ST.burn.k_dps)} aligned dps · regen −${pc0(ST.burn.regen_cut_per_stack)}`,
          `${n0(ST.burn.stack_max)} stacks · ${n0(ST.burn.time_sec)} sec · regen max −${pc0(ST.burn.regen_cut_max)}`,
          `Detonate consumes ${n0(ST.burn.stack_max)}`,
          `DoT both ways · shared cap`],
        ['poison', 'Elemental damage a second that outlives a weapon swap',
          `×${n2(ST.poison.k_dps)} aligned dps`,
          `${n0(ST.poison.stack_max)} stacks · decays over ${n0(ST.poison.decay_sec)} sec`,
          `Catalyst consumes 5 · leftover stacks stay`,
          `DoT both ways · shared cap`],
        ['chill', 'Slows attack speed and cuts Armour. No accuracy cut',
          `attack speed −${pts(ST.chill.aspd_pct)} · Armour −${pc0(ST.chill.armour_cut)}`,
          `2 stacks · attack speed max −${pts(ST.chill.aspd_cap)} · ${n0(ST.chill.time_sec)} sec`,
          `Shatter bonus vs chilled`,
          `attack speed + Armour cut both ways`],
        ['shock', 'Cuts accuracy and stops the clock',
          `accuracy −${pts(ST.shock.acc_pct)} · stop ${n1(ST.shock.stop_sec)} sec`,
          `no stacks · debuff ${n1(ST.shock.time_sec)} sec · stop under budget`,
          `Overload bonus vs shocked`,
          `accuracy + stop both ways · recovery on player`],
        ['mark', 'A growing multiplier on the hit it rides, plus leech',
          `damage +${pc1(ST.mark.k_dmg)} · leech +${pc1(ST.mark.k_leech)}`,
          `${n0(ST.mark.stack_max)} stacks · decays over ${n0(ST.mark.decay_sec)} sec`,
          `Ruin consumes ${n0(ST.mark.stack_max)}`,
          `damage / leech setup both ways`],
        ['crippled', 'Cuts outgoing direct damage only — hits and skill presses. No attack clock, no cooldown',
          `outgoing direct damage ${n0(ST.crippled.outgoing_damage_pct)}%`,
          `no stacks · refreshes · ${n0(ST.crippled.time_sec)} sec`,
          `Aftershock bonus vs crippled`,
          `outgoing cut both ways`],
        ['bleed', 'Physical damage over time off a landed hit. <strong>Not an Element</strong> — no resistance line answers it, Armour does not shrink it, and it cannot crit',
          `×${n2((E as any).K.K_BLEED)} of the hit that inflicted it, spread over ${n0((E as any).K.bleed_time_sec)} sec`,
          `no stacks · refresh keeps the stronger value · ${n0((E as any).K.bleed_time_sec)} sec`,
          `physical only · separate chance roll`,
          `physical DoT both ways`],
        ['stun', 'Not a status. A stop proc that reuses the shock stop',
          `${n1(ST.shock.stop_sec)} sec off the clock, on a chance the Alignment gate lets through`,
          `no stacks · one stop at a time · under budget · ${n1(ST.shock.stop_sec)} sec`,
          `no consume · reads shocked`,
          `stop proc both ways · recovery on player`],
      ]),
      `Rolled Element status: pass the Alignment gate, then roll ${pc0(ST.proc_chance)} on eligible Element hits; guaranteed_status skips both rolls while bleed and stun roll their own chance. burn + poison + earth erosion share the DoT cap (×${n1(ST.dot_cap)} aligned dps). shock / stun stops count against the control budget (${pc0(ST.mob_control_budget_pct)}). Crippled cuts outgoing direct damage ${n0(ST.crippled.outgoing_damage_pct)}% and never slows cooldowns or attack speed. Stun is a shock-stop proc, not a status row.`),
    block('The Alignment a status rides', (() => {
      const raw = DV.align_raw, focused = DV.align_path;
      const stun = (a: number) => `${n1(eng.stunChanceFrom(a))}% chance`;
      return table(['', 'What the engine does', 'From → to'], [
        ['Where it comes from', 'Dex × <code>K_DEX_ALIGN</code>, plus any additive line, times any multiplier on it',
          `stats alone ${n1(raw)}% → the reference build path ${n1(focused)}%`],
        ['The gate', 'EVERY rolled status passes it — an Element status, the bleed an axe&rsquo;s line grants, and a stun — so a build that cannot pass inflicts none of the three',
          `then ${pc0(ST.proc_chance)} of the Element hits that pass carry their status`],
        ['The damage', 'aligned damage a second = Elemental power × Alignment ÷ 100 × hits a second',
          `burn and poison together stop at ×${n1(ST.dot_cap)} of that figure`],
        ['What it buys', 'the lightning side converts it into a stun chance through <code>K_STUN_PER_ALIGN</code>',
          `${stun(raw)} → ${stun(focused)}`],
        ['What cuts it', 'no status cuts our Alignment', 'the build keeps every point it earns'],
        ['Ceiling', '<code>caps.alignment</code>', 'no Cap — the build keeps every point it earns'],
      ]);
    })(), '<code>Alignment = (Dex × K_DEX_ALIGN + additive) × multiplier</code>. Status damage and stun chance read that value.'),
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
          `<span class="rn">${esc(modLabel(e.id))}</span><span class="rv">${winOf(e.id)}</span><span class="rp">${e.forced ? 'forced' : `${(e.chance * 100).toFixed(1)}%`}</span></li>`).join('') + '</ul>';
      };
      const gearMod = (b: any) => `<div class="sub">Gear Mod: ${b.school
        ? `${esc(modLabel(b.school))} — the piece's own defence, raised only by a ${STONE_NAME.quality}`
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

page({
  file: 'items.html',
  nav: 'Items',
  title: 'Items',
  lead: 'A piece of gear is a <strong>frame</strong> plus the Mods that rolled on it. The frame decides what it can roll; the roll decides what it is worth. Every Mod and its window is on <a href="mods.html">Mods</a>; per-kill drop odds are on <a href="drops.html">Drop rates</a>.',
  body: [
    block('Two halls', `<p><a href="weapons.html">Weapons</a> lists main-hand frames. <a href="equipment.html">Equipment</a> lists every other slot.</p>`),
    block('How a drop rolls', table(['', 'Number', 'What it means'], [
      ['Lines on a drop', wrap(`${n0(IL.frame_mod_slots + IL.bound_slots + NORM.min)}-${n0(IL.frame_mod_slots + IL.bound_slots + NORM.max)}`), `${n0(IL.frame_mod_slots)} Frame Mod · ${n0(IL.bound_slots)} Bound · ${spacing(NORM)} Unbound, drawn at drop — a slot whose pool runs out first publishes fewer`],
      ['Lines after crafting', wrap(n0(IL.crafted_max)), `the Add craft opens one more line per stone, up to ${n0(IL.mods_added_cap)} — the crafted ceiling`],
      ['Item level', 'the drop own level', 'every line on the piece rolls inside the window that level publishes'],
      ['Item quality', 'low · mid · high', IL.spans.map((sp: any) => `${sp.band} ${n0(sp.from)}-${n0(sp.to)}`).join(' · ')],
      ['Tier', 'T1 · T2 · T3', 'which third of the window the roll landed in — T1 is the top third, and the rarest roll (' + pc0(1 - loot.TIER_SPLIT[1]) + ' T1 · ' + pc0(loot.TIER_SPLIT[1] - loot.TIER_SPLIT[0]) + ' T2 · ' + pc0(loot.TIER_SPLIT[0]) + ' T3)'],
    ]), `<code>drop lines = frame lines + Bound lines + rolled Unbound lines</code>; <code>crafted max = drop lines + ${n0(IL.mods_added_cap)}</code>. Tier odds: T1 ${pc0(1 - loot.TIER_SPLIT[1])}, T2 ${pc0(loot.TIER_SPLIT[1] - loot.TIER_SPLIT[0])}, T3 ${pc0(loot.TIER_SPLIT[0])}.`),
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
  file: 'mods.html',
  nav: 'Mods',
  title: 'Mods and windows',
  lead: 'Every Mod the gear pool rolls, its range, and the window it publishes at each Item quality. An amount carries no unit; a percent value carries <code>%</code>.',
  body: [
    block('Every Mod and the window it rolls in', table(['Mod', 'Range', 'Window by Item quality: low · mid · high'], [...(MODS.mods || [])].sort((a: any, b: any) => b.max - a.max).map((m: any) => [
      esc(modLabel(m.id)), `${n0(m.min)}-${n0(m.max)}${m.pct ? '%' : ''}`, modBands(m) || '—',
    ])), `<code>t = clamp((ItemLevel − band.from) / (band.to − band.from), 0, 1)</code>; <code>floor = round(lerp(previousBandFloor, currentBandFloor, t))</code>; ceiling = current band ceiling.`),
  ],
});

page({
  file: 'drops.html',
  nav: 'Drop rates',
  title: 'Drop rates',
  lead: 'What a zone band pays per kill: gear, herbs, junk by rarity and potion drops.',
  body: [(() => {
    const rarityRows = Object.entries((E.junk as any).rarities || {}) as [string, any][];
    const bandRows = ['low', 'mid', 'high'].map((band) => [
      esc(band), pc1(eng.dropChance(band)), pc1(farm.herbChance(band)),
      rarityRows.map(([rarity, row]) => `${esc(rarity)} ${pc1(row.drop_chance_per_kill)}`).join(' · '),
      pc1(farm.potionDropChance(band)),
    ]);
    return block('Drop rates', table(['Zone band', 'Gear', 'Herbs', 'Junk by rarity', 'Potion drop'], bandRows),
      `<code>gear chance = base_drop_chance × (1 + LCK × K_LCK_DROP)</code> before mastery and loot leans. A Variant&rsquo;s junk item and its Species alternative split the rarity chance equally.`);
  })()],
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
        (f.frame_mod || []).map((id: any) => `<span class='rn'>${esc(modLabel(id))}</span> <span class='rv'>${winOf(id)}</span>`).join('<br>')]);
      return `<h3>${esc(w.name)} — ${esc(w.group)} · ${esc(w.damage)} · ${n1(weapon.weapon_aspd)} attacks/sec · ×${n2(weapon.weapon_mult)} damage · ${n0(dpsIndex)}% sword DPS · weight ${n1(w.weight)}</h3>` +
        table(['Frame', 'Drop weight', 'Value bias', 'Frame Mod lines'], rows);
    }).join(''), `<code>weapon DPS index = attacksPerSecond × weaponMult ÷ (swordAttacksPerSecond × swordMult) × 100</code>. Drop weight selects the frame; carried weight feeds encumbrance.`),
  ],
});

page({
  file: 'equipment.html',
  nav: 'Equipment',
  title: 'Equipment',
  lead: 'Every slot that is not a main hand. Pick a slot group for frames, frame Mods and the lines each one can roll.',
  body: [
    block('Slot groups', table(['Group', 'Slots', 'What it holds'], [
      ['<a href="armour.html">Armour</a>', list(['helmet', 'chest', 'pant', 'boots', 'belt', 'gloves', 'cape']), 'the body slots, each with its own frame pool'],
      ['<a href="jewellery.html">Jewellery</a>', list(['ring', 'amulet', 'earring']), 'the three small slots and their Mod pools'],
      ['<a href="offhand.html">Off hand</a>', list(['off hand']), 'shields, quivers, tomes and foci'],
    ]), '<code>line value = tier slice(windowAt(Mod, ItemLevel, band))</code>. Frame Mods shared across n lines apply <code>shared value = line budget × frameScale[n]</code>. Bound, Unbound and Frame lines use the same slot pool; lock type controls which presses may edit them.'),
  ],
});

page({
  file: 'armour.html',
  nav: 'Armour',
  title: 'Armour slots',
  lead: 'Helmet, chest, pant, boots, belt, gloves and cape, frame by frame.',
  body: [
    block('Slot by slot', slotSections(['helmet', 'chest', 'pant', 'boots', 'belt', 'gloves', 'cape']), '<code>line value = tier slice(windowAt(Mod, ItemLevel, band))</code>. Frame Mods shared across n lines apply <code>shared value = line budget × frameScale[n]</code>.'),
  ],
});

page({
  file: 'jewellery.html',
  nav: 'Jewellery',
  title: 'Jewellery slots',
  lead: 'Ring, amulet and earring, frame by frame.',
  body: [
    block('Slot by slot', slotSections(['ring', 'amulet', 'earring']), '<code>line value = tier slice(windowAt(Mod, ItemLevel, band))</code>. Ring and amulet windows differ from the body slots; the same Mod can appear in more than one group.'),
  ],
});

page({
  file: 'offhand.html',
  nav: 'Off hand',
  title: 'Off hand',
  lead: 'Shields, quivers, tomes and foci — the off-hand frame pool.',
  body: [
    block('Slot by slot', slotSections(['off hand']), '<code>line value = tier slice(windowAt(Mod, ItemLevel, band))</code>. The off hand is the only slot that can carry the Shield line; its block rule is on <a href="combat.html">Combat</a>.'),
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
    ]), `<code>Core[k] = (statOf(allocatedPoints[k]) + additive[k]) × (1 + percent[k] / 100)</code>; derived lines apply their own <code>K_core</code>.`),
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
  file: 'passive-tree.html',
  nav: 'Passive tree',
  title: 'Passive tree',
  lead: `The ${n0((tree as any).nodes.length)}-node board the game draws. Drag to pan, scroll to zoom, jump by region. Every road, Notable and Keystone is live tree data.`,
  body: [
    block('The board', treeViewer(), 'Drag to pan · Scroll or the buttons to zoom. Hover or tap a node for its rule; the complete Keystone table is on <a href="keystones.html">Keystones</a>.'),
    block('Reading the tree', table(['Node', 'Cost', 'What it is'], [
      ['Normal', `${n0(treeKindCost('normal'))} tree point`, '+1 of its region’s Core attribute. The road: every purchase continues from an owned neighbour or the free Origin.'],
      ['Notable', `${n0(treeKindCost('notable'))} tree points`, 'Its value and percent lines; the entrance a Keystone hangs from.'],
      ['Keystone', `${n0(treeKindCost('keystone'))} attainment point`, 'One rule change; never spends tree points. Every effect is in the Keystone table on <a href="keystones.html">Keystones</a>.'],
    ]), 'Origin is free; every region opens from it. Respec is free at any settlement. The complete node and Keystone tables are on <a href="keystones.html">Keystones</a>.'),
    block('The passive tree', table(['Region', 'Normal', 'Notable', 'Keystone', 'Node cost, tree points'], [
      ...treeNodes().regions.map((name: string) => [
        esc(name.toUpperCase()), wrap(n0(treeNodes().countsIn(name, 'normal'))), wrap(n0(treeNodes().countsIn(name, 'notable'))),
        wrap(n0(treeNodes().countsIn(name, 'keystone'))), wrap(n0(treeNodes().costOf(name))),
      ]),
      (() => {
        const count = (kind: string) => treeNodes().regions.reduce((sum: number, name: string) => sum + treeNodes().countsIn(name, kind), 0);
        const cost = treeNodes().regions.reduce((sum: number, name: string) => sum + treeNodes().costOf(name), 0);
        return ['Total', wrap(n0(count('normal'))), wrap(n0(count('notable'))), wrap(n0(count('keystone'))), wrap(n0(cost))];
      })(),
    ]), `Every node holds one rank and opens from any owned neighbour; Start is free and every region opens from it. Normal nodes form an irregular field of branching roads and local loops that cross region boundaries, and every playable route ends on a Notable or Keystone. Ordinary dead ends are retired: they keep only their layout position and cannot be bought. Notables sit on local loops or beside roads. Every Keystone has its own Notable entrance from Normal roads. Either branch is open without the other's Notable; earlier roads may join. A build can mix regions from its allocated frontier. Select a node to preview the route; Shift-click buys it when both wallets can pay. A Normal grants exactly +1 of its region's Core attribute for 1 tree point. A Notable grants its value and percent lines for 3 tree points. A Keystone changes a mechanic for 1 attainment point and never spends tree points. <code>treePoints = ${TREE_POINT_CURVE} + claimed quest bonuses − spent tree</code>. The first milestone Expedition claim per zone and first milestone Delivery completion per town guarantee +${n0(QUEST_REWARDS.milestone_tree_points)} Tree Point, outside the consumable reward choice. The point pays once on completion; skipping or expiry leaves the milestone available. Legacy saved random Tree Point promises remain payable. Respec at a settlement is free and hands both wallets back at the prices the spec charged. The redesigned roads preserve existing v3 allocations on live nodes, node effects and wallets; a rank on a retired ordinary node is refunded on load, and every live owned node remains a usable frontier. Characters predating v3 are refused with their own message rather than rewritten. The Build goals lens reads what Notables and Keystones grant for staying alive, managing mana, supporting your skills or the held weapon. It quotes the same route and the same tree/attainment split the path purchase charges, marks a route you cannot afford yet and a keystone pair that cannot be held together, and describes a keystone’s trade-off. A recommendation never allocates a point and is not a claim that the build is best. <em>Track this node</em> only pins it in Journey; selection, search, route preview and path purchase stay yours.`),
    block('Passive points', `<p>Levels, quest milestones and first-time Expedition/Delivery milestones bank tree points; a Keystone is paid in attainment, not tree points. Respec is free at a settlement. The tree board is on <a href="passive-tree.html">Passive tree</a>; every rule is on <a href="keystones.html">Keystones</a>, and the plan is on <a href="builds.html">Build plan</a>.</p>`, 'Progression banks the points; the Build plan spends them.'),
  ],
});

page({
  file: 'world.html',
  nav: 'World',
  title: 'The world',
  lead: 'Zone Level drives HP/DPS curves. Body classes and species are on <a href="mobs.html">Bestiary</a>.',
  body: [
    block('Zones', table(['#', 'Zone', 'Region', 'Levels', 'Band', 'Mob group', 'Its three sides', 'Elements'], eng.ZONES.map((z: any) => [
      wrap(n0(z.id)), esc(z.name), esc(z.region), `${n0(z.levels[0])}-${n0(z.levels[1])}`, esc(z.quality), esc(z.group),
      list((z.subzones || []).map((s: any) => `${s.name}: ${(s.spawn || {}).group || z.group} pack, ${(s.spawn || {}).elite_pct ?? Math.round(E.loot.elite_spawn_chance * 100)}% elite, ${eng.packWordOf((s.spawn || {}).pack)}`)),
      list(eng.zoneElements(z.id)),
    ])), 'Zone item band sets drop quality. The Element list is the union of its Species and Boss Elements.'),
    block('Dungeons', table(['Dungeon', 'Zone', 'Band', 'A run'], (TOWN.settlements || []).map((s: any) => [
      // the sheet prints the same name (tools/map.ts owns it); the wiki only reads it back
      esc(s.name + ' Dungeon'), wrap(n0(s.zone)), esc(s.band),
      `${n0(E.dungeon.mob_cap)} mobs · population waves`,
    ])), `Clear: receive escrowed loot. Retreat: keep ${n0(E.dungeon.retreat_keep_min)}–${n0(E.dungeon.retreat_keep_max)} random legal stacks; forfeit the rest. Push: forfeit all escrow. Cooldown: ${n0(E.dungeon.cooldown_sec / 60)} min.`),
  ],
});

const RACE_NAME = (race: string): string => race.charAt(0).toUpperCase() + race.slice(1);
const countOf = (n: number, word: string): string => `${n0(n)} ${word}${n === 1 ? '' : 's'}`;
const ELEMENT_NAME: Record<string, string> = {
  fire: 'Fire', cold: 'Cold', lightning: 'Lightning', poison: 'Poison', chaos: 'Chaos', earth: 'Earth', physical: 'Physical',
};
const BODY_TICK: Record<string, [string, string]> = {
  small: ['S', 'Small'], medium: ['M', 'Medium'], large: ['L', 'Large'],
};
/** A species' attack Element is the plate's spine; this token carries the same ink everywhere it prints. */
const elTag = (element: string, small = false): string =>
  `<span class="beast-el${small ? ' sm' : ''}" data-element="${escAttr(element)}">${esc(ELEMENT_NAME[element] || element)}</span>`;
const bodyTicks = (sizes: string[]): string =>
  ['small', 'medium', 'large'].filter((size) => sizes.includes(size))
    .map((size) => `<abbr class="beast-body" title="${BODY_TICK[size][1]}" data-size="${size}">${BODY_TICK[size][0]}</abbr>`).join('');

page({
  file: 'mobs.html',
  nav: 'Bestiary',
  title: 'Bestiary',
  lead: (() => {
    const variants = (E.mob as any).variants || {};
    const total = (E.mob.species || []).reduce((n: number, sp: any) => n + (variants[sp.id] || []).length, 0);
    const uniques = ((E.mob as any).uniques || []).length;
    const races = (E.mob.races?.set || []).length;
    return `${n0(races)} races · ${n0(E.mob.species.length)} species · ${n0(total)} variants · ${n0(uniques)} uniques. Every species attacks with one Element — the spine on its plate — and carries its own resistance, weakness and junk. Mob skills are on <a href="mob-skills.html">Mob skills</a>; drop rates on <a href="drops.html">Drop rates</a>.`;
  })(),
  body: (() => {
    const speciesRows: any[] = E.mob.species || [];
    const variantsBySpecies: Record<string, any[]> = (E.mob as any).variants || {};
    const allUniques: any[] = (E.mob as any).uniques || [];
    const races: string[] = E.mob.races?.set || [];
    const skills: any[] = MOB_SKILLS_DATA.skills as any[];
    const skillById = new Map(skills.map((row) => [row.id, row]));
    const materialName = (sp: any): string =>
      fieldwork.materialById[sp.bonus_material.resource]?.name || sp.bonus_material.resource;
    const skillTags = (ids: string[]): string => ids.length
      ? ids.map((id) => `<span class="tag">${esc(skillById.get(id)?.name || id)}</span>`).join('')
      : '<span class="beast-none">basic swing only</span>';
    /** One row of a plate's fold: a Variant, or a Unique with its own Element and find. */
    const dropRow = (sp: any, row: any, kind: 'variant' | 'unique'): any[] => {
      const drop: any = maybe(E.mob.variant_drops, row.name);
      const chance = drop ? Number((E.junk as any).rarities?.[drop.rarity]?.drop_chance_per_kill || 0) : 0;
      const choices = drop ? [...new Set([drop.item, sp.junk_items?.[drop.rarity]].filter(Boolean))] as string[] : [];
      const junk = drop
        ? `${esc(drop.item)} <span class="beast-pc">${pc1(choices.length ? chance / choices.length : chance)}</span> <span class="hy">${esc(drop.rarity)}</span>`
        : '<span class="hy">no junk row</span>';
      const notes = [
        row.damage && row.damage !== sp.damage ? `hits ${esc(RACE_NAME(row.damage))}` : '',
        drop?.lean && drop.lean !== 'none' ? `${esc(drop.lean)} lean` : '',
      ].filter(Boolean);
      if (kind === 'unique') notes.push('Elite stones', `XP ×${n0(E.xp.unique_mult)}`, `skill ${pc1(E.skill_drop.unique)}`);
      const name = kind === 'unique'
        ? `<b>${esc(row.name)}</b> <span class="tag beast-unique">Unique</span>${row.element && row.element !== sp.element ? ` ${elTag(row.element, true)}` : ''}`
        : `<b>${esc(row.name)}</b>`;
      return [name, kind === 'unique' ? 'wild' : `${n0(row.levels[0])}–${n0(row.levels[1])}`, junk,
        `<span class="hy">${notes.join(' · ') || '—'}</span>`];
    };
    const plate = (sp: any): string => {
      const variants: any[] = variantsBySpecies[sp.id] || [];
      const uniques: any[] = allUniques.filter((u: any) => u.species === sp.id);
      const levels = (Object.values(sp.zone_levels || {}) as any[]).map(Number).filter((level) => Number.isFinite(level));
      const levelText = levels.length ? `${n0(Math.min(...levels))}–${n0(Math.max(...levels))}` : '—';
      const habitat: string[] = sp.habitat || [];
      const habitats = habitat.slice(0, 3).map((name: string) => esc(name)).join(' · ')
        + (habitat.length > 3 ? ` <span class="hy">+${n0(habitat.length - 3)}</span>` : '');
      const kitIds: string[] = (MOB_SKILLS_DATA.kits.species as Record<string, string[]>)[sp.id] || [];
      const search = [
        sp.name, sp.race, RACE_NAME(sp.race), sp.element, sp.damage, materialName(sp),
        ...(sp.sizes || []), ...habitat, ...variants.map((v) => v.name), ...uniques.map((u) => u.name),
        ...kitIds.map((id) => skillById.get(id)?.name || ''),
      ].join(' ').toLowerCase();
      const rows = [...variants.map((v) => dropRow(sp, v, 'variant')), ...uniques.map((u) => dropRow(sp, u, 'unique'))];
      return `<article class="beast-card" data-bestiary-entry data-race="${escAttr(sp.race)}" data-element="${escAttr(sp.element)}" data-search="${escAttr(search)}">
        <header class="beast-head">
          <div class="beast-title">
            <h4>${esc(sp.name)}</h4>
            <p class="beast-sub">${esc(RACE_NAME(sp.race))} · ${countOf(sp.zones.length, 'zone')} · Lv <span class="num">${levelText}</span>${sp.potion_source ? ' · <span class="beast-flag">Potion source</span>' : ''}</p>
          </div>
          ${elTag(sp.element)}
        </header>
        <dl class="beast-facts">
          <div><dt>Bodies</dt><dd>${bodyTicks(sp.sizes)}</dd></div>
          <div><dt>Damage</dt><dd>${esc(RACE_NAME(sp.damage))}</dd></div>
          <div><dt>Resists</dt><dd>${elTag(sp.resistance.element, true)} ${n0(sp.resistance.pct)}%</dd></div>
          <div><dt>Weak to</dt><dd>${elTag(sp.weakness.element, true)} +${n0(sp.weakness.taken_pct)}%</dd></div>
          <div><dt>Material</dt><dd>${esc(materialName(sp))} <span class="beast-pc">${n2(sp.bonus_material.chance * 100)}%</span></dd></div>
        </dl>
        ${habitats ? `<p class="beast-habitat"><span class="beast-label">Found in</span>${habitats}</p>` : ''}
        <p class="beast-kit"><span class="beast-label">Kit</span>${skillTags(kitIds)}</p>
        <details class="beast-fold">
          <summary>Variants &amp; uniques <b>· ${countOf(variants.length, 'variant')} · ${countOf(uniques.length, 'unique')}</b></summary>
          <div class="beast-table-wrap">${table(['Variant', 'Lv', 'Junk / kill', 'Notes'], rows)}</div>
        </details>
      </article>`;
    };
    const groups = races.map((race) => {
      const members = speciesRows.filter((sp) => sp.race === race);
      return `<section class="beast-group" data-bestiary-group data-race="${escAttr(race)}">
        <header class="beast-group-head"><h3>${esc(RACE_NAME(race))}</h3><span>${n0(members.length)} species</span></header>
        <div class="beast-grid">${members.map(plate).join('')}</div>
      </section>`;
    }).join('');
    return [
    block('Body classes', table(['Body', 'Base evasion', 'Comes in'], (E.mob.sizes || []).map((s: any) => [
      esc(s.id), `+${n0(s.evasion_pct)}%`, esc(s.group),
    ])), '<code>Mob evasion = min(evasionCap, Dex × K_EVASION × (1 + body.evasion_pct / 100))</code>. Body classes do not scale damage. Bosses declare which body class weapons read.'),
      block('Species roster',
        `<div class="bestiary" data-bestiary>
          <div class="beast-tools">
            <div class="beast-toolbar">
              <label class="beast-search"><span class="sr-only">Filter species</span><input type="search" placeholder="Filter by name, race, Element or skill…" data-bestiary-search autocomplete="off" spellcheck="false" /></label>
              <p class="beast-status" data-bestiary-status aria-live="polite">Showing ${n0(speciesRows.length)} of ${n0(speciesRows.length)} species</p>
            </div>
            <div class="beast-chips" role="group" aria-label="Filter by race">
              <button type="button" class="beast-chip" data-bestiary-race="all" aria-pressed="true">All <b>${n0(speciesRows.length)}</b></button>
              ${races.map((race) => `<button type="button" class="beast-chip" data-bestiary-race="${escAttr(race)}" aria-pressed="false">${esc(RACE_NAME(race))} <b>${n0(speciesRows.filter((sp) => sp.race === race).length)}</b></button>`).join('')}
            </div>
          </div>
          ${groups}
        </div>`,
        'A plate&rsquo;s spine is its attack Element. Body ticks are <abbr title="Small">S</abbr>, <abbr title="Medium">M</abbr> and <abbr title="Large">L</abbr>. Open a plate for its variants, uniques and skill kit.'),
    ];
  })(),
});

page({
  file: 'mob-skills.html',
  nav: 'Mob skills',
  title: 'Mob skills',
  lead: 'The mob-only skill library: strikes, auras, and the Boss and Unique kits that choose them.',
  body: (() => {
    const skills: any[] = MOB_SKILLS_DATA.skills as any[];
    const skillById = new Map(skills.map((row) => [row.id, row]));
    const skillTags = (ids: string[]): string => ids.length
      ? ids.map((id) => `<span class="tag">${esc(skillById.get(id)?.name || id)}</span>`).join('')
      : '<span class="beast-none">basic swing only</span>';
    const skillRowsFor = (mode: string): any[][] => skills.filter((row) => row.mode === mode).map((row) => [
      esc(row.name),
      elTag(row.element || 'physical', true),
      row.status ? esc(row.status) : '<span class="hy">—</span>',
      row.cd ? `${n0(row.cd)} sec` : '<span class="hy">—</span>',
      row.cast_sec != null ? `${n1(row.cast_sec)} sec` : '<span class="hy">—</span>',
      esc(row.role || 'any'),
      row.mode === 'aura'
        ? `${esc(row.scope)} · ${Object.entries(row.effects || {}).map(([stat, value]) => `${esc(String(stat).replace(/_pct$/, ''))} +${n0(Number(value))}%`).join(' · ')}`
        : '<span class="hy">—</span>',
    ]);
    const kitRows = [
      ...Object.entries(MOB_SKILLS_DATA.kits.bosses as Record<string, string[]>)
        .map(([name, ids]) => [`<span class="tag">Boss</span> ${esc(name)}`, skillTags(ids)]),
      ...Object.entries(MOB_SKILLS_DATA.kits.uniques as Record<string, string[]>)
        .map(([name, ids]) => [`<span class="tag beast-unique">Unique</span> ${esc(name)}`, skillTags(ids)]),
    ];
    return [
      block('Mob skills',
        `<details class="beast-fold beast-fold-wide">
          <summary>Skills, kits and auras <b>· ${n0(skills.length)} rows</b></summary>
          ${tabbedTable('mob-skill-mode', ['Skill', 'Element', 'Status', 'Cooldown', 'Cast', 'Role', 'Scope & effect'], [
            { key: 'strike', label: 'Strikes', rows: skillRowsFor('strike') },
            { key: 'aura', label: 'Auras', rows: skillRowsFor('aura') },
          ])}
          <h3>Boss and Unique kits</h3>
          <div class="beast-table-wrap">${table(['Mob', 'Kit'], kitRows)}</div>
        </details>`,
        `A strike uses an attack opportunity instead of adding another damage stream. Every strike authors a cast profile: delivery (melee, projectile or ground), its range basis, windup and recovery. In the live arena the first ready, in-range strike starts its full preparation and keeps that skill until release, even across ticks. Control or an invalid release cancels it without spending the strike cooldown; no basic attack or different skill slips into its preparation. A melee strike re-tests body contact at release, a projectile commits its aim and travels to contact, and a ground strike commits its point then tests living centres inside that area at impact. The cooldown commits at a valid release even when the contact is later dodged, blocked or misses. Prepared strikes and ordinary ranged shots show their contact and recovery after release; retaining their animation history does not extend the movement lock. Nearby bodies may join through connected assist neighbours, but an ordinary field body's home leash also bounds assistance and deliberate targeting. A body pulled out of the leash resets once and returns home as a returning body that cannot be newly targeted or hit until it reaches its home band; Bosses and camp fights keep their own boundary. Classic/offline combat retains its queue approximation. Auras are passive, defensive and strongest-wins. Kits choose which rows a spawn resolves; a Variant may replace its Species kit, and a Boss or Unique may replace either.`),
    ];
  })(),
});

page({
  file: 'towns.html',
  nav: 'Towns',
  title: 'Settlements',
  lead: 'Stall price = listed income-minutes × the seller band’s gold-per-minute rate. Standing, tasks and the Collector are on <a href="standing.html">Standing</a>.',
  body: (() => {
    const NPC: Record<string, any> = Object.fromEntries((TOWN.npcs || []).map((n: any) => [n.id, n]));
    const LINE: Record<string, any> = Object.fromEntries([...(TOWN.one_time || []), ...(TOWN.repeatable || [])].map((l: any) => [l.id, l]));
    const SET: Record<string, any> = Object.fromEntries((TOWN.collector_sets || []).map((c: any) => [c.id, c]));
    /** A stock id is a stall line, or the settlement’s own Collector set. */
    const stockName = (id: string): string => LINE[id]?.item || (SET[id] ? `${SET[id].name} (Collector set)` : id);
    const TS: any = TOWN.task_sizing || {};
    const price = (l: any): string => (l.m_per_block != null
      // a per-block line (the Waypoint warp) has no fixed band price; its fare is the table below
      ? '—'
      : l.m_min != null
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
      block('One-time lines', table(['Item', 'Sold by', 'Buys', 'Costs, in gold at that band', 'Note'], (TOWN.one_time || []).map((l: any) => [
        esc(l.item), esc(NPC[l.npc]?.name || l.npc || ''), esc(l.kind), price(l),
        `<span class="hy">${[extra(l), l.discount ? `at ${esc((TOWN.settlements || []).find((s: any) => s.id === l.discount.settlement)?.name || l.discount.settlement)} it costs ${goldAt(l.discount.m, (TOWN.settlements || []).find((s: any) => s.id === l.discount.settlement)?.band || l.charge_band)}` : ''].filter(Boolean).join(' · ')}</span>`,
      ])), '<code>Gold price = roundConfigured(listed minutes × goldPerMinute(charge_band))</code>; one-time lines cannot be bought again. A vendor’s ladder advances to its next authored rung once the current one is owned; a rung authored at another settlement stays there.'),
      block('Repeatable lines', table(['Item', 'Sold by', 'Buys', 'Costs, in gold at that band', 'Note'], (TOWN.repeatable || []).map((l: any) => [
        esc(l.item), esc(NPC[l.npc]?.name || 'no vendor — see note'), esc(l.kind), price(l),
        `<span class="hy">${extra(l)}</span>`,
      ])), '<code>Gold price = roundConfigured(listed minutes × goldPerMinute(charge_band))</code>; repeat and daily limits are shown per line. Task skip tokens are spent from the Guild board.'),
    ];
  })(),
});

page({
  file: 'standing.html',
  nav: 'Standing',
  title: 'Standing, tasks and the Collector',
  lead: 'Settlement Standing, the task board and the Collector set that asks for specific pieces. Settlement stock is on <a href="towns.html">Towns</a>.',
  body: (() => {
    const TS: any = TOWN.task_sizing || {};
    return [
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
        ['Expedition choice', 'Tier stones or a named useful skill; stored stone fallback if the skill later becomes unhelpful', '<code>quest_rewards.expedition_skill_choice</code>'],
        ['First Expedition milestone per zone', `+${n0(QUEST_REWARDS.milestone_tree_points)} Tree Point with either reward`, '<code>quest_rewards.milestone_tree_points</code>'],
        ['A Boss hunt pays', `${n0(TS.boss_reward.remove)} Remove Stone or ${n0(TS.boss_reward.reroll_tier)} Tier Stones`, 'winner’s choice, exactly as the board writes it'],
      ]), `${(() => {
        const pay = (b: string) => {
          const p: any = eng.taskPayout(b, TS.reward_minutes_of_band_income);
          return `${stone('tier', p.tier)} · ${stone('add', p.add)} · ${stone('reroll_value', p.reroll_value)}`;
        };
        return `${n0(TS.reward_minutes_of_band_income)}-minute slice: low ${pay('low')} · mid ${pay('mid')} · high ${pay('high')}`;
      })()}. <code>stone payout = round(stonesPerHour(band) × reward_minutes / 60)</code>. Expeditions count the target Species’ Elites in the named subzone.`),
      block('The Collector', table(['Set', 'At', 'School', 'Pieces it wants', 'Quality', 'Pays'], (TOWN.collector_sets || []).map((c: any) => [
        esc(c.name || c.id), esc((TOWN.settlements || []).find((s: any) => s.id === c.settlement)?.name || c.settlement),
        esc(c.school), list(c.pieces || []), esc(c.quality || 'any'),
        `<span class="hy">${esc(c.reward || '')}${c.pays_gold === false ? ' · never gold, never a Mod' : ''}</span>`,
      ])), 'Collector sets reserve requested pieces before the filter runs. Rewards are data-authored. In game, the set’s school stays hidden until its Collector hint is bought.'),
    ];
  })(),
});

page({
  file: 'economy.html',
  nav: 'Economy',
  title: 'The two currencies',
  lead: 'Trade quote = item value integrated over the town’s demand curve. Delivery and Black Market are on <a href="delivery.html">Delivery</a>; craft stone prices are on <a href="stones.html">Stones</a>.',
  body: [
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
    block('City ledger sales', `<p>Three settlements carry a live city ledger. One sale there is read once and split: units the city actually wants — <code>target − stock, + open event demand</code>, capped by its free storage and gold budget — are bought out of the city's own budget at the market quote, and the rest earns the basic floor price <code>floorCurrency(floorUnits × value × floorMult)</code>. Haggling applies once to the combined price.</p>`),
    block('Haggling', `<p><code>level = min(cap, floor(sqrt(XP / levelDivisor)) + 1)</code>; <code>progress = (level − 1) / (cap − 1)</code>.</p><p><code>saleMult = 1 + progress × saleBonusMax / 100</code>; <code>deliveryMult = 1 + progress × deliveryBonusMax / 100</code>; <code>serviceMult = 1 − progress × serviceDiscountMax / 100</code>. A completed Delivery pays XP once.</p>`),
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
  file: 'delivery.html',
  nav: 'Delivery',
  title: 'Delivery, Black Market and cargo',
  lead: 'Timed town demand, the Black Market stock, and the Workshop cargo that turns field materials into sale goods.',
  body: [
    block('Delivery wants', `<p><code>offer roll = trigger_chance</code> at each online interval for each visited town. Rewards and deadlines freeze when offered. The saved offer serial follows the configured mode sequence (${TOWN.delivery.reward_modes.map(esc).join(' → ')}): Fixed pays its displayed bundle; Choice lets you take a gold bounty or stones plus any named skill, each scaled by the configured ×${xOf(TOWN.delivery.choice_reward_mult)} concentration. Only one alternative pays; select it before the final hand-in. Every hand-in still pays its live market quote.</p><p>Completion grants Haggling XP and any displayed Attainment independently of that choice. The first milestone Delivery per town also pays +${n0(QUEST_REWARDS.milestone_tree_points)} Tree Point. Partial hand-ins and expired offers consume no milestone. Already stored legacy rewards remain unchanged.</p><p>Deadlines use credited game time and pause during Camp recovery or dungeon runs. Offline time creates no offers. If the chosen reward cannot fit, the final hand-in refuses without spending goods or progress. Recaps distinguish actual paid rewards from expired mutually exclusive alternatives. A tracked want is also the Journey’s next goal while it stays open. Its shortfall lists the acquisition steps the offer already carries, with a Pin button per source settlement; pinning changes the map selection only. <em>Track the missing</em> pins the good as the goal and keeps a way back to this board.`),
    block('Black Market', table(['Rule', 'The number'], [
      ['Offers per settlement', `${n0(TOWN.black_market.offers_per_refresh)} at a time`],
      ['Refresh', `every ${n0(TOWN.black_market.refresh_interval_sec / 60)} online minutes, per visited town`],
      ['Material price', `peak trade value × ${n2(TOWN.black_market.resale_cover_multiplier)} resale cover × its rarity multiplier`],
      ['Skill XP Level bands', TOWN.black_market.skill_level_offers.map((row: any) => `Level ${n0(row.level)} · ${n0(row.price_gold)} gold`).join(' · ')],
    ]), `<code>material price = peakTradeValue × resaleCover × rarityMultiplier</code>. Stock is per town and refreshes online. Skill offers only grant or raise a skill; they never lower level or add duplicate rungs.`),
    block('Workshop cargo', table(['Finished good', 'Field skill', 'Materials', 'Base value'], (E.fieldwork as any).workshop_recipes.map((recipe: any) => [
      esc(recipe.name), `${esc(recipe.skill)} Lv ${n0(recipe.level)}`, esc(Object.entries(recipe.materials).map(([id, count]) => `${count} ${fieldwork.materialById[id].name}`).join(' · ')), `${n2(trade.byId[`material:${recipe.id}`].value)} gold`,
    ])), `<code>finishedGoodValue = (Σ materialCount × materialValue) × workshop_value_mult / recipeYield</code>. Sale gold is the town quote at current demand.`),
  ],
});

page({
  file: 'crafting.html',
  nav: 'Crafting',
  title: 'Crafting',
  lead: 'The Craft bench and the Forge: place a piece, choose a pattern and read the line caps. Every stone press, its cost and the quality ladder are on <a href="stones.html">Stones</a>.',
  body: [
    block('Use the Craft bench', `<ol>
      <li>Drag a piece from Equipped or Inventory into the central bench slot.</li>
      <li>Hover a gear piece to inspect its full item detail and current Mod lines.</li>
      <li>Drag a stone from the stack onto the selected piece. Direct presses apply on drop; presses that need a line or Mod choice prepare the action for review and confirmation.</li>
      <li>Hover the gear again after the press to read its updated Mod lines.</li>
    </ol><p>The Stones pane opens on <strong>Basic</strong>, which keeps the common presses together. Switch to <strong>Advanced</strong> for whole-piece and rare stones: Polish, Reforge, Rebirth, Corrupt, Imprint and the bulk presses.</p>`, 'Gear crafting is a Settlement service. Camp cooking is the field exception; it does not craft gear.'),
    block('Forge a new piece', (() => {
      const F = E.forge;
      const bands = E.item_level.spans.map((s: any) => `${esc(s.band)} ${n0(s.from)}–${n0(s.to)}`).join(' · ');
      const families = Object.entries(F.families)
        .map(([, row]: any) => `${esc(row.name)}${Object.keys(row.bases).length ? `: ${Object.keys(row.bases).map((slot) => esc(slot)).join(', ')}` : ': weapon frames only'}`)
        .join(' · ');
      const materials = Object.entries(F.materials)
        .map(([id, row]: any) => `${esc(fieldwork.materialById[id]?.name || id)} (${esc(F.families[row.family]?.name || row.family)}, grade ${n0(row.grade)})`)
        .join(' · ');
      const armour = Object.entries(F.armour).map(([, row]: any) => `${esc(row.name)} ${n0(row.count)}`).join(' · ');
      const weapons = Object.entries(F.weapons).map(([, row]: any) => `${esc(row.name)} ${n0(row.count)} · ${esc(row.frame)}`).join(' · ');
      return `<p>At a settlement Forge choose a pattern and one material. The material's family picks the Base or weapon Frame; its grade sets the band (${bands}). The piece rolls with the drop skeleton: line 1, the Bound pair and 2–${n0(E.item_level.unbound_slots.max)} Unbound lines.</p>
        <p><b>Families</b> ${families}.</p>
        <p><b>Materials</b> ${materials}.</p>
        <p><b>Armour patterns</b> ${armour}.</p>
        <p><b>Weapon patterns</b> ${weapons}.</p>
        <p>The selected material also prints how many are missing and a <strong>Where to farm</strong> list — Mine or Grove zone, hunting Species, the Workshop/Smithing recipe, or Salvage.</p>`;
    })(), `<code>character level ≥ band floor · smithing ≥ ${E.forge.smithing_level.map((n: number) => n0(n)).join(' / ')} by grade · cost = pattern count · XP = ${E.forge.xp_per_grade.map((n: number) => n0(n)).join(' / ')} by grade</code>. No gold fee; fancy Base variants stay drop-only.`),
    block('How many lines a piece can gain', `<code>craftedLines = droppedUnboundLines + successfulAdds − removals</code>; Add allows at most ${n0(E.item_level.mods_added_cap)} lifetime presses. Remove frees a slot but does not refund Add pricing history.`),
  ],
});

page({
  file: 'stones.html',
  nav: 'Stones',
  title: 'Crafting stones',
  lead: 'Every stone, the presses it buys, the quality ladder and where each stone comes from. The bench itself is on <a href=\"crafting.html\">Crafting</a>.',
  body: [
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
          [`${pressOf('imprint')} · one Mod you hold (${n0(loot.IMPRINT_IDS.length)} stone types)`, tok('select', 1, UNB, 'set mod', 'with the stone mod'), `${n0(E.craft.imprint_stones_per_use)} stone of that one Mod`, 'a fresh Tier and value, even outside the Base pool; no Add charge or line count change. Passive-tree-only Mods cannot be Imprinted.'],
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
        ['Imprint (any of ' + n0(loot.IMPRINT_IDS.length) + ')', chance(E.loot.imprint_stone_sources.elite_imprint_chance), `${n0(E.loot.imprint_stone_sources.boss_imprint_stones)} stones`, 'uniform over eligible gear Mods'],
        [STONE_NAME.corrupt, '—', chance(E.loot.corrupt_stone_sources.boss_corrupt_chance), 'bosses only'],
        [STONE_NAME.polish, chance(E.loot.polish_stone_sources.elite_polish_chance), chance(E.loot.polish_stone_sources.boss_polish_chance), 'one step tighter than Replace on the Elite half, and Replace own Boss half'],
        [STONE_NAME.reforge, '—', chance(E.loot.reforge_stone_sources.boss_reforge_chance), 'bosses only, on half the Corrupt chance — the bench spends it on the whole piece'],
        [STONE_NAME.rebirth, '—', chance(E.loot.rebirth_stone_sources.boss_rebirth_chance), 'bosses only, inside the same boss draw again (Corrupt ⊃ Reforge ⊃ Rebirth) — the widest press of the three, so the rarest stone'],
      ]);
    })(), 'Elite and Boss values are per kill.'),
  ],
});

page({
  file: 'progression.html',
  nav: 'Progression',
  title: 'Progression',
  lead: `XP to next level = kills at that level × XP per kill. Weapon mastery is on <a href="mastery.html">Weapon mastery</a>; the finish line is on <a href="goals.html">Finish line</a>.`,
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
  ],
});

page({
  file: 'mastery.html',
  nav: 'Weapon mastery',
  title: 'Weapon mastery',
  lead: 'Each weapon type has its own Mastery ladder; the held type discounts weight and boosts matching skills, and every type at its cap adds account-wide drop rate.',
  body: [
    block('Weapon Mastery', table(['Bonus', 'What it gives', 'Where it stops'], [
      ['While held', `−${pts((BASES.mastery as any).weight_discount_per_level_pct)} weapon weight a level`, `<code>weight_discount_cap_pct</code> ${pts((BASES.mastery as any).weight_discount_cap_pct)}`],
      ['Matching skill', `+${n1((BASES.mastery as any).skill_bonus_per_level_pct)}% skill damage a level from Mastery level ${n0((BASES.mastery as any).skill_bonus_from_level)}`, `full bonus · cap ${pts((BASES.mastery as any).skill_bonus_cap_pct)}`],
      ['Other skill', 'half the held weapon’s skill damage bonus', `cap ${pts((BASES.mastery as any).skill_bonus_cap_pct * (BASES.mastery as any).skill_bonus_off_type_mult)}`],
      ['Account-wide', `+${pts((BASES.mastery as any).drop_bonus_per_type_pct)} drop rate per weapon type once that type reaches Mastery ${n0((BASES.mastery as any).drop_bonus_level_required)}`, `across ${n0((BASES.weapons || []).length)} types — <code>mastery.dropMultiplier</code>`],
      ['The ladder', `${n0((BASES.mastery as any).xp_per_kill)} Mastery XP a kill, the same curve shape as the herb farm, capped at ${n0((BASES.mastery as any).level_cap)}`, '<code>engine/mastery.ts</code>'],
    ]), `<code>MasteryLevel = min(cap, floor(sqrt(XP / divisor)) + 1)</code>; <code>weightDiscount = min(cap, level × perLevel)</code>. Matching skills get full skill bonus; other skills get <code>full × offTypeMultiplier</code>.`),
  ],
});

page({
  file: 'damage.html',
  nav: 'Damage',
  title: 'Damage, area and bodies',
  lead: 'How a finished hit meets body size, reach, area, conversion and bleed. Hit order and the defensive pools stay on <a href="combat.html">Combat</a>.',
  body: [
    block('What shape of fight pays what', table(['Body', 'Health', 'Comes in', 'What a weapon does to it'],
      (E.mob.sizes || []).filter((s: any) => s.id !== 'boss').map((s: any) => {
        const lean = (Object.entries((E.weapon_size_mult as any).ladder || {}) as any[])
          .filter(([, v]: any) => Number(v[s.id]) !== 1)
          .map(([w, v]: any) => `${w === 'one-handed sword' ? 'sword' : w === 'one-handed axe' ? 'axe' : w} ×${n2(v[s.id])}`);
        return [esc(s.name), '<span class="hy">the curve</span>', esc(s.group),
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
      ['Area damage', 'Live targets are all enemy centers inside the skill radius; the primary receives the full hit and additional targets receive <code>hit × per_target_pct / 100</code>. Offline uses the queue approximation.',
        `${pts((E.aoe as any).per_target_pct)} additional-target share · offline queue cap ${wrap(n0((E.aoe as any).target_cap))} · no multi-target Mana premium — <code>aoe</code>`],
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
  ],
});

page({
  file: 'encounters.html',
  nav: 'Encounters',
  title: 'Elite, Unique and Boss',
  lead: 'The three ranks that are not ordinary bodies: their HP, DPS and spawn rules.',
  body: [
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
  file: 'elements.html',
  nav: 'Elements',
  title: 'Elements',
  lead: 'Every Element names the status its hits leave. A Species attacks with one Element and authors a separate resistance and weakness; no Element counters another. The status rules are on <a href="statuses.html">Statuses</a>.',
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
  lead: 'One incoming hit resolves in a fixed order — avoidance, then Armour, then Elemental resistance, then a pool. Damage shapes, area and body size are on <a href="damage.html">Damage</a>; encounter ranks on <a href="encounters.html">Encounters</a>. Every number is the engine at the reference build (every point spent evenly across the seven Core attributes, level ' +
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
      row('Energy Shield', '<code>MaxES = (Wis × K_WIS_ES + additive) × (1 + pct / 100)</code>; regen waits for the no-hit delay',
        '<span class="hy">no Cap</span>', `${n0(DV.es_pool)} pool, ${n1(DV.es_regen)} a second, a full pool back in ${n0(DV.es_recover_sec)} sec, worth ${pc1(DV.es_share_of_hp)} of your Health — <code>maxEsOf</code>, <code>esRegenOf</code>`),
      row('Health', '<code>MaxHP = (base + Vit × K_VIT_HP + hp_per_level × (L − 1) + additive) × (1 + pct / 100)</code>',
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
      ['Crit', '<code>pool = Lck × K_LCK_CRIT + additive; chance = min(pool, cap); damage = 100 + bonus + (pool − chance) × K_CRIT_OVERFLOW</code>',
        `${pts(DV.crit_chance)} chance · ${pts(DV.crit_dmg)} damage — anything the pool holds past what the chance line takes is spent on damage, never wasted`],
      ['Stun', '<code>chance = max(0, Alignment × K_STUN_PER_ALIGN + gearPct)</code>; stop = duration × (1 − VitRecovery / 100)',
        `${n1(eng.stunChanceFrom(DV.align_path))}% a hit · Vit lets you shake off ${pts(eng.stunRecoveryOf(EVEN))} of a mob’s stop time`],
    ]), '<code>hitChance = Accuracy / (Accuracy + Evasion)</code>; Evasion and Stun use their own caps (Stun has none).'),
  ],
});

page({
  file: 'survival.html',
  nav: 'Survival',
  title: 'Field camp and survival',
  lead: 'HP, Mana and Energy Shield use separate Core formulas. Field skills are on <a href="field-skills.html">Field skills</a>; food, potions and herbs are on <a href="provisions.html">Provisions</a>.',
  body: [
    block('The pools', table(['Pool', 'What it is', 'Full at the reference build', 'How it comes back'], [
      ['Health', 'the pool every avoidance layer protects', wrap(n0(DV.hp)), `${n1(eng.hpRegenOf(EVEN))} a second off the Vit line — <code>hpRegenOf</code>`],
      ['Mana', 'the pool Mana-cost skills spend from; HP-cost skills debit the current HP pool, while auras reserve Max Mana', wrap(n0(DV.mana)),
        `${n1(DV.mana_regen)} a second, so an empty pool refills in ${n0(DV.pool_regen_sec)} sec — <code>manaRegenOf</code>`],
      ['Energy Shield', 'the caster’s second pool, spent before Health, and player-only', wrap(n0(DV.es_pool)),
        `${n1(DV.es_regen)} a second, but only once ${n0((E.energy_shield as any).delay_sec)} sec have passed without a hit — <code>esRegenOf</code>`],
    ]), `<code>MaxHP = (hp_base + Vit × K_VIT_HP + hp_per_level × (L − 1) + additive) × (1 + pct / 100)</code>; <code>MaxMana = (mana_base + Int × K_INT_MP + mp_per_level × (L − 1) + additive) × (1 + pct / 100)</code>; <code>MaxES = (Wis × K_WIS_ES + additive) × (1 + pct / 100)</code>.`),
    block('Your combat readout', '<p>The You card shows HP, Energy Shield, Mana and combat feedback. Objectives shows the run target and tracked Delivery wants; Chronicle records combat and loot.</p><p>The Journey keeps one next goal in front of you: your own pin (a Forge recipe, a Delivery, a map destination, a missing material or a passive node) or, when nothing is pinned, a suggestion from what the run can act on now. A suggestion never outranks your pin; hiding suggestions leaves pins and Delivery tracking visible. Problems that stop progress — a storage failure, a read-only tab, a full bag or a Camp decision — are listed above the goal in that order, one row per condition rather than a new warning every tick.</p><p>A missing material or Delivery want shows its known sources with a Pin button. Pinning selects that settlement on the map; it never walks, buys or spends anything. <em>Gear care</em> in Journey gathers Auto Equip, the bag filter and Auto-Return in one place and previews the current bag without moving a piece: locked pieces and Collector-held pieces are called out, and the filter run and Auto-Return use the same rules as the field.</p>'),
    block('What a Push costs', `<ul class="fx">
      <li><span class="fk">There is no death.</span><span class="fs">rule</span><span class="fv">a fight you lose rests you at camp and costs time only</span></li>
      <li><span class="fk">A Push on the walk is the ordinary Push.</span><span class="fs">rule</span><span class="fv">with a Field Camp in this zone, recovery returns there and ends the walk; otherwise the route resumes at its interrupted block (<code>road.push_rule</code>)</span></li>
      <li><span class="fk">A dungeon run forfeits its escrow.</span><span class="fs">rule</span><span class="fv">the one place a Push costs loot — <a href="world.html">World</a></span></li>
      <li><span class="fk">The log leaves a Push report.</span><span class="fs">readout</span><span class="fv">the threat's kind, level, damage type and Element, your resistance and HP/ES, plus the one change worth making before the next attempt</span></li>
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
  ],
});



page({
  file: 'field-skills.html',
  nav: 'Field skills',
  title: 'Field skills and gathering',
  lead: 'Field-skill progression, the extra rolls a hunt pays, and the regional Mine, Grove and forage sources.',
  body: [
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
        esc(drop.species.map((id: string) => (E.mob.species as any[]).find((sp: any) => sp.id === id)?.name || id).join(' · ')),
        esc(fieldwork.materialById[drop.resource]?.name || drop.resource),
        pc1(drop.chance), `${n0(drop.min)}–${n0(drop.max)}`,
      ])),
      '<code>Expected material per kill = chance × average(quantity range)</code>. These rows are the extra Hunting-skill roll; Mine and Grove actions use their own harvest formulas.'),
    block('Species bonus materials', table(['Material', 'Species', 'Chance'],
      [...new Set((E.mob.species as any[]).map((sp: any) => sp.bonus_material.resource))].map((resource: string) => {
        const members = (E.mob.species as any[]).filter((sp: any) => sp.bonus_material.resource === resource);
        return [
          esc(fieldwork.materialById[resource]?.name || resource),
          list(members.map((sp: any) => sp.name)),
          `${n2(members[0].bonus_material.chance * 100)}%`,
        ];
      })),
      '<code>Expected material per kill = chance × average(quantity range)</code>. This roll is independent of Hunting and applies to every rank, including dungeon and field kills.'),
    block('Regional gathering', table(['Town field', 'Mine bonus', 'Grove bonus', 'Grove forage'], TOWN.settlements.map((town: any) => {
      const source = (E.fieldwork as any).regional_sources[town.zone];
      return [esc(town.name), esc(fieldwork.materialById[source.mine].name), esc(fieldwork.materialById[source.grove].name), esc(fieldwork.foodById[source.food].name)];
    })), `<code>harvestBonus = reachedMilestones × bonusPerMilestone</code>; <code>dropChance = min(1, baseChance × (1 + min(cap, (max(0, skill − 1) × skillRate + max(0, mastery − 1) × masteryRate)) / 100))</code>. Regional source selects Mine, Grove and forage goods by zone.`),
  ],
});

page({
  file: 'provisions.html',
  nav: 'Provisions',
  title: 'Provisions, potions and herbs',
  lead: 'Hunger, the Camp kitchen, potions, Condensed draughts and the herb farm.',
  body: [
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
      `<code>pool restored = MaxPool × potionPct / 100</code>. One shared ${n0((E.potions as any).shared_cooldown_sec)} sec cooldown; cap ${n0((E.potions as any).max_uses_per_fight)} uses per fight. Auto-use prioritizes HP, then checks Mana when no usable HP bottle is available. Boss use: ${String((E.potions as any).boss_suppressed)}.`),
    block('Condensed', table(['', 'What it takes', 'What it gives'], [
      ['A Condensed draught', `${n0((E.potions as any).condensed.cost_bottles)} bottles + ${n0((E.potions as any).condensed.cost_reroll_value_stones)} ${STONE_NAME.reroll_value}s`,
        `×${n0((E.potions as any).condensed.effect_mult)} effect, at ${n0((E.potions as any).condensed.weight)} weight (${n0((E.potions as any).condensed.weight_loose)} carried loose)`],
    ]), `<code>condensed effect = base effect × ${n0((E.potions as any).condensed.effect_mult)}</code>; weight = ${n0((E.potions as any).condensed.weight)}.`),
    block('The herb farm', table(['', 'The number', 'Read from'], [
      ['Plots', `${n0((E.farm as any).plots.base)} to start, ${n0((E.farm as any).plots.shop_deeds)} bought, ${n0(farm.plotsMax)} at most`, '<code>farm.plots</code>'],
      ['A grow', `${n1(farm.growthSec / 3600)} hours, then ${n0((E.farm as any).yield_per_harvest)} herbs`, '<code>farm.growth_hours</code> · <code>farm.yield_per_harvest</code>'],
      ['A replant', `${n0(farm.seedCostHerbs)} herb of the harvest goes back into the ground`, '<code>farm.seed_cost_herbs</code>'],
      ['A day', `${n0((E.farm as any).taps_per_day)} taps; ${Number.isFinite(farm.offlineCapSec) ? `up to ${n1(farm.offlineCapSec / 3600)} hours of away growth` : 'away growth has no time limit'}`, '<code>farm.taps_per_day</code> · <code>farm.offline_cap_hours</code>'],
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
  file: 'away.html',
  nav: 'Away',
  title: 'Away',
  lead: `${E.inventory.offline_cap_hr == null ? 'Every whole elapsed second is credited, with no offline time limit.' : `Away time paid = min(elapsed away, ${n0(E.inventory.offline_cap_hr)} hours).`} Away gear uses the band’s floor Item level; loot is not auto-converted.`,
  body: [
    block('While the window is shut', table(['', 'The number', 'Read from'], [
      ['How long it keeps paying', E.inventory.offline_cap_hr == null ? 'Unlimited' : wrap(n0(E.inventory.offline_cap_hr)) + ' hours', '<code>inventory.offline_cap_hr</code>'],
      ['The farm while away', Number.isFinite(farm.offlineCapSec) ? wrap(n1(farm.offlineCapSec / 3600)) + ' hours' : 'Unlimited', '<code>farm.offline_cap_hours</code>'],
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
  ],
});

page({
  file: 'bag.html',
  nav: 'Bag & weight',
  title: 'Bag, weight and junk',
  lead: 'What you can carry, how it stacks, what encumbrance costs and how the bag filter decides.',
  body: [
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
    ]), `<code>score(item) = Σ(weight(Mod) × value / Mod.max)</code>. Keep if <code>score &gt; wornScore × (1 + margin)</code> or it carries an uncovered Element; otherwise dissolve when filtering is enabled. <em>Gear care</em> previews the same verdict on a copy of the run: Auto Equip is forecast with the same margin, the bag rows mark wear, keep, dissolve or protected, and a filter run is refused when the bag has no room for the salvage bundle. Changing a setting saves immediately; the preview moves nothing and rolls no RNG.`),
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
      ['A trail event a block', pc1((E.fieldwork as any).travel_events.chance_per_block), 'an independent local-food or rest roll; it never replaces the encounter roll'],
      ['What ambushes you', 'an ordinary mob group from the lower of the two zones the walk joins, at each Species’ fixed zone level and at the pack of the side it walks onto', '<code>road.encounter_rule</code> · <code>mob.species[].zone_levels</code>'],
      ['What it pays', 'the ordinary per-kill drop roll and nothing else', '<code>road.encounter_rule</code> — no purse, no chest, no Standing, no stone'],
      ['Losing one', 'a same-zone Field Camp receives you and ends the walk; without one, recover and resume at the interrupted block', '<code>road.push_rule</code>'],
      ['Forward', 'walks to the next already-open settlement when the current zone’s level band is behind', '<code>travel = forward</code> · online only'],
      ['Patrol', `${n0(E.road.patrol.max_stops)} subzones · ${n0(E.road.patrol.groups_per_stop)} groups per stop`, 'choose the order; repeat or stop whenever you want'],
      ['Auto-Return', `${n0(E.road.patrol.auto_return_threshold_pct)}% of the bag's slots used`, 'stashes unlocked gear at town and resumes Patrol if space was freed; stopping Patrol finishes the return at town'],
    ]), '<code>blocks = hexDistance</code>; <code>walkSeconds = blocks × block_sec</code>; <code>P(at least one encounter) = 1 − (1 − chancePerBlock)^blocks</code>. Patrol changes the active subzone pool.'),
    block('The map journal and trail sites', `<p>Approaching a block scouts its landmark, creatures and supplies. Standing on it records it as explored. The journal survives saving; offline time does not explore a route. Older saves retain their known settlements and current position.</p><p>Abandoned Camps and Provision Caravans appear as temporary world events on previously walked bare blocks near you. While online, every ${E.fieldwork.map_exploration.spawn.check_interval_sec} seconds the world rolls a ${Math.round(E.fieldwork.map_exploration.spawn.chance_per_check * 100)}% chance to create a site within ${E.fieldwork.map_exploration.spawn.radius} blocks, up to ${E.fieldwork.map_exploration.spawn.max_active} active sites. Each lasts ${E.fieldwork.map_exploration.spawn.lifetime_sec / 60} minutes of online time; spawning and lifetimes pause offline. Camps restore Hunger and caravans offer regional food, once per occurrence. A full food bag leaves a caravan available until it expires. Investigation stops hunting and cannot run during travel, recovery, a dungeon or an active fight. Setting or relocating Field Camp also requires a clear field. Both actions pause Patrol without clearing its itinerary. Event positions, timers and the independent RNG stream survive saving; reloading does not reroll the board. Sites add no currency, stones, XP or loot-RNG draws.</p><p>Patrol still uses its existing stop and group rules. The map's numbered flags show the selected order; offline hunting stays at the current stop. Field Camp scenery follows the active gathering activity, while visited settlements display their earned Standing.</p>`),
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
  nav: 'Build plan',
  title: 'Build plan',
  lead: 'A plan first: choose the regions your damage and defence scale on, walk one road to a Notable, and spend attainment on the Keystone that changes a rule. The tree and Keystone reference are separate pages; this page keeps the plan and the reference builds.',
  body: [
    block('Plan in four steps', `<ol>
      <li><strong>Pick the regions</strong> your damage and defence scale on; the seven Core attributes are on <a href="stats.html">Stats & caps</a>.</li>
      <li><strong>Walk one road</strong> from Start to the Notable you need; every Keystone hangs off a Notable entrance.</li>
      <li><strong>Spend attainment on a rule</strong>, not a stat: a Keystone changes one mechanic and never spends tree points.</li>
      <li><strong>Keep the plan free</strong>: respec is free at any settlement, so the tree follows the build.</li>
    </ol>`, 'The board previews the route and the price before a point is spent. Open the <a href="passive-tree.html">interactive tree</a> while you plan; every rule is on <a href="keystones.html">Keystones</a>.'),
    block('Where the pieces live', `<p>The <a href="passive-tree.html">Passive tree</a> draws every node and route; <a href="keystones.html">Keystones</a> lists every rule and exclusion; <a href="skills.html">Skills</a> holds acquisition, the duplicate ladder, auras and presets; <a href="goals.html">Finish line</a> holds the counted goals.</p>`, 'This page keeps the plan and the reference builds.'),
    block('The two builds every published number is measured on', table(['', 'Physical', 'Magic', 'Elemental', 'Alignment'],
      Object.entries(EREF).map(([k, v]: any) => [
        esc(k), wrap(n0(v.phys)), wrap(n0(v.magic)), wrap(n0(v.elem)), wrap(n1(v.align)),
      ])),
      `<code>TTK = target HP / DPS</code>. Reference at level ${n0(EREFERENCE.anchorLevel)}: ${n0(EREFERENCE.line.dps)} DPS evenly split (${n1(EREFERENCE.ttk)} sec) vs ${n0(EREFERENCE.focused.dps)} focused (${n2(EREFERENCE.focusedTtk)} sec).`),
  ],
});

page({
  file: 'keystones.html',
  nav: 'Keystones',
  title: 'Keystones',
  lead: 'Every Keystone, its Notable entrance, its authored parameters and the pairs that cannot be held together.',
  body: [
    block('The Keystones', tabbedTable('tree-keystones', ['Keystone', 'Notable entrance', 'What it changes'], treeNodes().regions.map((region: string) => ({
      key: region,
      label: region.toUpperCase(),
      rows: treeNodes().keystones.filter((node: any) => node.wing === region)
        .sort((a: any, b: any) => String(a.name || a.id).localeCompare(String(b.name || b.id)))
        .map((node: any) => {
          const numbers = keystoneNumbers(node);
          return [esc(node.name || node.id), esc(keystoneEntrance(node)),
            `${esc(node.description || '')}${numbers ? `<br><span class="hy">${numbers}</span>` : ''}`];
        }),
    }))), `Every Keystone costs ${wrap(n0(KEYSTONE_COST))} attainment point${KEYSTONE_COST === 1 ? '' : 's'} and never spends tree points. The numbers under a rule are its authored parameters from <code>tree.json</code>; the description is the rule the board shows when the node is selected. Pairwise exclusions are listed below.`),
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
  file: 'goals.html',
  nav: 'Finish line',
  title: 'The finish line',
  lead: 'What the run counts toward, and the goals that are counted rather than timed.',
  body: [
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
    lead: `Every icon the game ships, in one place. Search by name, filter by category, star icons to find them again, or mark unwanted icons to hide them until you're ready to remove them in a batch.`,
  body: ['<div id="icons-gallery"></div>'],
});

// ---------------------------------------------------------------- shell

/** The build order: the reading order of the manual, chapter by chapter. */
const ORDER = [
  'index.html', 'progression.html', 'mastery.html', 'goals.html', 'away.html', 'bag.html',
  'stats.html', 'skills.html', 'skills-roster.html', 'statuses.html', 'passive-tree.html', 'keystones.html', 'builds.html',
  'combat.html', 'damage.html', 'encounters.html', 'elements.html', 'mobs.html', 'mob-skills.html',
  'items.html', 'mods.html', 'drops.html', 'weapons.html', 'equipment.html', 'armour.html', 'jewellery.html', 'offhand.html', 'crafting.html', 'stones.html',
  'world.html', 'travel.html', 'survival.html', 'field-skills.html', 'provisions.html',
  'towns.html', 'standing.html', 'economy.html', 'delivery.html',
  'icons.html',
];
PAGES.sort((a, b) => ((ORDER.indexOf(a.file) + 1) || 999) - ((ORDER.indexOf(b.file) + 1) || 999));

// ---------------------------------------------------------------- chapters

type Chapter = { id: ChapterId; label: string; numeral: string; blurb: string };
const CHAPTERS: Chapter[] = [
  { id: 'start', label: 'Getting started', numeral: 'I', blurb: 'The run in six steps, levels, weapon mastery, the finish line, and the time the game keeps for you.' },
  { id: 'character', label: 'Character', numeral: 'II', blurb: 'Core attributes, the skill roster and its timing, statuses, the passive board, Keystones and the plan that spends them.' },
  { id: 'combat', label: 'Combat', numeral: 'III', blurb: 'How one hit resolves, how damage meets area and body size, encounter ranks, Elements and every body in the field.' },
  { id: 'gear', label: 'Gear & crafting', numeral: 'IV', blurb: 'Frames and Mods, drop odds, weapon types, every slot group, the bench and the stones that change what a piece is.' },
  { id: 'world', label: 'World', numeral: 'V', blurb: 'Zones and dungeons, the walk between them, the Camp, field skills and provisions.' },
  { id: 'trade', label: 'Towns & trade', numeral: 'VI', blurb: 'Settlements, Standing, task boards, gold, demand, Haggling, Delivery and the Black Market.' },
  { id: 'appendix', label: 'Appendix', numeral: 'VII', blurb: 'The complete icon shelf, read from the game folder.' },
];
const CHAPTER_OF: Record<string, ChapterId> = {
  index: 'start', progression: 'start', mastery: 'start', goals: 'start', away: 'start', bag: 'start',
  stats: 'character', skills: 'character', 'skills-roster': 'character', statuses: 'character', 'passive-tree': 'character', keystones: 'character', builds: 'character',
  combat: 'combat', damage: 'combat', encounters: 'combat', elements: 'combat', mobs: 'combat', 'mob-skills': 'combat',
  items: 'gear', mods: 'gear', drops: 'gear', weapons: 'gear', equipment: 'gear', armour: 'gear', jewellery: 'gear', offhand: 'gear', crafting: 'gear', stones: 'gear',
  world: 'world', travel: 'world', survival: 'world', 'field-skills': 'world', provisions: 'world',
  towns: 'trade', standing: 'trade', economy: 'trade', delivery: 'trade',
  icons: 'appendix',
};
for (const p of PAGES) p.group = CHAPTER_OF[p.file.replace(/\.html$/, '')] ?? 'appendix';
/** The reading order inside a chapter — the nav, cards and Prev/Next all follow this, not the
 *  global build order. */
const CHAPTER_ORDER: Record<ChapterId, string[]> = {
  start: ['index.html', 'progression.html', 'mastery.html', 'goals.html', 'away.html', 'bag.html'],
  character: ['stats.html', 'skills.html', 'skills-roster.html', 'statuses.html', 'passive-tree.html', 'keystones.html', 'builds.html'],
  combat: ['combat.html', 'damage.html', 'encounters.html', 'elements.html', 'mobs.html', 'mob-skills.html'],
  gear: ['items.html', 'mods.html', 'drops.html', 'weapons.html', 'equipment.html', 'armour.html', 'jewellery.html', 'offhand.html', 'crafting.html', 'stones.html'],
  world: ['world.html', 'travel.html', 'survival.html', 'field-skills.html', 'provisions.html'],
  trade: ['towns.html', 'standing.html', 'economy.html', 'delivery.html'],
  appendix: ['icons.html'],
};
const chapterOf = (id?: ChapterId): Chapter => CHAPTERS.find((c) => c.id === id) ?? CHAPTERS[0];
const pagesIn = (id: ChapterId): Page[] => CHAPTER_ORDER[id]
  .map((file) => PAGES.find((p) => p.file === file))
  .filter((p): p is Page => Boolean(p));
const chapterPageOf = (p: Page) => {
  const list = pagesIn(p.group ?? 'appendix');
  const at = list.findIndex((q) => q.file === p.file);
  return { list, at, prev: at > 0 ? list[at - 1] : undefined, next: at >= 0 ? list[at + 1] : undefined };
};
const plain = (html: string): string => String(html ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&#39;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/\s+/g, ' ')
  .trim();
const summary = (p: Page): string => {
  const text = plain(p.lead);
  if (text.length <= 140) return text;
  const cut = text.slice(0, 140);
  return `${cut.slice(0, cut.lastIndexOf(' ')).trimEnd()}…`;
};
const sectionParts = (body: string): { html: string; titles: { id: string; html: string }[] } => {
  const titles: { id: string; html: string }[] = [];
  let n = 0;
  const html = body.replace(/<h2>([\s\S]*?)<\/h2>/g, (_match, inner: string) => {
    n += 1;
    const id = `section-${n}`;
    titles.push({ id, html: inner });
    return `<h2 id="${id}">${inner}</h2>`;
  });
  return { html, titles };
};

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
.tabs input:checked:nth-of-type(3) ~ table tbody:nth-of-type(3),
.tabs input:checked:nth-of-type(4) ~ table tbody:nth-of-type(4),
.tabs input:checked:nth-of-type(5) ~ table tbody:nth-of-type(5),
.tabs input:checked:nth-of-type(6) ~ table tbody:nth-of-type(6),
.tabs input:checked:nth-of-type(7) ~ table tbody:nth-of-type(7) { display: table-row-group; }
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
/* Bestiary: race-grouped plates. A plate's left spine is its attack Element. */
.bestiary { display: grid; gap: 1.6rem; }
.beast-tools { display: grid; gap: .75rem; padding: .95rem 1rem; border: 1px solid var(--line); border-radius: var(--radius-card); background: var(--inset); }
.beast-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: .6rem 1rem; }
.beast-search { flex: 1 1 18rem; min-width: 0; }
.beast-search input { width: 100%; padding: .5rem .85rem; border: 1px solid var(--line); border-radius: var(--radius-pill); background: var(--panel); color: var(--text); font: inherit; font-size: .8rem; }
.beast-search input::placeholder { color: color-mix(in srgb, var(--dim) 72%, transparent); }
.beast-search input:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; border-color: color-mix(in srgb, var(--gold) 45%, var(--line)); }
.beast-status { color: var(--dim); font-family: var(--num); font-size: .7rem; white-space: nowrap; }
.beast-chips { display: flex; flex-wrap: wrap; gap: .3rem; }
.beast-chip { padding: .26rem .6rem; border: 1px solid var(--line); border-radius: var(--radius-pill); background: transparent; color: var(--dim); font: inherit; font-size: .7rem; cursor: pointer; }
.beast-chip b { color: color-mix(in srgb, var(--dim) 75%, transparent); font-weight: 500; }
.beast-chip:hover { color: var(--text); border-color: color-mix(in srgb, var(--gold) 30%, var(--line)); }
.beast-chip[aria-pressed="true"] { border-color: color-mix(in srgb, var(--gold) 55%, var(--line)); background: color-mix(in srgb, var(--gold) 11%, transparent); color: var(--gold-lit); }
.beast-chip[aria-pressed="true"] b { color: var(--gold); }
.beast-chip:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.beast-group { display: grid; gap: .55rem; }
.beast-group[hidden] { display: none; }
.beast-group-head { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; padding-bottom: .4rem; border-bottom: 1px solid var(--line); }
.beast-group-head h3 { color: var(--gold); font-size: .68rem; letter-spacing: .16em; text-transform: uppercase; }
.beast-group-head span { color: var(--dim); font-family: var(--num); font-size: .68rem; }
.beast-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr)); gap: .85rem; align-items: start; }
.page-content [data-element="fire"] { --el: var(--hp-lit); }
.page-content [data-element="cold"] { --el: var(--mana-lit); }
.page-content [data-element="lightning"] { --el: var(--xp-lit); }
.page-content [data-element="poison"] { --el: var(--good-lit); }
.page-content [data-element="chaos"] { --el: var(--curse); }
.page-content [data-element="earth"] { --el: var(--gold); }
.page-content [data-element="physical"] { --el: var(--mob); }
.beast-card { --el: var(--mob); display: grid; gap: .6rem; padding: .8rem .9rem .75rem 1rem; border: 1px solid var(--line); border-left: 3px solid var(--el); border-radius: var(--radius-card); background: var(--panel); }
.beast-card:hover { border-color: color-mix(in srgb, var(--el) 42%, var(--line)); border-left-color: var(--el); }
.beast-card[hidden] { display: none; }
.beast-head { display: flex; align-items: flex-start; justify-content: space-between; gap: .75rem; }
.beast-title { display: grid; gap: .1rem; min-width: 0; }
.beast-title h4 { color: var(--text); font-family: var(--wiki-display); font-size: 1.12rem; font-weight: 500; line-height: 1.15; }
.beast-sub { color: var(--dim); font-size: .7rem; }
.beast-flag { padding: 0 .3rem; border: 1px solid color-mix(in srgb, var(--good) 45%, var(--line)); border-radius: var(--radius-pill); color: var(--good-lit); font-size: .6rem; letter-spacing: .05em; text-transform: uppercase; white-space: nowrap; }
.beast-el { --el: var(--mob); display: inline-flex; align-items: center; gap: .32rem; flex: none; color: var(--el); font-family: var(--num); font-size: .62rem; letter-spacing: .08em; text-transform: uppercase; white-space: nowrap; }
.beast-el::before { content: ""; width: .42rem; height: .42rem; border-radius: 50%; background: var(--el); box-shadow: 0 0 .35rem color-mix(in srgb, var(--el) 60%, transparent); }
.beast-el.sm { font-size: .58rem; }
.beast-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .35rem .8rem; margin: 0; }
.beast-facts div { display: grid; gap: .05rem; min-width: 0; }
.beast-facts div:last-child:nth-child(odd) { grid-column: 1 / -1; }
.beast-facts dt { color: var(--dim); font-size: .56rem; letter-spacing: .1em; text-transform: uppercase; }
.beast-facts dd { margin: 0; display: flex; flex-wrap: wrap; align-items: baseline; gap: .3rem; color: var(--text); font-size: .74rem; }
.beast-bodies { display: inline-flex; gap: .22rem; }
.beast-body { display: inline-grid; place-items: center; width: 1.05rem; height: 1.05rem; border: 1px solid var(--line); border-radius: 3px; color: var(--dim); font-family: var(--num); font-size: .58rem; text-decoration: none; cursor: help; }
.beast-habitat { color: var(--dim); font-size: .7rem; text-transform: capitalize; }
.beast-label { color: var(--dim); font-size: .56rem; letter-spacing: .1em; text-transform: uppercase; padding-right: .4rem; }
.beast-kit { display: flex; flex-wrap: wrap; align-items: center; gap: .25rem; }
.beast-kit .tag { color: var(--text); }
.beast-none { color: var(--dim); font-size: .7rem; }
.beast-fold { border-top: 1px solid var(--line); padding-top: .5rem; }
.beast-fold summary { color: var(--dim); font-size: .7rem; cursor: pointer; }
.beast-fold summary:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.beast-fold summary:hover { color: var(--text); }
.beast-fold summary b { color: var(--el, var(--gold)); font-family: var(--num); font-size: .66rem; font-weight: 500; }
.beast-fold summary::marker { color: var(--el, var(--gold)); }
.beast-fold[open] { display: grid; gap: .5rem; }
.beast-fold-wide { border: 1px solid var(--line); border-radius: var(--radius-card); background: var(--inset); padding: .8rem 1rem; }
.beast-fold-wide[open] { gap: .9rem; }
.beast-fold-wide summary { font-family: var(--wiki-display); font-size: .95rem; }
.beast-fold-wide summary b { color: var(--gold); }
.beast-table-wrap { overflow-x: auto; }
.beast-fold table { font-size: .7rem; }
.beast-fold th, .beast-fold td { padding: .28rem .35rem; }
.beast-pc { color: var(--text); font-family: var(--num); }
.beast-unique { color: var(--gold-lit); border-color: color-mix(in srgb, var(--gold) 45%, var(--line)); }
.legend { display: grid; gap: var(--spacing-xs); padding-left: 1.1rem; font-size: var(--font-xs); color: var(--dim); }
.legend strong { color: var(--text); }
.num { font-family: var(--num); font-variant-numeric: tabular-nums; }.tag { border: 1px solid var(--line); border-radius: var(--radius-card); padding: 0 .25rem; color: var(--dim); font-size: var(--font-xs); text-transform: uppercase; }
ol { display: flex; flex-direction: column; gap: var(--spacing-xs); padding-left: 1.3rem; }`;

/** The official shell: masthead, chapter sidebar, page chrome and home cards. Content rules above
 *  still own the tables, tabs and rosters; this layer names tokens only. */
export const SHELL = `:root { --wiki-max: 96rem; --wiki-display: "Palatino Linotype", "Book Antiqua", Georgia, serif; }
body {
  display: block; min-height: 100vh;
  background:
    radial-gradient(70rem 34rem at 8% -12%, color-mix(in srgb, var(--gold) 7%, transparent), transparent 62%),
    radial-gradient(52rem 30rem at 104% 2%, color-mix(in srgb, var(--mana) 7%, transparent), transparent 58%),
    var(--bg);
}
body::before {
  content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 0;
  background-image: linear-gradient(color-mix(in srgb, var(--line) 22%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in srgb, var(--line) 22%, transparent) 1px, transparent 1px);
  background-size: 4.5rem 4.5rem; opacity: .28;
}
.skip {
  position: fixed; top: 1rem; left: 1rem; z-index: var(--z-popover);
  padding: .55rem .9rem; border: 1px solid var(--gold); border-radius: var(--radius-card);
  background: var(--panel); color: var(--gold-lit); font: inherit; cursor: pointer;
  transform: translateY(-200%);
}
.skip:focus-visible { transform: none; outline: 2px solid var(--focus); outline-offset: 2px; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.wiki-masthead {
  position: relative; z-index: 2; display: flex; align-items: center; gap: var(--spacing-lg);
  width: 100%; max-width: var(--wiki-max); padding: 1.35rem 2.5rem; margin-inline: auto;
  border-bottom: 1px solid var(--line);
}
.brand { display: flex; align-items: center; gap: .75rem; color: var(--text); flex: none; }
.brand:hover { text-decoration: none; }
.brand-mark {
  display: grid; place-items: center; width: 2.35rem; height: 2.35rem; flex: none;
  border: 1px solid color-mix(in srgb, var(--gold) 70%, var(--line)); border-radius: var(--radius-round);
  background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--gold) 18%, transparent), var(--inset) 70%);
  box-shadow: 0 0 1.2rem color-mix(in srgb, var(--gold) 16%, transparent);
}
.brand-mark::before { content: ""; width: .62rem; height: .62rem; transform: rotate(45deg); background: linear-gradient(140deg, var(--gold-lit), var(--gold)); }
.brand-text b { display: block; font-family: var(--wiki-display); font-size: 1.05rem; font-weight: 600; letter-spacing: .2em; line-height: 1.1; }
.brand-text small { display: block; color: var(--gold); font-size: .6rem; letter-spacing: .3em; text-transform: uppercase; }
.masthead-tag { flex: 1; color: var(--dim); font-size: .72rem; letter-spacing: .06em; }
.masthead-tools { display: flex; align-items: center; gap: .7rem; flex: none; }
.search { position: relative; display: flex; align-items: center; color: var(--dim); }
.search .search-glyph { position: absolute; left: .8rem; width: 1rem; height: 1rem; background: currentColor; -webkit-mask: url(../../game/src/icon/ui/search.png) center / contain no-repeat; mask: url(../../game/src/icon/ui/search.png) center / contain no-repeat; pointer-events: none; }
.search input {
  width: clamp(12rem, 19vw, 21rem); padding: .55rem 1rem .55rem 2.3rem;
  border: 1px solid var(--line); border-radius: 999px; background: var(--inset); color: var(--text);
  font: inherit; font-size: .8rem;
}
.search input::placeholder { color: color-mix(in srgb, var(--dim) 75%, transparent); }
.search input:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; border-color: color-mix(in srgb, var(--gold) 45%, var(--line)); }
.search-results {
  position: absolute; top: calc(100% + .5rem); right: 0; z-index: var(--z-popover);
  display: grid; gap: .15rem; width: min(26rem, 80vw); padding: .4rem;
  background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius-card); box-shadow: var(--shadow-soft);
}
.search-results[hidden] { display: none; }
dl, dt, dd { margin: 0; }
.search-hit { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; padding: .5rem .6rem; border-radius: 6px; color: var(--text); font-size: .82rem; }
.search-hit small { color: var(--dim); font-size: .62rem; letter-spacing: .1em; text-transform: uppercase; white-space: nowrap; }
.search-hit:hover, .search-hit:focus-visible { background: var(--surface-selected); text-decoration: none; }
.search-none { padding: .5rem .6rem; color: var(--dim); font-size: .78rem; }
.play-link { padding: .5rem .9rem; border: 1px solid color-mix(in srgb, var(--gold) 55%, var(--line)); border-radius: 999px; color: var(--gold-lit); font-size: .72rem; letter-spacing: .04em; white-space: nowrap; }
.play-link:hover { background: color-mix(in srgb, var(--gold) 9%, transparent); text-decoration: none; }
.menu-toggle { display: none; align-items: center; gap: .45rem; padding: .5rem .75rem; border: 1px solid var(--line); border-radius: var(--radius-card); background: var(--inset); color: var(--text); font: inherit; font-size: .78rem; cursor: pointer; }
.menu-toggle:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.wiki-shell { position: relative; z-index: 1; display: grid; grid-template-columns: 15.5rem minmax(0, 1fr); gap: 3.2rem; width: 100%; max-width: var(--wiki-max); padding: 2.3rem 2.5rem 4rem; margin-inline: auto; }
.wiki-nav { position: sticky; top: 1.6rem; align-self: start; display: flex; flex-direction: column; gap: 1.45rem; max-height: calc(100vh - 3.2rem); overflow: auto; min-width: 0; padding-right: .65rem; border-right: 1px solid var(--line); }
.nav-title { color: var(--dim); font-size: .62rem; letter-spacing: .24em; text-transform: uppercase; }
.nav-group { display: grid; gap: .5rem; }
.nav-group h2 { display: flex; align-items: baseline; gap: .45rem; padding: 0; border: 0; color: var(--dim); font-size: .64rem; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; }
.nav-group h2 span { color: var(--gold); font-family: var(--num); font-weight: 500; }
.nav-group h2 b { color: color-mix(in srgb, var(--dim) 65%, transparent); font-family: var(--num); font-weight: 500; }
.nav-group ul { display: grid; gap: 1px; padding: 0; list-style: none; }
.nav-group a { display: block; padding: .38rem .65rem; border-left: 2px solid transparent; border-radius: 0 6px 6px 0; color: var(--dim); font-size: .83rem; }
.nav-group a:hover { color: var(--text); background: color-mix(in srgb, var(--text) 4%, transparent); text-decoration: none; }
.nav-group a.on { color: var(--gold-lit); border-left-color: var(--gold); background: linear-gradient(90deg, color-mix(in srgb, var(--gold) 11%, transparent), transparent); }
.nav-foot { color: color-mix(in srgb, var(--dim) 70%, transparent); font-size: .66rem; letter-spacing: .06em; }
.wiki-main { display: flex; flex-direction: column; gap: 1.5rem; min-width: 0; }
.wiki-main h1 { font-family: var(--wiki-display); font-size: clamp(2rem, 3.4vw, 3.2rem); font-weight: 500; line-height: 1.08; letter-spacing: .01em; }
.page-head {
  display: grid; gap: .85rem; padding: 1.55rem 1.75rem;
  border: 1px solid var(--line); border-radius: var(--radius-card);
  background: linear-gradient(155deg, color-mix(in srgb, var(--panel) 92%, var(--gold) 8%), var(--inset));
  box-shadow: var(--shadow-soft);
}
.crumbs, .toc, .page-turn { position: static; min-width: 0; }
.crumbs { display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; gap: .45rem; color: var(--dim); font-size: .64rem; letter-spacing: .12em; text-transform: uppercase; }
.crumbs a { color: var(--dim); } .crumbs a:hover { color: var(--gold); text-decoration: none; }
.eyebrow { display: flex; align-items: center; gap: .55rem; color: var(--gold); font-size: .64rem; letter-spacing: .22em; text-transform: uppercase; }
.eyebrow::before { content: ""; width: 1.5rem; height: 1px; background: var(--gold); }
.page-head .lead { max-width: 62rem; color: var(--dim); font-size: 1rem; line-height: 1.6; }
.page-meta { display: flex; flex-wrap: wrap; gap: .4rem; }
.chip { padding: .22rem .6rem; border: 1px solid var(--line); border-radius: 999px; color: var(--dim); font-size: .62rem; letter-spacing: .08em; text-transform: uppercase; }
.covers { color: var(--dim); font-size: .78rem; }
.covers span { color: var(--gold); font-size: .62rem; letter-spacing: .12em; text-transform: uppercase; padding-right: .45rem; }
.toc { display: grid; gap: .55rem; padding: .95rem 1.15rem; border: 1px solid var(--line); border-radius: var(--radius-card); background: var(--inset); }
.toc ol { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: .15rem 1rem; padding: 0; list-style: none; }
.toc button { display: block; width: 100%; padding: .32rem .15rem; border: 0; border-bottom: 1px dotted transparent; background: none; color: var(--dim); font: inherit; font-size: .8rem; text-align: left; cursor: pointer; }
.toc button:hover, .toc button.on { color: var(--gold-lit); border-bottom-color: color-mix(in srgb, var(--gold) 40%, transparent); }
.toc button:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }
.page-content { display: grid; gap: 1.15rem; counter-reset: sec; }
.page-content > section {
  counter-increment: sec; display: grid; gap: .8rem; padding: 1.25rem 1.45rem;
  border: 1px solid var(--line); border-radius: var(--radius-card);
  background: linear-gradient(180deg, color-mix(in srgb, var(--panel) 88%, transparent), color-mix(in srgb, var(--inset) 94%, transparent));
  overflow-x: auto;
}
.page-content > section > h2 { display: flex; align-items: baseline; gap: .65rem; padding-bottom: .5rem; border-bottom: 1px solid var(--line); font-family: var(--wiki-display); font-size: 1.25rem; font-weight: 500; letter-spacing: .01em; }
.page-content > section > h2::before { content: counter(sec, decimal-leading-zero); color: var(--gold); font-family: var(--num); font-size: .7rem; letter-spacing: .08em; }
.page-content h3 { color: var(--gold); font-size: .68rem; letter-spacing: .14em; }
.page-content p, .page-content li { color: color-mix(in srgb, var(--text) 88%, var(--dim)); }
.page-content .note { padding: .55rem .8rem; border-left: 2px solid color-mix(in srgb, var(--gold) 45%, var(--line)); border-radius: 0 6px 6px 0; background: color-mix(in srgb, var(--gold) 4%, transparent); }
.page-content code { padding: .05em .28em; border-radius: 4px; background: color-mix(in srgb, var(--gold) 7%, transparent); color: var(--gold-lit); font-family: var(--num); font-size: .86em; }
.page-content thead th { background: var(--inset); color: var(--gold); font-size: .62rem; letter-spacing: .08em; text-transform: uppercase; }
.page-content td:first-child { white-space: normal; }
.page-content tbody tr:nth-child(even) { background: color-mix(in srgb, var(--text) 2.5%, transparent); }
.page-content tbody tr:hover { background: color-mix(in srgb, var(--gold) 5%, transparent); }
.page-foot { display: grid; gap: 1rem; padding-top: 1.1rem; border-top: 1px solid var(--line); }
.related-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: .65rem; }
.related-grid a { display: grid; gap: .2rem; padding: .75rem .85rem; border: 1px solid var(--line); border-radius: var(--radius-card); background: var(--inset); color: var(--text); }
.related-grid a:hover { border-color: color-mix(in srgb, var(--gold) 40%, var(--line)); text-decoration: none; }
.related-grid small { color: var(--dim); font-size: .75rem; }
.page-turn { display: grid; grid-template-columns: 1fr 1fr; gap: .7rem; }
.page-turn a { display: grid; gap: .2rem; padding: .65rem .85rem; border: 1px solid var(--line); border-radius: var(--radius-card); background: var(--inset); color: var(--text); }
.page-turn a:hover { border-color: color-mix(in srgb, var(--gold) 40%, var(--line)); text-decoration: none; }
.page-turn small { color: var(--dim); font-size: .6rem; letter-spacing: .12em; text-transform: uppercase; }
.page-turn .next { justify-self: end; text-align: right; }
.home-hero {
  display: grid; gap: 1.05rem; padding: 2.2rem 2.1rem;
  border: 1px solid color-mix(in srgb, var(--gold) 30%, var(--line)); border-radius: var(--radius-card);
  background:
    radial-gradient(38rem 18rem at 12% 0%, color-mix(in srgb, var(--gold) 13%, transparent), transparent 65%),
    linear-gradient(160deg, color-mix(in srgb, var(--panel) 90%, var(--gold) 10%), var(--inset));
  box-shadow: var(--shadow-soft);
}
.home-hero h1 { font-size: clamp(2.7rem, 5vw, 4.6rem); }
.home-hero .lead { max-width: 56rem; color: var(--dim); font-size: 1.08rem; line-height: 1.6; }
.hero-actions { display: flex; flex-wrap: wrap; gap: .65rem; }
.btn { display: inline-flex; align-items: center; gap: .45rem; padding: .55rem .95rem; border: 1px solid var(--line); border-radius: 999px; background: var(--inset); color: var(--text); font: inherit; font-size: .78rem; cursor: pointer; }
.btn:hover { border-color: var(--gold); text-decoration: none; }
.btn.primary { border-color: var(--gold); background: linear-gradient(180deg, var(--gold-lit), var(--gold)); color: var(--bg); font-weight: 600; }
.btn:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.hero-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr)); gap: 1px; padding: 0; overflow: hidden; border: 1px solid var(--line); border-radius: var(--radius-card); background: var(--line); }
.hero-stats div { display: grid; gap: .15rem; padding: .75rem .85rem; background: var(--inset); }
.hero-stats dt { color: var(--dim); font-size: .6rem; letter-spacing: .14em; text-transform: uppercase; }
.hero-stats dd { color: var(--gold-lit); font-family: var(--num); font-size: 1.3rem; }
.start-strip { display: grid; gap: .9rem; padding: 1.3rem 1.4rem; border: 1px solid var(--line); border-radius: var(--radius-card); background: var(--inset); }
.start-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); gap: .8rem; }
.start-grid article { display: grid; gap: .4rem; padding: .9rem 1rem; border: 1px solid var(--line); border-radius: var(--radius-card); background: var(--panel); }
.start-grid article > span { color: var(--gold); font-family: var(--num); font-size: .72rem; letter-spacing: .1em; }
.start-grid h3 { color: var(--text); font-family: var(--wiki-display); font-size: 1.05rem; font-weight: 500; letter-spacing: 0; text-transform: none; }
.start-grid p { color: var(--dim); font-size: .8rem; }
.start-grid a { color: var(--gold-lit); font-size: .76rem; }
.card-links { display: flex; flex-wrap: wrap; gap: .2rem .9rem; }
.chapters { display: grid; gap: 1rem; }
.chapter-head { display: flex; align-items: end; justify-content: space-between; gap: 1rem; padding-bottom: .55rem; border-bottom: 1px solid var(--line); }
.chapter-head h2 { padding: 0; border: 0; font-family: var(--wiki-display); font-size: 1.55rem; font-weight: 500; }
.chapter-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr)); gap: .9rem; }
.chapter-card { display: grid; gap: .65rem; padding: 1.05rem 1.15rem; border: 1px solid var(--line); border-radius: var(--radius-card); background: var(--panel); }
.chapter-card header { display: flex; align-items: baseline; gap: .55rem; }
.chapter-card h3 { flex: 1; color: var(--text); font-family: var(--wiki-display); font-size: 1.1rem; font-weight: 500; letter-spacing: 0; text-transform: none; }
.chapter-card header small { color: var(--dim); font-size: .58rem; letter-spacing: .1em; text-transform: uppercase; }
.chapter-card > p { color: var(--dim); font-size: .78rem; }
.chapter-card ul { display: grid; gap: .25rem; padding: 0; list-style: none; }
.chapter-card li a { display: grid; gap: .12rem; padding: .4rem .5rem; border-radius: 6px; color: var(--text); }
.chapter-card li a:hover { background: var(--surface-selected); text-decoration: none; }
.chapter-card li b { font-size: .82rem; font-weight: 500; }
.chapter-card li span { color: var(--dim); font-size: .72rem; }
.wiki-foot { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: .6rem 1.2rem; padding-top: 1rem; border-top: 1px solid var(--line); color: var(--dim); font-size: .66rem; letter-spacing: .03em; }
.wiki-foot a { color: var(--dim); }
.wiki-tree-view { display: grid; grid-template-rows: auto auto minmax(0, 1fr); overflow: hidden; border: 1px solid color-mix(in srgb, var(--gold) 24%, var(--line)); border-radius: var(--radius-card); background: var(--ground); }
.wiki-tree-bar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .75rem 1rem; border-bottom: 1px solid var(--line); background: var(--inset); }
.wiki-tree-heading { display: grid; gap: .2rem; }
.wiki-tree-heading strong { color: var(--text); font-size: .82rem; font-weight: 500; }
.wiki-tree-controls { display: flex; align-items: center; gap: .35rem; }
.icon-mask { display: inline-block; width: .9rem; height: .9rem; flex: none; background: currentColor; -webkit-mask: var(--glyph) center / contain no-repeat; mask: var(--glyph) center / contain no-repeat; }
.tree-tool { display: inline-flex; align-items: center; justify-content: center; min-width: 1.75rem; padding: .32rem .45rem; border: 1px solid var(--line); border-radius: 6px; background: var(--panel); color: var(--text); font: inherit; font-size: .75rem; cursor: pointer; }
.tree-tool[data-tree-fit] { --glyph: url(../../game/src/icon/ui/expand.png); }
.tree-tool[data-tree-zoom="0.8"] { --glyph: url(../../game/src/icon/ui/remove-minus.png); }
.tree-tool[data-tree-zoom="1.25"] { --glyph: url(../../game/src/icon/ui/add-plus.png); }
.tree-tool:hover { border-color: var(--gold); }
.tree-tool:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.tree-zoom { min-width: 3rem; text-align: center; color: var(--dim); font-family: var(--num); font-size: .72rem; }
.wiki-tree-chips { display: flex; flex-wrap: wrap; gap: .3rem; padding: .55rem 1rem; border-bottom: 1px solid var(--line); background: color-mix(in srgb, var(--panel) 55%, var(--ground)); }
.tree-chip { padding: .28rem .6rem; border: 1px solid color-mix(in srgb, var(--wing) 45%, var(--line)); border-radius: 999px; background: transparent; color: color-mix(in srgb, var(--wing) 70%, var(--dim)); font: inherit; font-size: .68rem; letter-spacing: .08em; cursor: pointer; }
.tree-chip:hover, .tree-chip.on { background: color-mix(in srgb, var(--wing) 14%, transparent); color: var(--text); }
.tree-chip:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.wiki-tree-stage { position: relative; height: clamp(22rem, 70vh, 48rem); overflow: hidden; background: radial-gradient(60% 60% at 50% 45%, color-mix(in srgb, var(--gold) 10%, transparent), transparent 70%), linear-gradient(160deg, color-mix(in srgb, var(--ground) 92%, var(--gold) 8%), var(--bg)); cursor: grab; touch-action: none; }
.wiki-tree-stage:focus-visible { outline: 2px solid var(--focus); outline-offset: -2px; }
.wiki-tree-stage.dragging { cursor: grabbing; }
.wiki-tree-svg { display: block; width: 100%; height: 100%; user-select: none; }
.tree-link { fill: none; stroke: color-mix(in srgb, var(--gold) 28%, var(--line)); stroke-width: 1.4; }
.tree-link.cross { stroke-dasharray: 3 5; stroke: color-mix(in srgb, var(--gold) 52%, var(--line)); opacity: .75; }
.tree-region .region-code { font-family: var(--wiki-display); font-size: 26px; fill: color-mix(in srgb, var(--wing) 58%, var(--dim)); }
.tree-region .region-name { font-size: 11px; fill: var(--dim); letter-spacing: .1em; text-transform: uppercase; }
.tree-origin .origin-ornament { fill: none; stroke: color-mix(in srgb, var(--gold) 24%, var(--line)); stroke-dasharray: 3 5; }
.tree-origin .origin-rim { fill: none; stroke: var(--gold); }
.tree-origin .origin-face { fill: var(--inset); stroke: var(--gold-lit); }
.tree-origin .origin-mark { pointer-events: none; }
.tree-origin .origin-label { fill: var(--dim); font-size: 11px; letter-spacing: .22em; }
.wiki-tree-node { cursor: pointer; }
.wiki-tree-node .tree-node-face { fill: var(--ground); stroke: color-mix(in srgb, var(--wing) 72%, var(--line)); stroke-width: 1.2; }
.wiki-tree-node .tree-node-halo { fill: none; stroke: color-mix(in srgb, var(--wing) 30%, transparent); stroke-width: 1; opacity: .55; }
.wiki-tree-node .tree-node-core { fill: var(--wing); opacity: .85; }
.wiki-tree-node .tree-node-icon { opacity: .9; pointer-events: none; filter: sepia(.2) saturate(.7); }
.wiki-tree-node .tree-node-rim { fill: none; stroke: var(--wing); stroke-width: 1.6; opacity: .9; }
.wiki-tree-node .tree-node-hit { fill: transparent; pointer-events: all; }
.wiki-tree-node.notable .tree-node-rim { stroke-width: 2; }
.wiki-tree-node.keystone .tree-node-face { fill: color-mix(in srgb, var(--gold) 14%, var(--ground)); stroke: var(--gold); }
.wiki-tree-node.keystone .tree-node-rim { stroke: var(--gold-lit); stroke-width: 2; }
.tree-keystone-corners { fill: none; stroke: var(--gold); stroke-width: 1.3; }
.wiki-tree-node:hover .tree-node-face, .wiki-tree-node.picked .tree-node-face { filter: drop-shadow(0 0 4px var(--wing)); }
.wiki-tree-node.picked .tree-node-rim { stroke: var(--gold-lit); stroke-width: 2.6; }
.wiki-tree-hint { position: absolute; left: .8rem; bottom: .7rem; color: var(--dim); font-size: .66rem; letter-spacing: .04em; pointer-events: none; }
.wiki-tree-legend { position: absolute; right: .8rem; bottom: .65rem; display: flex; flex-wrap: wrap; gap: .5rem; color: var(--dim); font-size: .6rem; letter-spacing: .05em; text-transform: uppercase; pointer-events: none; }
.wiki-tree-legend span { display: inline-flex; align-items: center; gap: .25rem; }
.wiki-tree-legend span::before { content: ""; width: .45rem; height: .45rem; border-radius: 50%; border: 1px solid var(--line); background: var(--ground); }
.wiki-tree-legend .l-notable::before { border-color: var(--gold); }
.wiki-tree-legend .l-keystone::before { border-color: var(--gold-lit); background: color-mix(in srgb, var(--gold) 25%, var(--ground)); }
.wiki-tree-legend .l-cross::before { width: .9rem; height: 0; border: 0; border-top: 1px dashed var(--gold); border-radius: 0; background: none; }
.wiki-tree-card { position: absolute; z-index: 3; display: grid; gap: .18rem; max-width: min(19rem, 72vw); padding: .7rem .85rem; border: 1px solid color-mix(in srgb, var(--gold) 45%, var(--line)); border-radius: var(--radius-card); background: color-mix(in srgb, var(--panel) 96%, transparent); box-shadow: var(--shadow-soft); pointer-events: none; }
.wiki-tree-card[hidden] { display: none; }
.wiki-tree-card strong { color: var(--gold-lit); font-family: var(--wiki-display); font-size: 1rem; font-weight: 500; }
.wiki-tree-card .tree-card-meta { color: var(--dim); font-size: .66rem; letter-spacing: .05em; text-transform: uppercase; }
.wiki-tree-card p { color: color-mix(in srgb, var(--text) 86%, var(--dim)); font-size: .78rem; }
.wiki-tree-node.str, .tree-region.str, .tree-chip.str { --wing: var(--hp); }
.wiki-tree-node.agi, .tree-region.agi, .tree-chip.agi { --wing: var(--good); }
.wiki-tree-node.dex, .tree-region.dex, .tree-chip.dex { --wing: var(--xp); }
.wiki-tree-node.int, .tree-region.int, .tree-chip.int { --wing: var(--mana); }
.wiki-tree-node.wis, .tree-region.wis, .tree-chip.wis { --wing: var(--curse); }
.wiki-tree-node.vit, .tree-region.vit, .tree-chip.vit { --wing: var(--hp-lit); }
.wiki-tree-node.lck, .tree-region.lck, .tree-chip.lck { --wing: var(--gold); }
@media (max-width: 46rem) {
  .wiki-tree-stage { height: 60vh; }
  .wiki-tree-legend { display: none; }
  .wiki-tree-bar { flex-wrap: wrap; }
  .wiki-tree-controls { flex: 1 0 100%; justify-content: flex-end; }
}
@media (max-width: 64rem) {
  .wiki-masthead { flex-wrap: wrap; padding: 1.1rem 1.4rem; }
  .masthead-tag { flex: 1 0 100%; order: 3; }
  .masthead-tools { order: 2; }
  .menu-toggle { display: inline-flex; order: 1; }
  .brand { order: 0; }
  .wiki-shell { grid-template-columns: 1fr; padding: 1.2rem 1.4rem 3rem; }
  .wiki-nav { position: static; display: none; max-height: none; padding: 0 0 1rem; border-right: 0; border-bottom: 1px solid var(--line); }
  .wiki-shell.nav-open .wiki-nav { display: flex; }
}
@media (max-width: 46rem) {
  .search input { width: min(100%, 14rem); }
  .masthead-tools { flex: 1 0 100%; }
  .search { flex: 1; } .search input { width: 100%; }
  .page-head, .home-hero { padding: 1.1rem 1.15rem; }
  .page-content > section { padding: 1rem 1.05rem; }
  .page-turn { grid-template-columns: 1fr; }
  .page-turn .next { justify-self: start; text-align: left; }
  .toc ol { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
}
@media print {
  .wiki-masthead, .wiki-nav, .toc, .page-turn, .related-grid, .wiki-foot, .skip { display: none !important; }
  .wiki-shell { display: block; max-width: none; padding: 0; }
  body::before { display: none; }
  .page-content > section { break-inside: avoid; }
}`;

const masthead = (): string => `<header class="wiki-masthead">
  <a class="brand" href="index.html" aria-label="ModWorld Field Manual, home">
    <span class="brand-mark" aria-hidden="true"></span>
    <span class="brand-text"><b>MODWORLD</b><small>Field Manual</small></span>
  </a>
  <p class="masthead-tag">Official player reference · live figures</p>
  <div class="masthead-tools">
    <div class="search" role="search">
      <span class="search-glyph" aria-hidden="true"></span>
      <label class="sr-only" for="wiki-search">Search the manual</label>
      <input id="wiki-search" type="search" placeholder="Search the manual…" autocomplete="off" spellcheck="false" />
      <div id="wiki-search-results" class="search-results" hidden></div>
    </div>
    <a class="play-link" href="/">Play the game</a>
  </div>
  <button class="menu-toggle" type="button" data-wiki-menu aria-controls="wiki-nav" aria-expanded="false"><span aria-hidden="true">☰</span> Chapters</button>
</header>`;

const chapterNav = (active: string): string => `<nav class="wiki-nav" id="wiki-nav" aria-label="Manual chapters">
  <p class="nav-title">The manual</p>
  ${CHAPTERS.map((c) => `<section class="nav-group" aria-labelledby="nav-${c.id}">
    <h2 id="nav-${c.id}"><span>${c.numeral}</span>${esc(c.label)}<b>${pagesIn(c.id).length}</b></h2>
    <ul>${pagesIn(c.id).map((p) => `<li><a href="${p.file}" data-page-link data-title="${escAttr(p.nav)}" data-group="${escAttr(c.label)}" data-search="${escAttr(`${p.nav} ${p.title} ${c.label} ${plain(p.lead)}`)}" class="${p.file === active ? 'on' : ''}"${p.file === active ? ' aria-current="page"' : ''}>${esc(p.nav)}</a></li>`).join('')}</ul>
  </section>`).join('')}
  <p class="nav-foot">${CHAPTERS.length} chapters · ${PAGES.length} pages · live data</p>
</nav>`;

const homeStats = (): string => {
  const rows: [string, number][] = [
    ['Pages', PAGES.length],
    ['Zones', eng.ZONES.length],
    ['Species', E.mob.species.length],
    ['Skills', sm.all().length],
    ['Keystones', treeNodes().keystones.length],
  ];
  return rows.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${wrap(n0(value))}</dd></div>`).join('');
};

const homeHero = (p: Page): string => `<header class="home-hero">
  <p class="eyebrow">Official field manual · live figures</p>
  <h1>ModWorld</h1>
  <p class="lead">${p.lead}</p>
  <div class="hero-actions">
    <a class="btn primary" href="/">Play the game</a>
    <a class="btn" href="combat.html">Read Combat first</a>
    <button class="btn" type="button" data-scroll="chapters">Browse chapters</button>
  </div>
  <dl class="hero-stats">${homeStats()}</dl>
</header>`;

const startStrip = (): string => `<section class="start-strip" aria-labelledby="start-title">
  <p class="eyebrow" id="start-title">Start here</p>
  <div class="start-grid">
    <article><span>01</span><h3>Open the field</h3><p>Pick a zone and let the character fight on the clock; every panel sits behind one field screen.</p><a href="/">Enter the game</a></article>
    <article><span>02</span><h3>Learn one hit</h3><p>Avoidance, Armour, resistance and the pools resolve in a fixed order; knowing that order explains every defence.</p><a href="combat.html">Combat</a></article>
    <article><span>03</span><h3>Set the loops</h3><p>Arrange skills, wear the right drop and plan a Patrol route; the run keeps working while you are away.</p><span class="card-links"><a href="skills.html">Skills</a><a href="travel.html">Travel</a></span></article>
  </div>
</section>`;

const chaptersGrid = (): string => `<section class="chapters" id="chapters" aria-labelledby="chapters-title">
  <div class="chapter-head"><div><p class="eyebrow">Contents</p><h2 id="chapters-title">Manual chapters</h2></div></div>
  <div class="chapter-grid">
    ${CHAPTERS.map((c) => {
      const list = pagesIn(c.id).filter((p) => p.file !== 'index.html');
      return `<article class="chapter-card">
        <header><span class="chapter-num">${c.numeral}</span><h3>${esc(c.label)}</h3><small>${list.length} page${list.length === 1 ? '' : 's'}</small></header>
        <p>${esc(c.blurb)}</p>
        <ul>${list.map((p) => `<li><a href="${p.file}"><b>${esc(p.nav)}</b><span>${esc(summary(p))}</span></a></li>`).join('')}</ul>
      </article>`;
    }).join('')}
  </div>
</section>`;

const pageHead = (p: Page, chapter: Chapter, titles: { id: string; html: string }[]): string => `<header class="page-head">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Field Manual</a>${chapter.label === p.nav ? '' : `<span aria-hidden="true">/</span><span>${esc(chapter.label)}</span>`}<span aria-hidden="true">/</span><span aria-current="page">${esc(p.nav)}</span></nav>
  <p class="eyebrow">Chapter ${chapter.numeral} · ${esc(chapter.label)}</p>
  <h1>${esc(p.title)}</h1>
  <p class="lead">${p.lead}</p>
  <div class="page-meta"><span class="chip">${titles.length} section${titles.length === 1 ? '' : 's'}</span><span class="chip">Live game data</span><span class="chip">${esc(chapter.label)}</span></div>
  ${titles.length ? `<p class="covers"><span>Covers</span>${titles.slice(0, 6).map((t) => t.html).join(' · ')}</p>` : ''}
</header>`;

const tocBlock = (titles: { id: string; html: string }[]): string => titles.length ? `<nav class="toc" aria-label="On this page">
  <p class="eyebrow">On this page</p>
  <ol>${titles.map((t, i) => `<li><button type="button" class="${i === 0 ? 'on' : ''}" data-scroll="${t.id}" data-toc="${t.id}">${t.html}</button></li>`).join('')}</ol>
</nav>` : '';

const pageFoot = (p: Page): string => {
  const { list, prev, next } = chapterPageOf(p);
  const related = list.filter((q) => q.file !== p.file).slice(0, 3);
  if (!related.length && !prev && !next) return '';
  return `<footer class="page-foot">
    ${related.length ? `<section class="related" aria-labelledby="related-title"><p class="eyebrow" id="related-title">Keep reading</p><div class="related-grid">${related.map((q) => `<a href="${q.file}"><b>${esc(q.nav)}</b><small>${esc(summary(q))}</small></a>`).join('')}</div></section>` : ''}
    ${prev || next ? `<nav class="page-turn" aria-label="Chapter navigation">${prev ? `<a class="prev" href="${prev.file}"><small>Previous</small><b>${esc(prev.nav)}</b></a>` : '<span></span>'}${next ? `<a class="next" href="${next.file}"><small>Next</small><b>${esc(next.nav)}</b></a>` : ''}</nav>` : ''}
  </footer>`;
};

/** Everything inside <body>: the theme, the chapter shell and the page. */
export const pageBody = (p: Page, active: string, tokens: string): string => {
  const { html, titles } = sectionParts(p.body.join('\n'));
  const chapter = chapterOf(p.group);
  const home = p.file === 'index.html';
  const article = `<article class="page-content">${html}</article>`;
  const main = home
    ? `${homeHero(p)}${startStrip()}${article}${chaptersGrid()}`
    : `${pageHead(p, chapter, titles)}${tocBlock(titles)}${article}${pageFoot(p)}`;
  return `<style>${tokens}
${LAYOUT}
${SHELL}</style>
<button class="skip" type="button" data-skip>Skip to content</button>
${masthead()}
<div class="wiki-shell">
${chapterNav(active)}
<main id="wiki-main" class="wiki-main" tabindex="-1">${main}
<footer class="wiki-foot"><span>ModWorld Field Manual · official player reference</span><span>${CHAPTERS.length} chapters · ${PAGES.length} pages · figures read live from the game</span><a href="index.html">Contents</a></footer>
</main></div>`;
};

/** A whole document, for the static build. */
export const renderDoc = (p: Page, active: string, tokens: string): string =>
  `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.title)} · ModWorld Field Manual</title></head>
<body>` + pageBody(p, active, tokens) + `
<script>${WIKI_RUNTIME}</script></body></html>`;

export { PAGES };
export type { Page };
