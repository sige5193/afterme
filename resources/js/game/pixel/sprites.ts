/**
 * 地图上的像素素材：鬼、活人、墓碑、树、灯、牌坊、房子、地砖。
 * 角色用字符画；墓碑、树、牌坊这类规则形状用「形状函数 + 自动描边」生成。
 */

import { C, type Canvas, ctx2d, flipH, fromArt, makeCanvas, rotate90, shape } from './art';

export type Facing = 'down' | 'up' | 'left' | 'right';

const PAL: Record<string, string> = {
  k: C.out,
  K: '#2b2733',
  f: '#f4f1ea',
  F: '#c7d3e0',
  e: '#141820',
  y: '#d8b45e',
  Y: '#9c7424',
  m: '#f0c9a2',
  u: '#3d5aa8',
  U: '#26386e',
  r: '#b8342a',
  w: C.wood,
  W: C.woodD,
  l: C.woodL,
};

/* ---------------- 鬼 ---------------- */

const GHOST_BODY = [
  '....kkkk....',
  '..kkffffkk..',
  '.kffffffffk.',
  '.kffffffffk.',
  'kffffffffffk',
  'kffffffffffk',
  'kffffffffffk',
  'kffffffffffk',
  'kffffffffffk',
  'kfffffffffFk',
  'kFffffffffFk',
  'kFFffffffFFk',
];
const GHOST_HEM = [
  ['kFkFFkkFFkFk', '.k.kk..kk.k.'],
  ['kkFFkFFkFFkk', 'k..kk..kk..k'],
];

/** sleepy：魂游时闭着眼 */
export function ghostFrame(facing: Facing, frame: 0 | 1, sleepy = false): Canvas {
  const rows = [...GHOST_BODY, ...GHOST_HEM[frame]].map((r) => r.split(''));
  const put = (x: number, y: number) => {
    rows[y][x] = 'e';
  };
  if (sleepy) {
    if (facing === 'down') {
      put(3, 6); put(4, 6); put(7, 6); put(8, 6); put(5, 8); put(6, 8);
    } else if (facing === 'left' || facing === 'right') {
      put(6, 6); put(9, 6); put(10, 6); put(8, 8);
    }
  } else if (facing === 'down') {
    put(4, 5); put(4, 6); put(7, 5); put(7, 6); put(5, 8); put(6, 8);
  } else if (facing === 'right' || facing === 'left') {
    put(6, 5); put(6, 6); put(9, 5); put(9, 6); put(8, 8);
  }
  const c = fromArt(rows.map((r) => r.join('')), PAL);
  return facing === 'left' ? flipH(c) : c;
}

/** 躺在棺材里的鬼（转 90°，闭眼） */
export function ghostLying(): Canvas {
  return rotate90(ghostFrame('down', 0, true));
}

/** 翻过身、脸朝下：看到的是后背 */
export function ghostLyingBack(): Canvas {
  return rotate90(ghostFrame('up', 0, true));
}

/* ---------------- 活人 ---------------- */

const PERSON_HEAD = ['...kkkk...', '..kyyyyk..', '.kyyyyyyk.', 'kYYYYYYYYk'];
const PERSON_FACE: Record<'down' | 'up' | 'right', string[]> = {
  down: ['.kkmmmmkk.', '..kmemek..', '..kmmmmk..'],
  up: ['.kkKKKKkk.', '..kKKKKk..', '..kKKKKk..'],
  right: ['.kkmmmmkk.', '..kmmmek..', '..kmmmmk..'],
};
const PERSON_BODY: Record<'down' | 'up' | 'right', string[]> = {
  down: ['..kkuukk..', '.kuuuuuuk.', 'kmkuuuukmk', '.kkuuuukk.', '..kuuuuk..'],
  up: ['..kkuukk..', '.kuuuuuuk.', 'kmkuuuukmk', '.kkuuuukk.', '..kuuuuk..'],
  right: ['..kkuukk..', '.kuuuuuuk.', '.kkuuuukmk', '..kuuuukk.', '..kuuuuk..'],
};
const PERSON_LEGS = {
  idle: ['..kUkkUk..', '..kUkkUk..', '..kk..kk..'],
  walkA: ['..kUkkUk..', '.kUk..kUk.', '.kk....kk.'],
  walkB: ['..kUkkUk..', '...kUUk...', '...kkkk...'],
};
export type LegPose = keyof typeof PERSON_LEGS;

