import campData from '../../../../tools/data/camp-events.json';
import { resolveCampChoice, validateCampEvents, type StorytellerBeat } from '../../../../engine/camp-events';

const beats = (campData as { beats: StorytellerBeat[] }).beats;
export const campBeatProblems = validateCampEvents(beats);
export function campBeatById(id: string): StorytellerBeat | null {
  return beats.find(b => b.id === id) ?? null;
}
export function campBeats(): StorytellerBeat[] { return beats; }
export function resolveCampBeat(id: string, choiceIndex: number) {
  const beat = campBeatById(id);
  return beat ? resolveCampChoice(beat, choiceIndex) : null;
}
