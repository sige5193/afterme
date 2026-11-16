/**
 * 界面九宫格边框：面板、纸张、卡片、输入框、按钮（四种状态 × 四种样式）、标签、提示条。
 */

import { C, type Canvas, ctx2d, frame, makeCanvas } from './art';

export type FrameDef = { canvas: Canvas; corner: number };

export type ButtonKind = 'normal' | 'primary' | 'seal' | 'quiet' | 'wisp';
export type ButtonState = 'up' | 'hover' | 'down' | 'off';

const BUTTON_COLORS: Record<ButtonKind, { body: string; hi: string; lo: string; ring: string }> = {
  normal: { body: '#2c303d', hi: '#4a4f60', lo: '#191c24', ring: C.out },
  primary: { body: '#d9ae55', hi: '#f3d68a', lo: '#8c6a24', ring: '#2a1d08' },
  seal: { body: '#b8342a', hi: '#e0685a', lo: '#6e1c16', ring: '#1d0705' },
  quiet: { body: '#14161d', hi: '#22252f', lo: '#0c0d12', ring: '#2c2f3a' },
  wisp: { body: '#2f6f62', hi: '#5fb8a4', lo: '#173d35', ring: '#06140f' },
};

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** 按钮：1px 描边、顶部 1px 高光、底部 2px 阴影；按下去时高光阴影对调 */
function button(kind: ButtonKind, st: ButtonState): Canvas {
  const size = 12;
  const c = makeCanvas(size, size);
  const x = ctx2d(c);
  let { body, hi, lo, ring } = BUTTON_COLORS[kind];
  if (st === 'hover') {
    body = shade(body, 1.18);
    hi = shade(hi, 1.12);
  }
  if (st === 'off') {
    body = '#24262d';
    hi = '#2e3038';
    lo = '#17181d';
    ring = '#101116';
  }
  const pressed = st === 'down';
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const corner = (px === 0 || px === size - 1) && (py === 0 || py === size - 1);
      if (corner) continue;
      let col = body;
      if (px === 0 || py === 0 || px === size - 1 || py === size - 1) col = ring;
      else if (pressed) {
        if (py <= 2) col = lo;
      } else if (py === 1) col = hi;
      else if (py >= size - 3) col = lo;
      x.fillStyle = col;
      x.fillRect(px, py, 1, 1);
    }
  }
  return c;
}

export function buildFrames(): Record<string, FrameDef> {
  const out: Record<string, FrameDef> = {
    panel: {
      canvas: frame(16, [C.out, C.jossD, C.joss, C.out], C.ink2, { notch: 2, top: C.ink3 }),
      corner: 6,
    },
    drawer: {
      canvas: frame(16, [C.out, C.jossD, C.out], C.ink2, { notch: 1, top: C.ink3 }),
      corner: 5,
    },
    paper: {
      // 九宫格的中间会被拉伸，不能有杂点
      canvas: frame(16, ['#3a2a18', '#8a7350', C.paperD], C.paper, { notch: 1, top: C.paperL }),
      corner: 5,
    },
    card: {
      canvas: frame(12, [C.out, C.line], C.ink1, { notch: 1, top: '#1a1d26' }),
      corner: 4,
    },
    cardHi: {
      canvas: frame(12, [C.out, C.joss], C.ink2, { notch: 1, top: C.ink3 }),
      corner: 4,
    },
    cardSeal: {
      canvas: frame(12, [C.out, C.seal], '#1a1013', { notch: 1, top: '#24151a' }),
      corner: 4,
    },
    cardPaper: {
      canvas: frame(12, ['#5a4630', C.paperD], C.paperL, { notch: 1 }),
      corner: 4,
    },
    inset: {
      canvas: frame(12, [C.out], '#0b0c11', { notch: 0, top: '#040508', left: '#040508', bottom: '#2a2d38', right: '#2a2d38' }),
      corner: 3,
    },
    insetFocus: {
      canvas: frame(12, [C.joss], '#0b0c11', { notch: 0, top: '#040508', left: '#040508' }),
      corner: 3,
    },
    insetPaper: {
      canvas: frame(12, ['#8a7350'], C.paperL, { notch: 0, top: '#d9cba6', left: '#d9cba6' }),
      corner: 3,
    },
    insetPaperFocus: {
      canvas: frame(12, [C.seal], C.paperL, { notch: 0, top: '#d9cba6', left: '#d9cba6' }),
      corner: 3,
    },
    chip: {
      canvas: frame(10, [C.line], '#14161d', { notch: 1 }),
      corner: 3,
    },
    chipHover: {
      canvas: frame(10, [C.boneDim], '#1b1e27', { notch: 1 }),
      corner: 3,
    },
    chipOn: {
      canvas: frame(10, [C.joss], '#2a2310', { notch: 1 }),
      corner: 3,
    },
    chipPaper: {
      canvas: frame(10, ['#8a7350'], C.paperL, { notch: 1 }),
      corner: 3,
    },
    chipPaperOn: {
      canvas: frame(10, [C.seal], '#f6dccf', { notch: 1 }),
      corner: 3,
    },
    toast: {
      canvas: frame(12, [C.out, C.wispD], '#0d1015', { notch: 1, top: '#151a20' }),
      corner: 4,
    },
    toastErr: {
      canvas: frame(12, [C.out, C.seal], '#140c0d', { notch: 1 }),
      corner: 4,
    },
    prompt: {
      canvas: frame(10, [C.out, C.joss], '#0e1016', { notch: 1 }),
      corner: 3,
    },
    promptNight: {
      canvas: frame(10, [C.out, C.wisp], '#0b1114', { notch: 1 }),
      corner: 3,
    },
    hud: {
      canvas: frame(12, ['#0a0b10'], C.ink1, { notch: 0, bottom: C.line }),
      corner: 3,
    },
    tab: {
      canvas: frame(10, [C.line], C.ink1, { notch: 1 }),
      corner: 3,
    },
    tabOn: {
      canvas: frame(10, [C.joss], '#2a2310', { notch: 1 }),
      corner: 3,
    },
    badge: {
      canvas: frame(10, [C.out], C.seal, { notch: 2, top: C.sealL }),
      corner: 4,
    },
    dream: {
      canvas: frame(16, ['#00000000', '#ffffff33', '#ffffff18'], '#00000055', { notch: 3 }),
      corner: 6,
    },
  };
  const kinds: ButtonKind[] = ['normal', 'primary', 'seal', 'quiet', 'wisp'];
  const states: ButtonState[] = ['up', 'hover', 'down', 'off'];
  for (const k of kinds) {
    for (const s of states) out[`btn-${k}-${s}`] = { canvas: button(k, s), corner: 4 };
  }
  return out;
}