export function personFrame(facing: Facing, legs: LegPose): Canvas {
  const dir = facing === 'left' ? 'right' : facing;
  const c = fromArt([...PERSON_HEAD, ...PERSON_FACE[dir], ...PERSON_BODY[dir], ...PERSON_LEGS[legs]], PAL);
  return facing === 'left' ? flipH(c) : c;
}

/* ---------------- 墓碑 ---------------- */

function stoneQingshi(light: string, mid: string, dark: string, groove: string, w = 14, h = 20): Canvas {
  const r = Math.floor(w / 2) - 1;
  return shape(
    w,
    h,
    (x, y) => {
      if (y >= r) return true;
      const dx = x - (w - 1) / 2;
      const dy = y - r;
      return dx * dx + dy * dy <= (r + 0.6) * (r + 0.6);
    },
    (x, y) => {
      if (y >= h - 3) return dark;
      if (x >= Math.floor(w / 2) - 1 && x <= Math.floor(w / 2) && y >= 5 && y <= h - 6) return groove;
      if (x <= 3) return light;
      if (x >= w - 4) return dark;
      return mid;
    },
  );
}

function stoneNeon(w = 14, h = 20): Canvas {
  return shape(
    w,
    h,
    (x, y) => !((x === 0 || x === w - 1) && (y === 0 || y === h - 1)),
    (x, y) => {
      if (x === 1 || x === w - 2 || y === 1 || y === h - 2) return '#4ef0ff';
      if (x >= Math.floor(w / 2) - 1 && x <= Math.floor(w / 2) && y >= 4 && y <= h - 5) return '#a8f8ff';
      return '#0b0d12';
    },
    '#061016',
  );
}

function stoneMupai(w = 8, h = 22): Canvas {
  return shape(
    w,
    h,
    (x, y) => y >= 3 || Math.abs(x - (w - 1) / 2) <= y + 0.5,
    (x, y) => {
      if (x === 2 && y % 5 !== 0) return '#5e4127';
      if (x <= 1) return '#a87c4f';
      if (x >= w - 2) return '#5e4127';
      return '#86603a';
    },
  );
}

function stoneTubao(w = 22, h = 18): Canvas {
  const c = makeCanvas(w, h);
  const x = ctx2d(c);
  const moundH = Math.round(h * 0.56);
  const mound = shape(
    w,
    moundH,
    (px, py) => {
      const dx = (px - (w - 1) / 2) / (w / 2);
      const dy = (py - (moundH - 0.5)) / moundH;
      return dx * dx + dy * dy <= 1;
    },
    (px, py) => (py < 3 ? '#8a6b45' : (px + py) % 3 === 0 ? '#5a4329' : '#6f5435'),
  );
  const sw = Math.max(4, Math.round(w * 0.27));
  const stake = shape(sw, Math.round(h * 0.67), () => true, (px) => (px <= 1 ? '#b08654' : px >= sw - 2 ? '#6b4b2c' : '#8f6a40'));
  x.drawImage(mound, 0, h - moundH);
  x.drawImage(stake, Math.round((w - sw) / 2), 0);
  return c;
}

export const STONE_STYLES = ['qingshi', 'hanbai', 'neon', 'tubao', 'mupai'] as const;

/** 地图上的小墓碑 */
export function stoneSprite(style: string): Canvas {
  switch (style) {
    case 'hanbai':
      return stoneQingshi('#ffffff', '#efe9dc', '#c9c0ad', '#c9a24a');
    case 'neon':
      return stoneNeon();
    case 'mupai':
      return stoneMupai();
    case 'tubao':
      return stoneTubao();
    default:
      return stoneQingshi('#b8bfc7', '#8c939c', '#5c636d', '#666d77');
  }
}

