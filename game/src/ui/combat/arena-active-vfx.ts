import manifest from './fx-manifests/manifest.json';

type Family = 'projectile' | 'slash' | 'thrust' | 'impact' | 'quake' | 'lightning' | 'storm' | 'rain' | 'nova' | 'ward' | 'heal' | 'curse' | 'fan';
export type ActiveVfx = { family: Family; art: string; impact: string; size: number; duration: number; ground?: string; turn?: number };
const fx = (family: Family, art: string, impact: string, size = 110, duration = .65, ground?: string, turn = 0): ActiveVfx =>
  ({ family, art, impact, size, duration, ground, turn });

// Each art choice is an inspected sheet, rather than the first entry of a shape category.
export const ACTIVE_VFX: Record<string, ActiveVfx> = {
  fireball: fx('projectile', 'orb/3a', 'burst-777', 66),
  firestorm: fx('storm', 'spiral-480', 'spark-1054', 230, 1.6, 'ring-320'),
  iceLance: fx('projectile', 'shard-1350', 'burst-837', 105),
  blizzard: fx('rain', 'shard-1472', 'shard-1408', 175, 1.5, 'ring-1712'),
  frostbite: fx('impact', 'shard-1472', 'burst-837', 120),
  chainLightning: fx('lightning', 'spark-1518', 'burst-1618', 90, .48),
  spark: fx('projectile', 'orb/3c', 'spark-1054', 54),
  thunder: fx('lightning', 'spark-1519', 'burst-1618', 155, .55, 'ring-1712'),
  poisonBolt: fx('projectile', 'orb/3b', 'smoke-1655', 57),
  venomFan: fx('fan', 'wave-1337', 'smoke-1075', 115, .65),
  acidArrow: fx('projectile', 'wave-1224', 'burst-1667', 75),
  chaosBolt: fx('projectile', 'spiral/1c', 'burst-1270', 65),
  voidBlast: fx('nova', 'spiral-1574', 'burst-1260', 180, .85, 'ring-1372'),
  sandStorm: fx('storm', 'spiral-480', 'smoke-1428', 190, 1.6, 'ring-1712'),
  earthSplitter: fx('quake', 'spark-1247', 'burst-926', 100, .9),
  backstab: fx('thrust', 'wave-1224', 'spark-1054', 100, .4, undefined, -25),
  sidestep: fx('slash', 'wave-1349', 'spark-1066', 100, .45),
  impale: fx('thrust', 'wave-1329', 'burst-1507', 160, .5),
  skullCrack: fx('impact', 'burst-861', 'spark-1351', 115),
  groundSlam: fx('quake', 'burst-926', 'spark-1247', 125, .8, 'ring-1712'),
  boneBreaker: fx('impact', 'burst-862', 'shard-1350', 125),
  carnage: fx('slash', 'wave-1677', 'burst-1507', 180, .65, undefined, -35),
  cleaveDown: fx('slash', 'wave-1617', 'spark-1054', 165, .55, undefined, 80),
  cleave: fx('slash', 'wave-1250', 'spark-1054', 165, .55),
  elementalBreak: fx('slash', 'wave-1349', 'burst-1594', 150, .65),
  whirlwind: fx('storm', 'spiral-1572', 'spark-1054', 210, 1.3, 'ring-320'),
  shieldBash: fx('impact', 'wave-1349', 'burst-1111', 130, .5),
  puncture: fx('thrust', 'wave-1224', 'spark-1066', 90, .4),
  reap: fx('slash', 'wave-1617', 'burst-1507', 185, .65, undefined, -20),
  piercingShot: fx('projectile', 'wave-1224', 'spark-1054', 85),
  arrowShower: fx('rain', 'wave-1224', 'spark-1054', 160, 1.15),
  headshot: fx('projectile', 'wave-1224', 'burst-862', 70),
  pierceVeil: fx('projectile', 'wave-1224', 'burst-1270', 110),
  earthShock: fx('quake', 'spark-1247', 'burst-926', 140, .8, 'ring-1338'),
  detonate: fx('nova', 'burst-777', 'smoke-1428', 200, .85, 'ring-1583'),
  shatter: fx('nova', 'burst-837', 'shard-1472', 170, .65, 'ring-1712'),
  overload: fx('lightning', 'spark-1518', 'burst-1618', 140, .6),
  catalyst: fx('nova', 'burst-1625', 'spark-1236', 165, .75),
  ruin: fx('nova', 'spiral-1574', 'burst-1260', 185, .9, 'ring-1372'),
  aftershock: fx('quake', 'burst-926', 'spark-1247', 125, 1.05, 'ring-1338'),
  warcry: fx('ward', 'ring-1712', 'ring-1339', 210, .7, 'ring-1712'),
  berserker: fx('ward', 'flame-463', 'spark-1236', 155, .95, 'ring-1583'),
  ironWill: fx('ward', 'lattice-388', 'spark-1054', 145, 1, 'ring-1372'),
  holyVeil: fx('ward', 'ring-495', 'spark-1066', 170, 1, 'ring-1338'),
  ghostDance: fx('ward', 'coil-265', 'spiral-1104', 165, 1, 'ring-1712'),
  earthWall: fx('ward', 'stack-214', 'burst-926', 155, .95, 'ring-1338'),
  esRing: fx('ward', 'ring-320', 'spiral-1572', 165, 1, 'ring-1372'),
  absorb: fx('ward', 'orb-257', 'spark-1066', 150, .95, 'ring-1712'),
  flameGuard: fx('ward', 'flame-242', 'spark-1236', 160, 1, 'ring-1583'),
  weaken: fx('curse', 'rune-1425', 'smoke-1428', 110, .85),
  blind: fx('curse', 'ring-1372', 'smoke-1244', 95, .85),
  expose: fx('curse', 'ring-1338', 'spark-1351', 125, .7),
  cripple: fx('curse', 'wave-1252', 'spark-1066', 110, .75),
  jinx: fx('curse', 'star-1675', 'spark-1518', 100, .9),
  venomBind: fx('curse', 'lattice-160', 'smoke-1075', 140, .95),
  heal: fx('heal', 'cross-1056', 'spark-1066', 115, .85, 'ring-1712'),
  greaterHeal: fx('heal', 'column-104', 'cross-1056', 175, 1.1, 'ring-1338'),
  cleanse: fx('heal', 'ring-1338', 'spark-1066', 185, .8, 'ring-1712'),
  cloud: fx('storm', 'smoke-1428', 'smoke-1075', 175, 1.4, 'ring-1712'),
  fissure: fx('thrust', 'spark-1247', 'burst-926', 190, .6),
};

