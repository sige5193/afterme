/**
 * 加载画面：一个像素小人「正在走向墓地」。
 * 单独打包、不依赖任何库，页面一出来就开始走；游戏准备好以后走到牌坊下，淡出。
 * 「正在走向墓地」六个字是从像素字体里提前抠出来的点阵，不用等字体加载。
 */

import fontUrl from '../fonts/afterme-pixel.woff2?url';

const GLYPHS = [
  [0xffe, 0x040, 0x040, 0x040, 0x240, 0x27c, 0x240, 0x240, 0x240, 0x240, 0xffe],
  [0x080, 0x080, 0xffe, 0x100, 0x110, 0x210, 0x67c, 0xa10, 0x210, 0x210, 0x2fe],
  [0x040, 0x7fc, 0x040, 0x040, 0xffe, 0x040, 0x240, 0x27c, 0x240, 0x5c0, 0x83e],
  [0x080, 0x100, 0xffe, 0x802, 0x9f2, 0x912, 0x912, 0x912, 0x9f2, 0x802, 0x80e],
  [0x110, 0xffe, 0x110, 0x3f8, 0x208, 0xffe, 0x110, 0x248, 0xdf6, 0x040, 0x7fc],
  [0x410, 0x490, 0x496, 0xeba, 0x5d2, 0x492, 0x496, 0x690, 0xc82, 0x082, 0x07e],
];

// 小人：头发、脸、衣服、腿（两帧）
const PERSON = [
  '...kkkk...',
  '..kyyyyk..',
  '.kyyyyyyk.',
  'kYYYYYYYYk',
  '.kkmmmmkk.',
  '..kmmmek..',
  '..kmmmmk..',
  '..kkuukk..',
  '.kuuuuuuk.',
  '.kkuuuukmk',
  '..kuuuukk.',
  '..kuuuuk..',
];
const LEGS = [
  ['..kUkkUk..', '.kUk..kUk.', '.kk....kk.'],
  ['..kUkkUk..', '...kUUk...', '...kkkk...'],
];
const PAL: Record<string, string> = {
  k: '#16131d',
  y: '#d8b45e',
  Y: '#9c7424',
  m: '#f0c9a2',
  e: '#141820',
  u: '#3d5aa8',
  U: '#26386e',
};

type LoaderApi = {
  fontReady: Promise<unknown>;
  done: () => void;
  fail: (msg: string) => void;
};

declare global {
  interface Window {
    __afterme?: LoaderApi;
  }
}

const face = new FontFace('AftermePixel', `url(${fontUrl}) format('woff2')`);
document.fonts.add(face);
const fontReady = face.load().catch(() => undefined);

const root = document.getElementById('loader');
const canvas = document.getElementById('loader-canvas') as HTMLCanvasElement | null;
const ctx = canvas?.getContext('2d') ?? null;

let W = 0;
let H = 0;
let t = 0;
let last = performance.now();
let walked = 0;
let arriving = false;
let arrivedAt = 0;
let failMsg = '';
let raf = 0;
let finished = false;

function resize(): void {
  if (!canvas) return;
  const k = Math.max(2, Math.round(Math.min(innerWidth, innerHeight) / 150));
  W = Math.ceil(innerWidth / k);
  H = Math.ceil(innerHeight / k);
  canvas.width = W;
  canvas.height = H;
}