/** 详情里的大墓碑底图（文字由 UI 另外叠上去）；尺寸按碑上要刻的字算 */
export function bigStone(style: string, w: number, h: number): Canvas {
  switch (style) {
    case 'hanbai':
      return bigSlab(w, h, '#ffffff', '#eee8da', '#c9c0ad', '#b9b1a0', '#c9a24a');
    case 'neon':
      return bigNeon(w, h);
    case 'mupai':
      return bigMupai(w, h);
    case 'tubao':
      return bigTubao(w, h);
    default:
      return bigSlab(w, h, '#c3c9d0', '#959ca5', '#6a717b', '#565c66', '#6f7680');
  }
}

function bigSlab(w: number, h: number, light: string, mid: string, dark: string, base: string, groove: string): Canvas {
  const sw = w - 8;
  const r = Math.floor(sw / 2) - 3;
  const c = makeCanvas(w, h);
  const x = ctx2d(c);
  const slab = shape(
    sw,
    h - 10,
    (px, py) => {
      if (py >= r) return true;
      const dx = px - (sw - 1) / 2;
      const dy = py - r;
      return dx * dx + dy * dy <= (r + 3.5) * (r + 3.5);
    },
    (px, py) => {
      if (px <= 3) return light;
      if (px >= sw - 5) return dark;
      if (py > 4 && py < 8 && px > 10 && px < sw - 11) return groove;
      return (px * 7 + py * 3) % 23 === 0 ? dark : mid;
    },
  );
  x.drawImage(slab, 4, 0);
  const plinth = shape(w, 12, () => true, (_px, py) => (py <= 2 ? mid : base));
  x.drawImage(plinth, 0, h - 12);
  return c;
}

function bigNeon(w: number, h: number): Canvas {
  return shape(
    w,
    h,
    (x, y) => !((x < 2 || x > w - 3) && (y < 2 || y > h - 3)),
    (x, y) => {
      if (x === 2 || x === w - 3 || y === 2 || y === h - 3) return '#4ef0ff';
      if (x === 4 || x === w - 5 || y === 4 || y === h - 5) return '#ff4fd8';
      if ((y + x) % 9 === 0 && y > 10 && y < h - 10) return '#10202a';
      return '#0b0d12';
    },
    '#061016',
  );
}

function bigMupai(w: number, h: number): Canvas {
  const peak = Math.floor(w / 3);
  return shape(
    w,
    h,
    (x, y) => y >= peak || Math.abs(x - (w - 1) / 2) <= y * ((w / 2) / peak) + 1,
    (x, y) => {
      if (x % 11 === 3 && y % 7 !== 0) return '#5e4127';
      if (x <= 3) return '#a87c4f';
      if (x >= w - 4) return '#5e4127';
      return (x + y * 3) % 13 === 0 ? '#6f4f2f' : '#86603a';
    },
  );
}

/** 土包碑：下面这么高的一截被土包盖住，但土包最高不超过 TUBAO_MOUND_MAX */
export const TUBAO_MOUND = 0.34;
export const TUBAO_MOUND_MAX = 64;

export function tubaoMoundH(h: number): number {
  return Math.min(Math.round(h * TUBAO_MOUND), TUBAO_MOUND_MAX);
}
/** 土包碑：木桩占碑宽的比例 */
export const TUBAO_STAKE = 0.5;

