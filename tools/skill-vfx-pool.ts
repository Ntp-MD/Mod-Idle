/**
 * Regenerate the archived VFX pool registry.
 *
 *   node --experimental-strip-types tools/skill-vfx-pool.ts
 *   node --experimental-strip-types tools/skill-vfx-pool.ts --skill=attack.meteor
 *
 * Layout (confirmed convention):
 *   game/public/fx/skill-pool/attack-<element>/<skill-slug>/default/version.json   ← pointer only
 *   game/public/fx/skill-pool/attack-<element>/<skill-slug>/v1/  v2/ …             ← immutable art
 *   game/public/fx/skill-pool/<type>/<skill-slug>/…                                ← aura · buff · curse · heal
 *
 * Attack rows group by Element (`attack-phy` holds the physical rows; every other suffix is the
 * element's own name). The folder must match the row's `element`, so a mis-filed atlas fails here
 * instead of shipping under the wrong skill. `phy` is the one short name; the data value stays
 * `physical`.
 *
 * Storage rule: every generated/imported skill VFX from any production pipeline is stored as a
 * new `vN` here. No other folder is a home for skill VFX — this script rejects sibling folders
 * such as `game/public/fx/<skill-id>/`.
 *
 * `default` never holds art; it names the active version. The script resolves that pointer
 * (falling back to the highest `vN`), reads every `meta.json`, and writes
 * `pool.generated.ts`. Runtime URLs always address the resolved `vN` folder, never `default`.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const POOL = path.join(ROOT, 'game/public/fx/skill-pool');
const OUT = path.join(ROOT, 'game/src/ui/fx/pool.generated.ts');
const SKILLS = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/data/skills.json'), 'utf8'));
const COMPONENTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/data/vfx-components.json'), 'utf8'));
const POINTER = 'version.json';

// One home only: nothing beside the pool may hold skill VFX.
const FX_ROOT = path.join(ROOT, 'game/public/fx');
const stray = fs.readdirSync(FX_ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== 'skill-pool');
if (stray.length) {
  throw new Error(`skill VFX must live under fx/skill-pool/<skill>/vN — found ${stray.map((entry) => entry.name).join(', ')}`);
}

const live = new Set<string>(SKILLS.skills.filter((skill: any) => !skill.retired).map((skill: any) => skill.id));

/** `default/version.json` is the selection; a copied atlas there is rejected. */
function defaultPointer(skillDir: string, slug: string): string | null {
  const dir = path.join(skillDir, 'default');
  if (!fs.existsSync(dir)) return null;
  const pointer = path.join(dir, POINTER);
  if (!fs.existsSync(pointer)) {
    if (fs.readdirSync(dir).some((file) => /\.(png|webp|json)$/i.test(file) && file !== POINTER)) {
      throw new Error(`${slug}/default holds art — default must be a pointer (${POINTER}), not a copy`);
    }
    return null;
  }
  const version = String(JSON.parse(fs.readFileSync(pointer, 'utf8')).version ?? '');
  if (!/^v\d+$/.test(version)) throw new Error(`${slug}/default/${POINTER} must name a vN version`);
  if (!fs.existsSync(path.join(skillDir, version))) throw new Error(`${slug}/default points at missing ${version}`);
  return version;
}

const slugToId = (slug: string) => {
  const dash = slug.indexOf('-');
  if (dash < 0) return slug;
  return `${slug.slice(0, dash)}.${slug.slice(dash + 1).replaceAll('-', '_')}`;
};