function px(x: number, y: number, w: number, h: number, c: string): void {
  if (!ctx) return;
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function drawArt(rows: string[], x: number, y: number): void {
  rows.forEach((row, ry) => {
    for (let i = 0; i < row.length; i++) {
      const c = PAL[row[i]];
      if (c) px(x + i, y + ry, 1, 1, c);
    }
  });
}

function drawText(x: number, y: number, color: string): void {
  GLYPHS.forEach((rows, gi) => {
    rows.forEach((bits, ry) => {
      for (let bx = 0; bx < 12; bx++) {
        if (bits & (1 << (11 - bx))) px(x + gi * 13 + bx, y + ry, 1, 1, color);
      }
    });
  });
}

function stone(x: number, ground: number, kind: number): void {
  const c = kind % 3 === 0 ? '#3a4150' : kind % 3 === 1 ? '#4a3a2a' : '#5a5f6a';
  if (kind % 3 === 1) {
    px(x, ground - 11, 4, 11, '#16131d');
    px(x + 1, ground - 10, 2, 10, c);
    return;
  }
  px(x - 1, ground - 10, 8, 10, '#16131d');
  px(x, ground - 11, 6, 1, '#16131d');
  px(x, ground - 9, 6, 9, c);
  px(x + 1, ground - 10, 4, 1, c);
}

function gate(x: number, ground: number): void {
  px(x, ground - 26, 3, 26, '#16131d');
  px(x + 1, ground - 25, 1, 25, '#a3302a');
  px(x + 21, ground - 26, 3, 26, '#16131d');
  px(x + 22, ground - 25, 1, 25, '#a3302a');
  px(x - 3, ground - 31, 30, 4, '#16131d');
  px(x - 2, ground - 30, 28, 2, '#3a3f4a');
  px(x - 1, ground - 22, 26, 2, '#a3302a');
  px(x + 8, ground - 29, 8, 5, '#d8b45e');
  px(x + 9, ground - 28, 6, 3, '#1e1a14');
}

function frame(now: number): void {
  if (!ctx || finished) return;
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;
  t += dt;
  const speed = arriving ? 46 : 16;
  walked += dt * speed;

  // 夜空
  const bands = ['#06080f', '#0a0e1a', '#0e1424', '#121a2e'];
  const ground = Math.round(H * 0.66);
  bands.forEach((c, i) => px(0, (i * ground) / bands.length, W, Math.ceil(ground / bands.length) + 1, c));
  for (let i = 0; i < 40; i++) {
    const sx = (i * 97 + 13) % W;
    const sy = (i * 53 + 7) % Math.max(1, ground - 20);
    if ((i + Math.floor(t * 2)) % 7 !== 0) px(sx, sy, 1, 1, '#c9d2e0');
  }
  px(W * 0.78, H * 0.16, 7, 7, '#e9e4d0');
  px(W * 0.78 + 3, H * 0.16 - 1, 6, 6, '#06080f');

  // 远山
  for (let x = 0; x < W; x += 2) {
    const h = 6 + Math.round(Math.sin((x + walked * 0.2) / 23) * 3 + Math.sin((x + walked * 0.2) / 9));
    px(x, ground - h, 2, h, '#0c1220');
  }
  // 地面和小路
  px(0, ground, W, H - ground, '#0e1a12');
  px(0, ground, W, 1, '#1c3022');
  for (let x = -((walked * 1) % 8); x < W; x += 8) px(x, ground + 4, 4, 1, '#2a2f2a');

  // 路边的坟
  const spacing = 34;
  const off = walked % spacing;
  for (let i = -1; i < W / spacing + 2; i++) {
    const x = i * spacing - off + 10;
    const idx = Math.floor((walked + i * spacing) / spacing);
    stone(x, ground, ((idx % 5) + 5) % 5);
  }

  // 牌坊：快准备好时从右边过来
  const personX = Math.round(W * 0.32);
  if (arriving) {
    const p = Math.min(1, (now - arrivedAt) / 900);
    const gx = Math.round(W + 10 - p * (W + 10 - personX - 14));
    gate(gx, ground);
  }

  // 小人
  const step = Math.floor(t * 6) % 2;
  const bob = step ? 0 : -1;
  drawArt([...PERSON, ...LEGS[step]], personX, ground - 15 + bob);

  // 文字
  const tw = 6 * 13 - 1;
  const ty = Math.round(H * 0.8);
  if (failMsg) {
    ctx.font = '12px AftermePixel, sans-serif';
    ctx.fillStyle = '#e0685a';
    ctx.textAlign = 'center';
    ctx.fillText(failMsg, Math.round(W / 2), ty + 9);
    ctx.fillStyle = '#a6a192';
    ctx.fillText('点一下再试', Math.round(W / 2), ty + 26);
  } else {
    const tx = Math.round((W - tw - 12) / 2);
    drawText(tx, ty, '#e8c46a');
    const dots = Math.floor(t * 2.5) % 4;
    for (let i = 0; i < dots; i++) px(tx + tw + 3 + i * 3, ty + 9, 1, 1, '#e8c46a');
  }

  raf = requestAnimationFrame(frame);
}

function done(): void {
  if (arriving) return;
  arriving = true;
  arrivedAt = performance.now();
  setTimeout(() => {
    root?.classList.add('gone');
    setTimeout(() => {
      finished = true;
      cancelAnimationFrame(raf);
      root?.remove();
    }, 600);
  }, 950);
}

function fail(msg: string): void {
  failMsg = msg;
  root?.addEventListener('click', () => location.reload(), { once: true });
}

resize();
addEventListener('resize', resize);
raf = requestAnimationFrame(frame);

window.__afterme = { fontReady, done, fail };