function bigTubao(w: number, h: number): Canvas {
  const c = makeCanvas(w, h);
  const x = ctx2d(c);
  const moundH = tubaoMoundH(h);
  const mound = shape(
    w,
    moundH,
    (px, py) => {
      const dx = (px - (w - 1) / 2) / (w / 2);
      const dy = (py - (moundH - 0.5)) / moundH;
      return dx * dx + dy * dy <= 1;
    },
    (px, py) => (py < 6 ? '#8a6b45' : (px * 3 + py) % 7 === 0 ? '#5a4329' : (px + py) % 5 === 0 ? '#7d6040' : '#6f5435'),
  );
  const sw = Math.max(30, Math.round(w * TUBAO_STAKE));
  const stake = shape(sw, h - 6, (px, py) => py >= 4 || (px > 1 && px < sw - 2), (px) => (px <= 3 ? '#b08654' : px >= sw - 4 ? '#6b4b2c' : '#8f6a40'));
  x.drawImage(stake, Math.round((w - sw) / 2), 0);
  x.drawImage(mound, 0, h - moundH);
  return c;
}

/** 合葬碑：一整块汉白玉，顶上压一道檐，中间一条金色墓名牌，下方是成员名字的刻痕 */
export function groupStone(pw: number, members: number, capacity: number): Canvas {
  const w = Math.max(24, Math.round(pw));
  const h = 28;
  const c = makeCanvas(w, h);
  const x = ctx2d(c);
  const body = shape(
    w - 4,
    h - 4,
    () => true,
    (px, py) => {
      if (py >= h - 7) return '#b9b1a0';
      if (px <= 2) return '#ffffff';
      if (px >= w - 8) return '#cfc7b6';
      return '#efe9dc';
    },
  );
  x.drawImage(body, 2, 4);
  const cap = shape(w, 5, (px, py) => py >= 1 || (px > 1 && px < w - 2), () => '#8c8478');
  x.drawImage(cap, 0, 0);
  x.fillStyle = '#d8b45e';
  const plateW = Math.min(w - 16, 40);
  x.fillRect(Math.round((w - plateW) / 2), 7, plateW, 3);
  x.fillStyle = '#9c7424';
  x.fillRect(Math.round((w - plateW) / 2), 10, plateW, 1);
  const slots = Math.max(2, capacity);
  const gap = (w - 12) / slots;
  for (let i = 0; i < slots; i++) {
    const sx = Math.round(6 + gap * i + gap / 2);
    x.fillStyle = i < members ? '#8a8172' : '#d9d2c3';
    for (let sy = 13; sy < h - 8; sy++) {
      if (i < members || sy % 2 === 0) x.fillRect(sx, sy, 1, 1);
    }
  }
  if (members >= 6) {
    x.fillStyle = '#b8342a';
    x.fillRect(w - 9, 13, 5, 5);
    x.fillStyle = '#f0d0c8';
    x.fillRect(w - 8, 14, 3, 3);
    x.fillStyle = '#b8342a';
    x.fillRect(w - 7, 15, 1, 1);
  }
  return c;
}

/* ---------------- 场景物件 ---------------- */

export function cypress(): Canvas {
  const w = 14;
  const h = 28;
  const c = makeCanvas(w, h);
  const x = ctx2d(c);
  const crown = shape(
    w,
    h - 3,
    (px, py) => {
      const dx = (px - (w - 1) / 2) / (w / 2);
      const dy = (py - (h - 3) / 2) / ((h - 3) / 2);
      return dx * dx + dy * dy <= 1;
    },
    (px, py) => {
      if (px < w / 2 - 1 && (px + py) % 2 === 0) return '#3f6e48';
      if (px > w / 2 + 1 && (px + py) % 2 === 0) return '#1d3826';
      return py % 4 === 0 && px % 3 === 1 ? '#1d3826' : '#2c5236';
    },
    '#0f1f15',
  );
  x.drawImage(crown, 0, 0);
  x.fillStyle = C.out;
  x.fillRect(5, h - 4, 4, 4);
  x.fillStyle = '#5e4127';
  x.fillRect(6, h - 4, 2, 3);
  return c;
}