const sheets = new Map(manifest.entries.map(entry => [entry.kind === 'bullet'
  ? entry.url.split('/').slice(-2).join('/').replace('.png', '') : entry.url.split('/').at(-1)!.replace('.png', ''), entry]));

export function activeVfxSheet(name: string) {
  const entry = sheets.get(name);
  if (!entry) throw new Error(`Missing active skill VFX sheet: ${name}`);
  return entry;
}

/** Art-only lifetimes. Damage and status duration remain owned by the engine. */
export function activeVfxDuration(shape: string, skill?: {duration?:string; effects?:{stat:string;value:number}[]}) {
  if (shape === 'sandStorm') return skill?.effects?.find(effect => effect.stat === 'dot_sec')?.value ?? ACTIVE_VFX[shape].duration;
  if (shape === 'heal' && skill?.effects?.some(effect => effect.stat === 'heal_per_sec')) return Number.parseFloat(skill.duration ?? '') || ACTIVE_VFX[shape].duration;
  if (skill?.duration) return Number.parseFloat(skill.duration) || ACTIVE_VFX[shape]?.duration || .72;
  return ACTIVE_VFX[shape]?.duration ?? .72;
}

/** Shapes whose row duration belongs to a status effect, not to the attack animation. */
const STRIKE_DURATION_SHAPES = new Set(['reap', 'elementalBreak', 'pierceVeil', 'aftershock']);

/**
 * The lifetime of the attack beat itself. A six-second status or debuff never stretches the slash,
 * bolt or impact that applied it; field shapes keep their full deployed duration.
 */
