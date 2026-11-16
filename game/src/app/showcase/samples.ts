/** Gameplay samples the showcase dropdown offers; deep links (?sample=) accept the same set. */
export const SHOWCASE_SAMPLES = ['combat-field', 'magic-aoe', 'build-workbench', 'progress-recap', 'core-field',
  'offline-progress', 'delivery', 'choice', 'full-bag', 'fallback', 'expired', 'read-only',
  'craft-stash', 'combat-fx', 'story-camp-warning', 'story-cache-choices', 'story-cache-working',
  'story-cache-bagfull', 'story-cache-results', 'story-delivery-choices', 'story-courier-unaccepted',
  'story-courier-destination', 'story-market-promotion', 'story-forge-ready', 'story-forge-shortage',
  'story-road-result', 'story-site-result', 'story-dungeon-result', 'story-read-only',
  'vfx-charge-gather', 'vfx-motion-trail', 'vfx-contact-flash', 'vfx-shield-ripple', 'vfx-body-coating'] as const;

export type ShowcaseSampleId = (typeof SHOWCASE_SAMPLES)[number];
export const DEFAULT_SHOWCASE_SAMPLE: ShowcaseSampleId = 'combat-field';

export const SHOWCASE_SAMPLE_LABELS: Record<ShowcaseSampleId, string> = {
  'combat-field': 'Combat field',
  'magic-aoe': 'Meteor · Combat field',
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
  'vfx-charge-gather': '3D VFX: charge gather',
  'vfx-motion-trail': '3D VFX: motion trail',
  'vfx-contact-flash': '3D VFX: contact flash',
  'vfx-shield-ripple': '3D VFX: shield ripple',
  'vfx-body-coating': '3D VFX: coating source (mask pending)',
};

const VFX_COMPONENT_SKILLS: Record<string, string> = {
  'charge-gather': 'attack.fireball', 'motion-trail': 'attack.fireball',
  'contact-flash': 'attack.double_strike', 'shield-ripple': 'buff.iron_will', 'body-coating': 'buff.berserker',
};

export function showcaseVfxComponent(sample: string): string | undefined {
  const id = sample.slice(4);
  return sample.startsWith('vfx-') && VFX_COMPONENT_SKILLS[id] ? id : undefined;
}

export function isShowcaseSample(value: string | null): value is ShowcaseSampleId {
  return value !== null && (SHOWCASE_SAMPLES as readonly string[]).includes(value);
}

/** Field samples change only the initial skill; the live arena owns rendering. */
export function showcaseFieldSkill(sample: string): string | undefined {
  const component = showcaseVfxComponent(sample);
  if (component) return VFX_COMPONENT_SKILLS[component];
  if (sample === 'combat-field') return 'attack.fireball';
  if (sample === 'magic-aoe') return 'attack.meteor';
  return undefined;
}

export interface ShowcaseView {
  fieldSkill?: string;
  worldScale?: number;
  panel?: 'map' | 'market' | 'forge' | 'craft';
  journeyTools?: boolean;
  market?: { view: 'deliveries' | 'trade'; town: 'current' | 'courier-destination' };
  statuses?: Record<string, { stacks: number; secLeft: number; perSec: number }>;
  offline?: { done: number; total: number };
  progressRecap?: boolean;
  combatFx?: boolean;
  readOnly?: boolean;
  forestGround?: boolean;
}

/** One presentation descriptor per sample; App owns state and applies it. */
export function showcaseView(sample: string): ShowcaseView | null {
  const fieldSkill = showcaseFieldSkill(sample);
  if (fieldSkill) return { fieldSkill };
  if (sample === 'craft-stash') return { panel: 'craft' };
  if (sample === 'combat-fx') {
    return {
      combatFx: true,
      statuses: {
        burn: { stacks: 1, secLeft: 8, perSec: 12 },
        chill: { stacks: 1, secLeft: 10, perSec: 0 },
        bleed: { stacks: 1, secLeft: 6, perSec: 8 },
      },
    };
  }
  if (sample === 'offline-progress') return { offline: { done: 43200, total: 86400 } };
  if (sample === 'progress-recap') return { progressRecap: true };
  if (sample === 'read-only') return { readOnly: true };
  if (sample === 'story-read-only') return { readOnly: true, journeyTools: true, panel: 'map' };
  if (!sample.startsWith('story-')) return null;
  if (['story-delivery-choices', 'story-courier-unaccepted'].includes(sample)) {
    return { journeyTools: true, panel: 'market', market: { view: 'deliveries', town: 'current' } };
  }
  if (sample === 'story-courier-destination') {
    return { journeyTools: true, panel: 'market', market: { view: 'deliveries', town: 'courier-destination' } };
  }
  if (sample === 'story-market-promotion') {
    return { journeyTools: true, panel: 'market', market: { view: 'trade', town: 'current' } };
  }
  if (sample === 'story-forge-ready' || sample === 'story-forge-shortage') {
    return { journeyTools: true, panel: 'forge' };
  }
  return { journeyTools: true, panel: 'map' };
}
