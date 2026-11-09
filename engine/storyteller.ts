export type StorySource = 'camp' | 'delivery' | 'journey' | 'exploration' | 'dungeon' | 'market' | 'forge';
export type StoryMediaId = 'camp' | 'trail' | 'discovery' | 'dungeon' | 'market' | 'forge';
export type StorySceneRow = { id: string; source: StorySource; speaker: string; media: StoryMediaId; lines: string[] };
export type StoryData = { version: 1; scenes: StorySceneRow[]; labels: Record<string, string>; media: Record<StoryMediaId, { glyphs: string[] }> };

const SOURCES = new Set(['camp', 'delivery', 'journey', 'exploration', 'dungeon', 'market', 'forge']);
const MEDIA = new Set(['camp', 'trail', 'discovery', 'dungeon', 'market', 'forge']);
const REQUIRED_SCENES = new Set([
  'sounds-signs', 'prowler-edge', 'traveler-offer', 'traveler-return', 'nest-worksite', 'camp-found',
  'cache-ledge', 'cache-careful-result', 'cache-gain-result', 'cache-mixed-result', 'cache-loss-result',
  'cache-left-result', 'cache-cancel-result', 'delivery-request', 'delivery-paid', 'delivery-expired',
  'courier-request', 'courier-accepted', 'courier-paid', 'road-result', 'site-inspect', 'site-result',
  'dungeon-entry', 'dungeon-result', 'market-greeting', 'market-route', 'market-promotion',
  'forge-greeting', 'forge-ready', 'forge-blocked', 'forge-result',
]);
const REQUIRED_LABELS: Record<string, string> = {
  investigate: 'Investigate', quiet: 'Stay quiet', fight: 'Fight', secure: 'Secure supplies',
  shelter: 'Shelter', pause: 'Wait it out', listen: 'Ask for news', 'trade-ore': 'Trade provisions for ore',
  'trade-timber': 'Trade provisions for timber', decline: 'Send the traveler onward',
  'cache-careful': 'Recover carefully', 'cache-quick': 'Reach for the whole bundle', 'cache-leave': 'Leave it',
  'cache-collect': 'Collect recovered materials', 'cache-cancel': 'Abandon recovery',
  'courier-accept': 'Accept request', 'courier-decline': 'Decline request',
  'show-market': 'Open market', 'show-forge': 'Open Forge', 'show-deliveries': 'View requests', 'show-route': 'View route',
  'cache-title': 'Supplies on the ledge', 'signs-title': 'Movement near Camp', 'road-title': 'Along the road',
  'dungeon-title': 'Dungeon run',
};
const TOKENS: Record<string, Set<string>> = {
  camp: new Set(['species', 'material', 'food']),
  delivery: new Set(['town', 'destination', 'good']),
  market: new Set(['town', 'good', 'item']),
  forge: new Set(['material', 'pattern', 'item']),
  journey: new Set(), exploration: new Set(), dungeon: new Set(),
};
const MEDIA_ORDER: Record<StoryMediaId, string[]> = {
  camp: ['pine-tree', 'birch-trees', 'tent', 'rest-campfire'],
  trail: ['pine-tree', 'high-grass', 'adventure-bags'],
  discovery: ['boulder', 'high-grass', 'adventure-bags'],
  dungeon: ['boulder', 'adventure-bags'],
  market: ['currency-strongbox', 'adventure-bags'],
  forge: ['anvil-1', 'boulder'],
};
const NARROW = /[\u0000-\u001f\u007f]/;

export function storyHash32(text: string): number {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) {
    value = Math.imul(value ^ text.charCodeAt(i), 16777619) >>> 0;
  }
  return value >>> 0;
}

export function formatStoryLine(line: string, tokens: Record<string, string>): string {
  return line.replace(/\{([a-z]+)\}/g, (_m, name: string) => {
    if (!(name in tokens)) throw new Error(`formatStoryLine: unknown token ${name}`);
    if (typeof tokens[name] !== 'string' || !tokens[name].length) throw new Error(`formatStoryLine: missing value for token ${name}`);
    return tokens[name];
  });
}

