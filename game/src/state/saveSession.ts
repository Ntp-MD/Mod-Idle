import { writeSave, type SlotName } from './save';

/**
 * P3 fresh-session gate: every boot, reload and reset begins with `newGame` plus a fresh account.
 * Gameplay storage is neither read nor written while this phase is on; presentation preferences
 * and read-only showcase samples keep their own rules. Not a player preference.
 */
export const FRESH_SESSION_PHASE = true;
import type { GameState } from '@sim/core/types';

/** A save belongs to the character that requested it, even if a later character is now on screen. */
export class CharacterSaveSession {
  slot: SlotName | null = null;
  private epoch = 0;
  private pending: Promise<void> = Promise.resolve();

  constructor(private readonly write = writeSave) {}

  checkpoint(): number { return this.epoch; }
  detach(): number { this.slot = null; return ++this.epoch; }
  isCurrent(epoch: number): boolean { return epoch === this.epoch; }
  attach(slot: SlotName, epoch: number): boolean {
    if (!this.isCurrent(epoch)) return false;
    this.slot = slot;
    return true;
  }
  run<T>(action: () => Promise<T>): Promise<T> {
    const result = this.pending.then(action);
    this.pending = result.then(() => {}, () => {});
    return result;
  }
  flush(): Promise<void> { return this.pending; }

  async save(slot: SlotName, state: GameState): Promise<boolean> {
    const epoch = this.epoch;
    await this.run(() => this.write(slot, state));
    return this.attach(slot, epoch);
  }
}
