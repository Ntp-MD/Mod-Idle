import { sm } from '../../src/engine/client';

/** Live-roster lookup: find by capability, never by hardcoded id. Throws when the mechanic is gone. */
export const liveId = (pred: (s: any) => boolean, label: string): string => {
  const row = sm.all().find((s: any) => !s.retired && pred(s));
  if (!row) throw new Error(`no live skill for ${label}`);
  return row.id;
};

export const hasStat = (s: any, stat: string): boolean =>
  (s.effects ?? []).some((e: any) => e.stat === stat);
