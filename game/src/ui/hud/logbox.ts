export type LogTab = 'all' | 'combat' | 'loot' | 'system';
export type EmptyFeedState = { title: string; detail: string };

export function feedEventsAfter<T extends { id: number }>(events: T[], seen: number): T[] {
  return events.filter((event) => event.id > seen).slice(0, 6);
}

export function emptyFeedState(active: LogTab, hasActivity: boolean): EmptyFeedState {
  if (!hasActivity) {
    return {
      title: 'No activity yet',
      detail: 'Combat, loot, and system events will appear here.',
    };
  }
  return {
    title: `No ${active} events yet`,
    detail: 'Try another filter to see recent events.',
  };
}
