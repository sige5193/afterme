/**
 * WebAudio 合成音效（原样平移原型的 Sound）：敲棺材板 / 锣 / 木鱼 / 铃 / 化纸 / 呼啸 / 哀乐，
 * 另加一个很轻的 8-bit 按键音。
 */

import type { SoundName } from './ui';

type ToneOpts = {
  type?: OscillatorType;
  gain?: number;
  wet?: boolean;
  slide?: number;
};

type NoiseOpts = {
  freq?: number;
  q?: number;
  gain?: number;
};

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let verb: DelayNode | null = null;
let dirgeTimer: ReturnType<typeof setTimeout> | null = null;

function ac(): AudioContext | null {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
      const d = ctx.createDelay();
      d.delayTime.value = 0.27;
      const fb = ctx.createGain();
      fb.gain.value = 0.32;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1800;
      d.connect(fb);
      fb.connect(lp);
      lp.connect(d);
      d.connect(master);
      verb = d;
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(f: number, t0: number, dur: number, { type = 'sine', gain = 0.2, wet = true, slide = 0 }: ToneOpts = {}) {
  const c = ac();
  if (!c || !master) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(master);
  if (wet && verb) g.connect(verb);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noise(t0: number, dur: number, { freq = 300, q = 1, gain = 0.3 }: NoiseOpts = {}) {
  const c = ac();
  if (!c || !master) return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const s = c.createBufferSource();
  const f = c.createBiquadFilter();
  const g = c.createGain();
  s.buffer = buf;
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  g.gain.value = gain;
  s.connect(f);
  f.connect(g);
  g.connect(master);
  s.start(t0);
}

function knock() {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  [0, 0.2, 0.4].forEach((d) => {
    tone(110, t + d, 0.18, { gain: 0.5, wet: false, slide: 70 });
    noise(t + d, 0.08, { freq: 260, q: 2, gain: 0.5 });
  });
}

function gong() {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  (
    [
      [98, 0.35],
      [196, 0.12],
      [294, 0.06],
      [415, 0.04],
    ] as const
  ).forEach(([f, g]) => tone(f, t, 4, { gain: g }));
}

function muyu() {
  const c = ac();
  if (!c) return;
  tone(760, c.currentTime, 0.16, { gain: 0.35, slide: 420 });
}

function bell() {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  tone(880, t, 2.6, { gain: 0.12 });
  tone(1318, t + 0.02, 2.2, { gain: 0.07 });
  tone(1760, t + 0.5, 2, { gain: 0.05 });
}

function crackle(sec = 3) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  noise(t, sec, { freq: 900, q: 0.4, gain: 0.12 });
  for (let i = 0; i < sec * 14; i++) {
    noise(t + Math.random() * sec, 0.02, { freq: 1500 + Math.random() * 2500, q: 3, gain: 0.35 });
  }
}

function whoosh() {
  const c = ac();
  if (!c) return;
  noise(c.currentTime, 1.2, { freq: 500, q: 0.5, gain: 0.25 });
}

function click() {
  const c = ac();
  if (!c) return;
  tone(660, c.currentTime, 0.05, { type: 'square', gain: 0.04, wet: false, slide: 520 });
}

function stopDirge() {
  if (dirgeTimer != null) clearTimeout(dirgeTimer);
  dirgeTimer = null;
}

function dirge() {
  stopDirge();
  if (!ac()) return;
  // 自写的五声小调慢板
  const A3 = 220;
  const mel: [number, number][] = [
    [A3, 1.2],
    [261.6, 0.8],
    [293.7, 1.2],
    [329.6, 1.6],
    [293.7, 0.8],
    [261.6, 0.8],
    [A3, 1.6],
    [196, 1.2],
    [220, 2.4],
    [261.6, 1.2],
    [329.6, 0.8],
    [392, 1.2],
    [329.6, 1.6],
    [293.7, 0.8],
    [261.6, 1.2],
    [A3, 2.8],
  ];
  let i = 0;
  const step = () => {
    const cc = ac();
    if (!cc) return;
    const [f, d] = mel[i % mel.length]!;
    tone(f, cc.currentTime, d * 1.25, { type: 'triangle', gain: 0.13 });
    if (i % 4 === 0) tone(110, cc.currentTime, 3.2, { gain: 0.07 });
    i++;
    dirgeTimer = setTimeout(step, d * 1000);
  };
  step();
}

export function playSound(name: SoundName, arg?: number): void {
  switch (name) {
    case 'knock':
      return knock();
    case 'gong':
      return gong();
    case 'muyu':
      return muyu();
    case 'bell':
      return bell();
    case 'whoosh':
      return whoosh();
    case 'dirge':
      return dirge();
    case 'crackle':
      return crackle(arg ?? 3);
    case 'click':
      return click();
    case 'stop':
      return stopDirge();
  }
}
