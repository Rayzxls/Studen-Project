"use client";

/**
 * The room's earcons (ADR-0053).
 *
 * Synthesised rather than shipped as files. Two reasons, and both matter:
 * the sounds every other call application uses are that application's
 * property and cannot be copied, and a handful of oscillators costs nothing
 * in the bundle where a set of audio files would be the largest asset on a
 * page that already has a bundle budget.
 *
 * They are deliberately plain — two or three short sine tones, rising to mean
 * "began" and falling to mean "ended". A class hears these dozens of times a
 * day, so anything characterful becomes something to hate by Wednesday.
 */

export type RoomSound =
  | "join"
  | "leave"
  | "mic-on"
  | "mic-off"
  | "ears-on"
  | "ears-off"
  | "share-start"
  | "share-stop";

/** [frequency in Hz, seconds from the start, length in seconds] */
type Step = readonly [number, number, number];

/**
 * Rising means it started, falling means it stopped, and the room's own events
 * carry more notes than a switch you flicked yourself. That is the whole
 * grammar, and it is meant to be learnable without anyone explaining it.
 */
const SOUNDS: Record<RoomSound, readonly Step[]> = {
  join: [
    [587.33, 0, 0.09],
    [880, 0.075, 0.11],
  ],
  leave: [
    [880, 0, 0.09],
    [587.33, 0.075, 0.11],
  ],
  "mic-on": [[880, 0, 0.07]],
  "mic-off": [[587.33, 0, 0.07]],
  "ears-on": [[1046.5, 0, 0.07]],
  "ears-off": [[783.99, 0, 0.07]],
  "share-start": [
    [587.33, 0, 0.07],
    [783.99, 0.06, 0.07],
    [1046.5, 0.12, 0.12],
  ],
  "share-stop": [
    [1046.5, 0, 0.07],
    [783.99, 0.06, 0.07],
    [587.33, 0.12, 0.12],
  ],
};

/** Quiet enough to sit under a teacher talking, not under a shared video. */
const PEAK_GAIN = 0.06;

interface WebkitWindow {
  webkitAudioContext?: typeof AudioContext;
}

let shared: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as WebkitWindow).webkitAudioContext;
  // jsdom has no Web Audio, and neither does a browser old enough to matter
  // less than the lesson does. Silence is an acceptable outcome; a crash is
  // not.
  if (!Ctor) return null;
  shared ??= new Ctor();
  return shared;
}

/**
 * Best effort in the strict sense: a browser that will not make a sound —
 * because no gesture has been seen yet, or because the tab is not allowed to —
 * must never turn that into an error in the middle of a class.
 */
export function playSound(sound: RoomSound): void {
  const ctx = context();
  if (!ctx) return;

  // Contexts start suspended until the page has seen a gesture. Entering a
  // room is a click, so by the time any of these fire there has been one.
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});

  const now = ctx.currentTime;
  for (const [frequency, at, length] of SOUNDS[sound]) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, now + at);

    // Ramped rather than switched: a square-edged start and stop is a click,
    // and a click is what makes a notification sound feel cheap.
    gain.gain.setValueAtTime(0, now + at);
    gain.gain.linearRampToValueAtTime(PEAK_GAIN, now + at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + at + length);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(now + at);
    oscillator.stop(now + at + length + 0.02);
  }
}
