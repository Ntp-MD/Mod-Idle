import fs from 'node:fs';
import path from 'node:path';
import { readJson } from './lib/json.ts';
import { gates, report } from './lib/gates.ts';
import { createTrade, type TradeCfg } from '../engine/trade.ts';
import { characterIconCandidates, gearIconCandidates, ICON_REGISTRY, skillIconCandidates, stackIconCandidates } from '../game/src/icon/registry.ts';

const root = path.resolve(import.meta.dirname, '..');
const E = readJson<any>(path.join(root, 'tools/data/engine.json'));
const T = readJson<{ trade: TradeCfg }>(path.join(root, 'tools/data/town.json'));
const B = readJson<any>(path.join(root, 'tools/data/bases.json'));
const S = readJson<any>(path.join(root, 'tools/data/skills.json'));
const trade = createTrade(E, T.trade);
const iconRoot = path.join(root, 'game/src/icon');
const assets = new Set<string>();

function scan(dir: string): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { scan(file); continue; }
    const ext = path.extname(entry.name).toLowerCase();
    const rel = path.relative(iconRoot, file).replace(/\\/g, '/');
    if (ext === '.png' || (ext === '.svg' && rel.startsWith('items/'))) {
      assets.add(path.basename(entry.name, ext));
    }
  }
}
scan(iconRoot);

const rows = gates();
const issues: string[] = [];
let explicit = 0;
let substituted = 0;
function check(label: string, candidates: string[]): void {
  const found = candidates.find((key) => assets.has(key));
  if (!found) { issues.push(`${label}: no registered icon or fallback exists (${candidates.join(' → ')})`); return; }
  if (found === candidates[0]) explicit++;
  else substituted++;
}

const groupFor: Record<string, string> = { material: 'materials', food: 'food', herb: 'herbs', junk: 'junk' };
for (const good of trade.goods) check(`item ${good.id}`, stackIconCandidates(groupFor[good.bucket] || good.bucket, good.name, good.id));
for (const base of B.bases as { name: string; slot: string }[]) check(`gear base ${base.name}`, gearIconCandidates(base.name, base.slot));
for (const rows of Object.values(B.weapon_frames) as { name: string }[][]) {
  for (const frame of rows) check(`weapon frame ${frame.name}`, gearIconCandidates(frame.name, 'main hand'));
}
for (const skill of S.skills as { id: string; type?: string }[]) check(`skill ${skill.id}`, skillIconCandidates(skill.id, skill.type));
for (const [id] of Object.entries(ICON_REGISTRY.character.byId)) check(`character ${id}`, characterIconCandidates(id));

rows.add('IC1', issues.length === 0, issues.length
  ? issues.join(' · ')
  : `${trade.goods.length} item IDs, ${B.bases.length} gear bases, ${Object.values(B.weapon_frames).reduce((n: number, list: any) => n + list.length, 0)} weapon frames, ${S.skills.length} skill IDs and ${Object.keys(ICON_REGISTRY.character.byId).length} character portraits resolve to existing art; ${explicit} match a preferred key and ${substituted} resolve through an alternate candidate or fallback`);
report(rows.rows());