type Pair = [number, number];
type SourceFrame = { rect: [number, number, number, number]; offsetX: number; offsetY: number };
type FrameGrid = {
  width: number; height: number; count: number; columns: number; rows: number;
  textureWidth: number; textureHeight: number;
  virtualWidth?: number; virtualHeight?: number; sourceFrames?: SourceFrame[];
};
type Authoring = {
  shape?: string; origin?: string; delivery?: string;
  radiusM?: number; lengthM?: number; widthM?: number; angleDeg?: number;
  spanM?: number; depthM?: number; diameterM?: number;
};
type Version = {
  palette?: string;
  sizePolicy?: 'footprint' | 'body' | 'world';
  binding?: 'area' | 'caster' | 'target' | 'contact' | 'release';
  phases?: ('Aim' | 'Windup' | 'Travel' | 'Impact' | 'Field' | 'Channel')[];
  delaySec?: number;
  durationSec?: number;
  placement?: { kind: 'line-series'; spacingM: number; staggerSec: number }
    | { kind: 'line-front' } | { kind: 'tether' } | { kind: 'expand'; fromScale: number } | { kind: 'spin'; cycleSec: number }
    | { kind: 'orbit'; cycleSec: number; radiusM: number };
  projection?: 'ground';
  rainDurationSec?: number;
  rainPhase?: 'Impact' | 'Field';
  rainIntervalSec?: number;
  rainSizeScale?: number;
  rainRadiusRatio?: number;
  rainSpreadM?: number;
  id: string; label: string; arena: boolean; default: boolean;
  /** Renderer-only version: no raster slots; the arena draws it procedurally. */
  renderer?: 'procedural';
  orient?: boolean;
  anchor?: Pair;
  impactAnchor?: Pair;
  frames?: { opening?: Pair; loop?: Pair; exit?: Pair };
  frameMs?: number;
  scale?: number;
  content?: { widthRatio: number; heightRatio: number };
  authoring?: Authoring;
  /** Straight-down ground texture; renders through the arena basis, exactly on the footprint. */
  decal?: string;
  decalOpacity?: number;
  layers: ({ id?: string; role: 'ground' | 'upright'; src: string; frame: FrameGrid; fps: number; loop: boolean; opacity?: number } & Partial<Omit<Version, 'layers' | 'id'>>)[];
};

const finite = (value: unknown) => value != null && Number.isFinite(Number(value));
const pair = (x: unknown, y: unknown): Pair | undefined =>
  finite(x) && finite(y) ? [Number(x), Number(y)] : undefined;
const range = (value: unknown): Pair | undefined =>
  Array.isArray(value) && value.length === 2 && value.every((entry) => finite(entry))
    ? [Number(value[0]), Number(value[1])] : undefined;

const positive = (value: unknown, label: string): number => {
  if (!finite(value) || Number(value) <= 0) throw new Error(`${label} must be positive and finite`);
  return Number(value);
};

/** Read the installed texture, rather than trusting a stale authoring image size. */
function textureSize(file: string): { textureWidth: number; textureHeight: number } {
  const fd = fs.openSync(file, 'r');
  const header = Buffer.alloc(24);
  try {
    if (fs.readSync(fd, header, 0, header.length, 0) !== header.length
      || header.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
      || header.subarray(12, 16).toString('ascii') !== 'IHDR') throw new Error(`${file} is not a PNG atlas`);
  } finally { fs.closeSync(fd); }
  return {
    textureWidth: positive(header.readUInt32BE(16), `${file} width`),
    textureHeight: positive(header.readUInt32BE(20), `${file} height`),
  };
}

function frameGrid(meta: any, file: string): FrameGrid {
  const texture = textureSize(file);
  const columns = positive(meta?.columns ?? 4, `${file} columns`);
  const rows = positive(meta?.rows ?? 4, `${file} rows`);
  if (!Number.isInteger(columns) || !Number.isInteger(rows)) throw new Error(`${file} grid must use integer columns/rows`);
  const count = positive(meta?.frames?.length ?? columns * rows, `${file} frame count`);
  const width = positive(meta?.cellWidth ?? texture.textureWidth / columns, `${file} cell width`);
  const height = positive(meta?.cellHeight ?? texture.textureHeight / rows, `${file} cell height`);
  const grid: FrameGrid = { width, height, count, columns, rows, ...texture };
  if (meta?.frames == null) return grid;
  if (!Array.isArray(meta.frames)) throw new Error(`${file} frames must be an array`);
  grid.virtualWidth = positive(meta.virtualWidth, `${file} virtual width`);
  grid.virtualHeight = positive(meta.virtualHeight, `${file} virtual height`);
  grid.sourceFrames = meta.frames.map((frame: any, index: number): SourceFrame => {
    const rect = frame?.rect;
    const offsetX = frame?.offsetX;
    const offsetY = frame?.offsetY;
    if (!Array.isArray(rect) || rect.length !== 4 || !rect.every((value) => finite(value))
      || !finite(offsetX) || !finite(offsetY)) throw new Error(`${file} frame ${index} needs a finite rect and offsets`);
    const [x, y, w, h] = rect.map(Number);
    if (x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > texture.textureWidth || y + h > texture.textureHeight
      || Number(offsetX) < 0 || Number(offsetY) < 0
      || Number(offsetX) + w > grid.virtualWidth! || Number(offsetY) + h > grid.virtualHeight!) {
      throw new Error(`${file} frame ${index} exceeds its source texture or virtual canvas`);
    }
    return { rect: [x, y, w, h], offsetX: Number(offsetX), offsetY: Number(offsetY) };
  });
  return grid;
}

