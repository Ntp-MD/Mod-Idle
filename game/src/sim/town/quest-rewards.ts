import { E, MODS, TOWN, sm } from '../../engine/client';
import { craft } from '../gear/craft';
import { addTo } from '../gear/slots';
import { grantNamedSkill, usefulSkillDuplicate } from '../combat/skills';
import type { GameState, TaskSlot } from '../core/types';
import type { DeliveryReward, StoneReward } from './delivery-types';

/** Frozen ordinary rewards are alternatives; passive-tree currencies belong to the objective. */
export interface QuestBonus {
  id: string; label: string; gold: number; stones: StoneReward[];
  skill: string | null; fallback: StoneReward | null;
}

export function deliveryBonuses(reward: DeliveryReward): QuestBonus[] {
  return [{ id: 'supplies', label: reward.alternative ? 'Crafting supplies' : 'Completion bonus',
    gold: reward.gold, stones: [reward.stone], skill: reward.skill, fallback: reward.fallback },
    ...(reward.alternative ? [reward.alternative] : [])];
}

export function taskBonuses(task: TaskSlot): QuestBonus[] {
  return [{ id: task.stone, label: 'Crafting stones', gold: 0,
    stones: [{ key: task.stone, count: task.count }], skill: null, fallback: null },
    ...(task.alternative ? [task.alternative] : task.alt ? [{ id: task.alt.stone, label: 'Crafting stones',
      gold: 0, stones: [{ key: task.alt.stone, count: task.alt.count }], skill: null, fallback: null }] : [])];
}

export function resolveQuestBonus(state: GameState, bonus: QuestBonus) {
  const skill = bonus.skill && usefulSkillDuplicate(state.skills, bonus.skill) ? bonus.skill : null;
  const fallback = Boolean(bonus.skill && !skill);
  return { gold: bonus.gold, stones: [...bonus.stones, ...(fallback && bonus.fallback ? [bonus.fallback] : [])],
    skill, fallback, choice: bonus.id };
}

export function payQuestBonus(state: GameState, bonus: ReturnType<typeof resolveQuestBonus>) {
  for (const stone of bonus.stones) addTo(state, state.counters.stones, stone.key, 'stone', stone.count);
  if (bonus.skill) grantNamedSkill(state.skills, bonus.skill);
  state.counters.gold += bonus.gold;
}

export function milestoneAvailable(state: GameState, key: string): boolean {
  return !state.town.questMilestones?.[key]
    && !state.town.tasks.some((task) => task?.milestone === key && !task.claimed)
    && !Object.values(state.town.contracts).flat().some((contract) => contract.status === 'open' && contract.reward.milestone === key);
}

export function recordQuestMilestone(state: GameState, key?: string): void {
  if (key) (state.town.questMilestones ||= {})[key] = true;
}

export function validQuestBonus(bonus: QuestBonus): boolean {
  const stone = (row: StoneReward) => row && Number.isSafeInteger(row.count) && row.count > 0
    && typeof row.key === 'string' && row.key !== 'imprint'
    && (Object.hasOwn(craft.STONE_NAME, row.key) || row.key.startsWith('imprint_') && MODS.mods.some((mod) => mod.id === row.key.slice(8)));
  return !!bonus && typeof bonus.id === 'string' && !!bonus.id && typeof bonus.label === 'string' && !!bonus.label
    && Number.isFinite(bonus.gold) && bonus.gold >= 0 && Array.isArray(bonus.stones) && bonus.stones.every(stone)
    && (bonus.skill === null || Object.hasOwn(sm.byId, bonus.skill))
    && (bonus.fallback === null || stone(bonus.fallback)) && (!bonus.skill || !!bonus.fallback)
    && (bonus.gold > 0 || bonus.stones.length > 0 || !!bonus.skill);
}

export function normalizeQuestRewards(state: GameState): void {
  if (state.town.questMilestones === undefined) state.town.questMilestones = {};
  const validKey = (key: string) => TOWN.settlements.some((town) => key === `delivery:${town.id}`)
    || E.mob.zones.some((zone) => key === `expedition:${zone.id}`);
  if (!state.town.questMilestones || typeof state.town.questMilestones !== 'object' || Array.isArray(state.town.questMilestones)
    || Object.entries(state.town.questMilestones).some(([key, paid]) => !validKey(key) || paid !== true))
    throw new Error('quest save: invalid milestone record');
  const promised = new Set<string>();
  const promise = (key: string | undefined, expected: string, points: number | undefined) => {
    if (key === undefined) return;
    if (key !== expected || !validKey(key) || !Number.isSafeInteger(points) || !(points! > 0) || state.town.questMilestones[key] || promised.has(key))
      throw new Error('quest save: invalid or repeated milestone promise');
    promised.add(key);
  };
  for (const task of state.town.tasks) if (task) {
    if (task.alternative && (!validQuestBonus(task.alternative) || task.alternative.id === task.stone))
      throw new Error('quest save: invalid hunt reward choice');
    if (!task.claimed) promise(task.milestone, task.kind === 'expedition' ? `expedition:${task.zone}` : '', task.treePoints);
  }
  for (const contract of Object.values(state.town.contracts).flat()) {
    if (contract.status === 'open') promise(contract.reward.milestone, `delivery:${contract.town}`, contract.reward.treePoints);
  }
}
