<script lang="ts">
  import { E, eng, road } from '../engine/client';
  import { modsOn, psMult } from '../sim/curse';
  import { heldWeaponName } from '../sim/game';
  import { fxByMob as bucketFx, plateBeat, plateStrike, plateGesture } from './plate';
  import { fieldLabel } from './hud';
  import { bar, curseWords, statusWords } from './field';
  import { fxOut } from './motion';
  import { elementIcon, mobIcon } from '../icon';
  import { bossMark } from '../icon';
  import faceMark from '../icon/equipment/helmet-1.svg?url';
  import type { GameState, Mob, FxEvent } from '../sim/types';
  import type { Character } from '../sim/player';

  /**
   * The field: the group itself, one plate per mob, plus the character's own card on the near edge.
   *
   * It is the busiest read in the client — every landed blow, both flinches, the walking stride and the
   * clear-ground promise — so it lives in its own component with the transition it owns. It reads the
   * sim's event ring and nothing else: no clock, no state of its own, every gesture mounted by a fact
   * the sim raised (`ui/plate.ts`).
   */
  let { s, c, ring, plates, zone, town, townLive, plateMotion, fxOutMs }: {
    s: GameState; c: Character; ring: FxEvent[]; plates: Mob[]; zone: any;
    town: any; townLive: boolean; plateMotion: number; fxOutMs: number;
  } = $props();

  /** A plate's comings and goings. Only a transition is handed the item the sim removed, so a body that
   *  leaves sinks out of the frame while a death destroys its block at once. */
  function plateLife(node: Element, { duration = 0 }: { duration?: number } = {}) {
    return {
      duration,
      css: (t: number, u: number) => `opacity: ${t}; transform: translateY(${(u * 14).toFixed(1)}px)`,
    };
  }

  /** every blow the ring still holds, in its own mob's bucket, newest first as the ring already is */
  const fxByMob = $derived(bucketFx(ring));
  const selfFx = $derived(ring.filter((e) => e.side === 'self' && e.kind !== 'level' && e.kind !== 'block' && e.kind !== 'proc' && e.kind !== 'taken').slice(0, 5));
  const latestTaken = $derived(ring.find((e) => e.side === 'self' && e.kind === 'taken') || null);
  const latestLand = $derived(ring.find((e) => e.side === 'field' && e.kind === 'hit' && (e.via === 'swing' || e.via === 'cast')) || null);
  const selfArt = $derived(plateGesture(latestTaken, latestLand));

  /** The walking read: one trail of boot prints, a left foot then a right, laid along the walk and lit
   *  from where the walk has reached — the sim's tick drives it, nothing here is a looping animation. */
  const travelTrail = Array.from({ length: 7 }, (_, i) => ({ right: i % 2 === 1, x: i / 6 }));
  const walkPct = $derived.by(() => {
    const w = s.walk;
    if (!w) return 0;
    const part = w.blocksLeft ? 1 - w.secLeft / road.blockSec : 1;
    return Math.min(1, Math.max(0, (w.blocksTotal - w.blocksLeft + part) / w.blocksTotal));
  });

  const hereName = $derived(townLive ? (town?.name ?? 'the field') : zone.name);
</script>

