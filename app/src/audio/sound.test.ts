import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// A stand-in for the handful of Web Audio calls the chime makes. jsdom implements none of them,
// so without this `playNudgeChime` takes its "no Web Audio here" path and proves nothing.
function fakeAudio() {
  const oscillators: { frequency: { value: number }; started: number[]; stopped: number[] }[] = [];
  // Every value either ramp is ever asked to reach, so a test can prove none of them is zero.
  const rampTargets: number[] = [];
  const osc = () => {
    const node = {
      type: '', frequency: { value: 0 }, started: [] as number[], stopped: [] as number[],
      connect: (next: unknown) => next,
      start: (t: number) => node.started.push(t),
      stop: (t: number) => node.stopped.push(t),
    };
    oscillators.push(node);
    return node;
  };
  const gain = () => ({
    gain: {
      setValueAtTime: (v: number) => rampTargets.push(v),
      exponentialRampToValueAtTime: (v: number) => rampTargets.push(v),
    },
    connect: (next: unknown) => next,
  });
  const resume = vi.fn(() => Promise.resolve());
  class FakeContext {
    currentTime = 0;
    destination = {};
    state = 'running';
    resume = resume;
    createOscillator = osc;
    createGain = gain;
  }
  return { FakeContext, oscillators, rampTargets, resume };
}

// `sound.ts` caches its AudioContext in a module-level singleton for the tab's lifetime, which is
// right in a browser and poison in a suite: the second test would drive the first test's fake and
// assert on an array nothing writes to any more. Deleting the mute guard entirely used to leave
// this file green. Every test gets the module fresh.
async function loadSound() {
  vi.resetModules();
  return import('./sound');
}

describe('sound preference', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('is on until someone turns it off', async () => {
    const { isSoundEnabled } = await loadSound();
    expect(isSoundEnabled()).toBe(true);
  });

  it('survives a reload once toggled', async () => {
    const { isSoundEnabled, toggleSound } = await loadSound();
    expect(toggleSound()).toBe(false);
    expect(isSoundEnabled()).toBe(false);
    expect(localStorage.getItem('poker.sound')).toBe('off');
  });

  it('toggles back on', async () => {
    const { isSoundEnabled, toggleSound } = await loadSound();
    toggleSound();
    expect(toggleSound()).toBe(true);
    expect(isSoundEnabled()).toBe(true);
  });
});

describe('playNudgeChime', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // The chime is decoration on top of a banner that says the same thing. A browser without Web
  // Audio — or with it behind a permission — must not take the voting stage down with it.
  it('does nothing and throws nothing where Web Audio is missing', async () => {
    vi.stubGlobal('AudioContext', undefined);
    const { playNudgeChime } = await loadSound();
    expect(() => playNudgeChime()).not.toThrow();
  });

  it('plays one oscillator per note', async () => {
    const { FakeContext, oscillators } = fakeAudio();
    vi.stubGlobal('AudioContext', FakeContext);
    const { playNudgeChime } = await loadSound();

    playNudgeChime();

    expect(oscillators).toHaveLength(2);
    expect(oscillators.map((o) => o.frequency.value)).toEqual([660, 990]);
    // Every note is both started and stopped: an oscillator left running leaks per nudge.
    expect(oscillators.every((o) => o.started.length === 1 && o.stopped.length === 1)).toBe(true);
  });

  // The footgun this guards: `exponentialRampToValueAtTime(0, …)` throws a RangeError in every
  // real browser. jsdom has no Web Audio to throw it, so nothing else here would ever notice a
  // SILENT_GAIN quietly rewritten to 0 — the chime would simply start throwing in production.
  it('never ramps the envelope to an exponentially impossible zero', async () => {
    const { FakeContext, rampTargets } = fakeAudio();
    vi.stubGlobal('AudioContext', FakeContext);
    const { playNudgeChime } = await loadSound();

    playNudgeChime();

    expect(rampTargets.length).toBeGreaterThan(0);
    expect(rampTargets.every((v) => v > 0)).toBe(true);
  });

  // The whole point of the toggle. A mute that still spun up the audio graph would be the kind of
  // half-mute people stop trusting.
  it('is silent when the user has muted it', async () => {
    const { FakeContext, oscillators } = fakeAudio();
    vi.stubGlobal('AudioContext', FakeContext);
    const { playNudgeChime, toggleSound } = await loadSound();
    toggleSound();

    playNudgeChime();

    expect(oscillators).toHaveLength(0);
  });

  // Autoplay refused: `resume()` has not settled, so the context is still suspended. Scheduling
  // into it builds a graph nobody hears and nothing collects, a little more with every nudge.
  it('schedules nothing into a context that is not running', async () => {
    const { FakeContext, oscillators } = fakeAudio();
    class Suspended extends FakeContext {
      state = 'suspended';
    }
    vi.stubGlobal('AudioContext', Suspended);
    const { playNudgeChime } = await loadSound();

    playNudgeChime();

    expect(oscillators).toHaveLength(0);
  });
});
