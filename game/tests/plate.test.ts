import { describe, it, expect } from 'vitest';
import { fxByMob, plateBeat, platePark, plateStrike, plateGesture, parked, latchedPark, latchedFrom, graveIds, type Parked } from '../src/ui/plate';
import type { FxEvent } from '../src/sim/types';

/**
 * The reads a plate is built from, tested on a hand-made ring. Written newest-first because that is the order
 * `fx` unshifts into the sim's ring, so every claim below is about the shape the client actually gets and not
 * about a fight it would have to run to produce one.
 */
let seq = 0;
const ev = (over: Partial<FxEvent> & { kind: FxEvent['kind'] }): FxEvent => ({
  id: ++seq, sec: 1, text: '', colour: '#cfd6e0', ...over,
});
const hit = (mobId: string, value: number, over: Partial<FxEvent> = {}) =>
  ev({ kind: 'hit', side: 'field', mobId, value, text: String(value), via: 'swing', ...over });
/** the list is read as the ring is: newest first */
const ring = (...list: FxEvent[]) => list;

describe('the figure a plate parks', () => {
  it('adds up the blows one body took inside one second', () => {
    const r = ring(hit('a', 6, { sec: 2 }), hit('a', 4, { sec: 2 }), hit('a', 10));
    const p = platePark(fxByMob(r), 'a')!;
    expect(p.sum).toBe(10);
    // the newest second is the one held, and both blows that share it are in it
    expect(p.sec).toBe(2);
    expect(p.id).toBe(r[0].id);
  });

  it('never mixes two bodies into one figure', () => {
    const r = ring(hit('a', 5), hit('b', 90), hit('a', 10));
    expect(platePark(fxByMob(r), 'a')!.sum).toBe(15);
    expect(platePark(fxByMob(r), 'b')!.sum).toBe(90);
  });

  it('wears the newest blow: its colour, and the crit face if that blow was a crit', () => {
    const r = ring(hit('a', 6, { colour: '#9fe0f2', crit: true }), hit('a', 4, { colour: '#e2603a' }));
    const p = platePark(fxByMob(r), 'a');
    expect(p!.colour).toBe('#9fe0f2');
    expect(p!.crit).toBe(true);
    // an ordinary blow on top of a crit takes the plain face back
    const later = ring(hit('a', 1, { colour: '#cfd6e0' }), ...r);
    expect(platePark(fxByMob(later), 'a')!.crit).toBeFalsy();
  });

  it('holds rather than ticks down as the ring drains', () => {
    // the whole burst is in the ring, then its oldest member falls off the end: what the plate shows has to
    // grow and then leave, never shrink under the player's eye
    const burst = ring(hit('a', 5, { sec: 3 }), hit('a', 5, { sec: 3 }), hit('a', 5, { sec: 3 }));
    expect(platePark(fxByMob(burst), 'a')!.sum).toBe(15);
    expect(platePark(fxByMob(burst.slice(0, 2)), 'a')!.sum).toBe(10);
    // and once a later second lands, the earlier burst is never read again
    const next = ring(hit('a', 2, { sec: 4 }), ...burst);
    expect(platePark(fxByMob(next), 'a')!.sum).toBe(2);
  });

  it('counts only an event that carries an amount, and empties with the ring', () => {
    const noValue = ring(ev({ kind: 'hit', side: 'field', mobId: 'a', text: '7' }), hit('a', 3));
    expect(parked(noValue)!.sum).toBe(3);
    expect(parked([])).toBeNull();
    expect(platePark(fxByMob(ring(hit('a', 3))), 'gone')).toBeNull();
  });

  it('follows a hit and not the words raised on the same body', () => {
    const r = ring(ev({ kind: 'kill', side: 'field', mobId: 'a', text: 'Rat' }), hit('a', 12));
    expect(plateBeat(fxByMob(r), 'a')!.value).toBe(12);
    expect(platePark(fxByMob(r), 'a')!.sum).toBe(12);
  });
});

describe('the figure a body holds while the ring remembers it', () => {
  const held = () => new Map<string, Parked>();

  it('is empty before the first blow, and leaves with the ring that raised it', () => {
    const h = held();
    expect(latchedPark(fxByMob([]), 'a', h)).toBeNull();
    const blow = hit('a', 7, { sec: 5 });
    expect(latchedPark(fxByMob(ring(blow)), 'a', h)!.sum).toBe(7);
    // the ring moves on with the tick, and about a second later the figure leaves the card with it
    expect(latchedPark(fxByMob([]), 'a', h)).toBeNull();
  });

  it('grows with a blow in the same second and never counts one blow twice', () => {
    const h = held();
    const first = hit('a', 4, { sec: 6 });
    latchedPark(fxByMob(ring(first)), 'a', h);
    const second = hit('a', 9, { sec: 6 });
    // the ring holds both: only the newer blow adds to the held figure
    expect(latchedPark(fxByMob(ring(second, first)), 'a', h)!.sum).toBe(13);
    // and once the older one drains, the figure does not shrink back under the player's eye
    expect(latchedPark(fxByMob(ring(second)), 'a', h)!.sum).toBe(13);
  });

  it('is replaced whole when a later second lands', () => {
    const h = held();
    const old = hit('a', 40, { sec: 7 });
    latchedPark(fxByMob(ring(old)), 'a', h);
    const later = hit('a', 3, { sec: 8 });
    expect(latchedPark(fxByMob(ring(later, old)), 'a', h)!.sum).toBe(3);
    // the drained burst is never read again
    expect(latchedPark(fxByMob(ring(later)), 'a', h)!.sum).toBe(3);
  });

  it('holds each body apart', () => {
    const h = held();
    latchedPark(fxByMob(ring(hit('a', 5))), 'a', h);
    expect(latchedPark(fxByMob(ring(hit('b', 8))), 'b', h)!.sum).toBe(8);
    // a's card is unmoved by b's blow — and each figure leaves once its own ring drains
    expect(latchedPark(fxByMob([]), 'a', h)).toBeNull();
    expect(latchedPark(fxByMob([]), 'b', h)).toBeNull();
  });

  it('takes the list it is handed, so the blows the character took latch too', () => {
    // the self card narrows to `taken` before asking — a filter inside the latch would empty that list and
    // the character's own card would park nothing at all, which is the bug this read exists to avoid
    const h = held();
    const first = ev({ kind: 'taken', side: 'self', byId: 'b', value: 6, text: '6', sec: 4 });
    const later = ev({ kind: 'taken', side: 'self', byId: 'c', value: 3, text: '3', sec: 4 });
    expect(latchedFrom([first], h, ' self')!.sum).toBe(6);
    expect(latchedFrom([later, first], h, ' self')!.sum).toBe(9);
    expect(latchedFrom([later], h, ' self')!.sum).toBe(9);
    expect(latchedFrom([], h, ' self')).toBeNull();
  });
});

