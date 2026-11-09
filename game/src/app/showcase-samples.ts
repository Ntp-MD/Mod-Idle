/** Gameplay samples the showcase dropdown offers; deep links (?sample=) accept the same set. */
export const SHOWCASE_SAMPLES = ['combat-field', 'magic-aoe', 'rimworld-field', 'build-workbench', 'progress-recap', 'core-field',
  'offline-progress', 'delivery', 'choice', 'full-bag', 'fallback', 'expired', 'read-only',
  'craft-stash', 'combat-fx', 'story-camp-warning', 'story-cache-choices', 'story-cache-working',
  'story-cache-bagfull', 'story-cache-results', 'story-delivery-choices', 'story-courier-unaccepted',
  'story-courier-destination', 'story-market-promotion', 'story-forge-ready', 'story-forge-shortage',
  'story-road-result', 'story-site-result', 'story-dungeon-result', 'story-read-only'] as const;

export const SHOWCASE_SAMPLE_LABELS: Record<(typeof SHOWCASE_SAMPLES)[number], string> = {
  'combat-field': 'Combat field',
  'magic-aoe': 'Meteor · Combat field',
  'rimworld-field': 'RimWorld · Field view',
  'build-workbench': 'Build · Full skill collection',
  'progress-recap': 'Progress · Return report',
  'core-field': 'Core allocation · field',
  'offline-progress': 'Offline catch-up · preview',
  delivery: 'Delivery want · Fixed',
  choice: 'Delivery want · Choice',
  'full-bag': 'Delivery reward bag full',
  fallback: 'Delivery skill fallback',
  expired: 'Expired partial delivery',
  'read-only': 'Read-only transactions',
  'craft-stash': 'Crafting · Stash workbench',
  'combat-fx': 'Combat FX · all labels',
  'story-camp-warning': 'Story: Camp warning',
  'story-cache-choices': 'Story: Cache choices',
  'story-cache-working': 'Story: Cache working',
  'story-cache-bagfull': 'Story: Cache bag full',
  'story-cache-results': 'Story: Cache results',
  'story-delivery-choices': 'Story: Delivery choices',
  'story-courier-unaccepted': 'Story: Courier unaccepted',
  'story-courier-destination': 'Story: Courier destination',
  'story-market-promotion': 'Story: Market promotion',
  'story-forge-ready': 'Story: Forge ready',
  'story-forge-shortage': 'Story: Forge shortage',
  'story-road-result': 'Story: Road result',
  'story-site-result': 'Story: Site result',
  'story-dungeon-result': 'Story: Dungeon result',
  'story-read-only': 'Story: Read-only',
};

/** Field samples change only the initial skill; the live arena owns rendering. */
export function showcaseFieldSkill(sample: string): string | undefined {
  if (sample === 'combat-field') return 'attack.fireball';
  if (sample === 'magic-aoe') return 'attack.meteor';
  if (sample === 'rimworld-field') return 'attack.meteor';
  return undefined;
}
