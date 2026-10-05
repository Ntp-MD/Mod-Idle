// Re-export of the shared engine's helpers so the client imports one thing.
// Nothing is implemented here — the RNG and the roll primitives live in engine/loot.ts,
// which tools/loot.ts runs too.
export { mulberry32, pick, intBetween, pickBand, weightedPick } from '../../../engine/loot.ts';
