<script lang="ts">
  import { E, eng, sm } from '../engine/client';
  import { castForHit, fxByMob as bucketFx, plateBeat, plateStrike, windupOf } from './plate';
  import { fieldLabel } from './hud';
  import { bar } from './field';
  import { fxOut } from './motion';
  import { elementIcon, mobIcon, skillIcon } from '../icon';
  import { bossMark } from '../icon';
  import Icon from './Icon.svelte';
  import PlayerVitalCard from './PlayerVitalCard.svelte';
  import { statusLabel, type MobStatusName } from '../sim/mobStatus';
  import { mobSkillById } from '../sim/mobSkills';
  import type { GameState, Mob, FxEvent } from '../sim/types';
  import type { Character } from '../sim/player';
  import type { Statuses } from '../sim/combat';

  /**
   * The field: one plate per mob and the Player Vital Card at the original near edge of the combat scene.
   *
   * It is the busiest read in the client — every landed blow, both flinches and the clear-ground
   * promise — so it lives in its own component with the transition it owns. It reads the
   * sim's event ring and nothing else: no clock, no state of its own, every gesture mounted by a fact
   * the sim raised (`ui/plate.ts`).
   */
  let { s, c, ring, plates, statuses, zone, town, townLive, vitals, reserved, onSheet,
    fmtNum, selfFx, plateMotion, fxOutMs }: {
    s: GameState; c: Character; ring: FxEvent[]; plates: Mob[]; statuses: Statuses; zone: any;
    town: any; townLive: boolean; vitals: { hp: number; es: number; mana: number }; reserved: number;
    onSheet: () => void; fmtNum: (n: number) => string; selfFx: FxEvent[];
    plateMotion: number; fxOutMs: number;
  } = $props();

  function defenseColour(text: string) {
    const answer = text.toLowerCase();
    if (answer.includes('block')) return 'var(--es-lit)';
    if (answer.includes('evasion')) return 'var(--good-lit)';
    if (answer.includes('dodge')) return 'var(--gold-lit)';
    if (answer.includes('miss')) return 'var(--dim)';
    return 'var(--focus)';
  }

  const shortTime = (secs: number) => secs >= 60 ? `${Math.ceil(secs / 60)}m` : `${Math.ceil(secs)}s`;
  const statusElement = (name: string) =>
    Object.entries(E.elements.status_of as Record<string, string>).find(([, status]) => status === name)?.[0] || 'physical';

  function mobDebuffMarks(mobId: string) {
    void s.clockSec;
    const marks: { id: string; label: string; icon: string; secs: number | null; stacks: number }[] = [];
    const mobStatuses = s.mobStatus[mobId]?.statuses || {};
    for (const [name, line] of Object.entries(mobStatuses) as [MobStatusName, { stacks: number; secLeft: number }][]) {
      if (line.stacks <= 0 && line.secLeft <= 0) continue;
      marks.push({
        id: `status-${name}`, label: statusLabel(name), icon: elementIcon(statusElement(name)),
        secs: line.secLeft > 0 ? line.secLeft : null, stacks: line.stacks,
      });
    }

    const curses = new Map<string, { label: string; icon: string; secs: number; stacks: number }>();
    for (const [key, line] of Object.entries(s.curses[mobId] || {})) {
      if (line.secLeft <= 0) continue;
      const skillId = line.from || key;
      const current = curses.get(skillId);
      curses.set(skillId, {
        label: sm.byId[skillId]?.name || skillId,
        icon: skillIcon(skillId, 'curse'),
        secs: Math.max(current?.secs || 0, line.secLeft),
        stacks: 1,
      });
    }
    for (const [id, curse] of curses) marks.push({ id: `curse-${id}`, ...curse });
    return marks;
  }

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

  /** The walking read is the one word on the field: a walk is a clock, so nothing here counts its blocks. */


  const hereName = $derived(townLive ? (town?.name ?? 'the field') : zone.name);
</script>

