import type { Acquisition } from '../../../engine/delivery';
import type { QuestBonus } from './quest-rewards';

export interface StoneReward { key: string; count: number }
export interface DeliveryReward {
  gold: number; stone: StoneReward; skill: string | null; fallback: StoneReward;
  /** The attainment point the contract pays on completion (D2) — frozen at offer time. */
  attainment: number;
  /** Quest-granted passive-tree points frozen at offer time. */
  treePoints: number;
  quoteGold: number; premium: number;
  alternative?: QuestBonus;
  milestone?: string;
}
export interface DeliveryContract {
  id: string; serial: number; town: string; good: string; target: number; delivered: number;
  acquisition: Acquisition; derivationVersion: number; reward: DeliveryReward;
  triggeredAtClockSec: number; dueAtDeliverySec: number; status: 'open' | 'completed' | 'expired';
  terminalAt: number | null; baseGold: number; lastQuantity: number; lastGold: number;
  paidBonus: { gold: number; stones: StoneReward[]; skill: string | null; fallback: boolean; treePoints?: number; attainment?: number; choice?: string } | null;
  recapAcknowledged: boolean; announced: boolean;
}
export interface DeliverySummary {
  unread: number; completed: number; expired: number;
  goods: Record<string, { quantity: number; gold: number }>;
  paidGold: number; paidStones: Record<string, number>; paidSkills: Record<string, number>;
  /** Quest-granted passive-tree points actually paid, not the ones promised. */
  paidTreePoints?: number;
  paidAttainment?: number;
  forfeitedTreePoints?: number;
  forfeitedAttainment?: number;
  /** Mutually exclusive offers are kept apart from forfeited fixed payouts. */
  forfeitedChoices?: { count: number; gold: number; stones: Record<string, number>; skills: Record<string, number>; fallback: Record<string, number> };
  forfeitedGold: number; forfeitedStones: Record<string, number>;
  forfeitedSkills: Record<string, number>; forfeitedFallback: Record<string, number>;
}
export const newDeliverySummary = (): DeliverySummary => ({ unread: 0, completed: 0, expired: 0, goods: {},
  paidGold: 0, paidStones: {}, paidSkills: {}, forfeitedGold: 0, forfeitedStones: {}, forfeitedSkills: {}, forfeitedFallback: {} });
