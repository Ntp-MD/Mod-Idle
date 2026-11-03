import type { GameState } from '../types';
import type { Character } from '../player';
import { bundleOf } from '../../../../../engine/keystones.ts';
import type { KeystoneBundle } from '../../../../../engine/keystones.ts';
import { usableHp } from '../../combat/skills';

/**
 * Keystone upkeep between ticks and the pool ceiling.
 *
 * 04 Rage's idle reset and per-second HP drain, 11 Fortify's idle reset, 16 Bark's charge
 * accumulation, 43 Armourbreaker's restore, 22 Demolition's dropped-target cleanup and 57 Shield
 * Gate's rearm all read the absolute µs clock, never a mutable tick count.
 */
export function applyKeystonePrep(
  s: GameState,
  c: Character,
  debt52: KeystoneBundle | undefined,
  units: number,
  tickStartUs: number,
): void {
  const rkH = s.keystoneRuntime;
  const redlineH = bundleOf(c.keystones, 'redline');
  if (redlineH) {
    const idleUs = Number(redlineH.params.idleResetSec) * units;
    if (rkH.lastHitAtUs !== null && tickStartUs - rkH.lastHitAtUs >= idleUs) {
      rkH.stacks.redline = 0;
      rkH.lastHitAtUs = null;
    }
    const stacks = rkH.stacks.redline || 0;
    if (stacks > 0) {
      const drain = c.maxHp * (Number(redlineH.params.hpCostPctPerStackPerSec) / 100) * stacks;
      if (s.player.hp - drain >= 1) s.player.hp -= drain;
      else { s.player.hp = 1; rkH.stacks.redline = 0; }
    }
  }
  const fortH = bundleOf(c.keystones, 'fortress-under-siege');
  if (fortH && rkH.lastLossAtUs !== null
    && tickStartUs - rkH.lastLossAtUs >= Number(fortH.params.resetSec) * units) rkH.stacks.fortress = 0;
  // 43 Armourbreaker restores the initial Armour after 4s without a Physical Hit
  const breakerH = bundleOf(c.keystones, 'armourbreaker');
  if (breakerH) for (const m of s.group) {
    const init = rkH.targetCounters[`ab:init:${m.id}`];
    const last = rkH.icdsUs[`ab:last:${m.id}`];
    if (init !== undefined && last !== undefined
      && tickStartUs - last >= Number(breakerH.params.resetSec) * units) {
      m.armour = init;
      rkH.targetCounters[`ab:stacks:${m.id}`] = 0;
      delete rkH.targetCounters[`ab:init:${m.id}`];
      delete rkH.icdsUs[`ab:last:${m.id}`];
    }
  }
  // `22` Demolition Sequence counts one body: whatever left the field takes its count and its summed
  // HP loss with it, so a fifth Hit can never be paid against a target that is no longer there (§7.2).
  for (const key of Object.keys(rkH.counters)) {
    if (!key.startsWith('ds:hits:')) continue;
    const gone = key.slice('ds:hits:'.length);
    if (s.group.some((m) => m.id === gone)) continue;
    delete rkH.counters[key];
    delete rkH.targetCounters[`ds:loss:${gone}`];
  }
  // 57 Shield Gate rearms only after ES is full and its 8s cooldown has passed
  const gateH = bundleOf(c.keystones, 'shield-gate');
  if (gateH && !(rkH.flags.shieldGateArmed ?? true)
    && s.player.es >= c.es && tickStartUs >= (rkH.icdsUs.shieldGateArmAt ?? 0)) rkH.flags.shieldGateArmed = true;
  const barkH = bundleOf(c.keystones, 'barkskin');
  if (barkH) {
    const everyUs = Number(barkH.params.regenEverySec) * units;
    const maxBark = Number(barkH.params.maxCharges);
    let next = rkH.icdsUs.bark ?? tickStartUs + everyUs;
    while (tickStartUs >= next && (rkH.stacks.bark || 0) < maxBark) {
      rkH.stacks.bark = (rkH.stacks.bark || 0) + 1;
      next += everyUs;
    }
    rkH.icdsUs.bark = next;
  }
  // a pool is bounded by what it is: never below nothing, never above what the sheet says it holds.
  // The bars read these straight, so an unbounded value here is what shows as a negative number there.
  // 52 lets the pool stand negative; without it the bar never reads below zero
  s.player.mana = Math.min(debt52 ? s.player.mana : Math.max(0, s.player.mana), c.maxMana);
  s.player.es = Math.min(Math.max(0, s.player.es), c.es);
  // reservations hold the usable ceiling below Full Max HP, never below 1 (§7.5)
  s.player.hp = Math.min(s.player.hp, usableHp(c, s.skills));
}
