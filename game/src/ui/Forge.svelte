<script lang="ts">
  /**
   * The forge — the one screen where a piece is made stronger by level.
   *
   * Everything on it answers a single question before the press: what does this step cost, what can it do
   * to me, and can I afford to be wrong. The chance curve, the stone prices, the rung a piece Breaks from
   * and the protection charges it has left are all read from the shared craft module, so a screen can never
   * quote a ladder the engine has since moved. Nothing here is hidden behind the button: a step that can
   * drop a level says so in the same row that prints its chance.
   */
  import { craft, stoneName } from '../sim/craft';
  import PieceOn from './PieceOn.svelte';
  import type { GameState, Item } from '../sim/types';

  let { state, item, where = null, index = -1, onpick, onrun, wornOf, note = '' }: {
    state: GameState;
    item: Item | null;
    where?: 'gear' | 'bag' | null;
    index?: number;
    onpick: (where: 'gear' | 'bag', index: number) => void;
    onrun: (op: 'upgrade' | 'repair' | 'corrupt', line?: number) => void;
    wornOf: (slot: string) => Item | null;
    note?: string;
  } = $props();

  const C = craft.C;
  const cap = $derived(C.upgrade_cap as number);
  const now = $derived(item?.upgrade_lv || 0);
  const step = $derived(Math.min(now + 1, cap));
  const maxed = $derived(item != null && now >= cap);
  const chance = $derived(craft.successPct(step));
  const cost = $derived(item ? craft.costOf('upgrade', item) : {});
  const afford = $derived(item ? craft.payable(state.counters.stones, 'upgrade', item) : false);
  const gate = $derived(item ? craft.guard(item, 'upgrade') : { ok: false, why: 'pick a piece first' });
  const repairGate = $derived(item ? craft.guard(item, 'repair') : { ok: false, why: 'pick a piece first' });
  const protection = $derived(item ? (item.protection_left == null ? C.protection_start : item.protection_left) : C.protection_start);
  /** what a miss costs at this rung — the three ways a step can fail, from the engine's own break point */
  const miss = $derived(step < C.upgrade_breaks_from
    ? `a miss drops it back to +${Math.max(0, step - 1)}`
    : protection > 0
      ? `a miss spends one protection charge and drops it to +${Math.max(0, step - 1)}`
      : `a miss past +${C.upgrade_breaks_from - 1} with no charge left leaves it Broken at +${Math.max(0, step - 1)}`);

  const rungs = $derived.by(() => Array.from({ length: cap }, (_, k) => {
    const n = k + 1;
    return { n, stones: (C.upgrade_costs as number[])[k], chance: craft.successPct(n), done: n <= now, next: n === step };
  }));
  const stones = $derived(Object.entries(state.counters.stones).filter(([, v]) => (v as number) > 0));
</script>