export function validateStoryData(raw: unknown, refs: { npcIds: ReadonlySet<string> }): StoryData {
  const fail = (path: string, msg: string): never => { throw new Error(`storyteller.${path}: ${msg}`); };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('', 'must be an object');
  const data = raw as Record<string, unknown>;
  for (const key of Object.keys(data)) if (!['version', 'scenes', 'labels', 'media'].includes(key)) fail(key, 'unknown top-level key');
  if (data.version !== 1) fail('version', 'must be exactly 1');
  if (!Array.isArray(data.scenes)) fail('scenes', 'must be an array');
  const ids = new Set<string>();
  const sceneList = data.scenes as unknown[];
  for (let i = 0; i < sceneList.length; i++) {
    const row = sceneList[i] as Record<string, unknown>;
    const path = `scenes[${i}]`;
    if (!row || typeof row !== 'object') fail(path, 'must be an object');
    if (typeof row.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.id)) fail(`${path}.id`, 'must be a lowercase-hyphen id');
    if (ids.has(row.id as string)) fail(`${path}.id`, `duplicate scene ${row.id}`);
    ids.add(row.id as string);
    if (!SOURCES.has(String(row.source))) fail(`${path}.source`, `unknown source ${row.source}`);
    if (row.speaker !== 'narrator' && !refs.npcIds.has(String(row.speaker))) fail(`${path}.speaker`, `unknown speaker ${row.speaker}`);
    if (!MEDIA.has(String(row.media))) fail(`${path}.media`, `unknown media ${row.media}`);
    if (!Array.isArray(row.lines) || !row.lines.length || row.lines.some((l: unknown) => typeof l !== 'string' || !(l as string).length)) fail(`${path}.lines`, 'must be a nonempty string array');
    for (const line of row.lines as string[]) {
      if (NARROW.test(line) || /[<>]/.test(line)) fail(`${path}.lines`, 'plain text only, no HTML or control characters');
      if (/\d|%/.test(line)) fail(`${path}.lines`, 'must not embed probabilities, currency amounts or combat numbers');
      for (const match of line.matchAll(/\{([a-z]+)\}/g)) {
        if (!TOKENS[String(row.source)]?.has(match[1])) fail(`${path}.lines`, `token ${match[1]} not allowed for source ${row.source}`);
      }
      if (/\{[^\}]*\}/.test(line.replace(/\{[a-z]+\}/g, ''))) fail(`${path}.lines`, 'malformed brace token');
    }
  }
  for (const id of REQUIRED_SCENES) if (!ids.has(id)) fail('scenes', `missing required scene ${id}`);
  if (!data.labels || typeof data.labels !== 'object' || Array.isArray(data.labels)) fail('labels', 'must be a string map');
  for (const key of Object.keys(data.labels as Record<string, unknown>)) {
    if (typeof (data.labels as Record<string, unknown>)[key] !== 'string') fail(`labels.${key}`, 'must be a string');
  }
  for (const [id, value] of Object.entries(REQUIRED_LABELS)) {
    if (!(id in (data.labels as Record<string, unknown>))) fail('labels', `missing required label ${id}`);
    if ((data.labels as Record<string, unknown>)[id] !== value) fail(`labels.${id}`, `must be exactly "${value}"`);
  }
  if (!data.media || typeof data.media !== 'object' || Array.isArray(data.media)) fail('media', 'must be a map');
  for (const key of Object.keys(data.media as Record<string, unknown>)) if (!MEDIA.has(key)) fail(`media.${key}`, 'unknown preset');
  for (const preset of MEDIA) {
    const entry = (data.media as Record<string, unknown>)[preset] as Record<string, unknown> | undefined;
    if (!entry || typeof entry !== 'object' || !Array.isArray(entry.glyphs)) fail(`media.${preset}`, 'must be {glyphs:string[]}');
    const expected = MEDIA_ORDER[preset as StoryMediaId];
    const glyphs = entry!.glyphs as unknown[];
    if (glyphs.length !== expected.length || glyphs.some((g, i) => g !== expected[i])) fail(`media.${preset}.glyphs`, `must be [${expected.join(', ')}] in order`);
  }
  return data as unknown as StoryData;
}
