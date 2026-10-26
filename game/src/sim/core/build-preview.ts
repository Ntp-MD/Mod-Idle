import { loot, sm, STAT_KEYS, tree } from '../../engine/client';
import { characterSheet } from './game';
import { equipFromBag } from '../gear/gear';
import type { Character } from './player';
import { usableHp, usableMana } from '../combat/skills';
import { allocateTreePath, treePath } from './tree';
import type { GameState, Item } from './types';

export interface BuildValueChange {
  key: string;
  label: string;
  current: number;
  after: number;
  unit: '' | '%' | '/sec' | '×';
  decimals: number;
}

export interface BuildPreview {
  ok: boolean;
  why?: string;
  changes: BuildValueChange[];
  notes: { key: string; text: string }[];
  replaced?: Item | null;
}

// Copy only the branches the canonical equip/allocation actions write. Character-sheet calculation
// reads the remaining state; previews never tick the simulation, roll RNG or write a save.
function previewState(state: GameState): GameState {
  return {
    ...state,
    player: { ...state.player, treeRanks: { ...state.player.treeRanks } },
    gear: [...state.gear],
    bag: [...state.bag],
    filter: { ...state.filter },
    skills: { ...state.skills, auras: { ...state.skills.auras }, auraPool: { ...state.skills.auraPool } },
  };
}

const labels: Record<string, string> = {
  str: 'Strength', agi: 'Agility', dex: 'Dexterity', int: 'Intelligence',
  wis: 'Wisdom', vit: 'Vitality', lck: 'Luck',
};

/** The same finished values as the live sheet, with per-Element caps and usable pools applied. */
function sheetValues(state: GameState, sheet: Character) {
  const values: Omit<BuildValueChange, 'current' | 'after'>[] = [];
  const numbers: number[] = [];
  const add = (key: string, label: string, value: number, unit: BuildValueChange['unit'] = '', decimals = 1) => {
    values.push({ key, label, unit, decimals }); numbers.push(value);
  };
  add('maxHp', 'Max HP', sheet.maxHp);
  add('usableHp', 'Usable HP', usableHp(sheet, state.skills));
  add('es', 'Energy Shield', sheet.es);
  add('maxMana', 'Max Mana', sheet.maxMana);
  add('usableMana', 'Usable Mana', usableMana(sheet, state.skills));
  add('phys', 'Physical power', sheet.phys);
  add('magic', 'Magic power', sheet.magic);
  add('elem', 'Elemental power', sheet.elem);
  for (const el of loot.ELEMENTS) add(`power.${el}`, `${el} power`, sheet.elemByElement[el] || 0);
  add('attackDamage', 'Attack damage', sheet.attackDamage, '%');
  add('spellDamage', 'Spell damage', sheet.spellDamage, '%');
  add('armour', 'Armour', sheet.armour);
  add('evasion', 'Evasion rating', sheet.evasion);
  add('evasionChance', 'Reference evasion chance', sheet.evasionChance, '%');
  add('resCap', 'Resistance cap', sheet.resCap, '%');
  for (const el of loot.ELEMENTS) {
    add(`resistance.${el}`, `${el} resistance`, Math.min(sheet.resCap, sheet.resistance + (sheet.resByElement[el] || 0)), '%');
    add(`conversion.${el}`, `${el} conversion`, sheet.conversion[el] || 0, '%');
  }
  add('hpRegen', 'HP regeneration', sheet.hpRegen, '/sec');
  add('esRegen', 'ES recharge', sheet.esRegen, '/sec');
  add('manaRegen', 'Mana regeneration', sheet.manaRegen, '/sec');
  add('hitsPerSec', 'Attack rate', sheet.hitsPerSec, '/sec', 2);
  add('accuracy', 'Accuracy rating', sheet.accuracy);
  add('critChance', 'Crit chance', sheet.critChance, '%');
  add('critDmg', 'Crit damage', sheet.critDmg, '%');
  add('armourPen', 'Armour penetration', sheet.armourPen, '%');
  add('bleedChance', 'Bleed chance', sheet.bleedChance, '%');
  add('stunChance', 'Stun chance', sheet.stunChance, '%');
  add('alignment', 'Element alignment', sheet.alignment, '%');
  add('perfectDodge', 'Perfect dodge', sheet.perfectDodge, '%');
  add('block', 'Block chance', sheet.block, '%');
  add('stunRecovery', 'Stun recovery', sheet.stunRecovery, '%');
  add('statusResist', 'Status resistance', sheet.statusResist, '%');
  add('damageTaken', 'Incoming damage multiplier', sheet.damageTaken, '×', 2);
  add('leechPct', 'Leech', sheet.leechPct, '%');
  add('cdr', 'Cooldown reduction', sheet.cdr, '%');
  add('globalSpeed', 'Global speed', sheet.globalSpeed, '×', 2);
  add('weightUsed', 'Carried weight', sheet.weightUsed);
  add('weightCap', 'Weight capacity', sheet.weightCap);
  add('encumbrance', 'Weight speed penalty', sheet.encumbrance * 100, '%');
  add('weaponMastery', 'Held weapon Mastery', sheet.weaponMastery, '', 0);
  for (const key of STAT_KEYS) add(`core.${key}`, labels[key], sheet.core[key]);
  return values.map((value, index) => ({ ...value, value: numbers[index] }));
}

