/**
 * 像素画工具：字符画转画布、形状函数自动描边、九宫格边框。
 * 所有素材都用代码画，生成的画布注册成 Phaser 纹理。
 */

export type Canvas = HTMLCanvasElement;

export const C = {
  out: '#16131d',
  ink0: '#07080c',
  ink1: '#0f1117',
  ink2: '#181b24',
  ink3: '#232733',
  ink4: '#2e3341',
  line: '#3a3d4a',
  bone: '#ece6d6',
  boneDim: '#a6a192',
  dim: '#6f6a5c',
  joss: '#e0b85a',
  jossL: '#f3d68a',
  jossD: '#9c7424',
  seal: '#c4453a',
  sealL: '#e0685a',
  sealD: '#7a2019',
  wisp: '#9fe8d4',
  wispD: '#4fa894',
  paper: '#e8dcc0',
  paperL: '#f4ecd6',
  paperD: '#c9b88f',
  paperInk: '#2b2016',
  wood: '#86603a',
  woodL: '#a87c4f',
  woodD: '#5e4127',
  stone: '#8c939c',
  stoneL: '#b8bfc7',
  stoneD: '#5c636d',
  white: '#ffffff',
  black: '#000000',
} as const;

export function makeCanvas(w: number, h: number): Canvas {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function ctx2d(c: Canvas): CanvasRenderingContext2D {
  const x = c.getContext('2d', { willReadFrequently: false });
  if (!x) throw new Error('canvas 2d unavailable');
  x.imageSmoothingEnabled = false;
  return x;
}

/** 字符画 → 画布；所有行必须等宽，'.' 和空格是透明 */
export function fromArt(rows: string[], pal: Record<string, string>): Canvas {
  const w = Math.max(...rows.map((r) => r.length));
  const c = makeCanvas(w, rows.length);
  const x = ctx2d(c);
  rows.forEach((row, y) => {
    for (let i = 0; i < row.length; i++) {
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

/** 顺时针转 90° */
export function rotate90(src: Canvas): Canvas {
  const c = makeCanvas(src.height, src.width);
  const x = ctx2d(c);
  x.translate(src.height, 0);
  x.rotate(Math.PI / 2);
  x.drawImage(src, 0, 0);
  return c;
}

export function scaleUp(src: Canvas, k: number): Canvas {
  const c = makeCanvas(src.width * k, src.height * k);
  const x = ctx2d(c);
  x.drawImage(src, 0, 0, src.width * k, src.height * k);
  return c;
}

/** 把整张图换成单色（做剪影、阴影用） */
export function tint(src: Canvas, color: string): Canvas {
  const c = makeCanvas(src.width, src.height);
  const x = ctx2d(c);
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = color;
  x.fillRect(0, 0, c.width, c.height);
  return c;
}

/** 黑白化（遗像用） */
export function grayscale(src: Canvas, contrast = 1.1): Canvas {
  const c = makeCanvas(src.width, src.height);
  const x = ctx2d(c);
  x.drawImage(src, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) {
    const g = 0.3 * d.data[i] + 0.59 * d.data[i + 1] + 0.11 * d.data[i + 2];
    const v = Math.max(0, Math.min(255, (g - 128) * contrast + 128));
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
  }
  x.putImageData(d, 0, 0);
  return c;
}

/** 形状函数 + 着色函数，自动在边缘描一圈深色轮廓 */
export function shape(
  w: number,
  h: number,
  inside: (x: number, y: number) => boolean,
  color: (x: number, y: number) => string | null,
  outline: string | null = C.out,
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

/**
 * 九宫格边框：rings 从外到内每圈 1px 的颜色，notch 是四个角切掉的像素数（像素圆角），
 * fill 是中间的底色；top/bottom 给内部加一道高光 / 阴影。
 */
export function frame(
  size: number,
  rings: string[],
  fill: string | null,
  opts: { notch?: number; top?: string; bottom?: string; left?: string; right?: string; speckle?: [string, number] } = {},
): Canvas {
  const c = makeCanvas(size, size);
  const x = ctx2d(c);
  const notch = opts.notch ?? 1;
  const n = rings.length;
  const cut = (px: number, py: number, inset: number) => {
    // 角上切掉的三角形，越往里切得越少
    const k = Math.max(0, notch - inset);
    const dx = Math.min(px, size - 1 - px);
    const dy = Math.min(py, size - 1 - py);
    return dx + dy < k;
  };
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const d = Math.min(px, py, size - 1 - px, size - 1 - py);
      if (cut(px, py, 0)) continue;
      let col: string | null = null;
      if (d < n) col = rings[d];
      else {
        col = fill;
        const inner = d - n;
        if (inner === 0) {
          if (opts.top && py === n) col = opts.top;
          if (opts.left && px === n) col = opts.left;
          if (opts.bottom && py === size - 1 - n) col = opts.bottom;
          if (opts.right && px === size - 1 - n) col = opts.right;
        }
      }
      // 内层圈的角也要切，免得圆角里露出外圈颜色
      if (d < n && cut(px, py, d + 1) && d + 1 < n) col = rings[Math.min(n - 1, d + 1)];
      if (!col) continue;
      x.fillStyle = col;
      x.fillRect(px, py, 1, 1);
    }
  }
  if (opts.speckle && fill) {
    const [color, count] = opts.speckle;
    let s = 7;
    const rnd = () => {
      s = (s * 1103515245 + 12345) >>> 0;
      return s / 4294967296;
    };
    x.fillStyle = color;
    for (let i = 0; i < count; i++) {
      const px = n + 1 + Math.floor(rnd() * (size - 2 * n - 2));
      const py = n + 1 + Math.floor(rnd() * (size - 2 * n - 2));
      x.fillRect(px, py, 1, 1);
    }
  }
  return c;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 4×4 Bayer 有序抖动矩阵，做像素风的光晕渐变 */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** 抖动的径向光斑（白色，透明度分档），给夜里的灯光擦黑幕用 */
export function lightBrush(r: number, bands = 4): Canvas {
  const size = r * 2;
  const c = makeCanvas(size, size);
  const x = ctx2d(c);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const d = Math.hypot(px + 0.5 - r, py + 0.5 - r) / r;
      if (d >= 1) continue;
      const v = (1 - d) * bands;
      const band = Math.floor(v);
      const frac = v - band;
      const threshold = (BAYER[(py % 4) * 4 + (px % 4)] + 0.5) / 16;
      const level = band + (frac > threshold ? 1 : 0);
      const a = Math.min(1, level / bands);
      if (a <= 0) continue;
      x.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
      x.fillRect(px, py, 1, 1);
    }
  }
  return c;
}

/** 彩色光晕（叠加混合用） */
export function glowBrush(r: number, color: [number, number, number], strength: number): Canvas {
  const size = r * 2;
  const c = makeCanvas(size, size);
  const x = ctx2d(c);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const d = Math.hypot(px + 0.5 - r, py + 0.5 - r) / r;
      if (d >= 1) continue;
      const step = Math.ceil((1 - d) * 3) / 3;
      const threshold = (BAYER[(py % 4) * 4 + (px % 4)] + 0.5) / 16;
      if ((1 - d) * 3 - Math.floor((1 - d) * 3) < threshold * 0.5 && step < 0.5) continue;
      x.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${(step * strength).toFixed(3)})`;
      x.fillRect(px, py, 1, 1);
    }
  }
  return c;
}