/** 枯树（园区导览的广场边上） */
export function deadTree(): Canvas {
  return fromArt(
    [
      '.k......k..k..',
      '.kk....kk.kk..',
      '..kk..kk.kk...',
      'k..kkkk.kk....',
      'kk..kkkkk...k.',
      '.kk..kkk...kk.',
      '..kkkkkk..kk..',
      '.....kkkkkk...',
      '.....kkkk.....',
      '.....kkkk.....',
      '.....kWWk.....',
      '.....kWWk.....',
      '.....kWWk.....',
      '....kWWWWk....',
      '...kkkkkkkk...',
    ],
    PAL,
  );
}

export function lamp(): Canvas {
  return fromArt(
    [
      '..kkkk..',
      '.kyyyyk.',
      'kyoooovk',
      'kyoooovk',
      'kyoooovk',
      '.kyyyyk.',
      '..kkkk..',
      '...kK...',
      '...kK...',
      '...kK...',
      '...kK...',
      '...kK...',
      '...kK...',
      '...kK...',
      '...kK...',
      '...kK...',
      '...kK...',
      '...kK...',
      '..kKKk..',
      '.kKKKKk.',
      '.kkkkkk.',
    ],
    { ...PAL, o: '#ffe4a3', v: '#c98a3a' },
  );
}

/** 红灯笼（合葬区牌坊、户籍科门口） */
export function lantern(): Canvas {
  return fromArt(
    ['...kk...', '..kyyk..', '.krrrrk.', 'krRrrrrk', 'krRrrrrk', 'krRrrrrk', '.krrrrk.', '..kyyk..', '...yy...', '...y....'],
    { ...PAL, R: '#e0685a' },
  );
}

export function flag(): Canvas {
  return fromArt(
    ['kk......', 'kyyyk...', 'kyyyyyk.', 'kyyyyk..', 'kyyk....', 'kk......', 'kb......', 'kb......', 'kb......', 'kb......', 'kb......', 'kk......'],
    { ...PAL, b: '#86603a' },
  );
}

/** 告示牌 */
export function noticeBoard(): Canvas {
  const w = 30;
  const h = 26;
  const c = makeCanvas(w, h);
  const x = ctx2d(c);
  const board = shape(w, 16, () => true, (px, py) => (py === 1 ? C.woodL : px % 7 === 0 ? C.woodD : C.wood));
  x.drawImage(board, 0, 0);
  x.fillStyle = C.paper;
  x.fillRect(4, 3, 9, 10);
  x.fillRect(16, 4, 10, 8);
  x.fillStyle = C.paperInk;
  for (let i = 0; i < 4; i++) x.fillRect(5, 5 + i * 2, 7, 1);
  for (let i = 0; i < 3; i++) x.fillRect(17, 6 + i * 2, 8, 1);
  x.fillStyle = C.seal;
  x.fillRect(22, 9, 3, 2);
  x.fillStyle = C.out;
  x.fillRect(5, 16, 3, 10);
  x.fillRect(22, 16, 3, 10);
  x.fillStyle = C.woodD;
  x.fillRect(6, 16, 1, 9);
  x.fillRect(23, 16, 1, 9);
  return c;
}

/** 小棺材（迁坟动画里鬼扛着的那个） */
export function smallCoffin(): Canvas {
  return shape(
    22,
    9,
    (px, py) => !(py === 0 && (px < 2 || px > 19)) && !(py === 8 && (px < 3 || px > 18)),
    (px, py) => (py <= 2 ? C.woodL : px === 6 ? C.woodD : (px + py) % 9 === 0 ? C.woodD : C.wood),
  );
}

/** 纸钱：圆形方孔 */
export function jossCoin(phase: number): Canvas {
  const widths = [8, 6, 3];
  const w = widths[phase] ?? 8;
  const c = makeCanvas(8, 8);
  const x = ctx2d(c);
  const off = Math.floor((8 - w) / 2);
  const coin = shape(
    w,
    8,
    (px, py) => {
      const dx = (px + 0.5 - w / 2) / (w / 2);
      const dy = (py + 0.5 - 4) / 4;
      if (dx * dx + dy * dy > 1) return false;
      if (w >= 6 && px >= w / 2 - 1 && px <= w / 2 && py >= 3 && py <= 4) return false;
      return true;
    },
    (px) => (px < w / 2 ? '#f0d58f' : '#e2c27a'),
    '#8c6a24',
  );
  x.drawImage(coin, off, 0);
  return c;
}

