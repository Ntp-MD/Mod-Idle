/** Gameplay samples the showcase dropdown offers; deep links (?sample=) accept the same set. */
export const SHOWCASE_SAMPLES = ['combat-field', 'build-workbench', 'progress-recap', 'core-field',
  'offline-progress', 'delivery', 'choice', 'full-bag', 'fallback', 'expired', 'read-only',
  'craft-stash', 'combat-fx'] as const;

export const SHOWCASE_SAMPLE_LABELS: Record<(typeof SHOWCASE_SAMPLES)[number], string> = {
  'combat-field': 'Combat field',
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
};
