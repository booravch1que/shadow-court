import type { SoundCue } from './logic/describe';

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    const Ctor = globalThis.AudioContext ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    context ??= new Ctor();
    if (context.state === 'suspended') void context.resume();
    return context;
  } catch {
    return null;
  }
}

/** Call from a click handler so the browser allows sound later. */
export function unlockAudio(): void {
  audio();
}

function tone(ctx: AudioContext, freq: number, start: number, length: number, type: OscillatorType, volume: number, endFreq?: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  const t0 = ctx.currentTime + start;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + length);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + length + 0.02);
}

/** Small synthesized effects, so there are no audio files to ship. */
export function playCue(cues: SoundCue[]): void {
  const ctx = audio();
  if (!ctx) return;
  for (const cue of cues) {
    switch (cue) {
      case 'coin':
        tone(ctx, 1320, 0, 0.09, 'triangle', 0.08);
        tone(ctx, 1760, 0.07, 0.14, 'triangle', 0.07);
        break;
      case 'flip':
        tone(ctx, 420, 0, 0.07, 'square', 0.04, 240);
        break;
      case 'challenge':
        tone(ctx, 220, 0, 0.28, 'sawtooth', 0.05, 120);
        break;
      case 'lose':
        tone(ctx, 330, 0, 0.35, 'triangle', 0.07, 110);
        break;
      case 'win':
        [523, 659, 784, 1047].forEach((f, i) => tone(ctx, f, i * 0.12, 0.3, 'triangle', 0.07));
        break;
    }
  }
}
