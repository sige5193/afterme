/**
 * 像素素材：全部用代码画（占位用），以后换成正式素材时只改这个文件。
 * 两种画法：
 * - 角色用字符画（每个字符对应调色板里的一个颜色）；
 * - 墓碑、树、牌坊这类规则形状用「形状函数 + 自动描边」生成。
 */

export type Facing = 'down' | 'up' | 'left' | 'right';
export type Canvas = HTMLCanvasElement;

export const OUTLINE = '#16131d';

const PAL: Record<string, string> = {
  k: OUTLINE,
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
};

export function makeCanvas(w: number, h: number): Canvas {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function ctx2d(c: Canvas): CanvasRenderingContext2D {
  const x = c.getContext('2d');
  if (!x) throw new Error('canvas 2d unavailable');
  x.imageSmoothingEnabled = false;
  return x;
}

/** 字符画 → 画布；所有行必须等宽 */
export function fromArt(rows: string[], pal: Record<string, string> = PAL): Canvas {
  const w = rows[0].length;
  for (const r of rows) {
    if (r.length !== w) throw new Error(`pixel art row width mismatch: "${r}"`);
  }
  const c = makeCanvas(w, rows.length);
  const x = ctx2d(c);
  rows.forEach((row, y) => {
    for (let i = 0; i < w; i++) {
      const color = pal[row[i]];
      if (!color) continue;
      x.fillStyle = color;
      x.fillRect(i, y, 1, 1);
    }
  });
  return c;
}

export function flipH(src: Canvas): Canvas {
  const c = makeCanvas(src.width, src.height);
  const x = ctx2d(c);
  x.translate(src.width, 0);
  x.scale(-1, 1);
  x.drawImage(src, 0, 0);
  return c;
}

/** 形状函数 + 着色函数，自动在边缘描一圈深色轮廓 */
export function shape(
  w: number,
  h: number,
  inside: (x: number, y: number) => boolean,
  color: (x: number, y: number) => string | null,
  outline: string | null = OUTLINE,
): Canvas {
  const c = makeCanvas(w, h);
  const x = ctx2d(c);
  const isIn = (px: number, py: number) => px >= 0 && py >= 0 && px < w && py < h && inside(px, py);
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      if (!isIn(px, py)) continue;
      const edge = !isIn(px - 1, py) || !isIn(px + 1, py) || !isIn(px, py - 1) || !isIn(px, py + 1);
      const col = edge && outline ? outline : color(px, py);
      if (!col) continue;
      x.fillStyle = col;
      x.fillRect(px, py, 1, 1);
    }
  }
  return c;
}

/* ---------------- 角色 ---------------- */

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

function ghostFrame(facing: Facing, frame: 0 | 1): Canvas {
  const rows = [...GHOST_BODY, ...GHOST_HEM[frame]].map((r) => r.split(''));
  const put = (x: number, y: number) => {
    rows[y][x] = 'e';
  };
  if (facing === 'down') {
    put(4, 5); put(4, 6); put(7, 5); put(7, 6); put(5, 8); put(6, 8);
  } else if (facing === 'right' || facing === 'left') {
    put(6, 5); put(6, 6); put(9, 5); put(9, 6); put(8, 8);
  }
  const c = fromArt(rows.map((r) => r.join('')));
  return facing === 'left' ? flipH(c) : c;
}

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

function personFrame(facing: Facing, legs: LegPose): Canvas {
  const dir = facing === 'left' ? 'right' : facing;
  const c = fromArt([...PERSON_HEAD, ...PERSON_FACE[dir], ...PERSON_BODY[dir], ...PERSON_LEGS[legs]]);
  return facing === 'left' ? flipH(c) : c;
}

/* ---------------- 墓碑 ---------------- */

function stoneQingshi(light: string, mid: string, dark: string, groove: string): Canvas {
  const w = 14;
  const h = 20;
  const r = 6;
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
      if (x >= 6 && x <= 7 && y >= 5 && y <= h - 6) return groove;
      if (x <= 3) return light;
      if (x >= w - 4) return dark;
      return mid;
    },
  );
}

