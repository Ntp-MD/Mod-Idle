import { sm } from '../engine/client';
import { mobSkillById } from './mobSkills';
import type { FxEvent, GameState, Mob } from './types';

export const COMBAT_HISTORY_LIMIT = 120;
export type EnemySnapshot = Readonly<Pick<Mob, 'id' | 'species' | 'speciesId' | 'formName' | 'variant' | 'kind' | 'level' | 'zone' | 'damage' | 'line' | 'hpMax' | 'armour' | 'res'> & {
  innate: readonly string[];
  skillIds: readonly string[];
  immune: readonly string[];
  weak: Readonly<{ element: string; taken_pct: number }> | null;
}>;

const snapshots = new WeakMap<Mob, EnemySnapshot>();

/** Spawn identity and its resolved kit are stable; retain one detached snapshot per body. */
export function snapshotEnemy(mob: Mob): EnemySnapshot {
  const known = snapshots.get(mob);
  if (known) return known;
  const snapshot: EnemySnapshot = Object.freeze({
    id: mob.id, species: mob.species, speciesId: mob.speciesId, formName: mob.formName,
    variant: mob.variant, kind: mob.kind, level: mob.level, zone: mob.zone, damage: mob.damage,
    line: mob.line, hpMax: mob.hpMax, armour: mob.armour, res: mob.res,
    innate: Object.freeze([...(mob.innate || [])]), skillIds: Object.freeze([...(mob.skillIds || [])]),
    immune: Object.freeze([...(mob.immune || [])]), weak: mob.weak ? Object.freeze({ ...mob.weak }) : null,
  });
  snapshots.set(mob, snapshot);
  return snapshot;
}

const KINDS = ['hit', 'cast', 'taken', 'block', 'proc', 'buff', 'heal', 'kill', 'push'] as const;
export type CombatHistoryKind = typeof KINDS[number];
export interface CombatHistoryEntry {
  id: number;
  sec: number;
  kind: CombatHistoryKind;
  text: string;
  side?: FxEvent['side'];
  via?: FxEvent['via'];
  value?: number;
  hpDamage?: number;
  esDamage?: number;
  crit?: boolean;
  skillId?: string;
  skillName?: string;
  enemy?: EnemySnapshot;
  away: boolean;
}

function append(state: GameState, entry: CombatHistoryEntry): void {
  const entries = state.combatHistory ||= [];
  entries.unshift(entry);
  if (entries.length > COMBAT_HISTORY_LIMIT) entries.length = COMBAT_HISTORY_LIMIT;
}

/** Record facts before short-lived presentation effects expire. No RNG or combat state is consumed. */
export function recordCombatEvent(state: GameState, event: FxEvent, source?: Mob): void {
  if (!(KINDS as readonly string[]).includes(event.kind)) return;
  const enemyId = event.byId || event.mobId;
  const enemy = source || (enemyId ? state.group.find(mob => mob.id === enemyId) : undefined);
  const retained = !enemy && enemyId ? state.combatHistory?.find(entry => entry.enemy?.id === enemyId)?.enemy : undefined;
  const enemySkill = (event.side === 'field' && event.kind === 'cast') || !!event.byId;
  const skill = event.skillId ? enemySkill ? mobSkillById(event.skillId) : sm.byId[event.skillId] : undefined;
  append(state, {
    id: event.id, sec: event.sec, kind: event.kind as CombatHistoryKind, text: event.text,
    side: event.side, via: event.via, value: event.value, hpDamage: event.hpDamage, esDamage: event.esDamage,
    crit: event.crit, skillId: event.skillId, skillName: skill?.name,
    enemy: enemy ? snapshotEnemy(enemy) : retained, away: state.online === false,
  });
}

export function recordCombatPush(state: GameState, campSec: number): void {
  state.fxSeq = (state.fxSeq || 0) + 1;
  append(state, { id: state.fxSeq, sec: state.clockSec, kind: 'push',
    text: `HP reached 0. Recovering at Camp for ${campSec} seconds.`, away: state.online === false });
}

/** A concise, inspectable summary of the records actually retained; the window is stated. */
export interface CombatSummary {
  fromSec: number;
  toSec: number;
  windowSec: number;
  outgoing: number;
  incoming: number;
  kills: number;
  crits: number;
  skills: { id: string; name: string; damage: number }[];
}