/** Carry the authored aim data the meta file already owns; the old generator dropped all of it. */
function aimMeta(meta: any): Pick<Version, 'placement' | 'palette' | 'sizePolicy' | 'binding' | 'phases' | 'delaySec' | 'durationSec' | 'projection' | 'orient' | 'anchor' | 'impactAnchor' | 'frames' | 'frameMs' | 'scale' | 'content' | 'authoring' | 'rainDurationSec' | 'rainPhase' | 'rainIntervalSec' | 'rainSizeScale' | 'rainRadiusRatio' | 'rainSpreadM'> {
  if (meta?.palette != null && !Object.hasOwn(COMPONENTS.palettes, meta.palette)) throw new Error('Unknown VFX palette');
  if (meta?.sizePolicy != null && !['footprint', 'body', 'world'].includes(meta.sizePolicy)) throw new Error('Invalid VFX size policy');
  if (meta?.binding != null && !['area', 'caster', 'target', 'contact', 'release'].includes(meta.binding)) throw new Error('Invalid VFX binding');
  if (meta?.phases != null && (!Array.isArray(meta.phases) || !meta.phases.length || !meta.phases.every((phase: string) => ['Aim', 'Windup', 'Travel', 'Impact', 'Field', 'Channel'].includes(phase)))) throw new Error('Invalid VFX phases');
  if (meta?.delaySec != null && (!finite(meta.delaySec) || Number(meta.delaySec) < 0)) throw new Error('Invalid VFX delay');
  if (meta?.durationSec != null) positive(meta.durationSec, 'VFX duration');
  let placement: Version['placement'];
  if (meta?.placement != null) {
    const p = meta.placement;
    if (p.kind === 'line-series') {
      if (!finite(p.staggerSec) || Number(p.staggerSec) < 0) throw new Error('Invalid component stagger');
      placement = { kind: p.kind, spacingM: positive(p.spacingM, 'Component spacing'), staggerSec: Number(p.staggerSec) };
    } else if (p.kind === 'line-front') {
      positive(meta.durationSec, 'Component front duration');
      placement = { kind: p.kind };
    } else if (p.kind === 'tether') {
      placement = { kind: p.kind };
    } else if (p.kind === 'expand') {
      positive(meta.durationSec, 'Component expansion duration');
      const fromScale = positive(p.fromScale, 'Component expansion start');
      if (fromScale > 1) throw new Error('Component expansion start exceeds one');
      placement = { kind: p.kind, fromScale };
    } else if (p.kind === 'spin' || p.kind === 'orbit') {
      const cycleSec = positive(p.cycleSec, 'Component cycle');
      placement = p.kind === 'spin' ? { kind: p.kind, cycleSec }
        : { kind: p.kind, cycleSec, radiusM: positive(p.radiusM, 'Component orbit radius') };
    } else throw new Error('Unknown component placement');
  }
  const opening = range(meta?.opening);
  const loop = range(meta?.loop);
  const exit = range(meta?.exit);
  const frames = opening || loop || exit ? {
    ...(opening ? { opening } : {}),
    ...(loop ? { loop } : {}),
    ...(exit ? { exit } : {}),
  } : undefined;
  const content = finite(meta?.contentWidthRatio) && finite(meta?.contentHeightRatio)
    ? { widthRatio: Number(meta.contentWidthRatio), heightRatio: Number(meta.contentHeightRatio) } : undefined;
  const geometry = meta?.authoringGeometry ?? {};
  const authoring: Authoring = {};
  for (const key of ['shape', 'origin', 'delivery'] as const) {
    const value = geometry[key] ?? meta?.[key];
    if (typeof value === 'string' && value) authoring[key] = value;
  }
  for (const key of ['radiusM', 'lengthM', 'widthM', 'angleDeg', 'spanM', 'depthM'] as const) {
    if (finite(geometry[key])) authoring[key] = Number(geometry[key]);
  }
  if (finite(meta?.authoringDiameterM)) authoring.diameterM = Number(meta.authoringDiameterM);
  return {
    ...(meta?.palette != null ? { palette: String(meta.palette) } : {}),
    ...(meta?.sizePolicy != null ? { sizePolicy: meta.sizePolicy } : {}),
    ...(meta?.binding != null ? { binding: meta.binding } : {}),
    ...(meta?.phases != null ? { phases: meta.phases } : {}),
    ...(meta?.delaySec != null ? { delaySec: Number(meta.delaySec) } : {}),
    ...(meta?.durationSec != null ? { durationSec: Number(meta.durationSec) } : {}),
    ...(placement ? { placement } : {}),
    ...(meta?.projection === 'ground' ? { projection: 'ground' as const } : {}),
    ...(meta?.orient != null ? { orient: Boolean(meta.orient) } : {}),
    ...(pair(meta?.anchorX, meta?.anchorY) ? { anchor: pair(meta?.anchorX, meta?.anchorY)! } : {}),
    ...(pair(meta?.impactAnchorX, meta?.impactAnchorY) ? { impactAnchor: pair(meta?.impactAnchorX, meta?.impactAnchorY)! } : {}),
    ...(frames ? { frames } : {}),
    ...(finite(meta?.frameMs) ? { frameMs: Number(meta.frameMs) } : {}),
    ...(meta?.scale != null ? { scale: positive(meta.scale, 'atlas scale') } : {}),
    ...(finite(meta?.rainDurationSec) && meta.rainDurationSec > 0 ? { rainDurationSec: Number(meta.rainDurationSec) } : {}),
    ...(meta?.rainPhase === 'Impact' || meta?.rainPhase === 'Field' ? { rainPhase: meta.rainPhase } : {}),
    ...(finite(meta?.rainIntervalSec) && meta.rainIntervalSec > 0 ? { rainIntervalSec: Number(meta.rainIntervalSec) } : {}),
    ...(finite(meta?.rainSizeScale) && meta.rainSizeScale > 0 ? { rainSizeScale: Number(meta.rainSizeScale) } : {}),
    ...(finite(meta?.rainRadiusRatio) && meta.rainRadiusRatio > 0 ? { rainRadiusRatio: Number(meta.rainRadiusRatio) } : {}),
    ...(finite(meta?.rainSpreadM) && meta.rainSpreadM > 0 ? { rainSpreadM: Number(meta.rainSpreadM) } : {}),
    ...(content ? { content } : {}),
    ...(Object.keys(authoring).length ? { authoring } : {}),
  };
}

