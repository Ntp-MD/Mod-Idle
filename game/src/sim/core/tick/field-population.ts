import type { GameState, Mob } from '../types';
import type { Character } from '../player';
import { E, eng, spawns } from '../../../engine/client';
import { mulberry32 } from '../../../engine/client-helpers';
import { spawnSlotSeed } from '../../../../../engine/spawns.ts';
import { BOSS_EVERY_SEC } from '../clock';
import { fieldAreaKey, syncFieldState, type FieldSpawnSlot } from '../../world/field-area';
import { syncCombatArena, type CombatArena } from '../../combat/combat-arena';
import { isBossKind } from '../kinds';
import { push } from '../log';
import { byFrontLine } from '../roster-order';

/**
 * Field and dungeon population for one tick: which slots refill, what body they roll, and how the
 * arena mirrors them. The legacy field the away resolver reads keeps one active pull; the arena fills
 * its authored cap.
 *
 * `fieldProfile` and `spawnMob` stay owned by the tick and arrive as callbacks, so this stage adds no
 * import edge back into `game.ts`.
 */
export function advanceFieldPopulation(s: GameState, opts: {
  arena: CombatArena | undefined;
  c: Character;
  online: boolean;
  rng: () => number;
  tickStartUs: number;
  units: number;
  fieldProfile: () => { respawn_sec: number };
  spawnMob: typeof import('../game').spawnMob;
}): void {
  const { arena, c, online, rng, tickStartUs, units, fieldProfile, spawnMob } = opts;
  const L = E.loot;

  function spawnFieldMob(slot: FieldSpawnSlot): Mob | undefined {
    const field = s.field;
    if (!field) return;
    if (s.group.filter((mob) => mob.hp > 0).length >= field.slots.length) return;
    const [lo, hi] = eng.groupRangeOf(s.zone, s.cell?.sub);
    const expected = Math.max(1, (lo + hi) / 2);
    const profile = fieldProfile();
    const waveSec = Number(L.group_spawn_sec) + expected * Number(L.ttk_per_mob_sec);
    const slotRate = Math.max(1e-9, field.slots.length / profile.respawn_sec);
    let kind: 'normal' | 'elite' | 'boss' = 'normal';
    let bossSpawn = false;
    if (online && s.bossDueAt != null && s.clockSec >= s.bossDueAt
      && !s.group.some((mob) => isBossKind(String(mob.kind)))) {
      kind = 'boss';
      bossSpawn = true;
    } else {
      // Preserve the old wave's Elite and Unique rates: one per the same expected seconds, not one
      // per arbitrary slot roll. A faster refill therefore gets a proportionally smaller chance.
      const eliteChance = eng.eliteChanceOf(s.zone, s.cell?.sub) / Math.max(1e-9, waveSec * slotRate);
      const roll = mulberry32(spawnSlotSeed(s.seed, field.areaKey, slot.id, slot.respawnCount));
      if (roll() < Math.min(1, eliteChance)) kind = 'elite';
    }
    const uniqueChance = Number(L.unique_chance || 0) * expected / Math.max(1e-9, waveSec * slotRate);
    if (bossSpawn) {
      // A Boss joining a continuing field starts its own encounter epoch; it does not invalidate
      // released work or the shots already travelling toward the bodies that were here first.
      field.arenaEpoch++;
    }
    const rng2 = mulberry32(spawnSlotSeed(s.seed, field.areaKey, slot.id, slot.respawnCount));
    const mob = spawnMob(rng2, s.zone, kind, undefined, s.cell?.sub ?? null, { uniqueChance });
    mob.spawnSlotId = slot.id;
    slot.mobId = mob.id;
    slot.life = undefined;
    slot.respawnAtSec = 0;
    slot.respawnCount++;
    s.group.push(mob);
    field.actors = field.actors.filter((actor) => actor.id !== mob.id);
    field.actors.push({ id: mob.id, x: slot.home.x, y: slot.home.y });
    if (bossSpawn) {
      s.bossDueAt = s.clockSec + BOSS_EVERY_SEC;
      push(s, `Boss spawn in ${eng.zoneById(s.zone).name}`);
    }
    return mob;
  }

  function ensureFieldPopulation(): void {
    const field = s.field;
    if (!field || s.walk || !s.hunting || s.dungeon || s.phase === 'camp' || s.player.hp <= 0) return;
    if (!field.slots.length) syncFieldState(s, arena, 2, false);
    if (online && !s.bossDueAt) s.bossDueAt = s.clockSec + BOSS_EVERY_SEC;
    const living = new Set(s.group.filter((mob) => mob.hp > 0).map((mob) => mob.id));
    // Without ground positions the away resolver keeps one active pull; the arena fills its authored
    // cap. This is the A-lite seam that the dedicated offline throughput gate will tune.
    const populationCap = arena ? field.slots.length : Math.min(1, field.slots.length);
    for (const slot of field.slots) {
      if (slot.mobId && living.has(slot.mobId)) continue;
      if (slot.mobId) {
        slot.mobId = undefined;
        if (!(slot.respawnAtSec > s.clockSec)) slot.respawnAtSec = s.clockSec;
      }
      if (s.clockSec < slot.respawnAtSec) continue;
      if (living.size >= populationCap) break;
      const mob = spawnFieldMob(slot);
      if (mob) living.add(mob.id);
    }
    s.group.sort(byFrontLine);
  }

  // Dungeon runs keep their authored budget until that path is migrated to spawn slots.
  if (!s.group.length && !s.walk && s.hunting && s.dungeon) {
    const run = s.dungeon;
    // A run fields the same authored population density as the field; `left` is the run budget.
    const size = Math.min(spawns.profileFor(run.zone, s.cell?.sub ?? null, 'legacy').cap, Math.max(0, run.left));
    if (size > 0) {
      s.group = Array.from({ length: size }, () => spawnMob(rng, run.zone, 'normal'));
      s.group.sort(byFrontLine);
    }
  }

  if (!s.field || s.field.areaKey !== fieldAreaKey(s)) syncFieldState(s, arena, 2, false);
  syncFieldState(s, arena, 2, false);
  ensureFieldPopulation();
  if (arena) syncCombatArena(arena, s, tickStartUs, units, c.maxHp);
}