export type GateTheme = {
  pillar: string;
  pillarL: string;
  roof: string;
  roofL: string;
  plaque: string;
  base: string;
  extra?: 'lantern' | 'neon' | 'books' | 'jade';
};

export const GATE_THEMES: Record<string, GateTheme> = {
  public: { pillar: '#7b7f87', pillarL: '#9aa0a8', roof: '#3a3f4a', roofL: '#545b69', plaque: '#d8b45e', base: '#5c636d' },
  worker: { pillar: '#40566e', pillarL: '#5b7690', roof: '#2a3340', roofL: '#3d4a5c', plaque: '#c9d2dc', base: '#4a5563' },
  student: { pillar: '#9a4a36', pillarL: '#b8644d', roof: '#2f5a3a', roofL: '#3f7a4c', plaque: '#e9dcb8', base: '#6b5446', extra: 'books' },
  cyber: { pillar: '#14161f', pillarL: '#4ef0ff', roof: '#1a0f24', roofL: '#ff4fd8', plaque: '#4ef0ff', base: '#0b0d12', extra: 'neon' },
  fengshui: { pillar: '#e8e2d2', pillarL: '#ffffff', roof: '#8c6a24', roofL: '#d8b45e', plaque: '#2f5a3a', base: '#b9b1a0', extra: 'jade' },
  group: { pillar: '#a3302a', pillarL: '#c94a3f', roof: '#3a3f4a', roofL: '#545b69', plaque: '#d8b45e', base: '#8c939c', extra: 'lantern' },
};

/** 牌坊：80×64，匾额上的字由场景用像素字体另外写 */
export function gate(theme: GateTheme = GATE_THEMES.group): Canvas {
  const w = 80;
  const h = 64;
  const c = makeCanvas(w, h);
  const x = ctx2d(c);
  const rect = (rx: number, ry: number, rw: number, rh: number, fill: string, outline = true) => {
    if (outline) {
      x.fillStyle = C.out;
      x.fillRect(rx - 1, ry - 1, rw + 2, rh + 2);
    }
    x.fillStyle = fill;
    x.fillRect(rx, ry, rw, rh);
  };
  for (const px of [7, 65]) {
    rect(px, 20, 8, 38, theme.pillar);
    x.fillStyle = theme.pillarL;
    x.fillRect(px, 20, 2, 38);
    rect(px - 2, 56, 12, 7, theme.base);
  }
  rect(3, 24, 74, 5, theme.pillar);
  rect(5, 38, 70, 3, theme.pillar);
  rect(0, 10, 80, 8, theme.roof);
  x.fillStyle = theme.roofL;
  for (let i = 0; i < 80; i += 4) x.fillRect(i, 10, 2, 8);
  x.fillStyle = theme.roof;
  x.fillRect(0, 7, 3, 3);
  x.fillRect(77, 7, 3, 3);
  rect(10, 6, 60, 4, theme.roof);
  rect(26, 12, 28, 14, theme.plaque);
  rect(28, 14, 24, 10, '#1e1a14', false);
  if (theme.extra === 'lantern') {
    const l = lantern();
    x.drawImage(l, 16, 29);
    x.drawImage(l, 56, 29);
  } else if (theme.extra === 'neon') {
    x.fillStyle = '#ff4fd8';
    x.fillRect(3, 30, 74, 1);
    x.fillStyle = '#4ef0ff';
    x.fillRect(5, 42, 70, 1);
  } else if (theme.extra === 'books') {
    const colors = ['#c4453a', '#3d5aa8', '#d8b45e', '#2f5a3a'];
    for (let i = 0; i < 4; i++) {
      x.fillStyle = C.out;
      x.fillRect(4 + i * 3, 50, 3, 7);
      x.fillStyle = colors[i];
      x.fillRect(4 + i * 3, 51, 2, 6);
    }
  } else if (theme.extra === 'jade') {
    x.fillStyle = '#5fae7a';
    x.fillRect(9, 44, 4, 4);
    x.fillRect(67, 44, 4, 4);
    x.fillStyle = '#8fd4a4';
    x.fillRect(9, 44, 2, 2);
    x.fillRect(67, 44, 2, 2);
  }
  return c;
}