const TYPES = ['aura', 'buff', 'curse', 'heal'] as const;
function validateGroundAtlas(meta: any, frame: FrameGrid, label: string): void {
  if (meta?.projection !== 'ground') return;
  const widthRatio = Number(meta.contentWidthRatio ?? 1), heightRatio = Number(meta.contentHeightRatio ?? 1);
  if ((frame.virtualWidth ?? frame.width) !== (frame.virtualHeight ?? frame.height)
    || !Number.isFinite(widthRatio) || widthRatio <= 0 || widthRatio > 1 || widthRatio !== heightRatio) {
    throw new Error(`${label}: ground atlas needs square cells and equal positive content ratios <=1`);
  }
}

function layerId(value: unknown, fallback: string): string {
  if (value == null) return fallback;
  if (typeof value !== 'string' || !value.trim()) throw new Error('VFX layer ID must be a nonempty string');
  return value;
}

/** Attack pools group by Element; the folder suffix is the short name, `phy` means `physical`. */
const ATTACK_GROUPS = {
  phy: 'physical', fire: 'fire', cold: 'cold', lightning: 'lightning', poison: 'poison', chaos: 'chaos', earth: 'earth',
} as const;
const ATTACK_DIRS = Object.entries(ATTACK_GROUPS).map(([dir, element]) => ({ dir: `attack-${dir}`, element }));
const ELEMENT_OF = new Map<string, string>(SKILLS.skills.map((row: any) => [row.id, String(row.element ?? '')]));
const ALLOWED = [...TYPES, ...ATTACK_DIRS.map((group) => group.dir)];
const strayTypes = fs.readdirSync(POOL, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !ALLOWED.includes(entry.name));
if (strayTypes.length) throw new Error(`skill-pool holds only ${ALLOWED.join('/')} — found ${strayTypes.map((entry) => entry.name).join(', ')}`);

