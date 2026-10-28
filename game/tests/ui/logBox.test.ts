import { expect, it } from 'vitest';
import { emptyFeedState, feedEventsAfter } from '../../src/ui/hud/logbox';

it('shows a feed empty state before the first event, with filters ready', () => {
  expect(emptyFeedState('all', false)).toEqual({
    title: 'No activity yet',
    detail: 'Combat, loot, and system events will appear here.',
  });
});

it('explains when the active filter has no entries but the feed has other events', () => {
  expect(emptyFeedState('combat', true)).toEqual({
    title: 'No combat events yet',
    detail: 'Try another filter to see recent events.',
  });
});

it('keeps the first event in the feed instead of treating it as an initial snapshot', () => {
  const first = { id: 1, text: 'Slain · Rat · +1 EXP', tone: 'dim', chan: 'combat' as const };
  expect(feedEventsAfter([first], 0)).toEqual([first]);
});