export function summarizeCombat(entries: readonly CombatHistoryEntry[]): CombatSummary {
  let outgoing = 0, incoming = 0, kills = 0, crits = 0;
  let from = Infinity, to = -Infinity;
  const skills = new Map<string, { name: string; damage: number }>();
  for (const entry of entries) {
    from = Math.min(from, entry.sec);
    to = Math.max(to, entry.sec);
    if (entry.kind === 'hit' && entry.side === 'field') {
      const damage = entry.value || 0;
      outgoing += damage;
      if (entry.crit) crits++;
      if (entry.skillId) {
        const row = skills.get(entry.skillId) ?? { name: entry.skillName || entry.skillId, damage: 0 };
        row.damage += damage;
        skills.set(entry.skillId, row);
      }
    }
    if (entry.kind === 'taken') {
      incoming += entry.hpDamage != null && entry.esDamage != null
        ? entry.hpDamage + entry.esDamage : (entry.value || 0);
    }
    if (entry.kind === 'kill') kills++;
  }
  const hasWindow = Number.isFinite(from) && Number.isFinite(to);
  return {
    fromSec: hasWindow ? from : 0, toSec: hasWindow ? to : 0,
    windowSec: hasWindow ? Math.max(0, to - from) : 0,
    outgoing, incoming, kills, crits,
    skills: [...skills].map(([id, row]) => ({ id, ...row }))
      .sort((a, b) => b.damage - a.damage).slice(0, 4),
  };
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const word = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 300;
const words = (value: unknown, max: number): string[] => Array.isArray(value) ? value.filter(word).slice(0, max) : [];

function normalizeEnemy(raw: unknown): EnemySnapshot | undefined {
  if (!raw || typeof raw !== 'object') return;
  const value = raw as Record<string, unknown>;
  if (!word(value.id) || !word(value.species) || !word(value.kind) || !word(value.line)
    || !Number.isSafeInteger(value.level) || !finite(value.level) || value.level < 1
    || !Number.isSafeInteger(value.zone) || !finite(value.zone) || value.zone < 1
    || !finite(value.hpMax) || !finite(value.armour) || !finite(value.res)
    || !['physical', 'magic', 'mixed'].includes(String(value.damage))) return;
  const weak = value.weak as Record<string, unknown> | null;
  return Object.freeze({
    id: value.id, species: value.species, kind: value.kind, line: value.line,
    speciesId: word(value.speciesId) ? value.speciesId : undefined,
    formName: word(value.formName) ? value.formName : undefined, variant: word(value.variant) ? value.variant : undefined,
    level: value.level as number, zone: value.zone as number, damage: value.damage as Mob['damage'],
    hpMax: value.hpMax, armour: value.armour, res: value.res,
    innate: Object.freeze(words(value.innate, 8)), skillIds: Object.freeze(words(value.skillIds, 4)),
    immune: Object.freeze(words(value.immune, 16)),
    weak: weak && word(weak.element) && finite(weak.taken_pct) ? Object.freeze({ element: weak.element, taken_pct: weak.taken_pct }) : null,
  });
}

/** Optional save field: old saves start empty; malformed optional records never affect the character. */
export function normalizeCombatHistory(raw: unknown): CombatHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const entries: CombatHistoryEntry[] = [];
  for (const candidate of raw.slice(0, COMBAT_HISTORY_LIMIT)) {
    if (!candidate || typeof candidate !== 'object') continue;
    const value = candidate as Record<string, unknown>;
    if (!Number.isSafeInteger(value.id) || !finite(value.id) || seen.has(value.id)
      || !Number.isSafeInteger(value.sec) || !finite(value.sec) || !word(value.text)
      || !(KINDS as readonly unknown[]).includes(value.kind)) continue;
    seen.add(value.id);
    entries.push({
      id: value.id, sec: value.sec, kind: value.kind as CombatHistoryKind, text: value.text,
      side: value.side === 'self' || value.side === 'field' ? value.side : undefined,
      via: value.via === 'cast' || value.via === 'swing' || value.via === 'dot' ? value.via : undefined,
      value: finite(value.value) ? value.value : undefined,
      hpDamage: finite(value.hpDamage) ? value.hpDamage : undefined, esDamage: finite(value.esDamage) ? value.esDamage : undefined,
      crit: value.crit === true, skillId: word(value.skillId) ? value.skillId : undefined,
      skillName: word(value.skillName) ? value.skillName : undefined,
      enemy: normalizeEnemy(value.enemy), away: value.away === true,
    });
  }
  return entries.sort((a, b) => b.id - a.id);
}
