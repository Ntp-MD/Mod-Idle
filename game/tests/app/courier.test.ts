import { describe, expect, it } from 'vitest';
import { TOWN, trade } from '../../src/engine/client';
import { newGame } from '@sim/core/game';
import {
  acceptCourier, contractById, declineCourier, deliver, deliveryConfig, normalizeDeliveries, offerDelivery,
  previewDelivery, pruneDeliveries, tickCourierOffers, tickDeliveries,
} from '@sim/town/delivery';
import { quoteSale, tradeBucket } from '@sim/town/trade';
import { settlementCell } from '@sim/world/road';
import { exportJson, importJson } from '../../src/state/save';

const writer = { writer: true }, readonly = { writer: false };

function fresh(seed = 902) {
  const state = newGame(seed);
  state.cell = settlementCell(state.town.visited[0])!;
  state.hunting = false;
  state.group = [];
  return state;
}

function otherTown(state: ReturnType<typeof fresh>): string {
  const next = TOWN.settlements.find((town) => !state.town.visited.includes(town.id))!.id;
  state.town.visited.push(next);
  return next;
}

/** A real generated offer converted into a courier contract, so fixtures stay normalize-valid. */
function courierFixture(state: ReturnType<typeof fresh>) {
  const from = state.town.visited[0], to = state.town.visited.find((id) => id !== from) ?? otherTown(state);
  const local = offerDelivery(state, from, () => 0.9, writer)!;
  local.target = Math.max(local.target, 3);
  const serial = state.town.courierSerial + 1;
  local.kind = 'courier';
  local.destinationTown = to;
  local.serial = serial;
  local.id = `courier:${from}:${serial}`;
  local.offeredAtDeliverySec = state.town.deliveryClockSec;
  local.acceptedAtDeliverySec = null;
  local.endReason = null;
  delete local.reward.alternative;
  delete local.reward.milestone;
  local.reward.attainment = 0;
  local.reward.treePoints = 0;
  state.town.courierSerial = serial;
  return local;
}

