const KEY = 'poker.sound';

function get(key: string): string | null {
  try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
}
function set(key: string, val: string): void {
  try { globalThis.localStorage?.setItem(key, val); } catch { /* no-op */ }
}

/** On unless explicitly turned off, so the nudge has its bite without anyone opting in first. */
export function isSoundEnabled(): boolean {
  return get(KEY) !== 'off';
}

export function toggleSound(): boolean {
  const next = !isSoundEnabled();
  set(KEY, next ? 'on' : 'off');
  return next;
}

// Synthesised rather than shipped as a file: a chime this short is a handful of oscillator nodes,
// and an .mp3 would be a build asset, a network request on first play (so the *first* nudge is the
// one that arrives late or not at all), and a licence to keep track of.
const NOTES_HZ = [660, 990];
const NOTE_SPACING_S = 0.11;
const NOTE_LENGTH_S = 0.3;
// Quiet on purpose. This fires during someone's standup, on whatever volume they last used.
const PEAK_GAIN = 0.14;
// Not zero: `exponentialRampToValueAtTime` throws a RangeError on a target of 0, in every browser
// that implements it. Inaudible is as close to silence as an exponential ramp is allowed to get.
const SILENT_GAIN = 0.0001;

type WebkitWindow = { webkitAudioContext?: typeof AudioContext };

let ctx: AudioContext | null = null;

// One context for the tab's lifetime — browsers cap how many a page may create, and a room can
// easily see a dozen nudges. Created on first play, not at import: constructing one before any
// user gesture starts it suspended and Chrome logs a warning on every load.
function context(): AudioContext | null {
  const Ctor = globalThis.AudioContext ?? (globalThis as WebkitWindow).webkitAudioContext;
  // jsdom has no Web Audio, and neither do some locked-down embedded browsers.
  if (!Ctor) return null;
  ctx ??= new Ctor();
  return ctx;
}

/**
 * A two-note rising chime, played only if the user has not muted it.
 *
 * Silently does nothing when Web Audio is missing or the context refuses to start: a nudge that
 * cannot be heard still shows its banner and its animation, and throwing here would take the
 * whole voting stage down over a decoration.
 */
export function playNudgeChime(): void {
  if (!isSoundEnabled()) return;
  const ac = context();
  if (!ac) return;
  // A context created before the page had a user gesture starts suspended, and stays suspended
  // until something resumes it. Guests reach this screen by clicking Join, so this almost always
  // resolves immediately — but "almost always" is why it is not left to chance.
  void ac.resume?.().catch(() => { /* autoplay refused; the visual cue still lands */ });
  // Scheduling into a context that is not running builds an audio graph nobody will ever hear and
  // nothing will ever collect — one that leaks a little further with every nudge. `resume()` above
  // has not settled yet, so this skips the nudge that discovers the block, not every later one.
  if (ac.state !== 'running') return;

  const start = ac.currentTime + 0.02;
  NOTES_HZ.forEach((hz, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = hz;

    const at = start + i * NOTE_SPACING_S;
    // Ramped, not switched: a gain that jumps from 0 to full is a click, and two clicks either
    // side of a sine read as a pop rather than a chime.
    gain.gain.setValueAtTime(SILENT_GAIN, at);
    gain.gain.exponentialRampToValueAtTime(PEAK_GAIN, at + 0.015);
    gain.gain.exponentialRampToValueAtTime(SILENT_GAIN, at + NOTE_LENGTH_S);

    osc.connect(gain).connect(ac.destination);
    osc.start(at);
    // Stopped explicitly so the node is collected; an oscillator left running is a leak per nudge.
    osc.stop(at + NOTE_LENGTH_S + 0.02);
  });
}
