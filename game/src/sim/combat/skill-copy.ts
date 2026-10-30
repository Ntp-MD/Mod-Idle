import { sm } from '../../engine/client.ts';
import type { MobSkillRow, SkillRow } from '../../../../engine/types.ts';

export type SkillWindow = {
  type: string;
  target: string;
  range: string;
  area?: string;
  element: string;
  sp?: string;
  delay?: string;
  duration?: string;
  hits?: string;
  weapon?: string;
  reservation?: string;
  level: number;
  compact: string;
};

export type MobSkillWindow = {
  type: string;
  target: string;
  element: string;
  delay?: string;
  status?: string;
  description: string;
};

export type SkillWindowEntry = { label: string; value: string };

const TYPE_LABEL: Record<string, string> = {
  attack: 'Offensive',
  curse: 'Debuffer',
  heal: 'Support',
  buff: 'Support',
  aura: 'Support (Passive)',
};

const TARGET_SHORT: Record<string, string> = {
  single: 'Single',
  area: 'Area',
  around: 'Around me',
  self: 'Self',
  reserved: 'Reserved',
};

const title = (value?: string | null): string => (value ? value[0].toUpperCase() + value.slice(1) : '');

/**
 * The `Hits` line lives in the shared model (`sm.hitLineOf`, engine/skills.ts) so the
 * player window and the roster S11 gate derive it from the same function.
 */
const hitsLine = (skill: SkillRow): string | undefined => sm.hitLineOf(skill);

export function describeSkill(skill: SkillRow, opts: { level?: number; reservePct?: number } = {}): SkillWindow {
  const type = skill.type || '';
  const radius = skill.area?.radius_m ?? 0;
  const selfTarget = type === 'aura' || type === 'buff' || type === 'heal';
  const targetKind = type === 'aura'
    ? 'reserved'
    : radius > 0
      ? skill.area?.origin === 'caster' ? 'around' : 'area'
      : type === 'attack' || type === 'curse' ? 'single' : 'self';
  const target = targetKind === 'reserved'
    ? 'Self (Reserved)'
    : targetKind === 'around'
      ? 'All Enemies Around Me'
      : targetKind === 'area'
        ? 'Enemies in Area'
        : targetKind === 'single' ? 'Single Enemy' : 'Self';
  const range = selfTarget || !skill.cast?.range_m
    ? '—'
    : skill.cast.delivery === 'melee' ? 'Melee' : `${Math.round(skill.cast.range_m)}`;
  const area = radius > 0 ? `${Math.round(2 * radius)}x${Math.round(2 * radius)}` : undefined;
  const element = title(skill.element) || 'Physical';
  // The number already reads as an amount; `%` marks a share, so the word "flat" adds nothing.
  const sp = skill.mana?.replace(/\s+flat\b/gi, '').trim() || undefined;
  const delay = skill.cd == null ? undefined : skill.cd > 0 ? `${skill.cd} sec` : 'None (Filler)';
  const duration = skill.duration || undefined;
  const hits = hitsLine(skill);
  const weapon = skill.weapon ? (skill.weapon === 'bow' ? 'Bow or Crossbow' : skill.weapon) : undefined;
  const reservation = type === 'aura' && skill.reserve
    ? `${opts.reservePct ?? sm.reservePct(skill.reserve)}% Mana`
    : undefined;
  const compact = [
    TARGET_SHORT[targetKind],
    area,
    targetKind === 'self' || targetKind === 'reserved' ? undefined : range,
    delay,
    duration,
    hits,
  ].filter(Boolean).join(' · ');

  return { type: TYPE_LABEL[type] || 'Support', target, range, area, element, sp, delay, duration, hits, weapon, reservation, level: opts.level ?? 1, compact };
}

export function skillWindowEntries(window: SkillWindow): SkillWindowEntry[] {
  return [
    ['Type', window.type],
    ['Target', window.target],
    ['Range', window.range],
    ['Area', window.area],
    ['Element', window.element],
    ['SP Cost', window.sp],
    ['Delay', window.delay],
    ['Duration', window.duration],
    ['Hits', window.hits],
    ['Weapon', window.weapon],
    ['Reservation', window.reservation],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([label, value]) => ({ label, value }));
}

export function describeMobSkill(skill: MobSkillRow): MobSkillWindow {
  const aura = skill.mode === 'aura';
  const target = aura
    ? skill.scope === 'line' ? 'Engaged allies in line' : 'Engaged allies'
    : skill.cast && skill.cast.delivery !== 'melee' ? 'Player (kept at range)' : 'Player';
  const description = aura
    ? Object.entries(skill.effects || {})
      .filter(([, value]) => Number(value) > 0)
      .map(([stat, value]) => `${stat === 'armour_pct' ? 'Armour' : 'Resistance'} +${Number(value)}%`)
      .join(' · ') || 'Passive defensive aura.'
    : 'Replaces a basic swing.';

  return {
    type: `Monster (${skill.mode})`,
    target,
    element: title(skill.element) || 'Physical',
    delay: skill.cd ? `${skill.cd} sec` : undefined,
    status: skill.status ? `Inflicts ${title(skill.status)}` : undefined,
    description,
  };
}
