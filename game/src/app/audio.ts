import type { FxEvent } from '@sim/core/types';

/**
 * Combat sound cues: a small, deterministic mapping from resolved events to short synthesized
 * voices. Sound is presentation only — it never schedules damage or reads the combat clock — and a
 * muted player loses no information, because every cue also has a visual read.
 */
export type SoundCue = 'hit' | 'crit' | 'taken' | 'block' | 'cast' | 'kill' | 'heal' | 'level' | 'drop';

export interface CueVoice {
  frequency: number;
  /** Seconds. */
  duration: number;
  type: OscillatorType;
  gain: number;
}

/** The cue table is data-shaped, so a later recorded sample can replace one row without a caller. */
export const SOUND_CUES: Record<SoundCue, CueVoice> = {
  hit: { frequency: 190, duration: 0.055, type: 'square', gain: 0.035 },
  crit: { frequency: 340, duration: 0.085, type: 'square', gain: 0.05 },
  taken: { frequency: 92, duration: 0.12, type: 'sawtooth', gain: 0.045 },
  block: { frequency: 150, duration: 0.06, type: 'triangle', gain: 0.04 },
  cast: { frequency: 520, duration: 0.09, type: 'sine', gain: 0.03 },
  kill: { frequency: 430, duration: 0.14, type: 'triangle', gain: 0.045 },
  heal: { frequency: 470, duration: 0.1, type: 'sine', gain: 0.03 },
  level: { frequency: 700, duration: 0.16, type: 'sine', gain: 0.045 },
  drop: { frequency: 860, duration: 0.11, type: 'sine', gain: 0.035 },
};

/** Which resolved event owns a cue. Ordinary hits and taken blows are the only loops. */
export function cueFor(event: FxEvent | undefined): SoundCue | null {
  if (!event) return null;
  if (event.kind === 'hit') return event.crit ? 'crit' : 'hit';
  if (event.kind === 'taken') return 'taken';
  if (event.kind === 'block') return 'block';
  if (event.kind === 'cast' || event.kind === 'buff') return 'cast';
  if (event.kind === 'kill') return 'kill';
  if (event.kind === 'heal') return 'heal';
  if (event.kind === 'level') return 'level';
  if (event.kind === 'drop') return 'drop';
  return null;
}

export interface AudioSink {
  /** Start one voice; the sink owns its own node and stop. */
  play(voice: CueVoice): void;
}

export interface CueSchedulerOptions {
  sink: AudioSink;
  /** Voices allowed at once; a busy field drops the newest cue rather than doubling the mix. */
  maxVoices?: number;
  /** The same cue within this window is coalesced (high attack speed reads as one hit). */
  retriggerMs?: number;
}

/**
 * The voice budget and retrigger gate. It is a pure scheduler over a sink, so tests and the mute
 * switch run the same policy as the browser: no hidden second path for the live field.
 */
export class CueScheduler {
  private active = 0;
  private readonly recent = new Map<SoundCue, number>();
  private readonly maxVoices: number;
  private readonly retriggerMs: number;
  enabled = true;

  constructor(private readonly options: CueSchedulerOptions) {
    this.maxVoices = Math.max(1, Math.floor(options.maxVoices ?? 4));
    this.retriggerMs = Math.max(0, options.retriggerMs ?? 45);
  }

  /** Returns the cue actually started, or null when muted, coalesced or over budget. */
  play(cue: SoundCue, nowMs = performance.now()): SoundCue | null {
    if (!this.enabled) return null;
    const last = this.recent.get(cue);
    if (last != null && nowMs - last < this.retriggerMs) return null;
    if (this.active >= this.maxVoices) return null;
    this.recent.set(cue, nowMs);
    this.active++;
    try {
      this.options.sink.play(SOUND_CUES[cue]);
    } finally {
      // The synthesized voices are short; the budget is released on the cue's own duration.
      const release = Math.max(0, SOUND_CUES[cue].duration) * 1000;
      if (typeof setTimeout === 'function') setTimeout(() => { this.active = Math.max(0, this.active - 1); }, release);
      else this.active = Math.max(0, this.active - 1);
    }
    return cue;
  }

  /** Release every voice immediately, for mute or a hidden tab. */
  silence(): void {
    this.active = 0;
    this.recent.clear();
  }
}

/** The browser sink: one short oscillator per cue, no downloaded sample and no autoplay before a gesture. */
export function createWebAudioSink(getContext: () => AudioContext | null): AudioSink {
  return {
    play(voice) {
      const context = getContext();
      if (!context || context.state === 'suspended') return;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = voice.type;
      oscillator.frequency.setValueAtTime(voice.frequency, context.currentTime);
      gain.gain.setValueAtTime(voice.gain, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + voice.duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + voice.duration);
    },
  };
}
