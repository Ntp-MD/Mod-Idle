import type { GameState } from '../types';
import type { Character } from '../player';
import type { Statuses } from '../../combat/combat';
import type { KeystoneBundle } from '../../../../../engine/keystones.ts';
import { E, eng } from '../../../engine/client';
import { bundleOf, escapeBurst, mindOverMatter, manaRegenWhileNegative, timeOfNeedHeal } from '../../../../../engine/keystones.ts';
import { buffRuleUp, reservedMana, usableHp } from '../../combat/skills';
import { dotDamageParts } from '../../combat/combat';
import { dotLead, fx, hitColour, statusColour } from '../feedback';

/**
 * The recovery half of one tick, run only while the combat clock has not halted: committed healing
 * streams, the character's own DoT, and regen. The tick owns the halt latch; this stage owns the
 * pools it restores.
 */
export function advanceRecovery(opts: {
  s: GameState;
  c: Character;
  statuses: Statuses;
  debt52: KeystoneBundle | undefined;
  units: number;
  tickStartUs: number;
  tickEndUs: number;
  playerActiveFraction: number;
}): void {
  const { s, c, statuses, debt52, units, tickStartUs, tickEndUs, playerActiveFraction } = opts;
  const rkL = s.keystoneRuntime;
  const qL = rkL.queues;
  // 40 Borrowed Time recoup pays the HP actually lost back over its stream
  if (s.player.hp > 0) for (const p of [...qL.recoup]) {
    if (p.dueAtUs > tickEndUs) continue;
    qL.recoup.splice(qL.recoup.indexOf(p), 1);
    s.player.hp = Math.min(usableHp(c, s.skills), s.player.hp + p.amount);
  }
  // `17` Master Surgeon: the draught's Health arrives a second at a time. A payment that finds the
  // pool full is lost, but the stream keeps running to its last second (§7.4).
  if (s.player.hp > 0) for (const p of [...qL.potion]) {
    if (p.dueAtUs > tickEndUs) continue;
    qL.potion.splice(qL.potion.indexOf(p), 1);
    s.player.hp = Math.min(usableHp(c, s.skills), s.player.hp + p.amount);
  }
  // 24 Escape Artist replaces natural recharge with a 50% Max ES burst every 3s
  const escape = bundleOf(c.keystones, 'escape-artist');
  if (escape && s.player.esIdleSec >= Number(escape.params.idleSec)
    && tickStartUs >= (rkL.icdsUs.escapeArtist ?? 0)) {
    const capCast = bundleOf(c.keystones, 'capacitive-casting');
    const burst = escapeBurst(c.es, escape.params as Record<string, number>)
      * (capCast ? Number(capCast.params.naturalEsRegenMult) : 1);
    s.player.es = Math.min(c.es, s.player.es + burst);
    rkL.icdsUs.escapeArtist = tickStartUs + Number(escape.params.burstEverySec) * units;
  }
  // 36 Time of Need: every 5s clear Burn/Poison/Bleed and heal 15% of Full Max HP
  const need = bundleOf(c.keystones, 'time-of-need');
  if (need) {
    const periodUs = Number(need.params.periodSec) * units;
    rkL.icdsUs.timeOfNeed ??= tickStartUs + periodUs;
    if (tickStartUs >= rkL.icdsUs.timeOfNeed) {
      delete statuses.burn; delete statuses.poison; delete statuses.bleed;
      s.player.hp = Math.min(usableHp(c, s.skills), s.player.hp + timeOfNeedHeal(c.maxHp, need.params as Record<string, number>));
      rkL.icdsUs.timeOfNeed += periodUs;
    }
  }
  // 07 Endless Hunger bank fills the gap FIFO; each entry expires on its own clock
  for (const entry of [...rkL.bank]) {
    if (entry.expiresAtUs <= tickStartUs || entry.amount <= 0) { rkL.bank.splice(rkL.bank.indexOf(entry), 1); continue; }
    const gap = entry.pool === 'hp'
      ? Math.max(0, usableHp(c, s.skills) - s.player.hp) : Math.max(0, c.es - s.player.es);
    const take = Math.min(entry.amount, gap);
    if (entry.pool === 'hp') s.player.hp += take; else s.player.es += take;
    entry.amount -= take;
    if (entry.amount <= 0) rkL.bank.splice(rkL.bank.indexOf(entry), 1);
  }
  if (s.healUp && s.player.hp > 0) {
    const before = s.player.hp;
    s.player.hp = Math.min(c.maxHp, s.player.hp + c.maxHp * s.healUp.pctPerSec);
    // the stream says what it returned each second, on the same beat it spends — a heal that only lives in
    // the gauge is a number the eye never sees move
    fx(s, { kind: 'heal', side: 'self', text: `+${eng.fmt(s.player.hp - before)}`, colour: hitColour(null) });
    s.healUp.secLeft--;
    if (s.healUp.secLeft <= 0) s.healUp = null;
  }
  const dot = dotDamageParts(c, statuses);
  // a charge also stops a DoT tick — the row says it deletes "unconditional effects", which is what
  // a burn tick is: nothing rolls for it (`buff.ghost_dance`)
  if (dot.total > 0 && (s.player.charges || 0) > 0) s.player.charges!--;
  else if (dot.total > 0) {
    // Burn meets the live shield; poison and bleed reach HP directly. Only the burn part can
    // overflow to HP when the shield runs out, so a mixed DoT tick never spends ES on poison.
    // 55 Chaos Inoculation routes every non-immune DoT (Poison and Bleed included) through ES first.
    const ciDot = bundleOf(c.keystones, 'chaos-inoculation') !== undefined;
    const toEs = Math.min(ciDot ? dot.total : dot.burn, s.player.es);
    s.player.es -= toEs;
    const toHpDot = (ciDot ? dot.total : dot.poison + dot.bleed + dot.burn) - toEs;
    // 33 also answers DoT: its share comes from positive unreserved Mana, never from a reservation
    let hpDot = toHpDot;
    const momDot = bundleOf(c.keystones, 'mind-over-matter');
    if (momDot && hpDot > 0) {
      const pay = mindOverMatter(hpDot, Math.max(0, s.player.mana - reservedMana(c, s.skills)), momDot.params as Record<string, number>);
      s.player.mana -= pay.mana;
      hpDot = pay.hp;
    }
    s.player.hp -= hpDot;
    // the delay answers to damage taken, not to the pool it landed on: a poison tick that reached
    // HP interrupts the recharge the same way an equal direct hit does
    if ((toEs > 0 || toHpDot > 0) && !buffRuleUp(s.skills, 'es_recharge_immediate')) s.player.esIdleSec = 0;
    const lead = dotLead(dot);
    fx(s, { kind: 'taken', side: 'self', via: 'dot', text: eng.fmt(dot.total), value: dot.total, hpDamage: toHpDot, esDamage: toEs, colour: statusColour(lead) });
  }
  const burnCut = statuses.burn ? Math.min(E.status.burn.regen_cut_max, statuses.burn.stacks * E.status.burn.regen_cut_per_stack) : 0;
  // `combat.md` §5 reads shock as "attacks stop + regen stops", so the stop covers the pools too.
  // The Energy Shield recharge is left alone on purpose: it is a shield, not regen, and its own
  // `delay_sec` rule already governs it.
  if (s.player.hp > 0) s.player.hp = Math.min(c.maxHp, s.player.hp + c.hpRegen * (1 - burnCut) * playerActiveFraction);
  const manaRegenNow = debt52
    ? manaRegenWhileNegative(c.manaRegen * playerActiveFraction, s.player.mana < 0, debt52.params as Record<string, number>)
    : c.manaRegen * playerActiveFraction;
  // 45 Dark Siphon: Mana Regen fills ES instead; 52's ×2 (when negative) applies before the redirect.
  if (bundleOf(c.keystones, 'dark-siphon')) s.player.es = Math.min(c.es, s.player.es + manaRegenNow);
  else s.player.mana = Math.min(c.maxMana, s.player.mana + manaRegenNow);
  s.player.esIdleSec++;
  // Magia Drive forces the recharge: the delay is ignored and a hit does not interrupt it
  const rechargeNow = buffRuleUp(s.skills, 'es_recharge_immediate');
  const capacitive = bundleOf(c.keystones, 'capacitive-casting');
  const esRegenNow = c.esRegen * (capacitive ? Number(capacitive.params.naturalEsRegenMult) : 1);
  if (!escape && (rechargeNow || s.player.esIdleSec >= E.energy_shield.delay_sec)) s.player.es = Math.min(c.es, s.player.es + esRegenNow);
}