const output: Record<string, Version[]> = {};
// Refresh one skill while other pool folders are being manually curated.
const onlySkill = process.argv.find(arg => arg.startsWith('--skill='))?.slice('--skill='.length);
if (onlySkill) {
  if (!live.has(onlySkill)) throw new Error(`Unknown active skill ${onlySkill}`);
  const previous = fs.readFileSync(OUT, 'utf8').match(/export const POOL_VERSIONS[^=]*=([\s\S]*);\s*$/);
  if (!previous) throw new Error('Scoped generation needs an existing generated registry');
  Object.assign(output, JSON.parse(previous[1]));
  delete output[onlySkill];
}
const groups = [
  ...TYPES.map((type) => ({ dir: type, type, element: null as string | null })),
  ...ATTACK_DIRS.map((group) => ({ dir: group.dir, type: 'attack' as const, element: group.element as string | null })),
];
for (const group of groups) {
  const groupDir = path.join(POOL, group.dir);
  if (!fs.existsSync(groupDir)) continue;
  for (const entry of fs.readdirSync(groupDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    const skillId = slugToId(slug);
    if (!live.has(skillId) || onlySkill && skillId !== onlySkill) continue;
    if (group.element && ELEMENT_OF.get(skillId) !== group.element)
      throw new Error(`${group.dir}/${slug}: ${skillId} is ${ELEMENT_OF.get(skillId) || 'unknown'}, not ${group.element}`);
    const skillDir = path.join(groupDir, slug);
    const pointer = defaultPointer(skillDir, slug);
    let preferred: string | null = pointer;
    const versions: Version[] = [];
    for (const versionEntry of fs.readdirSync(skillDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (!versionEntry.isDirectory() || versionEntry.name === 'default') continue;
      const version = versionEntry.name;
      const dir = path.join(skillDir, version);
      const files = fs.readdirSync(dir);
      const metaFile = files.includes('meta.json') ? path.join(dir, 'meta.json') : null;
      const meta = metaFile ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : null;
      if (files.includes('version.json')) {
        const declared = JSON.parse(fs.readFileSync(path.join(dir, 'version.json'), 'utf8'));
        if (declared?.renderer === 'procedural') {
          versions.push({
            id: `pool-${version}`,
            label: preferred === version ? `Default · ${version}` : version,
            arena: true,
            default: preferred === version,
            renderer: 'procedural',
            layers: [],
          });
          continue;
        }
      }
      // A straight-down ground texture: exact footprint projection, no atlas frames.
      // The decal canvas must be square; the renderer maps 0..canvas onto the ground basis.
      if (files.includes('decal.png')) {
        const texture = textureSize(path.join(dir, 'decal.png'));
        if (texture.textureWidth !== texture.textureHeight) {
          throw new Error(`${slug}/${version}/decal.png must be square, got ${texture.textureWidth}x${texture.textureHeight}`);
        }
        versions.push({
          id: `pool-${version}`,
          label: preferred === version ? `Default · ${version}` : version,
          arena: true,
          default: preferred === version,
          decal: `/fx/skill-pool/${group.dir}/${slug}/${version}/decal.png`,
          ...(finite(meta?.decalOpacity) ? { decalOpacity: Number(meta.decalOpacity) } : {}),
          ...aimMeta(meta),
          layers: [],
        });
        continue;
      }
      let atlas = meta?.src ? path.basename(String(meta.src)) : 'atlas.png';
      if (!files.includes(atlas)) atlas = files.find((file) => /^atlas.*\.png$/.test(file)) || '';
      if (!atlas) continue;
      const frame = frameGrid(meta, path.join(dir, atlas));
      validateGroundAtlas(meta, frame, `${slug}/${version}`);
      const frameMs = Number(meta?.frameMs) || 80;
      versions.push({
        id: `pool-${version}`,
        label: preferred === version ? `Default · ${version}` : version,
        arena: true,
        default: preferred === version,
        ...aimMeta(meta),
        layers: [{
          id: layerId(meta?.layerId, 'base'),
          role: meta?.projection === 'ground' ? 'ground' : 'upright',
          src: `/fx/skill-pool/${group.dir}/${slug}/${version}/${atlas}`,
          frame,
          fps: Math.max(1, Math.round(1000 / frameMs)),
          loop: group.type === 'aura' || group.type === 'buff',
          ...(finite(meta?.opacity) ? { opacity: Number(meta.opacity) } : {}),
        }, ...(meta?.additionalLayers ?? []).map((extra: any, index: number) => {
          if (typeof extra.file !== 'string' || path.basename(extra.file) !== extra.file
            || !files.includes(extra.file)) throw new Error(`${slug}/${version}: invalid additional atlas file`);
          if (!finite(extra.opacity) || Number(extra.opacity) < 0 || Number(extra.opacity) > 1)
            throw new Error(`${slug}/${version}: additional layer opacity must be 0..1`);
          const extraFrame = frameGrid(extra, path.join(dir, extra.file));
          validateGroundAtlas(extra, extraFrame, `${slug}/${version}/${extra.file}`);
          return { id: layerId(extra.layerId, `layer-${index + 1}`), role: extra.projection === 'ground' ? 'ground' as const : 'upright' as const,
            src: `/fx/skill-pool/${group.dir}/${slug}/${version}/${extra.file}`,
            frame: extraFrame,
            fps: Math.max(1, Math.round(1000 / (Number(extra.frameMs) || 80))), loop: true,
            opacity: Number(extra.opacity), ...aimMeta(extra),
          };
        })],
      });
      const ids = versions[versions.length - 1].layers.map(layer => layer.id);
      if (new Set(ids).size !== ids.length) throw new Error(`${slug}/${version}: duplicate VFX layer IDs`);
    }
    if (!versions.length) continue;
    if (!preferred) {
      let best = -1;
      let bestName: string | null = null;
      for (const v of versions) {
        const m = v.id.match(/^pool-v(\d+)$/);
        const n = m ? Number(m[1]) : -1;
        if (n > best) { best = n; bestName = `v${n}`; }
      }
      preferred = bestName;
      if (preferred) {
        for (const v of versions) {
          const isDefault = v.id === `pool-${preferred}`;
          v.default = isDefault;
          v.label = isDefault ? `Default · ${preferred}` : v.id.replace('pool-', '');
        }
      }
    }
    if (preferred && !versions.some((version) => version.id === `pool-${preferred}`)) {
      console.warn(`${skillId}: ${preferred} is not a supported atlas version; registered older atlases remain active`);
    }
    versions.sort((a, b) => {
      const av = a.id === `pool-${preferred}` ? 0 : 1;
      const bv = b.id === `pool-${preferred}` ? 0 : 1;
      return av - bv || a.id.localeCompare(b.id);
    });
    output[skillId] = versions;
  }
}

const registryTemporary = `${OUT}.${process.pid}.tmp`;
fs.writeFileSync(registryTemporary, [
  '/* GENERATED by tools/skill-vfx-pool.ts from game/public/fx/skill-pool. Do not hand-edit. */',
  "import type { VfxVersion } from './catalog';",
  '',
  'export const POOL_VERSIONS: Record<string, VfxVersion[]> = ',
  `${JSON.stringify(output, null, 2)};`,
  '',
].join('\n'));
fs.renameSync(registryTemporary, OUT);
console.log(`wrote ${path.relative(ROOT, OUT)} · ${Object.keys(output).length} skills · ${Object.values(output).reduce((sum, rows) => sum + rows.length, 0)} versions`);