{#each plates as m, mi (m.id)}
  {@const beat = plateBeat(fxByMob, m.id)}
  <!-- the rim and the blade are the same blow: one event answers both, so a plate reads one shape per
       landed hit rather than scanning the ring twice for it -->
  {@const shape = beat}
  {@const strike = plateStrike(ring, m.id)}
  <!-- a mutual exchange: the blow taken and the blow dealt share one second, so the two cards meet
       halfway instead of the attacker running the whole way down -->
  {@const clash = strike && beat && strike.sec === beat.sec}
  <!-- one keyed plate per living body: a death destroys this block at once, no outro kept. A body that
       leaves for any other reason (the zone changed under the walk) sinks out of
       the frame instead, and the row below it slides into its place -->
  <div
    class="mob"
    class:front={mi === 0}
    class:elite={m.kind === 'Elite'}
    class:boss={m.kind.startsWith('Boss')}
    in:plateLife={{ duration: plateMotion }}
    out:plateLife={{ duration: plateMotion }}
  >
    {#if beat}
      <!-- the plate actually struck takes the blow: the rim is remounted on the event's own id, so it is
           one beat per hit rather than a loop the eye learns to ignore. It follows the hit and not the
           front rank, because a DoT tick and an AoE press both land on the bodies behind it -->
      {#key beat.id}
        <span class="flash" style={`--fx:${beat.colour}`}></span>
      {/key}
    {/if}
    {#if shape}
      {#key shape.id}
        {#if shape.via === 'swing'}
          <!-- the weapon's own path: the shelf's crossed swords swept across the body it cut, wearing the
               Element that carried the hit. A DoT tick draws no blade, because none was used -->
          <span class="arc" style={`--fx:${shape.colour}`} aria-hidden="true"></span>
        {:else}
          <!-- a press lands as a burst and not a cut — the same colour rule, a different shape, so the two
               halves of the build read apart before the number is read -->
          <span class="burst" style={`--fx:${shape.colour}`} aria-hidden="true"></span>
        {/if}
      {/key}
    {/if}
    <!-- every landed blow pops its own figure off the plate it hit and rises away: the newest few
         the ring still holds, each keyed on its event so it plays once. A status tick pops small beside
         the cut or burst that caused it, and never takes the rim. A swing the body answered without
         taking pops its word the same way — dodge and miss read where the dodger stands. The rim, the
         blade and the figures stay outside the charge below, so a swing back never replays the hit
         they belong to -->
    <div class="plate-fx" aria-hidden="true">
      {#each (fxByMob.get(m.id) || []).filter((e) => e.kind === 'hit' && e.value).slice(0, 4) as e (e.id)}
        <span class="fx pop" class:crit={e.crit} class:dot={e.via === 'dot'} out:fxOut={{ ms: fxOutMs }} style={`--fx:${e.colour}; --lane:${e.id % 4}`}>{eng.fmt(e.value ?? 0)}{e.crit ? '!' : ''}</span>
      {/each}
      {#each (fxByMob.get(m.id) || []).filter((e) => e.kind === 'block').slice(0, 2) as e (e.id)}
        <span class="fx pop word" out:fxOut={{ ms: fxOutMs }} style={`--fx:${e.colour}; --lane:${e.id % 4}`}>{e.text}</span>
      {/each}
    </div>
    {#key strike ? strike.id : `c${m.id}`}
      <!-- the attack run, keyed on the mob's own swing: this wrapper wears the whole card face, so the
           charge moves the card and not just what is drawn inside it. Remounted per strike so every swing
           reads; the shake inside is keyed on its own event, so being hit and hitting back play together
           instead of one starving or replaying the other. On a mutual exchange it runs halfway, and the
           player's card rises to meet it -->
      <div class="charge" class:lunge={!!strike} class:clash={!!clash}>
    {#key beat ? beat.id : `i${m.id}`}
      <!-- the body takes the blow: one node, remounted on every direct hit, so a fast fight re-stamps
           the flinch instead of looping it -->
      <div class="art" class:knock={!!beat}>
        <img class="portrait" src={mobIcon(m.species)} alt="" aria-hidden="true" />
        <p class="mob-name">{fieldLabel(m)}{#if m.kind.startsWith('Boss')}<img class="tier-mark" src={bossMark} alt="" aria-hidden="true" />{/if}</p>
        <p class="body">{m.kind}</p>
        <span class="mobbar"><i style={bar(m.hp, m.hpMax)}></i><b>{Math.max(0, Math.round(m.hp))} / {Math.round(m.hpMax)}</b></span>
        <p class="chips">
          <span>PS {(m.ps * psMult(modsOn(s.curses, m.id))).toFixed(1)}</span>
          <span>Hit {(eng.hitChance(c.accuracy, m.evasion) * 100).toFixed(1)}%</span>
          <span>Dodge {eng.dodgeChance(m.dodgeRate, c.accuracy).toFixed(1)}%</span>
        </p>
        <p class="element-list">
          {#each m.innate as element}
            <span class="element-label"><img src={elementIcon(element)} alt="" aria-hidden="true" />{element}</span>
          {/each}
        </p>
        <p class="curses">{[curseWords(s, m.id), statusWords(s, m.id)].filter(Boolean).join(' | ') || '—'}</p>
      </div>
    {/key}
      </div>
    {/key}
  </div>
{:else}
  {#if s.walk}
    <!-- The walking read: the shelf's own boot glyph split into single prints, a left foot and a right
         foot laid in a stride, lit from where the walk has reached. It mounts only while the field is
         empty, so a live plate is never covered or out-shouted, and it takes no pointer — the ground
         behind it still pans. -->
    <div class="travel" aria-hidden="true" style={`--p:${walkPct.toFixed(3)}`}>
      {#each travelTrail as d}
        <span class="print" class:right={d.right} style={`--x:${d.x.toFixed(3)}`}></span>
      {/each}
    </div>
  {:else if !s.hunting}
    <!-- ground that fields nothing says so, and says what would change it: a promise that the next
         group walks in is false here, and a player who believes it waits forever -->
    <p class="clear-field">
      <b>No group walks in while the hunt is off.</b>
      <span>Pick a cell on the map, then hunt it.</span>
    </p>
  {:else}
    <p class="clear-field">
      <b>Next group in {Math.max(0, s.spawnIn)} sec.</b>
      <span>{hereName} · levels {zone.levels[0]}–{zone.levels[1]}</span>
    </p>
  {/if}
{/each}

<!-- the character's own card, on the near edge of the field it fights on: a blow that lands here has a
     body to land on at last. It is a read and not a control — no pointer, no gold, and no second copy of
     any number the dock already owns -->
<div class="self-plate" aria-label="Your card" class:clash={!!(latestTaken && latestLand && latestTaken.sec === latestLand.sec)}>
  {#if latestTaken}
    {#key latestTaken.id}
      <span class="flash" style={`--fx:${latestTaken.colour}`}></span>
    {/key}
  {/if}
  <div class="plate-fx" aria-hidden="true">
    {#each ring.filter((e) => e.side === 'self' && e.kind === 'taken' && e.value).slice(0, 3) as e (e.id)}
      <span class="fx pop" out:fxOut={{ ms: fxOutMs }} style={`--fx:${e.colour}; --lane:${e.id % 4}`}>-{eng.fmt(e.value ?? 0)}</span>
    {/each}
    {#each ring.filter((e) => e.side === 'self' && (e.kind === 'block' || e.kind === 'proc')).slice(0, 3) as e (e.id)}
      <span class="fx pop word" out:fxOut={{ ms: fxOutMs }} style={`--fx:${e.colour}; --lane:${e.id % 4}`}>{e.text}</span>
    {/each}
  </div>
  {#key selfArt ? selfArt.id : 'self-idle'}
    <!-- the face wears the paint and both answers: a hit flinches the whole card down, away from the
         blow above, and a landed swing surges it up. Remounted on whichever fact is newer, so one
         gesture plays per beat and the clash on the root composes with it -->
    <div class="cardface" class:knock={selfArt?.gesture === 'knock'} class:lunge={selfArt?.gesture === 'lunge'}>
      <div class="art">
      <img class="portrait" src={faceMark} alt="" aria-hidden="true" />
      <p class="mob-name">You · {heldWeaponName(s) || 'Bare hands'}</p>
      {#if c.es > 0}
        <span class="mobbar es"><i style={bar(s.player.es, c.es)}></i><b>{Math.max(0, Math.round(s.player.es))} / {Math.round(c.es)}</b></span>
      {/if}
      <span class="mobbar"><i style={bar(s.player.hp, c.maxHp)}></i><b>{Math.max(0, Math.round(s.player.hp))} / {Math.round(c.maxHp)}</b></span>
      <span class="mobbar mana"><i style={bar(s.player.mana, c.maxMana)}></i><b>{Math.max(0, Math.round(s.player.mana))} / {Math.round(c.maxMana)}</b></span>
      </div>
    </div>
  {/key}
  <!-- the character's own column rises off the card it belongs to: anchored above the plate, so the
       events that name the character appear where the character stands rather than in a corner of
       the screen no card occupies -->
  <div class="float-side self-side" aria-hidden="true">
    {#each selfFx as e (e.id)}
      <span class="fx fx-{e.kind}" out:fxOut={{ ms: fxOutMs }} style="--fx:{e.colour}; --lane:{e.id % 3}">{e.text}</span>
    {/each}
  </div>
</div>

<style>

  .clear-field span{ font-size: var(--font-xs); letter-spacing: clamp(0px, 0.016vw + 0px, 1px); }

  /* The walking read: the shelf's own boot glyph split into single prints — `mask-size: 200%` puts one boot
     in each half, so a left foot and a right foot alternate down the stride and no second asset is needed.
     Each print mixes the client's own two greys: `--text` for the ground already crossed, `--dim` for the
     country still ahead, and the mix answers to `--p`, the fraction of blocks the walk has crossed. Gold is
     deliberately absent: the accent means *here, or press this*, and a trail is neither. Nothing animates —
     the ramp moves because the sim ticks, so a paused clock stops the read on its own and a reduced-motion
     player loses nothing. The mark is a mask, so it contributes only its alpha — the icon shelf's own white
     never paints the field. */
  /* the tracker's zone switch is also called a travel read, so the stride keeps to the field it sits on */
.travel{ position: relative; width: min(var(--box-300), 62%); height: var(--icon-xl); }

  .travel .print{
    position: absolute; width: var(--icon-lg); height: var(--icon-lg);
    left: calc(var(--x) * (100% - clamp(19px, 1.222vw + 5px, 40px))); top: 0;
    --on: clamp(0, calc((var(--p) - var(--x)) * 3), 1);
    /* the far end of the stride is the same grey a receded HUD read wears, laid on thin: an unlit print that
       is as loud as a lit one would invert the emphasis the ramp exists to make */
    background: color-mix(in srgb, var(--text) calc(var(--on) * 100%),
                color-mix(in srgb, var(--dim) 42%, transparent));
    transform: rotate(-9deg);
    -webkit-mask: url('./icon/equipment/boot-prints.svg') left center / 200% 100% no-repeat;
            mask: url('./icon/equipment/boot-prints.svg') left center / 200% 100% no-repeat;
  }

  /* the other foot: the glyph's far half, dropped half a step and turned the other way, so the two tracks
     read as a stride and not as one stamp repeated */
  .travel .print.right{
    top: clamp(8px, 0.489vw + 2px, 16px);
    transform: rotate(9deg);
    -webkit-mask-position: right center;
            mask-position: right center;
  }

  /* the charge wrapper wears the whole card face, so an attack run moves the card and not just what is
     drawn inside it. The shell above keeps the slot: size, place in the row and the reads pinned to it. */
  .mob .charge{
    --lunge: 1;
    width: 100%; min-height: var(--plate-h); display: flex; flex-direction: column; padding: var(--spacing-xs) var(--spacing-sm) var(--spacing-sm); border-radius: 12px;
    background: var(--glass); border: 1px solid var(--edge); box-shadow: 0 8px 22px rgba(0, 0, 0, .45);
  }

  /* the body fills the card face top to bottom, the way a playing card reads: portrait up top, the
     fight numbers in the middle, the status line pinned to the foot */
  .mob .art{ display: flex; flex-direction: column; align-items: center; flex: 1; }

  /* the fight numbers hug the foot of the card: everything from the first bar down sits on the bottom,
     the portrait and the name keep the head, and the face padding is the breathing room */
  .mob .art > span.mobbar:first-of-type{ margin-top: auto; }

  /* the body the next swing waits on: a lit edge plus a pair of crop marks, steady while it stands in front —
     the struck plate's coloured rim still owns the moment the blow actually lands. The marks are the read that
     survives an elite or a boss border, which out-ranks the edge colour on the same plate. */
  .mob.front .charge{
    border-color: color-mix(in srgb, var(--edge) 20%, var(--text));
    box-shadow: 0 8px 22px rgba(0, 0, 0, .45), 0 0 clamp(12px, 0.815vw + 3px, 27px) color-mix(in srgb, var(--text) 16%, transparent) inset;
  }

  .mob.front .charge::before, .mob.front .charge::after{
    content: ''; position: absolute; width: var(--icon-sm); height: var(--icon-sm); pointer-events: none;
    border: 2.5px solid color-mix(in srgb, var(--text) 90%, transparent);
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, .85));
  }

  .mob.front .charge::before{ top: clamp(-14px, -0.407vw - 2px, -6px); left: clamp(-14px, -0.407vw - 2px, -6px); border-right: 0; border-bottom: 0; border-top-left-radius: 9px; }

  .mob.front .charge::after{ bottom: clamp(-14px, -0.407vw - 2px, -6px); right: clamp(-14px, -0.407vw - 2px, -6px); border-left: 0; border-top: 0; border-bottom-right-radius: 9px; }

  .mob .portrait, .self-plate .portrait{ width: var(--icon-lg); height: var(--icon-lg); object-fit: contain; }

  .mob-name .tier-mark{ width: var(--icon-sm); height: var(--icon-sm); }

  .mob .body{ margin: 0; font-size: var(--font-xs); color: var(--dim); text-transform: uppercase; letter-spacing: clamp(1px, 0.049vw + 0px, 2px); }

  /* The ramp is stretched over the whole track instead of squeezed into the fill: `--w` is the fraction the
     bar reached, so a body's last health shows the hot end of its own colour. Across a group of plates that
     is one red signal read before any digit is looked at. The slide is the sim's own step carried between
     the two seconds it lands in — damage reads as travel, not as a strobe. */
  .mobbar i {
    background-size: calc(100% / max(var(--w, 1), .001)) 100%;
    transition: width .22s ease-out;
  }

  .mobbar i{ display: block; height: 100%; border-radius: 999px; background-image: linear-gradient(90deg, var(--hp-lit), var(--hp)); }

  .mob .chips{ display: flex; flex-wrap: wrap; gap: 1px var(--spacing-xs); justify-content: center; margin: 4px 0 0; font-size: var(--font-xs); color: var(--dim); }

  .mob.elite .charge{ border-color: var(--elite); }

  .mob.elite .mob-name{ color: var(--elite-ink); }

  .mob.boss .charge{ border-color: var(--boss); }

  .mob.boss .mob-name{ color: var(--boss-ink); }

  /* the cardface carries the paint, so every answer moves the whole card: the root keeps the slot only.
       The face is the hub's own avatar read — a round portrait on a dark plinth, the pools under it */
  .self-plate .cardface{
    min-height: var(--plate-h); display: flex; flex-direction: column; align-items: center; justify-content: flex-end;
    padding: var(--spacing-xs) var(--spacing-sm) var(--spacing-sm); border-radius: clamp(10px, 0.75vw, 16px);
    background: linear-gradient(180deg, rgba(23, 29, 40, .62), rgba(8, 11, 16, .78));
    border: 1px solid color-mix(in srgb, var(--gold) 34%, var(--edge));
    box-shadow: 0 6px 22px rgba(0, 0, 0, .5), inset 0 1px 0 rgba(255, 255, 255, .06);
  }

  /* the player's own vitals hug the same foot: the first bar carries the group down */
  .self-plate .art{ display: flex; flex-direction: column; justify-content: flex-start; align-items: center; flex: 1; gap: 4px; }

  .self-plate .art > span.mobbar:first-of-type{ margin-top: auto; }

  .self-plate .portrait{
    width: var(--icon-xl); height: var(--icon-xl); border-radius: 50%;
    border: 2px solid var(--gold); background: var(--glass); padding: var(--spacing-xs);
    box-shadow: 0 0 0 1px rgba(0, 0, 0, .55), 0 2px 10px rgba(0, 0, 0, .5);
  }

  /* Energy Shield sits above HP here exactly as it does in the dock, and only while the pool is there */
  .mobbar.es i{ background-image: linear-gradient(90deg, var(--es), var(--es-lit)); }

  .mobbar.mana i{ background-image: linear-gradient(90deg, var(--mana), var(--mana-lit)); }

  /* The figure a body wears, stamped on the card's top-right corner above its frame. A body pops one
     figure per landed blow — a cut or a burst full-size, a status tick small beside it — each rising away
     on its own life, so a plate shows what was done to it and never a sum. Set large and outlined on all
     four sides so a figure reads over any portrait behind it. */
  .mob .plate-fx, .self-plate .plate-fx{
    position: absolute; left: auto; right: clamp(-9px, -0.285vw - 1px, -4px); top: clamp(-30px, -0.896vw - 3px, -14px); z-index: 3; pointer-events: none;
    display: flex; flex-direction: column-reverse; align-items: flex-end; gap: 1px;
  }

  /* one figure per landed blow on a mob plate: a cut or a burst rises full-size off the card, a status
     tick beside it small — each keyed on its own event, so a burst reads as a shower rather than a sum.
     The figure is white ink on its own dark rim with the Element's bloom behind it, so it reads over any
     portrait the way a hub field prints its damage */
  .plate-fx .pop{
    font-size: var(--font-lg);
    font-weight: 700;
    -webkit-text-stroke: 1px rgba(6, 8, 11, .92);
    color: var(--text);
    text-shadow:
      0 2px 0 rgba(6, 8, 11, .9), 0 -1px 0 rgba(6, 8, 11, .9), 1.5px 0 0 rgba(6, 8, 11, .85), -1.5px 0 0 rgba(6, 8, 11, .85),
      0 0 clamp(9px, 0.57vw + 2px, 19px) color-mix(in srgb, var(--fx, var(--text)) 40%, transparent);
    animation: fx-rise .95s cubic-bezier(.18, .78, .3, 1) forwards;
  }

  .plate-fx .pop.crit{
    font-size: var(--font-xl);
    letter-spacing: clamp(0px, 0.016vw + 0px, 1px);
    -webkit-text-stroke-width: 1.3px;
    color: var(--gold-lit);
    text-shadow:
      0 2px 0 rgba(6, 8, 11, .92), 0 -1px 0 rgba(6, 8, 11, .92), 1.5px 0 0 rgba(6, 8, 11, .88), -1.5px 0 0 rgba(6, 8, 11, .88),
      0 0 clamp(10px, 0.652vw + 3px, 22px) color-mix(in srgb, var(--gold) 55%, transparent);
    animation: fx-crit 1.15s cubic-bezier(.14, .8, .28, 1) forwards;
  }

  .plate-fx .pop.dot{ font-size: var(--font-sm); color: var(--fx, var(--text)); }

  /* pops from one tick cascade instead of landing all at once: the lane each event already carries
     staggers the mount, and the both-fill holds the first frame through the wait so nothing flashes */
  .plate-fx .pop{ animation-fill-mode: both; animation-delay: calc(var(--lane) * 70ms); }

  /* a defense word pops like a number but reads as one: uppercase chip face in the colour of what
     caused it, small beside the figures, never taking the rim */
  .plate-fx .pop.word{
    font-family: var(--ui);
    font-size: var(--font-xs);
    text-transform: uppercase;
    letter-spacing: clamp(1px, 0.049vw + 0px, 2px);
    padding: 1px 4px;
    border: 1px solid color-mix(in srgb, var(--fx, var(--line)) 55%, transparent);
    border-radius: 999px;
    background: color-mix(in srgb, var(--fx, var(--panel)) 14%, transparent);
    animation: fx-rise 1.1s cubic-bezier(.2, .6, .3, 1) forwards;
  }

  .self-plate .cardface.knock{ animation: fx-flinch-down .3s cubic-bezier(.2, .8, .3, 1); }

  /* a landed swing surges the striker's own card up toward its victim — a lean, not a leap */
  .self-plate .cardface.lunge{ animation: fx-surge .35s cubic-bezier(.3, .7, .3, 1); }

  /* a swing draws the shelf's crossed swords across the body it cut, turned through the strike. A mask
     contributes only alpha, so the Element that carried the hit paints the blade. */
  .mob .arc{
    position: absolute; left: 50%; top: clamp(24px, 1.548vw + 6px, 51px); z-index: 4; pointer-events: none;
    width: var(--icon-xl); height: var(--icon-xl); margin: var(--x-pull-arc) 0 0 var(--x-pull-arc);
    background: var(--fx, var(--text));
    -webkit-mask: url('./icon/weapon/crossed-swords-1.svg') center / contain no-repeat;
            mask: url('./icon/weapon/crossed-swords-1.svg') center / contain no-repeat;
    animation: fx-arc .26s ease-out forwards;
  }

  /* a press lands as a burst and not a cut, so the two halves of a build read apart before a number is read */
  .mob .burst{
    position: absolute; left: 50%; top: clamp(24px, 1.548vw + 6px, 51px); z-index: 4; pointer-events: none;
    width: var(--icon-lg); height: var(--icon-lg); margin: var(--x-pull-burst) 0 0 var(--x-pull-burst);
    border: 2px solid var(--fx, var(--text)); border-radius: 50%;
    animation: fx-burst .34s ease-out forwards;
  }

@media (min-width: 1600px) {
  
      .mob .charge{ padding: var(--spacing-sm) var(--spacing-sm) var(--spacing-sm); }
  
      .mob .portrait, .self-plate .portrait{ width: var(--icon-xl); height: var(--icon-xl); }
}
</style>
