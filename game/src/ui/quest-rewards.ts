import { sm, TOWN } from '../engine/client';
import { stoneName } from '../sim/craft';
import type { QuestBonus } from '../sim/quest-rewards';

export function questBonusText(bonus: Pick<QuestBonus, 'gold' | 'stones' | 'skill'>): string {
  const parts = bonus.stones.map((stone) => `${stone.count} ${stoneName(stone.key)}`);
  if (bonus.gold) parts.unshift(`${bonus.gold.toFixed(TOWN.trade.currency_decimals)} gold`);
  if (bonus.skill) parts.push(sm.byId[bonus.skill]?.name || bonus.skill);
  return parts.join(' + ');
}
