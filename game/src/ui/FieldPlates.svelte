<script lang="ts">
  import { E, eng, road, sm } from '../engine/client';
  import { modsOn, psMult } from '../sim/curse';
  import { fxByMob as bucketFx, plateBeat, plateStrike, plateGesture } from './plate';
  import { fieldLabel, mechanicWords } from './hud';
  import { bar, curseWords, statusWords } from './field';
  import { fxOut } from './motion';
  import { elementIcon, mobIcon, skillIcon } from '../icon';
  import { statusLabel } from '../sim/mobStatus';
  import { ownsSkill } from '../sim/skills';
  import { bossMark } from '../icon';
  import faceMark from '../icon/equipment/helmet-1.svg?url';
  import alignMark from '../icon/currency/attribute-dexterity.svg?url';
  import type { GameState, Mob, FxEvent } from '../sim/types';
  import type { Character } from '../sim/player';
  import type { Statuses, StatusName } from '../sim/combat';

  /**
   * The field: the group itself, one plate per mob, plus the character's own card on the near edge.
   *
   * It is the busiest read in the client — every landed blow, both flinches, the walking stride and the
   * clear-ground promise — so it lives in its own component with the transition it owns. It reads the
   * sim's event ring and nothing else: no clock, no state of its own, every gesture mounted by a fact
   * the sim raised (`ui/plate.ts`).
   */
  let { s, c, ring, plates, statuses, zone, town, townLive, vitals, plateMotion, fxOutMs }: {
    s: GameState; c: Character; ring: FxEvent[]; plates: Mob[]; statuses: Statuses; zone: any;
    town: any; townLive: boolean; vitals: { hp: number; es: number; mana: number }; plateMotion: number; fxOutMs: number;
  } = $props();

  function defenseColour(text: string) {
    const answer = text.toLowerCase();
    if (answer.includes('block')) return 'var(--es-lit)';
    if (answer.includes('evasion')) return 'var(--good-lit)';
    if (answer.includes('dodge')) return 'var(--gold-lit)';
    if (answer.includes('miss')) return 'var(--dim)';
    return 'var(--focus)';
  }

  const shortTime = (secs: number) => secs >= 60 ? `${Math.ceil(secs / 60)}m` : String(secs);

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
  const selfFx = $derived(ring.filter((e) => e.side === 'self' && e.kind !== 'travel' && e.kind !== 'level' && e.kind !== 'block' && e.kind !== 'proc' && e.kind !== 'taken').slice(0, 5));
  const latestTaken = $derived(ring.find((e) => e.side === 'self' && e.kind === 'taken') || null);
  const latestLand = $derived(ring.find((e) => e.side === 'field' && e.kind === 'hit' && (e.via === 'swing' || e.via === 'cast')) || null);
  const selfArt = $derived(plateGesture(latestTaken, latestLand));

  const STATUS_ELEMENT: Record<StatusName, string> = {
    burn: 'fire', chill: 'cold', shock: 'lightning', poison: 'poison', bleed: 'physical', mark: 'chaos', crippled: 'earth',
  };
  const buffMarks = $derived.by(() => {
    void s.clockSec;
    const marks: { id: string; label: string; icon: string; secs: number | null }[] = [];
    for (const skill of sm.of('buff') as any[]) {
      const left = s.skills.buffUp[skill.id] || 0;
      if (ownsSkill(s.skills, skill.id) && s.skills.buffs[skill.id] && left > 0) {
        marks.push({ id: skill.id, label: skill.name, icon: skillIcon(skill.id, 'buff'), secs: Math.ceil(left) });
      }
    }
    for (const skill of sm.of('aura') as any[]) {
      if (ownsSkill(s.skills, skill.id) && s.skills.auras[skill.id]) {
        marks.push({ id: skill.id, label: skill.name, icon: skillIcon(skill.id, 'aura'), secs: null });
      }
    }
    return marks;
  });
  const debuffMarks = $derived.by(() => {
    void s.clockSec;
    return (Object.entries(statuses) as [StatusName, { stacks: number; secLeft: number }][])
      .filter(([, status]) => status && status.secLeft > 0)
      .map(([name, status]) => ({
        name, label: statusLabel(name), icon: elementIcon(STATUS_ELEMENT[name]),
        stacks: status.stacks, secs: Math.ceil(status.secLeft),
      }));
  });

  let selfBodyEl = $state<HTMLDivElement>();
  let lastLungeId = -1;
  let lungeAnimation: Animation | null = null;
  $effect(() => {
    const hit = latestLand;
    const node = selfBodyEl;
    if (!hit || !node || hit.id === lastLungeId) return;
    lastLungeId = hit.id;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const frame = requestAnimationFrame(() => {
      if (!node.isConnected) return;
      const field = node.closest('.field') as HTMLElement | null;
      if (!field) return;
      const mobs = Array.from(field.querySelectorAll<HTMLElement>('.mob'));
      const target = mobs.find((mob) => mob.dataset.mobId === hit.mobId) || mobs[0];
      const sourceRect = node.getBoundingClientRect();
      const targetRect = target?.getBoundingClientRect() || field.getBoundingClientRect();
      const targetX = targetRect.left + targetRect.width / 2;
      const targetY = target ? targetRect.top + targetRect.height / 2 : targetRect.top + targetRect.height * .24;
      const dx = (targetX - sourceRect.left - sourceRect.width / 2) * .78;
      const dy = (targetY - sourceRect.top - sourceRect.height / 2) * .78;
      const windup = sourceRect.height * .08;
      lungeAnimation?.cancel();
      lungeAnimation = node.animate([
        { transform: 'translate(0, 0) scale(1)', offset: 0 },
        { transform: `translate(0, ${windup}px) scale(.97)`, offset: .16 },
        { transform: `translate(${dx}px, ${dy}px) rotate(${Math.sign(dx) * 4}deg) scale(1.09)`, offset: .47 },
        { transform: `translate(${dx * .88}px, ${dy * .88}px) scale(1.04)`, offset: .60 },
        { transform: 'translate(0, 0) scale(1)', offset: 1 },
      ], { duration: 500, easing: 'cubic-bezier(.2, .75, .3, 1)' });
    });
    return () => cancelAnimationFrame(frame);
  });

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
    data-mob-id={m.id}
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
        <span class="fx pop word" out:fxOut={{ ms: fxOutMs }} style={`--fx:${defenseColour(e.text)}; --lane:${e.id % 4}`}>{e.text}</span>
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
        <div class="mob-head">
          <span class="race-mark" role="img" aria-label={`Race: ${m.species}`} title={`Race · ${m.species}`}>
            <img src={mobIcon(m.species)} alt="" aria-hidden="true" />
          </span>
          <div class="identity">
            <img class="portrait" src={mobIcon(m.species)} alt="" aria-hidden="true" />
            <div class="identity-text">
              <p class="mob-name">{fieldLabel(m)}{#if m.kind.startsWith('Boss')}<img class="tier-mark" src={bossMark} alt="" aria-hidden="true" />{/if}</p>
              <p class="body">{[m.kind, ...mechanicWords(m)].join(' · ')}</p>
            </div>
          </div>
          {#each m.innate as element}
            <span class="innate-mark" role="img" aria-label={`Innate Element: ${element}`} title={`Innate · ${element}`}>
              <img src={elementIcon(element)} alt="" aria-hidden="true" />
            </span>
          {/each}
        </div>
        <span class="mobbar"><i style={bar(m.hp, m.hpMax)}></i><b>{Math.max(0, Math.round(m.hp))} / {Math.round(m.hpMax)}</b></span>
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
<div class="self-plate" aria-label="Your card">
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
      <span class="fx pop word" out:fxOut={{ ms: fxOutMs }} style={`--fx:${defenseColour(e.text)}; --lane:${e.id % 4}`}>{e.text}</span>
    {/each}
  </div>
  <div class="self-body" bind:this={selfBodyEl}>
    <div class="effect-rail buffs" role="list" aria-label="Active buffs and auras">
      {#each buffMarks as mark (mark.id)}
        <span class="effect-badge buff" role="listitem"
              aria-label={`${mark.label}${mark.secs != null ? `, ${mark.secs} seconds left` : ', aura active'}`}
              title={`${mark.label}${mark.secs != null ? ` · ${mark.secs}s left` : ' · aura active'}`}>
          <img src={mark.icon} alt="" aria-hidden="true" />
          {#if mark.secs != null}<small>{shortTime(mark.secs)}</small>{/if}
        </span>
      {/each}
    </div>
    <div class="effect-rail ailments" role="list" aria-label="Status alignment and debuffs">
      <span class="effect-badge alignment" role="listitem" aria-label={`Status alignment ${c.alignment.toFixed(1)}%`}
            title={`Status alignment ${c.alignment.toFixed(1)}%`}>
        <img src={alignMark} alt="" aria-hidden="true" />
        <small>{Math.round(c.alignment)}</small>
      </span>
      {#each debuffMarks as mark (mark.name)}
        <span class="effect-badge debuff" role="listitem"
              aria-label={`${mark.label}${mark.stacks > 1 ? `, ${mark.stacks} stacks` : ''}, ${mark.secs} seconds left`}
              title={`${mark.label}${mark.stacks > 1 ? ` ×${mark.stacks}` : ''} · ${mark.secs}s left`}>
          <img src={mark.icon} alt="" aria-hidden="true" />
          <small>{shortTime(mark.secs)}</small>
        </span>
      {/each}
    </div>
  {#key selfArt ? selfArt.id : 'self-idle'}
    <!-- The card body is remounted for its flinch; the surrounding effect circles travel with the
         stable wrapper when a landed attack lunges toward the body it struck. -->
    <div class="cardface" class:knock={selfArt?.gesture === 'knock' && latestTaken?.sec !== latestLand?.sec}>
      <div class="art">
      <div class="identity">
        <img class="portrait" src={faceMark} alt="" aria-hidden="true" />
        <div class="identity-text">
          <p class="mob-name">You</p>
        </div>
      </div>
      {#if c.es > 0}
        <span class="mobbar es"><i style={bar(vitals.es, c.es)}></i><b>{Math.max(0, Math.round(vitals.es))} / {Math.round(c.es)}</b></span>
      {/if}
      <span class="mobbar"><i style={bar(vitals.hp, c.maxHp)}></i><b>{Math.max(0, Math.round(vitals.hp))} / {Math.round(c.maxHp)}</b></span>
      <span class="mobbar mana"><i style={bar(vitals.mana, c.maxMana)}></i><b>{Math.max(0, Math.round(vitals.mana))} / {Math.round(c.maxMana)}</b></span>
      </div>
    </div>
  {/key}
  </div>
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

  .clear-field span{ font-size: var(--font-xs); letter-spacing: clamp(0px, 0.00vw, 1px); }

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
    left: calc(var(--x) * (100% - clamp(19px, 1.45vw, 40px))); top: 0;
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
    top: clamp(8px, 0.58vw, 16px);
    transform: rotate(9deg);
    -webkit-mask-position: right center;
            mask-position: right center;
  }

  /* the charge wrapper wears the whole card face, so an attack run moves the card and not just what is
     drawn inside it. The shell above keeps the slot: size, place in the row and the reads pinned to it. */
  .mob .charge{
    --lunge: 1;
    width: 100%; height: 100%; min-height: 0; display: flex; flex-direction: column; padding: var(--spacing-sm); border-radius: var(--spacing-md);
    background: color-mix(in srgb, var(--face-floor) 92%, transparent);
    border: 1px solid var(--edge); box-shadow: 0 8px 22px rgba(0, 0, 0, .45);
  }

  /* the body fills the card face top to bottom, the way a playing card reads: portrait up top, the
     fight numbers in the middle, the status line pinned to the foot */
  .mob .art{ display: flex; flex-direction: column; align-items: stretch; flex: 1; min-width: 0; }

  .mob { position: relative; width: var(--card-w); aspect-ratio: 5 / 7; text-align: left; pointer-events: auto; }

  .self-plate {
    position: absolute; left: 50%; bottom: var(--spacing-lg); z-index: 2;
    width: var(--card-w); aspect-ratio: 5 / 7; transform: translateX(-50%); text-align: left; pointer-events: none;
  }
  .self-body { position: relative; width: 100%; height: 100%; }
  .effect-rail {
    position: absolute; top: 0; z-index: 6; display: flex; flex-direction: column; gap: var(--spacing-xs);
    pointer-events: none;
  }
  .effect-rail.buffs { right: calc(100% + var(--spacing-xs)); }
  .effect-rail.ailments { left: calc(100% + var(--spacing-xs)); }
  .effect-badge {
    position: relative; display: grid; place-items: center; width: var(--icon-md); height: var(--icon-md);
    border: 1px solid var(--edge); border-radius: 50%; background: var(--glass);
    box-shadow: 0 2px 8px rgba(0, 0, 0, .6); pointer-events: auto;
  }
  .effect-badge.buff { border-color: color-mix(in srgb, var(--good-lit) 60%, var(--edge)); }
  .effect-badge.debuff { border-color: color-mix(in srgb, var(--alarm) 70%, var(--edge)); }
  .effect-badge.alignment { border-color: color-mix(in srgb, var(--gold) 65%, var(--edge)); }
  .effect-badge img { width: var(--icon-sm); height: var(--icon-sm); object-fit: contain; }
  .effect-badge small {
    position: absolute; right: 0; bottom: 0; max-width: 100%; overflow: hidden;
    color: var(--text); font-size: var(--font-xs); line-height: 1; font-family: var(--num);
    text-shadow: 0 1px 2px var(--bg); transform: scale(.72); transform-origin: right bottom;
  }

  /* the fight numbers hug the foot of the card: everything from the first bar down sits on the bottom,
     the portrait and the name keep the head, and the face padding is the breathing room */
  .mob .art > span.mobbar:first-of-type{ margin-top: auto; }

  /* the body the next swing waits on: a lit edge plus a pair of crop marks, steady while it stands in front —
     the struck plate's coloured rim still owns the moment the blow actually lands. The marks are the read that
     survives an elite or a boss border, which out-ranks the edge colour on the same plate. */
  .mob.front .charge{ border-color: var(--gold); }

  .mob.front .charge::before, .mob.front .charge::after{
    content: ''; position: absolute; width: var(--icon-sm); height: var(--icon-sm); pointer-events: none;
    border: 2.5px solid color-mix(in srgb, var(--text) 90%, transparent);
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, .85));
  }

  .mob.front .charge::before{ top: var(--x-pull-scale); left: var(--x-pull-scale); border-right: 0; border-bottom: 0; border-top-left-radius: 9px; }

  .mob.front .charge::after{ bottom: var(--x-pull-scale); right: var(--x-pull-scale); border-left: 0; border-top: 0; border-bottom-right-radius: 9px; }

  .mob-head { display: grid; grid-template-columns: var(--icon-md) minmax(0, 1fr) var(--icon-md); align-items: start; gap: var(--spacing-2xs); width: 100%; min-width: 0; }
  .race-mark, .innate-mark { display: grid; place-items: center; width: var(--icon-md); height: var(--icon-md); border: 1px solid var(--hud-edge); border-radius: 50%; background: var(--glass); box-shadow: 0 2px 8px rgba(0, 0, 0, .45); }
  .race-mark img, .innate-mark img { width: var(--icon-sm); height: var(--icon-sm); object-fit: contain; }
  .mob-head .identity { min-width: 0; }

  /* the card head is a column: the body's own portrait on top and centred, its name under it. A mob
     is recognised by its shape before its words, so the face leads rather than sitting beside the
     text it labels. */
  .identity{ display: flex; flex-direction: column; align-items: center; justify-items: center; gap: var(--spacing-3xs); min-width: 0; text-align: center; }
  .identity-text{ display: grid; justify-items: center; min-width: 0; }
  .mob .portrait, .self-plate .portrait{ width: calc(var(--icon-lg) * 4 / 5); height: calc(var(--icon-lg) * 4 / 5); flex: none; object-fit: contain; }

  .mob-name .tier-mark{ width: var(--icon-sm); height: var(--icon-sm); }

  .mob .body, .self-plate .body{ margin: 0; font-size: var(--font-xs); color: var(--dim); }

  .mob-name { display: flex; align-items: center; justify-content: center; gap: var(--spacing-2xs); max-width: 100%; margin: 0; overflow-wrap: anywhere; font-size: var(--font-sm); font-weight: 600; line-height: 1.15; }

  .mobbar { display: block; position: relative; width: 100%; height: var(--spacing-sm); margin: var(--spacing-3xs) 0; border-radius: 999px; overflow: hidden; background: rgba(255, 255, 255, .09); }

  /* the figure sits in the bar the way the dock's own gauges read: centred, tabular, stroked off the fill */
  .mobbar b {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    max-width: 100%; overflow: hidden; white-space: nowrap; font-size: var(--spacing-sm); font-weight: 600; color: var(--text); font-variant-numeric: tabular-nums;
    text-shadow: 0 1px 2px rgba(0, 0, 0, .95); pointer-events: none;
  }

  .clear-field b { color: var(--text); font-weight: 600; }
  .curses { min-width: 0; max-width: 100%; margin: auto 0 0; overflow: hidden; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; font-size: var(--font-xs); color: var(--curse); min-height: var(--icon-xs); }

  /* The ramp is stretched over the whole track instead of squeezed into the fill: `--w` is the fraction the
     bar reached, so a body's last health shows the hot end of its own colour. Across a group of plates that
     is one red signal read before any digit is looked at. The slide is the sim's own step carried between
     the two seconds it lands in — damage reads as travel, not as a strobe. */
  .mobbar i {
    width: 100%; transform: scaleX(var(--fill)); transform-origin: left center;
    background-size: calc(100% / max(var(--w, 1), .001)) 100%;
    transition: transform .65s cubic-bezier(.2, .8, .2, 1);
  }

  .mobbar i{ display: block; height: 100%; border-radius: 999px; background-image: linear-gradient(90deg, var(--hp-lit), var(--hp)); }

  .mob.elite .charge{ border-color: var(--elite); }

  .mob.elite .mob-name{ color: var(--elite-ink); }

  .mob.boss .charge{ border-color: var(--boss); }

  .mob.boss .mob-name{ color: var(--boss-ink); }

  /* the cardface carries the paint, so every answer moves the whole card: the root keeps the slot only.
       The face is the hub's own avatar read — a round portrait on a dark plinth, the pools under it */
  .self-plate .cardface{
    height: 100%; min-height: 0; display: flex; flex-direction: column;
    padding: var(--spacing-sm); border-radius: var(--spacing-md);
    background: color-mix(in srgb, var(--face-floor) 92%, transparent);
    border: 1px solid color-mix(in srgb, var(--gold) 34%, var(--edge));
    box-shadow: 0 6px 22px rgba(0, 0, 0, .5), inset 0 1px 0 rgba(255, 255, 255, .06);
  }

  /* the player's own vitals hug the same foot: the first bar carries the group down */
  .self-plate .art{ display: flex; flex-direction: column; align-items: stretch; flex: 1; width: 100%; gap: var(--spacing-3xs); }

  .self-plate .art > span.mobbar:first-of-type{ margin-top: auto; }

  .self-plate .portrait{
    border-radius: 50%; border: 1px solid var(--gold); background: var(--face-top); padding: var(--spacing-2xs);
  }

  /* Energy Shield sits above HP here exactly as it does in the dock, and only while the pool is there */
  .mobbar.es i{ background-image: linear-gradient(90deg, var(--es), var(--es-lit)); }

  /* Player meters receive an already eased live value from the HUD, so the keyed hit flinch cannot snap them. */
  .self-plate .mobbar i { transition: none; }

  .mobbar.mana i{ background-image: linear-gradient(90deg, var(--mana), var(--mana-lit)); }

  /* Each number starts at the body struck, fans into its own lane, then lifts clear of the card. */
  .mob .plate-fx, .self-plate .plate-fx{
    position: absolute; inset: 0; z-index: 7; pointer-events: none;
  }

  .plate-fx .pop{
    position: absolute; left: 50%; top: 32%; white-space: nowrap;
    padding: var(--spacing-xs); font-family: var(--num); font-size: var(--font-lg); font-weight: 800;
    -webkit-text-stroke: 1px var(--bg);
    color: color-mix(in srgb, var(--fx, var(--text)) 25%, var(--text));
    background: radial-gradient(ellipse, color-mix(in srgb, var(--bg) 78%, transparent), transparent 72%);
    text-shadow: 0 2px 3px rgba(0, 0, 0, .95),
                 0 0 var(--spacing-md) color-mix(in srgb, var(--fx, var(--text)) 45%, transparent);
    animation: plate-number 1.1s cubic-bezier(.18, .78, .3, 1) both;
    animation-delay: calc(var(--lane) * 70ms);
  }

  .plate-fx .pop.crit{
    font-size: var(--font-xl);
    letter-spacing: 1px; -webkit-text-stroke-width: 1.3px;
    color: var(--gold-lit);
    text-shadow: 0 2px 3px rgba(0, 0, 0, .95),
                 0 0 var(--spacing-lg) color-mix(in srgb, var(--gold) 62%, transparent);
    animation-name: plate-crit-number; animation-duration: 1.25s;
  }

  .plate-fx .pop.dot{ font-size: var(--font-sm); animation-duration: .8s; }
  .self-plate .plate-fx .pop:not(.word) { color: var(--alarm); }

  /* A defence word keeps a small plate face, apart from the larger damage figures. */
  .plate-fx .pop.word{
    top: var(--spacing-xs);
    font-family: var(--ui);
    font-size: var(--font-xs);
    text-transform: uppercase;
    letter-spacing: 1px;
    padding: var(--seam) var(--spacing-2xs);
    border: 1px solid color-mix(in srgb, var(--fx, var(--line)) 55%, transparent);
    border-radius: 999px;
    background: var(--glass);
    color: var(--fx, var(--text));
    animation-duration: 1.1s;
  }

  .mob .art.knock { animation: plate-mob-knock .3s cubic-bezier(.2, .8, .3, 1); }
  .mob .charge.lunge { --reach: var(--box-100); animation: plate-mob-charge .45s cubic-bezier(.3, .7, .3, 1); }
  .mob .charge.lunge.clash { --reach: calc(var(--box-100) / 2); }
  .self-plate .cardface.knock { animation: plate-self-knock .3s cubic-bezier(.2, .8, .3, 1); }
  .mob .flash, .self-plate .flash {
    position: absolute; inset: -1px; z-index: 4; border: 1px solid var(--fx, var(--edge));
    border-radius: var(--spacing-md); pointer-events: none;
    box-shadow: inset 0 0 var(--spacing-sm) color-mix(in srgb, var(--fx, var(--text)) 58%, transparent);
    animation: plate-flash .32s ease-out forwards;
  }

  @keyframes plate-number {
    0% { opacity: 0; transform: translate(calc(-50% + var(--lane) * var(--spacing-md) - var(--spacing-lg)), var(--spacing-md)) scale(.7); }
    20% { opacity: 1; transform: translate(calc(-50% + var(--lane) * var(--spacing-md) - var(--spacing-lg)), calc(-1 * var(--spacing-xs))) scale(1.16); }
    60% { opacity: 1; transform: translate(calc(-50% + var(--lane) * var(--spacing-md) - var(--spacing-lg)), calc(-1 * var(--spacing-lg))) scale(1); }
    100% { opacity: 0; transform: translate(calc(-50% + var(--lane) * var(--spacing-md) - var(--spacing-lg)), calc(-1 * var(--box-100))) scale(.94); }
  }
  @keyframes plate-crit-number {
    0% { opacity: 0; transform: translate(calc(-50% + var(--lane) * var(--spacing-md) - var(--spacing-lg)), var(--spacing-md)) scale(.6); }
    24% { opacity: 1; transform: translate(calc(-50% + var(--lane) * var(--spacing-md) - var(--spacing-lg)), calc(-1 * var(--spacing-sm))) scale(1.4); }
    52% { opacity: 1; transform: translate(calc(-50% + var(--lane) * var(--spacing-md) - var(--spacing-lg)), calc(-1 * var(--spacing-lg))) scale(1.06); }
    100% { opacity: 0; transform: translate(calc(-50% + var(--lane) * var(--spacing-md) - var(--spacing-lg)), calc(-1 * var(--box-100))) scale(.96); }
  }
  @keyframes plate-mob-knock {
    0%, 100% { transform: none; }
    30% { transform: translateY(calc(-1 * var(--spacing-sm))) scale(.98); }
    60% { transform: translateY(2px); }
  }
  @keyframes plate-self-knock {
    0%, 100% { transform: none; }
    30% { transform: translateY(var(--spacing-sm)) scale(.98); }
    60% { transform: translateY(-2px); }
  }
  @keyframes plate-mob-charge {
    0%, 100% { transform: none; }
    18% { transform: translateY(calc(-1 * var(--spacing-xs))) scale(.98); }
    50% { transform: translateY(var(--reach)) scale(1.09); }
    64% { transform: translateY(calc(var(--reach) * .86)) scale(1.04); }
  }
  @keyframes plate-flash {
    0%, 100% { opacity: 0; }
    36% { opacity: 1; }
  }

  /* a swing draws the shelf's crossed swords across the body it cut, turned through the strike. A mask
     contributes only alpha, so the Element that carried the hit paints the blade. */
  .mob .arc{
    position: absolute; left: 50%; top: clamp(24px, 1.84vw, 51px); z-index: 4; pointer-events: none;
    width: var(--icon-xl); height: var(--icon-xl); margin: var(--x-pull-arc) 0 0 var(--x-pull-arc);
    background: var(--fx, var(--text));
    -webkit-mask: url('./icon/weapon/crossed-swords-1.svg') center / contain no-repeat;
            mask: url('./icon/weapon/crossed-swords-1.svg') center / contain no-repeat;
    animation: plate-arc .26s ease-out forwards;
  }

  /* a press lands as a burst and not a cut, so the two halves of a build read apart before a number is read */
  .mob .burst{
    position: absolute; left: 50%; top: clamp(24px, 1.84vw, 51px); z-index: 4; pointer-events: none;
    width: var(--icon-lg); height: var(--icon-lg); margin: var(--x-pull-burst) 0 0 var(--x-pull-burst);
    border: 2px solid var(--fx, var(--text)); border-radius: 50%;
    animation: plate-burst .34s ease-out forwards;
  }

  @keyframes plate-arc {
    0% { opacity: 0; transform: translate(calc(-1 * var(--spacing-md)), var(--spacing-sm)) rotate(-42deg) scale(.7); }
    35% { opacity: .95; }
    100% { opacity: 0; transform: translate(var(--spacing-md), calc(-1 * var(--spacing-sm))) rotate(16deg) scale(1.12); }
  }
  @keyframes plate-burst {
    0% { opacity: 0; transform: scale(.35); }
    25% { opacity: .9; }
    100% { opacity: 0; transform: scale(1.55); }
  }

</style>