/** 户籍科（办葬礼的地方）：48×44 的小衙门 */
export function officeBuilding(): Canvas {
  const w = 64;
  const h = 48;
  const c = makeCanvas(w, h);
  const x = ctx2d(c);
  const wall = shape(56, 26, () => true, (px, py) => (py <= 1 ? '#d9d0bd' : px % 9 === 0 ? '#b9ae96' : '#cfc4ab'));
  x.drawImage(wall, 4, 20);
  const roof = shape(
    w,
    16,
    (px, py) => py >= 4 || (px > 6 - py && px < w - 7 + py),
    (px, py) => (py % 3 === 0 ? '#2a2f3a' : px % 4 === 0 ? '#454c5c' : '#3a3f4a'),
  );
  x.drawImage(roof, 0, 6);
  x.fillStyle = '#3a3f4a';
  x.fillRect(0, 4, 3, 3);
  x.fillRect(w - 3, 4, 3, 3);
  // 门
  x.fillStyle = C.out;
  x.fillRect(24, 30, 16, 16);
  x.fillStyle = '#7a2019';
  x.fillRect(25, 31, 14, 15);
  x.fillStyle = '#a3302a';
  x.fillRect(25, 31, 6, 15);
  x.fillRect(33, 31, 6, 15);
  x.fillStyle = C.joss;
  x.fillRect(30, 38, 1, 2);
  x.fillRect(33, 38, 1, 2);
  // 匾
  x.fillStyle = C.out;
  x.fillRect(20, 21, 24, 8);
  x.fillStyle = '#1e1a14';
  x.fillRect(21, 22, 22, 6);
  x.fillStyle = C.joss;
  x.fillRect(21, 22, 22, 1);
  // 窗
  for (const wx of [8, 46]) {
    x.fillStyle = C.out;
    x.fillRect(wx, 28, 10, 10);
    x.fillStyle = '#3a2a18';
    x.fillRect(wx + 1, 29, 8, 8);
    x.fillStyle = '#ffe4a3';
    x.fillRect(wx + 2, 30, 2, 2);
    x.fillRect(wx + 6, 30, 2, 2);
    x.fillRect(wx + 2, 34, 2, 2);
    x.fillRect(wx + 6, 34, 2, 2);
  }
  const l = lantern();
  x.drawImage(l, 14, 16);
  x.drawImage(l, 42, 16);
  return c;
}

/** 土地庙（问路 / 搜索）：40×40 */
export function shrine(): Canvas {
  const w = 40;
  const h = 40;
  const c = makeCanvas(w, h);
  const x = ctx2d(c);
  const base = shape(36, 6, () => true, (_px, py) => (py === 1 ? '#9aa0a8' : '#6a717b'));
  x.drawImage(base, 2, h - 6);
  const wall = shape(28, 18, () => true, (px) => (px <= 2 ? '#c94a3f' : px >= 25 ? '#7a2019' : '#a3302a'));
  x.drawImage(wall, 6, 16);
  const roof = shape(
    w,
    14,
    (px, py) => py >= 5 || (px > 8 - py && px < w - 9 + py),
    (px, py) => (py % 3 === 0 ? '#2a5a3a' : px % 4 === 0 ? '#3f7a4c' : '#2f6a42'),
  );
  x.drawImage(roof, 0, 4);
  x.fillStyle = C.out;
  x.fillRect(15, 21, 10, 13);
  x.fillStyle = '#1a1210';
  x.fillRect(16, 22, 8, 12);
  // 土地公小像
  x.fillStyle = '#e9dcc0';
  x.fillRect(18, 25, 4, 3);
  x.fillStyle = '#ffffff';
  x.fillRect(18, 28, 4, 3);
  x.fillStyle = '#d8b45e';
  x.fillRect(17, 31, 6, 3);
  // 香炉
  x.fillStyle = C.out;
  x.fillRect(16, 35, 8, 3);
  x.fillStyle = C.joss;
  x.fillRect(17, 35, 6, 2);
  x.fillStyle = '#e8743b';
  x.fillRect(19, 33, 1, 2);
  x.fillRect(21, 32, 1, 3);
  return c;
}