export function activeVfxPlaybackDuration(shape: string, skill?: {duration?:string; effects?:{stat:string;value:number}[]}, id?: string) {
  if (id?.startsWith('curse.') || STRIKE_DURATION_SHAPES.has(shape))
    return ACTIVE_VFX[shape]?.duration ?? .72;
  return activeVfxDuration(shape, skill);
}

/** Counts come from structured effects, the same owner as the displayed Effect description. */
export function activeVfxMechanics(skill?: {targets?: string; effects?: {stat:string; value:number}[]}) {
  return {
    targets: Math.max(1, Number(String(skill?.targets ?? '1').split('/')[0]) || 1),
    hits: Math.max(1, skill?.effects?.find(effect => effect.stat === 'hits')?.value ?? 1),
  };
}

/**
 * How many strike visuals one arena event owns. A press the tick resolves into separate impact
 * flights (`action` rows) already emits one event per hit, so each event draws exactly one. Only a
 * folded row (no action; `skills.ts` multiplies `hits` into one damage receipt) needs the repeat.
 */
export function activeVfxResolvedHits(
  skill: { action?: unknown; effects?: { stat: string; value: number }[] } | undefined,
  cast: boolean,
): number {
  if (cast || skill?.action) return 1;
  return Math.max(1, Number(skill?.effects?.find((effect) => effect.stat === 'hits')?.value ?? 1));
}

/** A folded multi-hit receipt pays every hit as one number; the label says how many. */
export function arenaDamageLabel(text: string | undefined, hits: number, crit = false): string {
  if (!text) return '';
  return `${text}${crit ? '!' : ''}${hits > 1 ? ` ×${hits}` : ''}`;
}

/** Visual palette for skills without a gameplay element; these choices never feed combat data. */
export function activeVfxElement(id: string, element?: string | null) {
  return element ?? ({
    'curse.weaken':'chaos','curse.blinding_mark':'cold','curse.expose':'earth',
    'curse.cripple':'chaos','curse.jinx':'chaos','curse.venom_bind':'poison',
    'buff.warcry':'physical','buff.berserker':'fire','buff.iron_will':'physical',
    'buff.holy_veil':'cold','buff.ghost_dance':'cold','buff.earth_wall':'earth',
    'buff.magia_drive':'cold','buff.energy_absorb':'lightning','buff.flame_guard':'fire',
    'heal.heal':'poison','heal.greater_heal':'poison','heal.cleanse':'cold',
  } as Record<string,string>)[id] ?? 'physical';
}


export function activeVfxFrame(name: string, age: number, element = 'physical', loop = false, reducedMotion = false) {
  const bulletPalette = element === 'fire' ? ['a', 0] : element === 'chaos' ? ['a', 10]
    : element === 'cold' ? ['b', 0] : element === 'poison' ? ['b', 5] : element === 'earth' ? ['b', 10] : ['c', 0];
  const sheet = activeVfxSheet(name.includes('/') ? name.replace(/[abc]$/, String(bulletPalette[0])) : name);
  const frames = sheet.kind === 'cylinder' ? sheet.frames / 4 : sheet.frames;
  const palette = ({fire: 0, cold: 1, lightning: 1, chaos: 2, poison: 3, earth: 6, physical: 7} as Record<string, number>)[element] ?? 7;
  const column = sheet.kind === 'cylinder' ? palette % 4 * frames : 0;
  const row = sheet.kind === 'cylinder' ? Math.floor(palette / 4)
    : sheet.kind === 'bullet' ? Number(bulletPalette[1]) : ({fire: 0, chaos: 1, cold: 2, poison: 3, earth: 4, physical: 5, lightning: 5} as Record<string, number>)[element] ?? 5;
  const raw = Math.floor(Math.max(0, age) * 1000 / sheet.frameMs);
  const frame = reducedMotion ? Math.floor(frames / 2) : loop ? raw % frames : Math.min(frames - 1, raw);
  return { sheet, viewBox: `${(column + frame) * sheet.cellWidth} ${row * sheet.cellHeight} ${sheet.cellWidth} ${sheet.cellHeight}` };
}