function compareBuilds(current: GameState, after: GameState): BuildPreview {
  const currentSheet = characterSheet(current), nextSheet = characterSheet(after);
  const beforeValues = sheetValues(current, currentSheet), afterValues = sheetValues(after, nextSheet);
  const changes = beforeValues.flatMap((before, index) => {
    const next = afterValues[index];
    if (before.key === 'usableHp' && before.value === currentSheet.maxHp && next.value === nextSheet.maxHp) return [];
    if (before.key === 'usableMana' && before.value === currentSheet.maxMana && next.value === nextSheet.maxMana) return [];
    // Compare at displayed precision so a preview never prints an unchanged value as a change.
    if (before.value.toFixed(before.decimals) === next.value.toFixed(before.decimals)) return [];
    return [{ key: before.key, label: before.label, unit: before.unit, decimals: before.decimals, current: before.value, after: next.value }];
  });
  const notes: BuildPreview['notes'] = [];
  if (currentSheet.weaponName !== nextSheet.weaponName) {
    notes.push({ key: 'weapon', text: `Held weapon: ${currentSheet.weaponName} → ${nextSheet.weaponName}.` });
  }
  for (const id of current.skills.list) {
    const skill = id ? sm.byId[id] : null;
    if (!skill) continue;
    const fitsBefore = sm.weaponFits(skill, currentSheet.weaponName), fitsAfter = sm.weaponFits(skill, nextSheet.weaponName);
    if (fitsBefore !== fitsAfter) notes.push({ key: `skill.${id}`, text: `${skill.name}: ${fitsAfter ? 'weapon requirement met' : 'cannot cast with the new weapon'}.` });
  }
  for (const [id, on] of Object.entries(current.skills.auras)) {
    if (on && !after.skills.auras[id]) notes.push({ key: `aura.${id}`, text: `${sm.byId[id]?.name || id} will switch off to keep reservations valid.` });
  }
  return { ok: true, changes, notes };
}

export function previewEquip(state: GameState, item: Item, bagIndex = state.bag.indexOf(item)): BuildPreview {
  if (bagIndex < 0 || state.bag[bagIndex] !== item) return { ok: false, why: 'This piece is not in the carried bag.', changes: [], notes: [] };
  const after = previewState(state);
  const result = equipFromBag(after, bagIndex, true);
  if (!result.ok) return { ok: false, why: result.why, changes: [], notes: [] };
  const changedCell = after.gear.findIndex((piece, index) => piece !== state.gear[index]);
  return { ...compareBuilds(state, after), replaced: state.gear[changedCell] || null };
}

export function previewTreeRoute(state: GameState, destination: string): BuildPreview {
  const route = treePath(state, destination);
  if (!route.nodes.length) return { ok: false, why: 'No unallocated route to preview.', changes: [], notes: [] };
  const after = previewState(state);
  // Banked points affect when a route can be bought, not its hypothetical result. Fund only this
  // private copy; the live planner and allocation buttons continue to validate the real wallets.
  after.player.treePoints = Math.max(after.player.treePoints, route.cost.tree);
  after.player.attainmentPoints = Math.max(after.player.attainmentPoints || 0, route.cost.attainment);
  const result = allocateTreePath(after, destination);
  if (!result.ok) return { ok: false, why: result.why, changes: [], notes: [] };
  const preview = compareBuilds(state, after);
  for (const id of route.nodes) {
    const node = tree.byId[id];
    if (node.kind === 'keystone' && node.description) preview.notes.push({ key: id, text: `${node.name || id}: ${node.description}` });
    if (node.weapon) preview.notes.push({ key: `weapon.${id}`, text: `${node.name || id}: bonuses require ${node.weapon} equipped.` });
  }
  return preview;
}

export function formatBuildValue(change: BuildValueChange, value: number): string {
  const number = Number(value.toFixed(change.decimals)).toLocaleString('en-US', { maximumFractionDigits: change.decimals });
  return change.unit === '×' ? `×${number}` : `${number}${change.unit}`;
}
