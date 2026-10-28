/** Slot subtitle: a skill on cooldown names its live clock; every other state keeps its label. */
export function skillSlotState(label: string, remainingSec: number, ready: boolean): string {
  return !ready && remainingSec > 0 ? `${label} · ${remainingSec.toFixed(1)}s` : label;
}