describe('the gesture a body wears', () => {
  it('draws a blade only for a blow that used one, and never flashes the rim for a tick', () => {
    // a status clock that lands last must not erase the cut a moment earlier — and must not take the
    // rim either, or a DoT spread over the group blinks every plate while the swing hits one body
    const r = ring(hit('a', 3, { via: 'dot', colour: '#e2603a' }), hit('a', 9, { via: 'swing' }));
    expect(plateBeat(fxByMob(r), 'a')!.via).toBe('swing');
    expect(plateBeat(fxByMob(ring(hit('a', 3, { via: 'dot' }))), 'a')).toBeNull();
    // a press lands as a burst, and a swing as an arc
    expect(plateBeat(fxByMob(ring(hit('a', 8, { via: 'cast' }))), 'a')!.via).toBe('cast');
  });

  it('leans the body that carried the blow, and takes the knock for the one it landed on', () => {
    const r = ring(ev({ kind: 'taken', side: 'self', byId: 'b', value: 6, text: '6' }), hit('a', 12));
    expect(plateStrike(r, 'b')!.kind).toBe('taken');
    expect(plateStrike(r, 'a')).toBeNull();
    // a blocked swing is still a swing, so the striker leans even when nothing landed
    const blocked = ring(ev({ kind: 'block', side: 'self', byId: 'b', text: 'Block' }), hit('a', 12));
    expect(plateGesture(plateBeat(fxByMob(blocked), 'b'), plateStrike(blocked, 'b'))!.gesture).toBe('lunge');
  });

  it('plays one gesture per card, the hit winning its own second', () => {
    const bit = ev({ kind: 'taken', side: 'self', byId: 'a', value: 4 });
    const struckAfter = hit('a', 5);
    expect(plateGesture(struckAfter, bit)!.gesture).toBe('knock');
    expect(plateGesture(bit, struckAfter)!.gesture).toBe('knock');
    // a strictly newer second belongs to the striker: that is how an attack run is ever seen
    const laterSwing = ev({ kind: 'taken', side: 'self', byId: 'a', value: 4, sec: 2 });
    expect(plateGesture(struckAfter, laterSwing)!.gesture).toBe('lunge');
    expect(plateGesture(null, null)).toBeNull();
    expect(plateGesture(struckAfter, null)!.id).toBe(struckAfter.id);
  });
});

describe('the card the field keeps after the body is gone', () => {
  const group = (...ids: string[]) => ids.map((id) => ({ id }) as any);

  it('remembers a killed body while its own kill is in the ring', () => {
    const r = ring(ev({ kind: 'kill', side: 'field', mobId: 'a', text: 'Rat' }), hit('a', 40));
    expect(graveIds(r, group())).toEqual(['a']);
    // while the body is still on the field there is no grave to keep: its own plate is showing it
    expect(graveIds(r, group('a'))).toEqual([]);
  });

  it('lets a grave go on the next sim second instead of lingering while the ring drains', () => {
    const kill = ev({ kind: 'kill', side: 'field', mobId: 'a', text: 'Rat', sec: 10 });
    const r = ring(kill, hit('a', 40, { sec: 10 }));
    expect(graveIds(r, group(), 10)).toEqual(['a']);
    expect(graveIds(r, group(), 11)).toEqual([]);
  });

  it('names each dead body once, newest first, and empties when the ring does', () => {
    const r = ring(
      ev({ kind: 'kill', side: 'field', mobId: 'b', text: 'Bat' }),
      hit('b', 3),
      ev({ kind: 'kill', side: 'field', mobId: 'a', text: 'Rat' }),
      hit('a', 9),
    );
    expect(graveIds(r, group())).toEqual(['b', 'a']);
    expect(graveIds(ring(hit('a', 9)), group())).toEqual([]);
    expect(graveIds([], group())).toEqual([]);
  });

  it('does not dust a body that only left the field', () => {
    // the zone changed under the walk: the hits are still in the ring, but nothing killed them
    expect(graveIds(ring(hit('a', 9), hit('b', 4)), group())).toEqual([]);
  });

  it('buckets every event by the body it names, and drops the ones that name none', () => {
    const r = ring(hit('a', 3), ev({ kind: 'drop', side: 'field', text: 'Ring' }));
    const by = fxByMob(r);
    expect(by.size).toBe(1);
    expect(by.get('a')!.length).toBe(1);
  });
});