describe('courier contracts', () => {
  it('T-13: courier ticking never touches the world RNG and local offers stay seeded-identical', () => {
    const plain = fresh(7), ticked = fresh(7);
    for (const state of [plain, ticked]) otherTown(state);
    ticked.town.courierTriggerRemainingSec = 0;
    tickCourierOffers(ticked, true, false, writer);
    expect(ticked.rngState).toBe(plain.rngState);
    const draws = () => { const queue = [0, 0, 0, 0.99, 0.99, 0.5]; return () => queue.shift() ?? 0; };
    const a = offerDelivery(plain, plain.town.visited[0], draws(), writer);
    const b = offerDelivery(ticked, ticked.town.visited[0], draws(), writer);
    expect(b).toEqual(a);
  });

  it('T-14: one visited town, ineligible source, and a full slot make no offer and draw no stream', () => {
    const solo = fresh();
    solo.town.courierTriggerRemainingSec = 0;
    const soloStream = solo.town.courierStreamState;
    tickCourierOffers(solo, true, false, writer);
    expect(Object.values(solo.town.contracts).flat().filter((c) => c.kind === 'courier')).toEqual([]);
    expect(solo.town.courierStreamState).toBe(soloStream);

    const away = fresh();
    otherTown(away);
    away.town.courierTriggerRemainingSec = 0;
    away.phase = 'camp';
    const awayStream = away.town.courierStreamState;
    tickCourierOffers(away, true, false, writer);
    expect(away.town.courierTriggerRemainingSec).toBe(0);
    expect(away.town.courierStreamState).toBe(awayStream);

    const full = fresh();
    otherTown(full);
    const courier = courierFixture(full);
    full.town.courierTriggerRemainingSec = 0;
    const fullStream = full.town.courierStreamState;
    tickCourierOffers(full, true, false, writer);
    expect(full.town.courierTriggerRemainingSec).toBe(0);
    expect(full.town.courierStreamState).toBe(fullStream);
    expect(Object.values(full.town.contracts).flat().filter((c) => c.kind === 'courier')).toEqual([courier]);
  });

  it('T-15: acceptance is gated to the source, writer, open window and once', () => {
    const state = fresh();
    const courier = courierFixture(state);
    const gold = state.counters.gold;

    expect(acceptCourier(state, courier.id, readonly).ok).toBe(false);
    expect(courier.acceptedAtDeliverySec).toBeNull();

    // remote acceptance refuses at the destination
    state.cell = settlementCell(courier.destinationTown)!;
    const remote = acceptCourier(state, courier.id, writer);
    expect(remote.ok).toBe(false);
    expect(remote.why).toBe('stand in the issuing settlement to accept');
    expect(courier.acceptedAtDeliverySec).toBeNull();

    // legal origin acceptance changes only the acceptance stamp
    state.cell = settlementCell(courier.town)!;
    const accepted = acceptCourier(state, courier.id, writer);
    expect(accepted.ok).toBe(true);
    expect(courier.acceptedAtDeliverySec).toBe(state.town.deliveryClockSec);
    expect(courier.dueAtDeliverySec).toBeGreaterThan(0);
    expect(state.counters.gold).toBe(gold);

    const again = acceptCourier(state, courier.id, writer);
    expect(again.ok).toBe(false);
    expect(again.why).toBe('This request is already accepted.');
    expect(state.counters.gold).toBe(gold);

    // a busy character refuses too
    const busy = fresh();
    const busyCourier = courierFixture(busy);
    busy.hunting = true;
    expect(acceptCourier(busy, busyCourier.id, writer).ok).toBe(false);
    busy.hunting = false;

    // after the deadline it refuses without change
    const late = fresh();
    const lateCourier = courierFixture(late);
    late.town.deliveryClockSec = lateCourier.dueAtDeliverySec;
    expect(acceptCourier(late, lateCourier.id, writer).ok).toBe(false);
    expect(lateCourier.acceptedAtDeliverySec).toBeNull();
  });

  it('T-16: accepted courier refuses hand-in at the source and pays destination market gold', () => {
    const state = fresh();
    const courier = courierFixture(state);
    expect(acceptCourier(state, courier.id, writer).ok).toBe(true);
    const good = trade.byId[courier.good];
    tradeBucket(state, good)[good.key] = courier.target;

    state.cell = settlementCell(courier.town)!;
    expect(deliver(state, courier.id, 1, writer).ok).toBe(false);
    expect(courier.delivered).toBe(0);

    state.cell = settlementCell(courier.destinationTown)!;
    const quote = quoteSale(state, courier.destinationTown, courier.good, 1);
    expect(quote?.gold ?? 0).toBeGreaterThan(0);
    const first = deliver(state, courier.id, 1, writer);
    expect(first.ok).toBe(true);
    expect(courier.delivered).toBe(1);
    expect((tradeBucket(state, good)[good.key] || 0)).toBe(courier.target - 1);
    expect(courier.baseGold).toBeGreaterThan(0);
  });

  it('T-17: partials survive a native round trip, completion pays once, stale previews refuse, no permanent rewards', () => {
    const state = fresh();
    const courier = courierFixture(state);
    expect(acceptCourier(state, courier.id, writer).ok).toBe(true);
    const good = trade.byId[courier.good];
    tradeBucket(state, good)[good.key] = courier.target;
    state.cell = settlementCell(courier.destinationTown)!;

    const quoted = previewDelivery(state, courier.id, 1, writer);
    expect(quoted.ok).toBe(true);
    const snapshot = {
      delivered: courier.delivered, status: 'open' as const, gold: quoted.ok ? quoted.quote.gold : 0,
      acceptedAtDeliverySec: courier.acceptedAtDeliverySec,
    };
    const partial = deliver(state, courier.id, 1, writer, undefined, snapshot);
    expect(partial.ok).toBe(true);
    expect(courier.delivered).toBe(1);

    // replaying the same snapshot refuses without paying again
    const gold = state.counters.gold;
    const replay = deliver(state, courier.id, 1, writer, undefined, snapshot);
    expect(replay.ok).toBe(false);
    expect(state.counters.gold).toBe(gold);
    expect(courier.delivered).toBe(1);

    // the courier validates through a native persisted round trip
    const loaded = importJson(exportJson(state));
    const reloaded = contractById(loaded, courier.id)!;
    expect(reloaded.kind).toBe('courier');
    expect(reloaded.delivered).toBe(1);

    const attainmentBefore = loaded.player.attainmentPoints ?? 0;
    const treeBefore = loaded.player.questTreePointsEarned ?? 0;
    const remaining = reloaded.target - reloaded.delivered;
    const finalQuote = previewDelivery(loaded, courier.id, remaining, writer);
    expect(finalQuote.ok).toBe(true);
    const freshSnapshot = {
      delivered: reloaded.delivered, status: 'open' as const, gold: finalQuote.ok ? finalQuote.quote.gold : 0,
      acceptedAtDeliverySec: reloaded.acceptedAtDeliverySec,
    };
    const done = deliver(loaded, courier.id, remaining, writer, undefined, freshSnapshot);
    expect(done.ok).toBe(true);
    expect(done.completed).toBe(true);
    expect(reloaded.status).toBe('completed');
    expect(reloaded.reward.attainment).toBe(0);
    expect(reloaded.reward.treePoints).toBe(0);
    expect(loaded.player.attainmentPoints ?? 0).toBe(attainmentBefore);
    expect(loaded.player.questTreePointsEarned ?? 0).toBe(treeBefore);

    // a duplicate completion attempt against the finished contract refuses
    const duplicate = deliver(loaded, courier.id, 1, writer);
    expect(duplicate.ok).toBe(false);
    normalizeDeliveries(loaded);
  });

  it('T-18: decline pays nothing and waits the cadence; the common clock expires couriers online and offline', () => {
    const state = fresh();
    const courier = courierFixture(state);
    state.town.courierTriggerRemainingSec = 120;
    const gold = state.counters.gold;
    expect(declineCourier(state, courier.id, writer).ok).toBe(true);
    expect(courier.status).toBe('expired');
    expect(courier.endReason).toBe('declined');
    expect(courier.terminalAt).toBe(state.town.deliveryClockSec);
    expect(state.counters.gold).toBe(gold);
    expect(state.town.courierTriggerRemainingSec).toBe(120);

    // no immediate regeneration while the cadence is still ticking
    const stream = state.town.courierStreamState;
    tickCourierOffers(state, true, false, writer);
    expect(state.town.courierTriggerRemainingSec).toBe(119);
    expect(state.town.courierStreamState).toBe(stream);
    expect(Object.values(state.town.contracts).flat().filter((c) => c.kind === 'courier' && c.status === 'open')).toEqual([]);

    // a declined courier folds to declined only, never to completed/expired
    const corner = fresh();
    const declined = courierFixture(corner);
    declined.status = 'expired'; declined.endReason = 'declined'; declined.terminalAt = corner.town.deliveryClockSec;
    declined.recapAcknowledged = false;
    const limit = deliveryConfig.history_limit;
    deliveryConfig.history_limit = 1;
    try {
      for (let i = 0; i < 3; i++) {
        const extra = structuredClone(declined);
        extra.serial = ++corner.town.courierSerial;
        extra.id = `courier:${extra.town}:${extra.serial}`;
        (corner.town.contracts[extra.town] ||= []).push(extra);
      }
      pruneDeliveries(corner);
    } finally { deliveryConfig.history_limit = limit; }
    const summary = corner.town.deliverySummaries[declined.town];
    expect(summary.declined).toBe(3);
    expect(summary.expired).toBe(0);
    expect(summary.completed).toBe(0);

    // expiry uses the common delivery clock even offline; pause holds it
    const online = fresh();
    const onlineCourier = courierFixture(online);
    online.town.deliveryClockSec = onlineCourier.dueAtDeliverySec - 1;
    tickDeliveries(online, () => 0, true, false, writer);
    expect(onlineCourier.status).toBe('expired');
    expect(onlineCourier.endReason).toBe('expired');

    const offline = fresh();
    const offlineCourier = courierFixture(offline);
    offline.town.deliveryClockSec = offlineCourier.dueAtDeliverySec - 1;
    tickDeliveries(offline, () => 0, false, false, writer);
    expect(offlineCourier.status).toBe('expired');
    expect(offlineCourier.endReason).toBe('expired');

    const paused = fresh();
    const pausedCourier = courierFixture(paused);
    paused.town.deliveryClockSec = pausedCourier.dueAtDeliverySec - 1;
    tickDeliveries(paused, () => 0, true, true, writer);
    expect(pausedCourier.status).toBe('open');
    const pausedStream = paused.town.courierStreamState;
    tickCourierOffers(paused, false, false, writer);
    expect(paused.town.courierStreamState).toBe(pausedStream);
  });

  it('T-19: one courier stored once under its source, seen with the same progress from either context', () => {
    const state = fresh();
    const courier = courierFixture(state);
    expect(acceptCourier(state, courier.id, writer).ok).toBe(true);
    const good = trade.byId[courier.good];
    tradeBucket(state, good)[good.key] = courier.target;
    state.cell = settlementCell(courier.destinationTown)!;
    expect(deliver(state, courier.id, 1, writer).ok).toBe(true);

    const all = Object.values(state.town.contracts).flat();
    expect(all.filter((c) => c.id === courier.id)).toHaveLength(1);
    expect(state.town.contracts[courier.destinationTown] ?? []).not.toContain(courier);
    expect(contractById(state, courier.id)?.delivered).toBe(1);
    expect(contractById(state, courier.id)?.destinationTown).toBe(courier.destinationTown);
    expect(previewDelivery(state, courier.id, 1, writer).ok).toBe(true);
  });
});
