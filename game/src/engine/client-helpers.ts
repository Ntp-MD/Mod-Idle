// Re-export of the shared engine's helpers so the client imports one thing.
// Nothing is implemented here — the RNG and the roll primitives live in engine/loot.js,
// which tools/loot.js runs too.
export { mulberry32, pick, intBetween, pickBand, weightedPick } from '../../../engine/loot.js';