<div class="forge">
  <PieceOn {state} {item} {where} {index} {onpick} {wornOf} />

  <div class="ladder" role="group" aria-label="The enhancement ladder">
    {#each rungs as r (r.n)}
      <div class="rung" class:done={r.done} class:next={r.next} class:risky={r.n > C.upgrade_breaks_from - 1} aria-current={r.next ? 'step' : undefined}>
        <b>+{r.n}</b>
        <span class="pc">{Math.round(r.chance)}%</span>
        <span class="st">{r.stones}</span>
      </div>
    {/each}
  </div>
  <p class="scale"><small>left is the next rung, right is the top of the ladder · % is the published chance of the step · the number under it is Quality Stones it asks for</small></p>

  {#if item}
    <div class="press">
      <div class="odds">
        <div class="big" class:safe={chance >= 100} class:high={chance < 50}>
          <b>{maxed ? 'MAX' : Math.round(chance) + '%'}</b>
          <span>{maxed ? 'at its +' + cap : 'chance this step'}</span>
        </div>
        <ul class="terms">
          <li>Costs {Object.entries(cost).map(([k, n]) => `${n} ${stoneName(k)}`).join(' + ')}</li>
          <li>{maxed ? `+${cap} is the top of the ladder — this piece goes no higher` : miss}</li>
          <li>Protection charges left: <b>{protection}</b> of {C.protection_start}</li>
          <li>You hold {state.counters.stones.quality || 0} {stoneName('quality')}</li>
        </ul>
      </div>
      <div class="acts">
        <button class="hammer" disabled={!gate.ok || !afford || maxed} onclick={() => onrun('upgrade')}
                title={gate.ok ? `Forge +${step} for ${Math.round(chance)}%` : gate.why}>
          {#if item.broken}Cannot forge a Broken piece{:else if maxed}This piece is at +{cap}{:else}Forge +{step}{/if}
        </button>
        {#if !gate.ok && gate.why !== 'Broken — Repair it first'}<p class="refuse">{gate.why}</p>{/if}
        {#if !afford && gate.ok}<p class="refuse">Not enough {stoneName('quality')} for +{step}.</p>{/if}
        <button class="repair" disabled={!repairGate.ok} onclick={() => onrun('repair')}
                title={repairGate.ok ? `Repair for ${JSON.stringify(craft.costOf('repair', item))}` : repairGate.why}>
          Repair · {Object.entries(craft.costOf('repair', item)).map(([k, n]) => `${n} ${stoneName(k)}`).join(' + ')}
        </button>
        <p class="gamble">
          <button class="corrupt" disabled={!item.corrupted && !craft.payable(state.counters.stones, 'corrupt', item)}
                  onclick={() => onrun('corrupt')}>
            Corrupt · 1 {stoneName('corrupt')}
          </button>
          <small>one press per piece, ever. It is the only stone allowed to change a line's Element — and it
            can take the quality step down. After it, no stone of any kind touches this piece again.</small>
        </p>
      </div>
    </div>
    {#if note}<p class="result" class:good={!/drop|BROKEN|broken|refus/i.test(note)}>{note}</p>{/if}
  {/if}

  <p class="purse">
    {#if stones.length}
      {#each stones as [k, v]}<span>{v} × {stoneName(k)}</span>{/each}
    {:else}
      <span class="dim">No stones in the purse — rejected drops dissolve into Reroll value stones, and Guild tasks pay the rest.</span>
    {/if}
  </p>
</div>

<style>
  .forge { display: grid; gap: .9rem; }

  /* the ladder is the screen: a rung reads as a rung, climbed from the left, with the lit one being the
     press the button under it makes */
  .ladder { display: flex; gap: .25rem; align-items: stretch; }
  .rung {
    flex: 1 1 0; min-width: 0; display: grid; gap: .1rem; justify-items: center; align-content: center;
    padding: .45rem .1rem; border: 1px solid var(--line); border-radius: 8px; background: var(--panel);
  }
  .rung b { font-family: var(--num); font-size: .82rem; color: var(--dim); }
  .rung .pc, .rung .st { font-family: var(--num); font-size: .62rem; color: var(--mob); }
  .rung.done { background: #1b2029; border-color: #2f3a4d; }
  .rung.done b { color: var(--text); }
  .rung.risky b { color: #e2503f; }
  .rung.next {
    border-color: var(--gold); background: rgba(232, 193, 105, .14);
    box-shadow: 0 0 0 1px rgba(232, 193, 105, .45), 0 6px 18px rgba(0, 0, 0, .4);
  }
  .rung.next b { color: var(--gold); font-size: .95rem; }
  .scale { margin: -.5rem 0 0; color: var(--mob); }

  .press { display: grid; grid-template-columns: 1fr minmax(16rem, 22rem); gap: 1rem; align-items: start; }
  .odds { display: grid; grid-template-columns: auto 1fr; gap: 1rem; align-items: center; }
  .big {
    display: grid; gap: .1rem; justify-items: center; padding: .7rem 1rem; min-width: 6.5rem;
    border: 1px solid var(--edge); border-radius: 12px; background: var(--glass);
  }
  .big b { font-family: var(--num); font-size: 2.2rem; line-height: 1; color: var(--gold); }
  .big.safe b { color: var(--good); }
  .big.high b { color: #ff8b7a; }
  .big span { font-size: .64rem; color: var(--dim); text-transform: uppercase; letter-spacing: .06em; }
  .terms { margin: 0; padding-left: 1.1rem; display: grid; gap: .2rem; font-size: .78rem; color: var(--dim); }
  .terms b { color: var(--text); font-family: var(--num); }

  .acts { display: grid; gap: .35rem; }
  .hammer {
    padding: .7rem 1rem; font-size: .95rem; border-radius: 12px;
    border-color: rgba(232, 193, 105, .55); background: rgba(232, 193, 105, .13); color: var(--gold);
  }
  .hammer:disabled { opacity: .5; }
  .refuse { margin: 0; font-size: .72rem; color: #e8a093; }
  .repair, .corrupt { font-size: .76rem; }
  .corrupt { border-color: rgba(108, 81, 153, .7); color: #c8a5ff; }
  .gamble { margin: .1rem 0 0; display: grid; gap: .2rem; }
  .gamble small { color: var(--dim); font-size: .68rem; }

  .result { margin: 0; padding: .4rem .6rem; border-radius: 8px; font-size: .8rem; background: rgba(192, 57, 43, .16); color: #ffb3a8; }
  .result.good { background: rgba(39, 174, 96, .14); color: #9fe0bb; }
  .purse { margin: 0; display: flex; flex-wrap: wrap; gap: .2rem .8rem; font-size: .72rem; color: var(--dim); font-family: var(--num); }

  @media (max-width: 1280px) {
    .press { grid-template-columns: 1fr; }
    .rung .pc, .rung .st { font-size: .58rem; }
  }
</style>
