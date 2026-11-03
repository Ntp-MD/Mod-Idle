/**
 * A boss-class kind: the clock Boss or a wild Species Unique. Both pay the boss lines.
 *
 * Lives beside the state types so any sim stage (or the HUD) can ask without importing the tick.
 */
export const isBossKind = (k: string) => k.startsWith('Boss') || k.startsWith('Unique');
