import { describe, expect, it, vi } from 'vitest';
import { CueScheduler, SOUND_CUES, cueFor, type AudioSink } from '../../src/app/audio';

const sink = (): AudioSink => ({ play: vi.fn() });

describe('combat cues are presentation-only and budgeted', () => {
  it('maps every resolved event family to one cue and ignores travel/log events', () => {
    const event = (over: Record<string, unknown>) =>
      ({ id: 1, sec: 1, kind: 'hit', side: 'field', text: '1', colour: '#fff', ...over }) as never;
    expect(cueFor(event({ kind: 'hit', crit: true }))).toBe('crit');
    expect(cueFor(event({ kind: 'hit' }))).toBe('hit');
    expect(cueFor(event({ kind: 'taken', side: 'self' }))).toBe('taken');
    expect(cueFor(event({ kind: 'block' }))).toBe('block');
    expect(cueFor(event({ kind: 'cast', side: 'self' }))).toBe('cast');
    expect(cueFor(event({ kind: 'kill' }))).toBe('kill');
    expect(cueFor(event({ kind: 'travel', side: 'self' }))).toBeNull();
  });

  it('coalesces the same cue and never exceeds the voice budget', () => {
    vi.useFakeTimers();
    const output = sink();
    const cues = new CueScheduler({ sink: output, maxVoices: 2, retriggerMs: 100 });
    expect(cues.play('hit', 0)).toBe('hit');
    expect(cues.play('hit', 40)).toBeNull();          // same cue inside the retrigger window
    expect(cues.play('crit', 50)).toBe('crit');       // a different cue is its own voice
    expect(cues.play('taken', 60)).toBeNull();        // over the two-voice budget
    vi.advanceTimersByTime(200);
    expect(cues.play('taken', 300)).toBe('taken');    // the budget was released by duration
    vi.useRealTimers();
  });

  it('silences every voice when muted and starts none while disabled', () => {
    const output = sink();
    const cues = new CueScheduler({ sink: output, maxVoices: 4 });
    cues.enabled = false;
    expect(cues.play('kill', 0)).toBeNull();
    cues.enabled = true;
    expect(cues.play('kill', 10)).toBe('kill');
    cues.silence();
    expect(cues.play('kill', 11)).toBe('kill');
  });

  it('publishes a short voice for every cue, never a full-length sample', () => {
    for (const voice of Object.values(SOUND_CUES)) {
      expect(voice.duration).toBeGreaterThan(0);
      expect(voice.duration).toBeLessThanOrEqual(0.2);
    }
  });
});