{#if plates.length}
<div class="plate-row">
{#each plates as m, mi (m.id)}
  {@const beat = plateBeat(fxByMob, m.id)}
  <!-- the rim and the blade are the same blow: one event answers both, so a plate reads one shape per
       landed hit rather than scanning the ring twice for it -->
  {@const shape = beat}
  {@const strike = plateStrike(ring, m.id)}
  <!-- a mutual exchange: the blow taken and the blow dealt share one second, so the two cards meet
       halfway instead of the attacker running the whole way down -->
  {@const clash = strike && beat && strike.sec === beat.sec}
  {@const mobDebuffs = mobDebuffMarks(m.id)}
  {@const castHit = (fxByMob.get(m.id) || []).find((e) => e.kind === 'hit' && e.via === 'cast')}
  {@const castEvent = castForHit(ring, castHit)}
  {@const castSkill = castEvent?.skillId ? sm.byId[castEvent.skillId] : null}
  {@const casting = !!castSkill && !!castHit && s.clockSec - castHit.sec <= 1}
  {@const mobCast = (fxByMob.get(m.id) || []).find((e) => e.kind === 'cast')}
  {@const auraNames = (m.auraSources || []).map((aura) => mobSkillById(aura.id)?.name).filter((name): name is string => !!name)}
  {@const windup = windupOf(m)}
  <!-- one keyed plate per living body: a death destroys this block at once, no outro kept. A body that
       leaves for any other reason (the zone changed under the walk) sinks out of
       the frame instead, and the row below it slides into its place -->
  <div
    class="mob"
    data-mob-id={m.id}
    class:front={mi === 0}
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
        <span class="fx pop pop-damage" class:critical={e.crit} class:dot={e.via === 'dot'} out:fxOut={{ ms: fxOutMs }} style={`--fx:${e.colour}; --lane:${e.id % 4}`}>{eng.fmt(e.value ?? 0)}{e.crit ? '!' : ''}</span>
      {/each}
      {#each (fxByMob.get(m.id) || []).filter((e) => e.kind === 'block').slice(0, 2) as e (e.id)}
        <span class="fx pop pop-word" out:fxOut={{ ms: fxOutMs }} style={`--fx:${defenseColour(e.text)}; --lane:${e.id % 4}`}>{e.text}</span>
      {/each}
      {#if mobCast}
        <span class="fx pop pop-word mob-cast-word" out:fxOut={{ ms: fxOutMs }} style={`--fx:${mobCast.colour}; --lane:0`}>{mobCast.text}</span>
      {/if}
    </div>
    {#if auraNames.length}
      <span class="mob-aura" title={auraNames.join(' · ')} aria-label={`Aura: ${auraNames.join(', ')}`}>{auraNames[0]}{auraNames.length > 1 ? ` +${auraNames.length - 1}` : ''}</span>
    {/if}
    {#if mobDebuffs.length}
      <div class="mob-debuff-rail" role="list" aria-label={`${fieldLabel(m)} debuffs`}>
        {#each mobDebuffs as mark (mark.id)}
          <span class="mob-status-badge badge badge-status debuff" role="listitem"
                aria-label={`${mark.label}${mark.stacks > 1 ? `, ${mark.stacks} stacks` : ''}${mark.secs != null ? `, ${Math.ceil(mark.secs)} seconds left` : ''}`}
                title={`${mark.label}${mark.stacks > 1 ? ` ×${mark.stacks}` : ''}${mark.secs != null ? ` · ${Math.ceil(mark.secs)}s left` : ''}`}>
            <Icon src={mark.icon} />
            {#if mark.stacks > 1}<small>×{mark.stacks}</small>{:else if mark.secs != null}<small>{shortTime(mark.secs)}</small>{/if}
          </span>
        {/each}
      </div>
    {/if}
    {#key strike ? strike.id : `c${m.id}`}
      <!-- the attack run, keyed on the mob's own swing: this wrapper wears the whole card face, so the
           charge moves the card and not just what is drawn inside it. Remounted per strike so every swing
           reads; the shake inside is keyed on its own event, so being hit and hitting back play together
           instead of one starving or replaying the other. On a mutual exchange it runs halfway, and the
           player's card rises to meet it -->
      <div
        class="charge card card-combat"
        class:front={mi === 0}
        class:elite={m.kind === 'Elite'}
        class:boss={m.kind.startsWith('Boss')}
        class:lunge={!!strike}
        class:clash={!!clash}
      >
    {#key beat ? beat.id : `i${m.id}`}
      <!-- the body takes the blow: one node, remounted on every direct hit, so a fast fight re-stamps
           the flinch instead of looping it -->
      <div class="art" class:knock={!!beat}>
        <div class="mob-head">
            <div class="identity">
              <img class="portrait card-portrait" src={mobIcon(m.species)} alt="" aria-hidden="true" />
              <p class="mob-name card-name" class:elite={m.kind === 'Elite'} class:boss={m.kind.startsWith('Boss')}>{fieldLabel(m)}{#if m.kind.startsWith('Boss')}<img class="tier-mark" src={bossMark} alt="" aria-hidden="true" />{/if}</p>
              <small class="mob-level">Level {m.level}</small>
            </div>
          {#if m.innate.length}
            <div class="innate-rail">
              {#each m.innate as element}
                <span class="innate-mark" role="img" aria-label={`Innate Element: ${element}`} title={`Innate · ${element}`}>
                  <Icon src={elementIcon(element)} />
                </span>
              {/each}
            </div>
          {/if}
        </div>
        <span class="mobbar track track-meter hp"><i style={bar(m.hp, m.hpMax)}></i><b>{Math.max(0, Math.round(m.hp))} / {Math.round(m.hpMax)}</b></span>
        {#if casting}
          <span class="mob-cast" title={`Cast · ${castSkill.name || castEvent?.text || ''}`}>
            <Icon src={skillIcon(castSkill.id, castSkill.type || 'attack')} />
            {castSkill.name || castEvent?.text || ''}
          </span>
        {/if}
        <span class="mob-windup" role="progressbar" aria-label="Next swing" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(windup * 100)} title="Next swing">
          <i style={`--windup:${windup}`}></i>
        </span>
      </div>
    {/key}
      </div>
    {/key}
  </div>
{/each}
</div>
{:else}
  {#if s.walk}
    <!-- The walk is a clock, not a journey to watch: the destination already reads in the zone tag and the
         road itself reads on the map, so the field says the one word and counts nothing — no block counter
         and no trail of prints. It mounts only while the field is empty, so a live plate is never covered,
         and it takes no pointer — the ground behind it still pans. -->
    <p class="clear-field"><b>Traveling…</b></p>
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
{/if}

<div class="combat-player-slot">
  <PlayerVitalCard s={s} {c} {ring} {statuses} {vitals} {reserved} {onSheet} {fxOutMs} {fmtNum} />
  <div class="float-side self-side" aria-hidden="true">
    {#each selfFx as e (e.id)}
      <span class="fx fx-{e.kind}" class:pop={e.kind === 'drop'} class:pop-loot={e.kind === 'drop'} out:fxOut={{ ms: fxOutMs }} style="--fx:{e.colour}; --lane:{e.id % 3}">{e.text}</span>
    {/each}
  </div>
</div>

<style>
  /* ===== the combat slot: the player card sits centred at the bottom, the plate row shrinks around it =====
     Every combat read is contained in its card's own box: no lateral pop, rail or badge renders outside a
     card, so a narrow region shrinks the cards instead of spilling content into its neighbours. */

  .clear-field b { color: var(--text); font-weight: 600; }

  .combat-player-slot {
    position: absolute; left: 50%; bottom: 0; z-index: var(--z-content);
    width: min(var(--card-w), 100%); aspect-ratio: 5 / 7;
    transform: translateX(-50%); pointer-events: auto;
  }

  /* loot and system chips rise to the card's right and back onto it, tracking the drift the
     shared `fx-rise` keyframes carry: the anchor is pushed out by `--rail` and the drift pulls
     it back by about the same distance, so the column reads beside the card */
  .combat-player-slot .self-side { left: calc(100% + var(--spacing-xs) + var(--rail)); bottom: 0; align-items: flex-start; }
  .combat-player-slot .self-side .fx { translate: var(--rail) 0; }
  .float-side .pop-loot { padding: var(--spacing-xs); }

  /* the group is one centred row, never a wrap: the largest authored group is five bodies, and
     `flex-shrink` plus `min-width: 0` turns a narrow region into smaller cards, not overflow */
  .plate-row { display: flex; flex-wrap: nowrap; justify-content: center; align-items: flex-start; gap: var(--spacing-md); width: 100%; }
  .mob { position: relative; flex: 0 1 var(--card-w); min-width: 0; aspect-ratio: 5 / 7; text-align: left; pointer-events: auto; }

  /* the shell above keeps the slot's size, place in the row and the reads pinned to it */
  .mob .charge { width: 100%; height: 100%; min-height: 0; display: flex; flex-direction: column; padding: var(--spacing-md); }
  .mob .art { display: flex; flex-direction: column; justify-content: space-between; align-items: stretch; flex: 1; min-width: 0; gap: var(--spacing-xs); padding-bottom: var(--spacing-xs); }

  /* the body the next swing waits on carries a pair of crop marks inside its own corners, so the
     front state survives without the marks bleeding past the card edge */
  .mob.front .charge::before, .mob.front .charge::after {
    content: ''; position: absolute; width: var(--icon-label); height: var(--icon-label); pointer-events: none;
    border: 2.5px solid color-mix(in srgb, var(--text) 90%, transparent);
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, .85));
  }
  .mob.front .charge::before { top: var(--spacing-xs); left: var(--spacing-xs); border-right: 0; border-bottom: 0; border-top-left-radius: var(--radius-card); }
  .mob.front .charge::after { bottom: var(--spacing-xs); right: var(--spacing-xs); border-left: 0; border-top: 0; border-bottom-right-radius: var(--radius-card); }

  /* the head holds the identity alone: the innate Element mark rides the corner out of the flow */
  .mob-head { position: relative; width: 100%; min-width: 0; }
  .innate-rail { position: absolute; top: 0; right: 0; display: flex; flex-direction: column; gap: var(--spacing-xs); }
  .innate-mark { display: grid; place-items: center; width: calc(var(--icon-label) * 1.5); height: calc(var(--icon-label) * 1.5); border: 1px solid var(--hud-edge); border-radius: var(--radius-round); background: var(--glass); box-shadow: 0 2px 8px rgba(0, 0, 0, .45); }

  /* the card head is a column: portrait on top and centred, the name under it */
  .identity { display: flex; flex-direction: column; align-items: center; gap: var(--spacing-sm); min-width: 0; text-align: center; }
  .mob .portrait { width: calc(var(--icon-card) * 4 / 5); height: calc(var(--icon-card) * 4 / 5); flex: none; object-fit: contain; padding: var(--spacing-sm); }
  .mob-name { display: flex; align-items: center; justify-content: center; gap: var(--spacing-xs); max-width: 100%; margin: 0; overflow-wrap: anywhere; font-size: var(--font-sm); line-height: 1.15; }
  .mob-name .tier-mark { width: var(--icon-label); height: var(--icon-label); }
  .mob-level { color: var(--dim); font-size: var(--font-xs); line-height: 1.15; }

  .mobbar { display: block; position: relative; width: 100%; height: max(var(--spacing-sm), var(--font-xs)); overflow: hidden; }
  .mobbar b {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    max-width: 100%; overflow: hidden; white-space: nowrap; font-size: var(--font-xs); line-height: 1; font-weight: 600; color: var(--text); font-variant-numeric: tabular-nums;
    text-shadow: 0 1px 2px rgba(0, 0, 0, .95); pointer-events: none;
  }
  .mobbar i { display: block; height: 100%; width: 100%; transition: transform var(--motion-travel) var(--ease-glide); }
  .mob-cast { display: inline-flex; align-items: center; gap: var(--spacing-xs); max-width: 100%; overflow: hidden; color: var(--gold-lit); font-size: var(--font-xs); white-space: nowrap; text-overflow: ellipsis; }
  .mob-aura {
    position: absolute; right: var(--spacing-sm); bottom: var(--spacing-sm); z-index: var(--z-floater);
    max-width: calc(100% - 2 * var(--spacing-sm)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    padding: 1px var(--spacing-sm); border: 1px solid color-mix(in srgb, var(--gold-lit) 34%, transparent);
    border-radius: var(--radius-card); background: color-mix(in srgb, var(--bg) 82%, transparent);
    color: var(--gold-lit); font-size: var(--font-xs); font-weight: 600; line-height: 1.5;
    letter-spacing: .04em;
  }
  .mob-windup { display: block; width: 100%; height: 2px; overflow: hidden; border-radius: var(--radius-card); background: var(--bar); }
  .mob-windup i { display: block; width: 100%; height: 100%; background: var(--gold-lit); transform: scaleX(var(--windup)); transform-origin: left center; transition: transform var(--motion-fast) linear; }

  /* debuff badges stack inside the card's top-left corner, mirroring the innate mark at top-right */
  .mob-debuff-rail {
    position: absolute; top: 0; left: 0; z-index: var(--z-floater);
    display: flex; flex-direction: column; gap: var(--spacing-xs); pointer-events: none;
  }
  .mob-status-badge { position: relative; display: grid; place-items: center; width: calc(var(--icon-label) * 1.5); height: calc(var(--icon-label) * 1.5); pointer-events: auto; }
  .mob-status-badge small { position: absolute; right: 0; bottom: 0; max-width: 100%; overflow: hidden; font-size: var(--font-xs); line-height: 1; }

  /* every landed blow rises from the card's centre line and clears its face by the shared rise
     keyframes; staying inside the card means the row never paints over a neighbour */
  .mob .plate-fx { position: absolute; inset: 0; z-index: var(--z-label); pointer-events: none; }
  .plate-fx .pop { position: absolute; left: 50%; top: 58%; white-space: nowrap; padding: var(--spacing-xs); }
  .plate-fx .pop-word { top: 24%; }
  /* the cast is a telegraph, not a damage pop: it sits above the card so it never crosses the name,
     and stays put instead of rising through the portrait */
  .plate-fx .pop.mob-cast-word {
    top: calc(-1 * (var(--spacing-lg) + var(--spacing-sm)));
    padding: 2px var(--spacing-sm);
    border: 1px solid color-mix(in srgb, var(--gold-lit) 34%, transparent);
    border-radius: var(--radius-card);
    background: color-mix(in srgb, var(--bg) 82%, transparent);
    color: var(--gold-lit);
    font-size: var(--font-sm);
    letter-spacing: .06em;
    box-shadow: 0 2px 10px rgba(0, 0, 0, .35);
    animation: mob-cast-note 1.3s ease both;
  }

  .mob .art.knock { animation: plate-mob-knock var(--motion-ui) cubic-bezier(.2, .8, .3, 1); }
  .mob .charge.lunge { --reach: clamp(63px, 4.84vw, 135px); animation: plate-mob-charge .45s cubic-bezier(.3, .7, .3, 1); }
  .mob .charge.lunge.clash { --reach: calc(clamp(63px, 4.84vw, 135px) / 2); }
  .mob .flash {
    position: absolute; inset: -1px; z-index: var(--z-highlight); border: 1px solid var(--fx, var(--edge));
    border-radius: var(--radius-card); pointer-events: none;
    box-shadow: inset 0 0 var(--spacing-sm) color-mix(in srgb, var(--fx, var(--text)) 58%, transparent);
    animation: plate-flash .32s ease-out forwards;
  }

  @keyframes plate-mob-knock {
    0%, 100% { transform: none; }
    30% { transform: translateY(calc(-1 * var(--spacing-sm))) scale(.98); }
    60% { transform: translateY(2px); }
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
  .mob .arc {
    position: absolute; left: calc(50% + var(--x-pull-arc)); top: calc(clamp(24px, 1.84vw, 51px) + var(--x-pull-arc)); z-index: var(--z-highlight); pointer-events: none;
    width: calc(var(--icon-card) * 1.4); height: calc(var(--icon-card) * 1.4);
    background: var(--fx, var(--text));
    -webkit-mask: url('../icon/gear/weapon/crossed-swords-1.png') center / contain no-repeat;
            mask: url('../icon/gear/weapon/crossed-swords-1.png') center / contain no-repeat;
    animation: plate-arc .26s ease-out forwards;
  }

  /* a press lands as a burst and not a cut, so the two halves of a build read apart before a number is read */
  .mob .burst {
    position: absolute; left: calc(50% + var(--x-pull-burst)); top: calc(clamp(24px, 1.84vw, 51px) + var(--x-pull-burst)); z-index: var(--z-highlight); pointer-events: none;
    width: var(--icon-card); height: var(--icon-card);
    border: 2px solid var(--fx, var(--text)); border-radius: var(--radius-round);
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
  @keyframes mob-cast-note {
    0% { opacity: 0; transform: translate(-50%, var(--spacing-xs)) scale(.96); }
    14% { opacity: 1; transform: translate(-50%, 0) scale(1); }
    72% { opacity: 1; transform: translate(-50%, calc(-1 * var(--spacing-xs))) scale(1); }
    100% { opacity: 0; transform: translate(-50%, calc(-1 * var(--spacing-sm))) scale(.98); }
  }
</style>