/** 石凳 */
export function bench(): Canvas {
  return shape(20, 8, (px, py) => py <= 3 || px < 4 || px > 15, (px, py) => (py === 0 ? C.stoneL : py <= 3 ? C.stone : C.stoneD));
}

/* ---------------- 地砖 ---------------- */

function tile(seed: number, base: string, specks: Array<[string, number]>): Canvas {
  const c = makeCanvas(16, 16);
  const x = ctx2d(c);
  x.fillStyle = base;
  x.fillRect(0, 0, 16, 16);
  let s = seed;
  const rnd = () => {
    s = (s * 1103515245 + 12345) >>> 0;
    return s / 4294967296;
  };
  for (const [color, count] of specks) {
    x.fillStyle = color;
    for (let i = 0; i < count; i++) x.fillRect(Math.floor(rnd() * 16), Math.floor(rnd() * 16), 1, 1);
  }
  return c;
}

export function grassTile(i: number): Canvas {
  return tile(11 + i * 7, '#4f7a45', [
    ['#5d8a50', 16],
    ['#436a3b', 14],
  ]);
}

export function pathTile(seed: number): Canvas {
  const c = tile(seed, '#8b8273', [
    ['#776f61', 18],
    ['#a39a89', 10],
  ]);
  const x = ctx2d(c);
  x.fillStyle = '#6c6457';
  x.fillRect(0, 7, 16, 1);
  x.fillRect(seed % 2 ? 5 : 10, 0, 1, 7);
  x.fillRect(seed % 2 ? 11 : 3, 8, 1, 8);
  return c;
}

/** 广场的大石板 */
export function plazaTile(seed: number): Canvas {
  const c = tile(seed, '#9a9384', [
    ['#8a8374', 14],
    ['#aaa394', 8],
  ]);
  const x = ctx2d(c);
  x.fillStyle = '#7a7366';
  x.fillRect(0, 0, 16, 1);
  x.fillRect(0, 0, 1, 16);
  return c;
}

export function waterTile(frame: number): Canvas {
  const c = tile(7 + frame, '#3c5b8a', [['#4d6fa3', 14]]);
  const x = ctx2d(c);
  x.fillStyle = '#7d9fd0';
  const o = frame ? 4 : 0;
  x.fillRect((2 + o) % 16, 4, 4, 1);
  x.fillRect((9 + o) % 16, 11, 4, 1);
  return c;
}

export function fenceTile(): Canvas {
  const c = tile(3, '#4a7342', [['#3e6338', 20]]);
  const x = ctx2d(c);
  x.fillStyle = C.out;
  x.fillRect(0, 5, 16, 3);
  x.fillRect(2, 1, 4, 14);
  x.fillRect(10, 1, 4, 14);
  x.fillStyle = '#4b4452';
  x.fillRect(0, 6, 16, 1);
  x.fillRect(3, 2, 2, 12);
  x.fillRect(11, 2, 2, 12);
  return c;
}

export function bridgeTile(): Canvas {
  const c = makeCanvas(16, 16);
  const x = ctx2d(c);
  x.fillStyle = '#86603a';
  x.fillRect(0, 0, 16, 16);
  x.fillStyle = '#5e4127';
  for (let y = 3; y < 16; y += 4) x.fillRect(0, y, 16, 1);
  return c;
}
