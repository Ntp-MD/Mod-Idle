/**
 * The Core attribute keys, shared. This is the engine's own declaration of the seven stats every
 * sheet, save and stat line names — in the published order — so a stat a grant or a piece carries is
 * checked against the same keys the client and the cages use, not a second copy of them.
 */

export const STAT_KEYS = ['str', 'int', 'vit', 'agi', 'dex', 'wis', 'lck'] as const;

export type StatKey = (typeof STAT_KEYS)[number];
