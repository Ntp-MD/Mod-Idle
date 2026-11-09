export type CampEventStateId = 'prowler' | 'traveler' | 'nest' | 'herd' | 'aid' | 'discovered' | 'combat' | 'timeout' | 'full-bag' | 'read-only';
export type CampEventCost = { timeSec?: number; item?: string; qty?: number };
export type CampEventChoice = { label: string; cost?: CampEventCost; result: 'to-state' | 'combat' | 'close' | 'read-only' | 'aid' | 'timeout'; next?: CampEventStateId; flavor?: string };
export type StorytellerBeat = { id: string; state: CampEventStateId; portrait?: string; line: string; choices: CampEventChoice[] };

const states = new Set<string>(['prowler', 'traveler', 'nest', 'herd', 'aid', 'discovered', 'combat', 'timeout', 'full-bag', 'read-only']);
const results = new Set<string>(['to-state', 'combat', 'close', 'read-only', 'aid', 'timeout']);

export function validateCampEventBeat(beat: StorytellerBeat): string[] {
  const problems: string[] = [];
  if (!/^[a-z0-9-]+$/.test(beat.id)) problems.push(`${beat.id}: id must be lowercase hyphen`);
  if (!states.has(beat.state)) problems.push(`${beat.id}: unknown state ${beat.state}`);
  if (!beat.line.trim()) problems.push(`${beat.id}: empty line`);
  if (!beat.choices.length || beat.choices.length > 3) problems.push(`${beat.id}: choices must be 1-3`);
  for (const c of beat.choices) {
    if (!c.label.trim()) problems.push(`${beat.id}: empty label`);
    const kinds = [c.cost?.timeSec !== undefined, !!c.cost?.item].filter(Boolean).length;
    if (kinds > 1) problems.push(`${beat.id}/${c.label}: at most one cost type`);
    if (!results.has(c.result)) problems.push(`${beat.id}/${c.label}: bad result ${c.result}`);
    if (c.result === 'to-state' && (!c.next || !states.has(c.next))) problems.push(`${beat.id}/${c.label}: bad next`);
  }
  return problems;
}

export function validateCampEvents(beats: StorytellerBeat[]): string[] {
  const all = beats.flatMap(validateCampEventBeat);
  const ids = new Set<string>();
  for (const b of beats) {
    if (ids.has(b.id)) all.push(`${b.id}: duplicate id`);
    ids.add(b.id);
  }
  return all;
}

export function resolveCampChoice(beat: StorytellerBeat, index: number): { choice: CampEventChoice; cost: CampEventCost } | null {
  const choice = beat.choices[index];
  if (!choice) return null;
  return { choice, cost: choice.cost ?? {} };
}
