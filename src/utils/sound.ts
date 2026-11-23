// Synthesised chimes via Web Audio. No audio files. Silent where AudioContext is unavailable.

let enabled = true;
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!enabled) return null;
  if (!ctx) {
    const Ctor = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.15) {
  try {
    const ac = audio();
    if (!ac) return;
    const t = ac.currentTime + start;
    const osc = ac.createOscillator();
    const amp = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(amp).connect(ac.destination);
    osc.start(t);
    osc.stop(t + dur);
  } catch {
    // Audio is decorative; a failing device must never break gameplay.
  }
}

export function playTap() {
  tone(880, 0, 0.08);
}

export function playError() {
  tone(220, 0, 0.25, 'triangle');
}

export function playWin() {
  [523, 659, 784].forEach((f, i) => tone(f, i * 0.12, 0.3));
}

export function setSoundEnabled(on: boolean) {
  enabled = on;
}
