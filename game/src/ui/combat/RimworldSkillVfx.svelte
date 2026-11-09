<script lang="ts">
  import { ARENA_REF_PX_PER_M } from '../../presentation/arena-camera';
  import { matrixAttribute } from '../../presentation/view-transform';
  import type { FieldViewFrame } from '../../presentation/arena-view-frame';
  import { activeSkillVfx } from './arena-skill-vfx';
  import type { SkillGeometry, SkillGeometryScreen } from './skill-geometry';
  import { boltCenterline, boltEnvelope, boltForks, ribbonPath, seedOf } from './bolt-geometry';
  import { arcPath, burstOffsets, channelDust, channelSlashes, channelSpiral, linePath, parabolaPoint, streakDrops, supportMotes } from './rimworld-vfx';

  let { mark, screen, frame, reducedMotion = false }: {
    mark: SkillGeometry; screen: SkillGeometryScreen; frame: FieldViewFrame; reducedMotion?: boolean;
  } = $props();

  /** Three-step palette per family: hot core, saturated body, deep accent. */
  const PALETTE: Record<string, { hot: string; bright: string; deep: string }> = {
    fire: { hot: '#fff2c4', bright: '#ff8a2a', deep: '#b93a0e' },
    cold: { hot: '#ffffff', bright: '#9fe0ff', deep: '#2f7fb8' },
    lightning: { hot: '#e8f5ff', bright: '#7fb6ff', deep: '#2b4bb0' },
    earth: { hot: '#fff1d4', bright: '#d9b478', deep: '#6f5228' },
    poison: { hot: '#f2ffe4', bright: '#9bdc74', deep: '#3a6628' },
    chaos: { hot: '#f8ecff', bright: '#c08cff', deep: '#5f2fae' },
    physical: { hot: '#ffffff', bright: '#cfe4f7', deep: '#33465c' },
  };

  const spec = $derived(activeSkillVfx(mark.skillId, mark.incoming));
  const form = $derived(spec?.form ?? 'strike');
  const isSupport = $derived(!!spec && spec.cue !== 'attack');
  const palette = $derived(PALETTE[spec?.family ?? 'physical'] ?? PALETTE.physical);
  const seed = $derived(seedOf(mark.key));
  const cssPerM = $derived(frame.renderable ? frame.cssPixelsPerMeter : ARENA_REF_PX_PER_M);
  const t = $derived(Math.max(0, mark.phaseElapsedSec));
  const progress = $derived(Math.max(0, Math.min(1, mark.progress)));
  const phase = $derived(mark.phase);
  const travelling = $derived(phase === 'Travel');
  const radiusM = $derived(Math.max(.55, mark.area.radiusM, (spec?.lengthM ?? 0) / 2));
  const spreadM = $derived(Math.max(.55, mark.area.radiusM, spec?.lengthM ?? 0));
  const dirDeg = $derived((mark.area.directionRad ?? mark.vfxAim.directionRad) * 180 / Math.PI);
  const centre = $derived(mark.vfxAim.groundImpactM);
  const liftM = $derived(mark.vfxAim.bodyImpact ? mark.bodyM.height * .5 : 0);

  /** Projectile forms whose sim may resolve without a Travel phase still fly in over this window. */
  const flightForm = $derived(form === 'bolt' || form === 'volley' || form === 'lob');
  const catchUpSec = .14;
  const flying = $derived(flightForm && (travelling || (phase === 'Impact' && t < catchUpSec)));
  const flightT = $derived(travelling ? progress : flightForm ? Math.min(1, t / catchUpSec) : 0);
  const impactDelay = $derived(flightForm && !travelling ? catchUpSec : 0);
  const impactAge = $derived(Math.max(0, t - impactDelay));
  const impactAlpha = $derived(Math.max(0, 1 - impactAge / .65));
  /** Mundane impacts (arrows, knives, rock) land with dust and debris, not a glowing magical burst. */
  const physical = $derived(spec?.family === 'physical' || spec?.family === 'earth');
  /** Electric bodies carry a pale palette and physical hits are not magical, so their bloom is dialled back. */
  const bloomAlpha = $derived(impactAlpha * (physical ? .32 : spec?.family === 'lightning' ? .55 : 1));
  /** Impact body radius in metres: body-relative so the hit reads at gameplay zoom. */
  const explosionR = $derived(Math.max(1.2, mark.bodyM.height * (physical ? 1.05 : 1.6), radiusM * (physical ? .4 : .6)));
  const impactEase = $derived(1 - Math.pow(1 - Math.min(1, impactAge / .42), 2));
  const bloomR = $derived(explosionR * (.7 + .95 * impactEase));
  const hotR = $derived(explosionR * .62 * (1 - Math.min(1, impactAge / .18) * .35));
  const hotAlpha = $derived(Math.max(0, 1 - impactAge / .26));
  const supportAlpha = $derived(Math.max(0, 1 - t / .6));
  const worldTransform = $derived(frame.renderable ? matrixAttribute(frame.worldToViewport) : undefined);

  const burst = $derived.by(() => burstOffsets(seed, spec?.particles.burst ?? 12, explosionR)
    .map((piece) => ({ ...piece, x: centre.x + piece.x, y: centre.y - liftM + piece.y,
      sizeM: piece.sizeM * 2.4 })));

  /** Charge-up motes pulled inward while the cast winds up. */
  const gatherMotes = $derived.by(() => {
    if (isSupport || phase !== 'Windup') return [];
    const count = Math.min(10, spec?.particles.gather ?? 0);
    if (!count) return [];
    const charge = Math.min(1, t / .35);
    return burstOffsets(seed + 61, count, radiusM * 1.5).map((piece) => {
      const inward = .22 + .78 * (1 - charge);
      return { x: centre.x + piece.x * inward, y: centre.y - liftM + piece.y * inward,
        r: Math.max(.07, piece.sizeM * .8), alpha: charge * .85 };
    });
  });

  /** Embers lifted off the impact and fading; they sell the heat after the bloom is gone. */
  const embers = $derived.by(() => {
    if (!(phase === 'Impact' || phase === 'Field') || isSupport) return [];
    const rise = Math.min(1, impactAge / .6);
    return burstOffsets(seed + 41, 9, explosionR).map((piece) => ({
      x: centre.x + piece.x * (1 + rise * .5),
      y: centre.y - liftM + piece.y - rise * (.6 + piece.sizeM * 9),
      sizeM: piece.sizeM * 1.8, alpha: (1 - rise) * .9,
    }));
  });

  /** Falling streaks: long enough to read as weather, coloured by the skill family. */
  const streaks = $derived.by(() => (form === 'field' && phase === 'Field')
    ? streakDrops(seed, spec?.fieldStyle === 'lightning' ? 16 : 42, radiusM).map((drop, index) => {
      const cycle = reducedMotion ? .5 : ((t * 1.3 + drop.delay * .8) % .8) / .8;
      const fallM = drop.fallM * 1.5;
      const x = centre.x + drop.x;
      const y = centre.y + drop.y - fallM * (1 - cycle);
      const slant = spec?.family === 'cold' ? 0 : spec?.family === 'lightning' ? -4 : -12;
      return { x1: x + drop.sizeM * slant, y1: y - fallM * .5, x2: x, y2: y,
        width: drop.sizeM * 1.1, head: drop.sizeM * 1.3, alpha: Math.sin(Math.PI * cycle) * (spec?.fieldStyle === 'lightning' ? .4 : 1),
        land: cycle > .88 ? (cycle - .88) / .12 : -1, sizeM: drop.sizeM + (index % 3) * .01 };
    }) : []);

  /** Sand storm ambience: horizontal gusts sweeping the zone with drifting grit. */
  const sandStreaks = $derived.by(() => (form === 'field' && spec?.fieldStyle === 'sand')
    ? streakDrops(seed + 5, 52, radiusM).map((drop) => {
      const drift = reducedMotion ? drop.delay : (t * (1.1 + drop.delay * .8) + drop.delay * 4) % 2 - 1;
      const x = centre.x + drift * radiusM * 1.05;
      const y = centre.y + drop.y * .55;
      const length = .5 + drop.sizeM * 9;
      return { x1: x - length, x2: x, y1: y + length * .18, y2: y,
        width: drop.sizeM * 1.6, alpha: Math.min(1, (1 - Math.abs(drift)) * 1.15) };
    }) : []);
  const sandMotes = $derived.by(() => (form === 'field' && spec?.fieldStyle === 'sand')
    ? burstOffsets(seed + 29, 30, radiusM).map((piece, index) => ({
      x: centre.x + piece.x + Math.sin(t * 1.4 + index) * .25,
      y: centre.y + piece.y * .6 - .08 - ((t * .3 + piece.delay) % 1) * .5,
      r: piece.sizeM * 1.7, alpha: .3 + .35 * Math.abs(Math.sin(t * 2 + index * 1.3)),
    })) : []);
  /** Broad dust sheets sweeping across the zone so the storm reads as weather, not dots. */
  const sandSheets = $derived.by(() => (form === 'field' && spec?.fieldStyle === 'sand')
    ? Array.from({ length: 5 }, (_, sheet) => {
      const travel = reducedMotion ? .5 : (t * (.45 + sheet * .08) + sheet / 5) % 1;
      const y = centre.y + (sheet - 2) * radiusM * .36;
      const points = [0, 1, 2, 3, 4, 5, 6].map((k) => ({
        x: centre.x - radiusM * 1.25 + travel * radiusM * 2.5 + (k - 3) * radiusM * .38,
        y: y + Math.sin(k * 1.3 + sheet) * radiusM * .12,
      }));
      return { d: ribbonPath(points, radiusM * .09), alpha: .42 * Math.sin(Math.PI * travel) };
    }) : []);

  /** Thunder field: lightning strikes walk across the zone instead of raining. */
  const strikes = $derived.by(() => {
    if (!(form === 'field' && phase === 'Field') || spec?.fieldStyle !== 'lightning') return [];
    return Array.from({ length: 2 }, (_, slot) => {
      const beat = reducedMotion ? slot * .5 : t * 2.2 + slot * .5;
      const piece = burstOffsets(seed + slot * 97 + Math.floor(beat) * 31, 1, radiusM * .85)[0];
      const x = centre.x + piece.x;
      const groundY = centre.y + piece.y;
      const height = (spec?.heightM ?? 3.6) * Math.min(1, (beat % 1) * 2.4);
      const points = Array.from({ length: 9 }, (_, k) => ({
        x: x + (k % 2 ? .18 : -.13) * (1 - k / 8),
        y: groundY - height * (1 - k / 8),
      }));
      const forks = [2, 4].map((k) => {
        const base = points[k];
        const dir = k % 2 ? 1 : -1;
        return ribbonPath([base, { x: base.x + dir * .5, y: base.y - .3 }, { x: base.x + dir * .85, y: base.y - .55 }], .09);
      });
      const fade = Math.max(0, 1 - Math.max(0, (beat % 1) - .45) / .55);
      return { shadow: ribbonPath(points, .34), glow: ribbonPath(points, .2), core: ribbonPath(points, .08), forks,
        x, groundY, alpha: fade };
    });
  });

  /** Slow embers bubbling off the field floor so the zone keeps living between strikes. */
  const fieldEmbers = $derived.by(() => (form === 'field' && phase === 'Field')
    ? burstOffsets(seed + 77, 10, radiusM * .9).map((piece) => {
      const cycle = reducedMotion ? .5 : ((t * .7 + piece.delay * 6) % 1.1) / 1.1;
      return { x: centre.x + piece.x, y: centre.y + piece.y - cycle * 1.1,
        sizeM: piece.sizeM * 1.4, alpha: Math.sin(Math.PI * cycle) * .7 };
    }) : []);

  const motes = $derived.by(() => isSupport
    ? supportMotes(seed, 8, mark.bodyM.height).map((mote) => {
      const cycle = reducedMotion ? .5 : ((t * 1.1 + mote.delay) % .8) / .8;
      return { x: centre.x + mote.x, y: centre.y - liftM + mote.y - mote.riseM * cycle,
        sizeM: mote.sizeM, alpha: Math.sin(Math.PI * cycle) };
    }) : []);

  const blades = $derived.by(() => form === 'channel'
    ? channelSpiral(seed, 8, spreadM, reducedMotion ? 0 : t * 5.2).map((points) => ({
      shadow: ribbonPath(points, .58), glow: ribbonPath(points, .32), core: ribbonPath(points, .13) })) : []);
  const slashes = $derived.by(() => form === 'channel'
    ? channelSlashes(seed, 3, spreadM, reducedMotion ? 1.2 : t * 8.4).map((points) => ({
      shadow: ribbonPath(points, .34), glow: ribbonPath(points, .2), core: ribbonPath(points, .07) })) : []);
  /** Helical crests above the base ring give the channel height, so it reads as a vortex, not a decal. */
  const airBlades = $derived.by(() => form === 'channel'
    ? [0, 1].flatMap((layer) => {
      const lift = spreadM * (.22 + layer * .24);
      const radius = spreadM * (.72 - layer * .2);
      return channelSlashes(seed + 31 + layer * 7, 3, radius, reducedMotion ? 1.4 + layer * .6 : t * (9 + layer * 2.4))
        .map((points) => points.map((point) => ({ x: point.x, y: point.y - lift })));
    }).map((points) => ({ shadow: ribbonPath(points, .3), glow: ribbonPath(points, .17), core: ribbonPath(points, .06) })) : []);
  const dust = $derived.by(() => form === 'channel'
    ? channelDust(seed, 16, spreadM, reducedMotion ? 0 : t).map((mote) => ({
      x: centre.x + mote.x, y: centre.y + mote.y, r: mote.sizeM, alpha: mote.alpha })) : []);

  const novaRadiusM = $derived(form === 'nova' && phase === 'Impact' ? radiusM * (1 - Math.pow(1 - Math.min(1, t / .35), 2)) : 0);
  const shockAlpha = $derived(form === 'nova' ? Math.max(0, 1 - t / .45) : impactAlpha);

  /** Electric shockwave for ground-pulse bursts: jagged radial bolts plus rising arcs. */
  const pulseBolts = $derived.by(() => {
    if (!spec?.pulse || !showImpact) return [];
    const grow = Math.min(1, impactAge / .14);
    return Array.from({ length: 8 }, (_, index) => {
      const angle = index / 8 * Math.PI * 2 + (seed % 5) * .13;
      const reach = explosionR * (.95 + (index % 4) * .3) * grow;
      const dir = { x: Math.cos(angle), y: Math.sin(angle) * .55 };
      const side = { x: -dir.y, y: dir.x };
      const points = [0, .3, .55, .8, 1].map((f, step) => ({
        x: centre.x + dir.x * reach * f + side.x * (step % 2 ? .18 : -.08) * explosionR,
        y: centre.y - liftM + dir.y * reach * f + side.y * (step % 2 ? .18 : -.08) * explosionR,
      }));
      return { glow: ribbonPath(points, .11), core: ribbonPath(points, .045) };
    });
  });
  const pulseArcs = $derived.by(() => {
    if (!spec?.pulse || !showImpact) return [];
    return burstOffsets(seed + 13, 3, explosionR * .55).map((piece) => {
      const points = [0, .33, .66, 1].map((f, step) => ({
        x: centre.x + piece.x + (step % 2 ? .1 : -.07) * explosionR * .3,
        y: centre.y - liftM + piece.y - f * 1.9,
      }));
      return { glow: ribbonPath(points, .12), core: ribbonPath(points, .05) };
    });
  });

  /** Tapered shards radiating from the impact for strike/nova/sigil. */
  const shards = $derived.by(() => {
    if (isSupport || !(phase === 'Impact' || phase === 'Field') || t < impactDelay
      || form === 'field' || form === 'channel' || form === 'chain') return [];
    const count = form === 'nova' ? 12 : 10;
    const grow = Math.min(1, impactAge / .16);
    return Array.from({ length: count }, (_, index) => {
      const angle = index / count * Math.PI * 2 + (seed % 7) * .12;
      const length = explosionR * (1.05 + (index % 3) * .28) * grow;
      const from = { x: centre.x, y: centre.y - liftM };
      const to = { x: from.x + Math.cos(angle) * length, y: from.y + Math.sin(angle) * length * .55 };
      // ribbonPath tapers at both ends, so a two-point ribbon has zero width: add a fat midsection.
      const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
      return { d: ribbonPath([from, mid, to], .24 * (1 - Math.min(1, impactAge / .5) * .45)),
        core: ribbonPath([from, mid, to], .11 * (1 - Math.min(1, impactAge / .5) * .45)) };
    });
  });

  const chainBolts = $derived.by(() => mark.chainHop ? screen.paths.map((path) => {
    const bucket = reducedMotion ? 0 : Math.floor(t / .04);
    const hopSeed = seed + path.index * 977 + bucket * 131;
    const centreLine = boltCenterline(path.from, path.to, { seed: hopSeed, cssPerM });
    const forks = boltForks(centreLine, hopSeed, cssPerM);
    return { index: path.index, core: ribbonPath(centreLine, 1.3), mid: ribbonPath(centreLine, 3.4),
      glow: ribbonPath(centreLine, 5.6), forks: forks.map((fork) => ({ core: ribbonPath(fork, 1.1), glow: ribbonPath(fork, 2.8) })) };
  }) : []);

  /** Path point at flight fraction `at` (0 = release, 1 = impact). */
  const flightPoint = $derived((at: number) => {
    const apexPx = (spec?.apexM ?? 0) * cssPerM;
    return form === 'lob'
      ? parabolaPoint(screen.vfxAim.release, screen.vfxAim.impact, apexPx, at)
      : { x: screen.vfxAim.release.x + (screen.vfxAim.impact.x - screen.vfxAim.release.x) * at,
          y: screen.vfxAim.release.y + (screen.vfxAim.impact.y - screen.vfxAim.release.y) * at };
  });
  /** Flight sample points for the projectile comet, tail → head. */
  const trailPoints = $derived.by(() => {
    if (!flying) return [];
    const tail = Math.max(0, flightT - .34);
    return Array.from({ length: 10 }, (_, index) => flightPoint(tail + (flightT - tail) * index / 9));
  });
  const head = $derived(trailPoints.length ? trailPoints[trailPoints.length - 1] : null);
  const headR = $derived((spec?.family === 'physical' ? .2 : .34) * cssPerM);
  const headAngle = $derived.by(() => {
    if (!head || trailPoints.length < 2) return 0;
    const prev = trailPoints[trailPoints.length - 2];
    return Math.atan2(head.y - prev.y, head.x - prev.x) * 180 / Math.PI;
  });
  /** Ice bolts fly as a faceted shard, not a round orb. */
  const shardFlight = $derived(spec?.family === 'cold' && form === 'bolt');
  /** Unique gradient id per mark so one instance's palette never leaks into another. */
  const gradId = $derived(`rw-bloom-${mark.key.replace(/[^a-zA-Z0-9_-]/g, '')}`);

  /** Volley rounds fly in echelon, each in its own lane, so a fan arrives instead of one dot. */
  const volleyCount = $derived(spec?.family === 'physical' ? 2 : 3);
  const volleyHeads = $derived.by(() => {
    if (form !== 'volley' || !(travelling || flying)) return [];
    const dir = { x: screen.vfxAim.impact.x - screen.vfxAim.release.x, y: screen.vfxAim.impact.y - screen.vfxAim.release.y };
    const len = Math.max(1, Math.hypot(dir.x, dir.y));
    const side = { x: -dir.y / len, y: dir.x / len };
    const spread = Math.max(.5, radiusM * .5) * cssPerM;
    const trailFrac = Math.min(.85, cssPerM * 1.1 / len);
    return Array.from({ length: volleyCount }, (_, index) => {
      const lane = (index - (volleyCount - 1) / 2) * spread * .55;
      const at = Math.max(0, flightT - index * .05);
      const back = Math.max(0, at - trailFrac);
      const point = flightPoint(at), tail = flightPoint(back);
      const mid = { x: (point.x + tail.x) / 2, y: (point.y + tail.y) / 2 };
      return {
        d: ribbonPath([{ x: tail.x + side.x * lane, y: tail.y + side.y * lane },
          { x: mid.x + side.x * lane, y: mid.y + side.y * lane },
          { x: point.x + side.x * lane, y: point.y + side.y * lane }], headR * .26),
        head: { x: point.x + side.x * lane, y: point.y + side.y * lane }, size: headR * .42,
      };
    });
  });

  const showImpact = $derived(!isSupport && (phase === 'Impact' || phase === 'Field')
    && !travelling && t >= impactDelay && impactAlpha > 0);

  /** Element jet: a noisy vertical plume that lifts the hit above the skill label. */
  const plume = $derived.by(() => {
    if (!showImpact) return null;
    const base = screen.vfxAim.impact;
    const heightPx = explosionR * 2.6 * cssPerM * Math.min(1, impactAge / .16);
    const top = { x: base.x + Math.sin(seed) * headR * .5, y: base.y - heightPx };
    return ribbonPath(boltCenterline(base, top, { seed: seed + 3, cssPerM, amplitudeM: .22 }), headR * .55);
  });
  const showSupport = $derived(isSupport && supportAlpha > 0);

  /** Ray channels hold a continuous beam from the caster to the aim point in screen space. */
  const showRay = $derived(!!spec?.ray && phase !== 'Aim');
  const rayPower = $derived(phase === 'Windup' ? Math.min(1, t / .3)
    : phase === 'Impact' ? Math.max(.25, 1 - Math.max(0, t - .35) / .45) : 1);
  const rayBeam = $derived.by(() => {
    if (!showRay) return null;
    const bucket = reducedMotion ? 0 : Math.floor(t / .045);
    const points = boltCenterline(screen.vfxAim.release, screen.vfxAim.impact,
      { seed: seed + bucket * 137, cssPerM, amplitudeM: .18 });
    const d = points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
    const forks = reducedMotion ? [] : boltForks(points, seed + bucket * 137 + 7, cssPerM)
      .map((fork) => fork.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' '));
    return { d, forks };
  });
  const raySparks = $derived.by(() => {
    if (!showRay) return [];
    const from = screen.vfxAim.release, to = screen.vfxAim.impact;
    return Array.from({ length: 10 }, (_, index) => {
      const travel = ((reducedMotion ? .5 : t * .85) + index * .137) % 1;
      const wobble = Math.sin(t * 14 + index * 2.1) * headR * .55;
      return { x: from.x + (to.x - from.x) * travel,
        y: from.y + (to.y - from.y) * travel + wobble * Math.sin(Math.PI * travel),
        r: headR * (.12 + (index % 3) * .05), alpha: Math.sin(Math.PI * travel) };
    });
  });
  const rayPulse = $derived.by(() => showRay ? Array.from({ length: 3 }, (_, index) => {
    const cycle = ((reducedMotion ? .5 : t * 1.5) + index / 3) % 1;
    return { r: headR * (.9 + cycle * 2.8), alpha: (1 - cycle) * .9 };
  }) : []);
  /** Sky bolts fall as a full-height jagged column that scales with zoom, not a fixed-pixel ribbon. */
  const skyColumn = $derived.by(() => {
    if (form !== 'skybolt' || phase !== 'Impact' || t > .34) return null;
    const base = screen.vfxAim.impact;
    const height = (spec?.heightM ?? 4) * cssPerM;
    const bucket = reducedMotion ? 0 : Math.floor(t / .04);
    const points = Array.from({ length: 8 }, (_, k) => {
      const f = k / 7;
      const swing = Math.sin(seed * .7 + k * 1.9 + bucket * .8) * 1.1 + (k % 2 ? .5 : -.35);
      return { x: base.x + swing * headR * (1 - f), y: base.y - height * (1 - f) };
    });
    return {
      base,
      alpha: t < .04 ? t / .04 : Math.max(0, 1 - (t - .04) / .3),
      shadow: ribbonPath(points, headR * .7),
      glow: ribbonPath(points, headR * .45),
      core: ribbonPath(points, headR * .16),
      forks: boltForks(points, seed + bucket * 91, cssPerM).map((fork) => ribbonPath(fork, headR * .14)),
    };
  });
  const showGroundShape = $derived(!spec?.ray && (form === 'cleave' || form === 'cone' || form === 'line')
    && (phase === 'Windup' || phase === 'Travel' || phase === 'Impact') && (phase !== 'Impact' || impactAlpha > 0));
  const supportHeightM = $derived(mark.bodyM.height * 1.5);