function stoneNeon(): Canvas {
  const w = 14;
  const h = 20;
  return shape(
    w,
    h,
    (x, y) => !((x === 0 || x === w - 1) && (y === 0 || y === h - 1)),
    (x, y) => {
      if (x === 1 || x === w - 2 || y === 1 || y === h - 2) return '#4ef0ff';
      if (x >= 6 && x <= 7 && y >= 4 && y <= h - 5) return '#a8f8ff';
      return '#0b0d12';
    },
    '#061016',
  );
}

function stoneMupai(): Canvas {
  const w = 8;
  const h = 22;
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

function stoneTubao(): Canvas {
  const w = 22;
  const h = 18;
  const c = makeCanvas(w, h);
  const x = ctx2d(c);
  const mound = shape(
    w,
    10,
    (px, py) => {
      const dx = (px - (w - 1) / 2) / (w / 2);
      const dy = (py - 9.5) / 10;
      return dx * dx + dy * dy <= 1;
    },
    (px, py) => (py < 3 ? '#8a6b45' : (px + py) % 3 === 0 ? '#5a4329' : '#6f5435'),
  );
  const stake = shape(6, 12, () => true, (px) => (px <= 1 ? '#b08654' : px >= 4 ? '#6b4b2c' : '#8f6a40'));
  x.drawImage(mound, 0, h - 10);
  x.drawImage(stake, (w - 6) / 2, 0);
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

function cypress(): Canvas {
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
  x.fillStyle = OUTLINE;
  x.fillRect(5, h - 4, 4, 4);
  x.fillStyle = '#5e4127';
  x.fillRect(6, h - 4, 2, 3);
  return c;
}

function lamp(): Canvas {
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

function flag(): Canvas {
  return fromArt(
    ['kk......', 'kyyyk...', 'kyyyyyk.', 'kyyyyk..', 'kyyk....', 'kk......', 'kb......', 'kb......', 'kb......', 'kb......', 'kb......', 'kk......'],
    { ...PAL, b: '#86603a' },
  );
}

function gate(): Canvas {
  const w = 80;
  const h = 64;
  const c = makeCanvas(w, h);
  const x = ctx2d(c);
  const rect = (rx: number, ry: number, rw: number, rh: number, fill: string, outline = true) => {
    if (outline) {
      x.fillStyle = OUTLINE;
      x.fillRect(rx - 1, ry - 1, rw + 2, rh + 2);
    }
    x.fillStyle = fill;
    x.fillRect(rx, ry, rw, rh);
  };
  // 柱子和石墩
  for (const px of [7, 65]) {
    rect(px, 20, 8, 38, '#a3302a');
    x.fillStyle = '#c94a3f';
    x.fillRect(px, 20, 2, 38);
    rect(px - 2, 56, 12, 7, '#8c939c');
  }
  // 两道横梁
  rect(3, 24, 74, 5, '#a3302a');
  rect(5, 38, 70, 3, '#a3302a');
  // 屋檐，两头起翘
  rect(0, 10, 80, 8, '#3a3f4a');
  x.fillStyle = '#545b69';
  for (let i = 0; i < 80; i += 4) x.fillRect(i, 10, 2, 8);
  x.fillStyle = '#3a3f4a';
  x.fillRect(0, 7, 3, 3);
  x.fillRect(77, 7, 3, 3);
  rect(10, 6, 60, 4, '#2b2f38');
  // 匾额（文字由引擎在高分辨率层上写）
  rect(27, 12, 26, 13, '#d8b45e');
  rect(29, 14, 22, 9, '#1e1a14', false);
  return c;
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

function pathTile(seed: number): Canvas {
  const c = tile(seed, '#8b8273', [['#776f61', 18], ['#a39a89', 10]]);
  const x = ctx2d(c);
  x.fillStyle = '#6c6457';
  x.fillRect(0, 7, 16, 1);
  x.fillRect(seed % 2 ? 5 : 10, 0, 1, 7);
  x.fillRect(seed % 2 ? 11 : 3, 8, 1, 8);
  return c;
}

function waterTile(frame: number): Canvas {
  const c = tile(7 + frame, '#3c5b8a', [['#4d6fa3', 14]]);
  const x = ctx2d(c);
  x.fillStyle = '#7d9fd0';
  const o = frame ? 4 : 0;
  x.fillRect((2 + o) % 16, 4, 4, 1);
  x.fillRect((9 + o) % 16, 11, 4, 1);
  return c;
}

function fenceTile(): Canvas {
  const c = tile(3, '#4a7342', [['#3e6338', 20]]);
  const x = ctx2d(c);
  x.fillStyle = OUTLINE;
  x.fillRect(0, 5, 16, 3);
  x.fillRect(2, 1, 4, 14);
  x.fillRect(10, 1, 4, 14);
  x.fillStyle = '#4b4452';
  x.fillRect(0, 6, 16, 1);
  x.fillRect(3, 2, 2, 12);
  x.fillRect(11, 2, 2, 12);
  return c;
}

function bridgeTile(): Canvas {
  const c = makeCanvas(16, 16);
  const x = ctx2d(c);
  x.fillStyle = '#86603a';
  x.fillRect(0, 0, 16, 16);
  x.fillStyle = '#5e4127';
  for (let y = 3; y < 16; y += 4) x.fillRect(0, y, 16, 1);
  return c;
}

export interface SpriteSheet {
  ghost: Record<Facing, [Canvas, Canvas]>;
  person: Record<Facing, Record<LegPose, Canvas>>;
  stones: Record<string, Canvas>;
  tree: Canvas;
  lamp: Canvas;
  flag: Canvas;
  gate: Canvas;
  grass: Canvas[];
  path: Canvas[];
  water: [Canvas, Canvas];
  fence: Canvas;
  bridge: Canvas;
  groupStone: (pw: number, members: number, capacity: number) => Canvas;
}

let cached: SpriteSheet | null = null;

export function getSprites(): SpriteSheet {
  if (cached) return cached;
  const facings: Facing[] = ['down', 'up', 'left', 'right'];
  const ghost = {} as Record<Facing, [Canvas, Canvas]>;
  const person = {} as Record<Facing, Record<LegPose, Canvas>>;
  for (const f of facings) {
    ghost[f] = [ghostFrame(f, 0), ghostFrame(f, 1)];
    person[f] = { idle: personFrame(f, 'idle'), walkA: personFrame(f, 'walkA'), walkB: personFrame(f, 'walkB') };
  }
  const groupCache = new Map<string, Canvas>();
  cached = {
    ghost,
    person,
    stones: {
      qingshi: stoneQingshi('#b8bfc7', '#8c939c', '#5c636d', '#666d77'),
      hanbai: stoneQingshi('#ffffff', '#efe9dc', '#c9c0ad', '#c9a24a'),
      neon: stoneNeon(),
      mupai: stoneMupai(),
      tubao: stoneTubao(),
    },
    tree: cypress(),
    lamp: lamp(),
    flag: flag(),
    gate: gate(),
    grass: [0, 1, 2, 3].map((i) => tile(11 + i * 7, '#4f7a45', [['#5d8a50', 16], ['#436a3b', 14]])),
    path: [0, 1, 2].map((i) => pathTile(5 + i)),
    water: [waterTile(0), waterTile(1)],
    fence: fenceTile(),
    bridge: bridgeTile(),
    groupStone: (pw, members, capacity) => {
      const key = `${Math.round(pw)}|${members}|${capacity}`;
      let c = groupCache.get(key);
      if (!c) {
        c = groupStone(pw, members, capacity);
        groupCache.set(key, c);
      }
      return c;
    },
  };
  return cached;
}