</script>

{#if frame.renderable && spec}
  <g data-vfx-rimworld={form} data-vfx-phase={phase} data-vfx-pulse={spec?.pulse ? '' : undefined}
    data-vfx-support={isSupport ? spec.cue : undefined}
    style={`--rw-hot:${palette.hot};--rw-colour:${palette.bright};--rw-deep:${palette.deep}`}>
    {#if form === 'chain'}
      <g opacity={reducedMotion ? 1 : boltEnvelope(t)}>
        {#each chainBolts as bolt (bolt.index)}
          <g data-skill-chain-hop={bolt.index}>
            <g class="rw-glow"><path class="rw-bolt-glow" d={bolt.glow} /><path class="rw-mid" d={bolt.mid} />
              {#each bolt.forks as fork, index (index)}<path class="rw-bolt-glow" d={fork.glow} />{/each}</g>
            <path class="rw-core" d={bolt.core} />
            {#each bolt.forks as fork, index (index)}<path class="rw-fork" d={fork.core} />{/each}
          </g>
        {/each}
      </g>
    {/if}

    {#if head && form !== 'volley'}
      <g class="rw-glow" data-rw-projectile>
        <path class="rw-comet-glow" d={ribbonPath(trailPoints, headR * .85)} />
        <path class="rw-comet" d={ribbonPath(trailPoints, headR * .34)} />
        {#if shardFlight}
          <g transform={`translate(${head.x} ${head.y}) rotate(${headAngle})`} data-rw-shard-flight>
            <path class="rw-shard-head" d={`M${headR * 1.5} 0L${-headR * .8} ${-headR * .34}L${-headR * .45} 0L${-headR * .8} ${headR * .34}Z`} />
            <path class="rw-shard-head-core" d={`M${headR * .8} 0L${-headR * .3} ${-headR * .12}L${-headR * .16} 0L${-headR * .3} ${headR * .12}Z`} />
          </g>
        {:else}
          <circle class="rw-head" cx={head.x} cy={head.y} r={headR} />
        {/if}
        <circle class="rw-core-dot" cx={head.x} cy={head.y} r={headR * .38} />
      </g>
    {/if}
    {#if volleyHeads.length}
      <g class="rw-glow" data-rw-volley>
        {#each volleyHeads as round, index (index)}
          <path class="rw-volley-trail" d={round.d} />
          <circle class="rw-volley-head" cx={round.head.x} cy={round.head.y} r={round.size} />
        {/each}
      </g>
    {/if}

    {#if skyColumn}
      <g opacity={skyColumn.alpha} data-rw-skybolt>
        <path class="rw-strike-shadow" d={skyColumn.shadow} />
        <g class="rw-glow">
          <path class="rw-strike" d={skyColumn.glow} />
          {#each skyColumn.forks as fork, index (index)}
            <path class="rw-strike" d={fork} opacity={.8} />
          {/each}
          <path class="rw-strike-core" d={skyColumn.core} />
        </g>
        <circle class="rw-ring" cx={skyColumn.base.x} cy={skyColumn.base.y} r={explosionR * .8}
          opacity={impactAlpha * .8} />
      </g>
    {/if}

    {#if plume}
      <g class="rw-glow" opacity={impactAlpha} data-rw-plume>
        <path class="rw-plume-glow" d={plume} />
      </g>
    {/if}

    {#if rayBeam}
      <g data-rw-ray opacity={rayPower}>
        <path class="rw-ray-shadow" d={rayBeam.d} />
        <g class="rw-glow">
          <path class="rw-ray-glow" d={rayBeam.d} />
          <path class="rw-ray-mid" d={rayBeam.d} />
          {#each rayBeam.forks as fork, index (index)}
            <path class="rw-ray-branch" d={fork} />
          {/each}
        </g>
        <path class="rw-ray-core" d={rayBeam.d} />
        <circle class="rw-ray-origin" cx={screen.vfxAim.release.x} cy={screen.vfxAim.release.y} r={headR * .5} />
        <circle class="rw-ray-origin-core" cx={screen.vfxAim.release.x} cy={screen.vfxAim.release.y} r={headR * .2} />
        <circle class="rw-ray-impact" cx={screen.vfxAim.impact.x} cy={screen.vfxAim.impact.y}
          r={headR * 2.6} fill={`url(#${gradId})`} />
        <circle class="rw-void-hole" cx={screen.vfxAim.impact.x} cy={screen.vfxAim.impact.y} r={headR * .72} />
        <circle class="rw-ray-flare" cx={screen.vfxAim.impact.x} cy={screen.vfxAim.impact.y} r={headR * .82} />
        <g class="rw-glow">
          {#each rayPulse as ring, index (index)}
            <circle class="rw-ray-pulse" cx={screen.vfxAim.impact.x} cy={screen.vfxAim.impact.y}
              r={ring.r} opacity={ring.alpha} />
          {/each}
          {#each raySparks as spark, index (index)}
            <circle class="rw-ray-spark" cx={spark.x} cy={spark.y} r={spark.r} opacity={spark.alpha} />
          {/each}
        </g>
      </g>
    {/if}

    <g transform={worldTransform}>
      <defs>
        <radialGradient id={gradId}>
          <stop offset="0" stop-color={palette.hot} stop-opacity=".95" />
          <stop offset=".28" stop-color={palette.bright} stop-opacity=".9" />
          <stop offset=".55" stop-color={palette.bright} stop-opacity=".55" />
          <stop offset=".8" stop-color={palette.deep} stop-opacity=".25" />
          <stop offset="1" stop-color={palette.deep} stop-opacity="0" />
        </radialGradient>
        <radialGradient id={`${gradId}-soft`}>
          <stop offset="0" stop-color={palette.deep} stop-opacity=".5" />
          <stop offset=".6" stop-color={palette.deep} stop-opacity=".26" />
          <stop offset="1" stop-color={palette.deep} stop-opacity="0" />
        </radialGradient>
      </defs>
      {#if form === 'nova' && novaRadiusM > 0}
        <g class="rw-ground" opacity={shockAlpha}>
          <circle class="rw-ring" cx={centre.x} cy={centre.y} r={novaRadiusM} />
          <circle class="rw-ring rw-faint" cx={centre.x} cy={centre.y} r={novaRadiusM * .74} />
          {#each burst as piece (piece.x + ':' + piece.y)}
            <circle class="rw-burst" cx={piece.x} cy={piece.y} r={piece.sizeM * .35} opacity={.75} />
          {/each}
        </g>
      {/if}

      {#if showGroundShape}
        <g transform={`translate(${mark.area.center.x} ${mark.area.center.y}) rotate(${dirDeg})`}
          opacity={phase === 'Impact' ? impactAlpha : .5}>
          {#if form === 'line'}
            <path class="rw-ground-fill" d={linePath(spec.lengthM || radiusM * 2, spec.widthM || .6)} />
            <path class="rw-ground-edge" d={linePath(spec.lengthM || radiusM * 2, spec.widthM || .6)} />
          {:else}
            <path class="rw-ground-fill" d={arcPath(spec.lengthM || radiusM, Math.min(Math.PI / 2, (spec.angleDeg || 90) * Math.PI / 360))} />
          {/if}
        </g>
      {/if}

      {#if form === 'field' && phase === 'Field'}
        {#if spec.fieldStyle === 'sand'}
          <g opacity={Math.min(1, t / .2)}>
            <circle cx={centre.x} cy={centre.y} r={radiusM * 1.02} fill={`url(#${gradId}-soft)`} />
          </g>
          <g>
            {#each sandSheets as sheet, index (index)}
              <path class="rw-sand-sheet" d={sheet.d} opacity={sheet.alpha} />
            {/each}
          </g>
          <g class="rw-glow" opacity={.85}>
            {#each sandStreaks as gust, index (index)}
              <line class="rw-streak" x1={gust.x1} y1={gust.y1} x2={gust.x2} y2={gust.y2}
                stroke-width={gust.width} opacity={gust.alpha} />
            {/each}
            {#each sandMotes as mote, index (index)}
              <circle class="rw-dust" cx={mote.x} cy={mote.y} r={mote.r} opacity={mote.alpha} />
            {/each}
          </g>
        {:else}
          <g class="rw-glow" opacity={Math.min(1, t / .15)}>
            {#each streaks as streak, index (index)}
              <line class="rw-streak" x1={streak.x1} y1={streak.y1} x2={streak.x2} y2={streak.y2}
                stroke-width={streak.width} opacity={streak.alpha * .85} />
              <circle class="rw-streak-head" cx={streak.x2} cy={streak.y2} r={streak.head} opacity={streak.alpha} />
              {#if streak.land >= 0}
                <circle class="rw-streak-land" cx={streak.x2} cy={streak.y2}
                  r={streak.sizeM * (2.2 + streak.land * 2.6)} opacity={(1 - streak.land) * .8} />
              {/if}
            {/each}
            {#if spec.fieldStyle !== 'lightning'}
              {#each fieldEmbers as ember, index (index)}
                <circle class="rw-ember" cx={ember.x} cy={ember.y} r={ember.sizeM} opacity={ember.alpha} />
              {/each}
            {/if}
          </g>
          {#if spec.fieldStyle === 'lightning'}
            <g opacity={Math.min(1, t / .12)}>
              {#each strikes as strike, index (index)}
                <path class="rw-strike-shadow" d={strike.shadow} opacity={strike.alpha} />
                <g class="rw-glow">
                  <path class="rw-strike" d={strike.glow} opacity={strike.alpha} />
                  {#each strike.forks as fork, forkIndex (forkIndex)}
                    <path class="rw-strike" d={fork} opacity={strike.alpha * .8} />
                  {/each}
                  <path class="rw-strike-core" d={strike.core} opacity={strike.alpha} />
                </g>
                <circle class="rw-ring" cx={strike.x} cy={strike.groundY} r={.5 + (1 - strike.alpha) * 1.1}
                  opacity={strike.alpha * .8} />
              {/each}
            </g>
          {/if}
        {/if}
      {/if}

      {#if form === 'sigil' && (phase === 'Windup' || phase === 'Impact')}
        <g class="rw-ground" opacity={phase === 'Impact' ? impactAlpha : .45}>
          <circle class="rw-ring" cx={centre.x} cy={centre.y} r={radiusM * .9} />
          <circle class="rw-ring rw-faint" cx={centre.x} cy={centre.y} r={radiusM * .55} />
        </g>
      {/if}

      {#if gatherMotes.length}
        <g class="rw-glow" opacity={.9} data-rw-gather>
          {#each gatherMotes as mote, index (index)}
            <circle class="rw-gather" cx={mote.x} cy={mote.y} r={mote.r} opacity={mote.alpha} />
          {/each}
        </g>
      {/if}

      {#if shards.length}
        <g opacity={Math.min(1, impactAlpha * 1.6)} data-rw-shards>
          {#each shards as shard, index (index)}
            <path class="rw-shard" d={shard.d} />
            <path class="rw-shard-hot" d={shard.core} />
          {/each}
        </g>
      {/if}

      {#if showImpact}
        <g class="rw-ground" opacity={impactAlpha}>
          <circle class="rw-ring" cx={centre.x} cy={centre.y} r={explosionR * (.55 + 1.5 * impactEase)} />
          <circle class="rw-ring rw-faint" cx={centre.x} cy={centre.y} r={explosionR * (.35 + 1.05 * impactEase)} />
        </g>
        <g opacity={bloomAlpha}>
          <circle class="rw-shadow" cx={centre.x} cy={centre.y - liftM} r={bloomR * 1.04} />
          <circle class="rw-bloom" cx={centre.x} cy={centre.y - liftM} r={bloomR} fill={`url(#${gradId})`} />
        </g>
        <g class="rw-glow" opacity={impactAlpha}>
          <circle class="rw-hot" cx={centre.x} cy={centre.y - liftM} r={hotR}
            opacity={hotAlpha * (physical ? .5 : spec?.family === 'lightning' ? .7 : 1)} />
          {#each burst as piece (piece.x + ':' + piece.y)}
            {#if spec?.family === 'lightning'}
              <line class="rw-spark" x1={centre.x + (piece.x - centre.x) * .78}
                y1={centre.y - liftM + (piece.y - centre.y + liftM) * .78} x2={piece.x} y2={piece.y}
                stroke-width={piece.sizeM * .45} />
            {:else}
              <circle class="rw-burst" cx={piece.x} cy={piece.y} r={piece.sizeM} />
            {/if}
          {/each}
          {#each embers as ember, index (index)}
            <circle class="rw-ember" cx={ember.x} cy={ember.y} r={ember.sizeM} opacity={ember.alpha} />
          {/each}
        </g>
      {/if}

      {#if form === 'channel'}
        <g opacity={.85}>
          <circle cx={centre.x} cy={centre.y} r={spreadM * .98} fill={`url(#${gradId}-soft)`} />
          <circle class="rw-ring rw-dashed" cx={centre.x} cy={centre.y} r={spreadM * .92} />
        </g>
        <g data-rw-vortex opacity={.95} transform={`translate(${centre.x} ${centre.y})`}>
          {#each blades as blade, index (index)}
            <path class="rw-vortex-shadow" d={blade.shadow} />
            <path class="rw-vortex" d={blade.glow} />
            <path class="rw-vortex-core" d={blade.core} />
          {/each}
          {#each slashes as slash, index (index)}
            <path class="rw-vortex-shadow" d={slash.shadow} />
            <path class="rw-blade" d={slash.glow} />
            <path class="rw-vortex-core" d={slash.core} />
          {/each}
          {#each airBlades as blade, index (index)}
            <path class="rw-vortex-shadow" d={blade.shadow} />
            <path class="rw-blade" d={blade.glow} />
            <path class="rw-vortex-core" d={blade.core} />
          {/each}
        </g>
        <g class="rw-glow" opacity={.85}>
          {#each dust as mote, index (index)}
            <circle class="rw-dust" cx={mote.x} cy={mote.y} r={mote.r} opacity={mote.alpha} />
          {/each}
        </g>
      {/if}

      {#if pulseBolts.length}
        <g class="rw-glow" opacity={impactAlpha} data-rw-pulse>
          {#each pulseBolts as bolt, index (index)}
            <path class="rw-pulse-bolt" d={bolt.glow} />
            <path class="rw-pulse-core" d={bolt.core} />
          {/each}
          {#each pulseArcs as arc, index (index)}
            <path class="rw-pulse-bolt" d={arc.glow} />
            <path class="rw-pulse-core" d={arc.core} />
          {/each}
        </g>
      {/if}

      {#if showSupport}
        <g class="rw-glow" opacity={supportAlpha} data-rw-support-cue={spec.cue}>
          <path class="rw-pillar" d={ribbonPath([{ x: centre.x, y: centre.y - liftM },
            { x: centre.x, y: centre.y - liftM - supportHeightM / 2 },
            { x: centre.x, y: centre.y - liftM - supportHeightM }], .18)} />
          {#each motes as mote, index (index)}
            <circle class="rw-support" cx={mote.x} cy={mote.y} r={mote.sizeM * 1.4} opacity={mote.alpha} />
          {/each}
        </g>
        <g class="rw-ground" opacity={supportAlpha * .5}>
          <circle class="rw-ring" cx={centre.x} cy={centre.y} r={Math.max(.5, mark.bodyM.width * .9)} />
        </g>
      {/if}
    </g>
  </g>
{/if}

<style>
  .rw-glow { mix-blend-mode: screen; }
  .rw-burst { fill: var(--rw-colour); opacity: .7; }
  .rw-spark { stroke: var(--rw-hot); stroke-linecap: round; opacity: .9; }
  .rw-gather { fill: var(--rw-hot); }
  .rw-bloom { fill: var(--rw-colour); opacity: 1; }
  .rw-shadow { fill: #10141c; opacity: .3; }
  .rw-vortex-shadow { fill: var(--rw-deep); opacity: .5; }
  .rw-vortex { fill: var(--rw-colour); opacity: .8; }
  .rw-vortex-core { fill: var(--rw-hot); opacity: .85; }
  .rw-blade { fill: var(--rw-hot); opacity: .8; }
  .rw-dust { fill: var(--rw-colour); }
  .rw-ray-shadow { fill: none; stroke: #140a22; stroke-width: 26; stroke-linecap: round; opacity: .45; }
  .rw-ray-glow { fill: none; stroke: var(--rw-colour); stroke-width: 17; stroke-linecap: round; opacity: .55; }
  .rw-ray-mid { fill: none; stroke: var(--rw-hot); stroke-width: 8; stroke-linecap: round; opacity: .8; }
  .rw-ray-core { fill: none; stroke: #fff; stroke-width: 3.2; stroke-linecap: round; opacity: .95; }
  .rw-ray-impact { opacity: .9; }
  .rw-void-hole { fill: #0a0512; opacity: .9; }
  .rw-ray-flare { fill: none; stroke: #fff; stroke-width: 2.4; opacity: .9; }
  .rw-ray-pulse { fill: none; stroke: var(--rw-hot); stroke-width: 2.5; }
  .rw-ray-spark { fill: var(--rw-hot); }
  .rw-ray-branch { fill: none; stroke: var(--rw-hot); stroke-width: 2; stroke-linecap: round; opacity: .7; }
  .rw-ray-origin { fill: var(--rw-colour); opacity: .85; }
  .rw-ray-origin-core { fill: #fff; opacity: .95; }
  .rw-hot { fill: var(--rw-hot); opacity: .95; }
  .rw-ember { fill: var(--rw-hot); }
  .rw-comet-glow { fill: var(--rw-colour); opacity: .55; }
  .rw-comet { fill: var(--rw-hot); opacity: .9; }
  .rw-head { fill: var(--rw-colour); opacity: .95; }
  .rw-shard-head { fill: var(--rw-colour); opacity: .95; }
  .rw-shard-head-core { fill: #fff; opacity: .9; }
  .rw-core-dot { fill: #fff; opacity: .95; }
  .rw-volley-trail { fill: var(--rw-colour); opacity: .6; }
  .rw-volley-head { fill: var(--rw-hot); opacity: .95; }
  .rw-plume-glow { fill: var(--rw-colour); opacity: .5; }
  .rw-mid { fill: #8fd0ff; opacity: .5; }
  .rw-bolt-glow { stroke-linejoin: round; stroke-linecap: round; fill: #4f7dff; opacity: .42; }
  .rw-core { fill: #eafcff; opacity: 1; }
  .rw-fork { fill: #cfe9ff; opacity: .8; }
  .rw-streak { stroke: var(--rw-colour); stroke-linecap: round; }
  .rw-streak-head { fill: var(--rw-hot); }
  .rw-streak-land { fill: var(--rw-colour); }
  .rw-ring { fill: none; stroke: var(--rw-colour); stroke-width: 3; opacity: .9; vector-effect: non-scaling-stroke; }
  .rw-ring.rw-faint { opacity: .4; stroke-width: 1.6; }
  .rw-ring.rw-dashed { opacity: .55; stroke-width: 2; stroke-dasharray: 3 10; }
  .rw-ground-fill { fill: var(--rw-colour); opacity: .2; }
  .rw-ground-edge { fill: none; stroke: var(--rw-colour); stroke-width: 2; opacity: .6; vector-effect: non-scaling-stroke; }
  .rw-shard { fill: var(--rw-colour); opacity: .85; }
  .rw-shard-hot { fill: var(--rw-hot); opacity: .9; }
  .rw-pillar { fill: var(--rw-colour); opacity: .35; }
  .rw-support { fill: var(--rw-hot); }
  .rw-pulse-bolt { fill: var(--rw-colour); opacity: .85; }
  .rw-pulse-core { fill: var(--rw-hot); opacity: .95; }
  .rw-strike-shadow { fill: #10141c; opacity: .35; }
  .rw-strike { fill: var(--rw-colour); opacity: .9; }
  .rw-strike-core { fill: var(--rw-hot); opacity: .95; }
  .rw-sand-sheet { fill: var(--rw-colour); }
</style>
