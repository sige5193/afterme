/**
 * 像素字自己画。
 *
 * 浏览器画 12px 小字会做抗锯齿和字体平滑（macOS 上的 Safari 最明显），像素字的笔画会被抹开、发糊。
 * 这里接管 rex 文字的 drawText：每个字放大 8 倍画一次，取每个像素格正中间那一点，
 * 得到干净的 0/1 字模（抗锯齿和平滑都只影响格子边缘，碰不到中心），再按颜色拼成一整段贴上去。
 * 只接管 12px 的 AftermePixel；emoji、描边、别的字体还是交给浏览器。
 */

import { FONT, FONT_SIZE } from './theme';

/** 栅格化时放大的倍数 */
const SCALE = 8;
/** 字体 ascender 1400 / descender 400（每 em 1200）→ 12px 时上 14 下 4 */
const ASCENT = 14;
const DESCENT = 4;
const ROWS = ASCENT + DESCENT;
/** 字模左右各留两格，防止个别字形出界 */
const PAD = 2;
const PICTO = /\p{Extended_Pictographic}/u;

/** rex 量出来的是 ascent 12 / descent 2；写死，各浏览器排版一致 */
export const TEXT_METRICS = { ascent: 12, descent: 2, fontSize: 14 };

type Glyph = { cols: number; bits: Uint8Array };

type RexStyle = {
  fontFamily?: string;
  fontSize?: string;
  color?: unknown;
  stroke?: unknown;
  strokeThickness?: number;
  letterSpacing?: number;
};

type RexCanvasText = {
  autoRound: boolean;
  context: CanvasRenderingContext2D;
};

type DrawText = (this: RexCanvasText, x: number, y: number, text: string, style: RexStyle) => void;

const glyphs = new Map<string, Glyph | null>();
const advances = new Map<string, number>();
const colors = new Map<string, number | null>();

let big: CanvasRenderingContext2D | null = null;
let small: CanvasRenderingContext2D | null = null;
let strip: CanvasRenderingContext2D | null = null;

function context(width: number, height: number, readBack: boolean): CanvasRenderingContext2D | null {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas.getContext('2d', readBack ? { willReadFrequently: true } : undefined);
}

/** 字体没到之前量的数不进缓存 */
function fontReady(): boolean {
  return document.fonts?.check(`${FONT_SIZE}px ${FONT}`) ?? true;
}

function smallContext(): CanvasRenderingContext2D | null {
  small ??= context(1, 1, true);
  return small;
}

function advance(ch: string): number {
  const hit = advances.get(ch);
  if (hit != null) return hit;
  const ctx = smallContext();
  if (!ctx) return FONT_SIZE;
  ctx.font = `${FONT_SIZE}px ${FONT}`;
  const width = ctx.measureText(ch).width;
  if (fontReady()) advances.set(ch, width);
  return width;
}

function rasterize(ch: string): Glyph | null {
  const cols = Math.ceil(advance(ch)) + PAD * 2;
  const width = cols * SCALE;
  const height = ROWS * SCALE;
  if (!big || big.canvas.width < width) big = context(Math.max(width, 256), height, true);
  if (!big) return null;
  big.clearRect(0, 0, width, height);
  big.font = `${FONT_SIZE * SCALE}px ${FONT}`;
  big.textBaseline = 'alphabetic';
  big.fillStyle = '#fff';
  big.fillText(ch, PAD * SCALE, ASCENT * SCALE);
  const data = big.getImageData(0, 0, width, height).data;
  const bits = new Uint8Array(cols * ROWS);
  const half = SCALE >> 1;
  for (let y = 0; y < ROWS; y++) {
    const row = (y * SCALE + half) * width;
    for (let x = 0; x < cols; x++) {
      if (data[(row + x * SCALE + half) * 4 + 3] >= 128) bits[y * cols + x] = 1;
    }
  }
  return { cols, bits };
}

/** null 表示这个字交给浏览器画（emoji 之类） */
function glyph(ch: string): Glyph | null {
  const hit = glyphs.get(ch);
  if (hit !== undefined) return hit;
  const result = PICTO.test(ch) ? null : rasterize(ch);
  if (fontReady()) glyphs.set(ch, result);
  return result;
}

/** CSS 颜色 → ImageData 里用的 32 位像素（小端：ABGR） */
function pixelColor(css: string): number | null {
  const hit = colors.get(css);
  if (hit !== undefined) return hit;
  const ctx = smallContext();
  if (!ctx) return null;
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = '#000';
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  const value = a === 0 ? null : ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
  colors.set(css, value);
  return value;
}

/** 在 (x, y)（基线）画一段同色的字；画不了返回 false */
function drawRun(target: CanvasRenderingContext2D, text: string, x: number, y: number, css: string): boolean {
  const color = pixelColor(css);
  if (color == null) return false;
  const chars = Array.from(text);
  const starts: number[] = [];
  let total = 0;
  for (const ch of chars) {
    starts.push(Math.round(total));
    total += advance(ch);
  }
  const width = Math.ceil(total) + PAD * 2;
  if (!strip || strip.canvas.width < width) strip = context(Math.max(width, 256), ROWS, false);
  if (!strip) return false;
  const image = strip.createImageData(width, ROWS);
  const pixels = new Uint32Array(image.data.buffer);
  const leftovers: Array<[string, number]> = [];
  chars.forEach((ch, i) => {
    if (ch === ' ' || ch === '\u3000') return;
    const g = glyph(ch);
    if (!g) {
      leftovers.push([ch, starts[i]]);
      return;
    }
    const left = starts[i];
    const cols = Math.min(g.cols, width - left);
    for (let gy = 0; gy < ROWS; gy++) {
      const src = gy * g.cols;
      const dst = gy * width + left;
      for (let gx = 0; gx < cols; gx++) {
        if (g.bits[src + gx]) pixels[dst + gx] = color;
      }
    }
  });
  strip.putImageData(image, 0, 0);
  target.drawImage(strip.canvas, 0, 0, width, ROWS, x - PAD, y - ASCENT, width, ROWS);
  for (const [ch, left] of leftovers) {
    target.fillText(ch, x + left, y);
  }
  return true;
}

let installed = false;

/** 换掉 rex 画字的方法（所有 BBCodeText 共用一个原型，装一次就行） */
export function installPixelText(sample: object): boolean {
  if (installed) return true;
  const canvasText = (sample as { canvasText?: object }).canvasText;
  const proto = canvasText ? (Object.getPrototypeOf(canvasText) as { drawText?: DrawText }) : null;
  const original = proto?.drawText;
  if (!proto || !original) return false;
  installed = true;
  proto.drawText = function (this: RexCanvasText, x: number, y: number, text: string, style: RexStyle): void {
    const simple =
      style.fontFamily === FONT &&
      style.fontSize === `${FONT_SIZE}px` &&
      !style.letterSpacing &&
      !(style.stroke && style.stroke !== 'none' && (style.strokeThickness ?? 0) > 0) &&
      typeof style.color === 'string' &&
      style.color !== 'none';
    if (!simple) {
      original.call(this, x, y, text, style);
      return;
    }
    if (this.autoRound) {
      x = Math.round(x);
      y = Math.round(y);
    }
    if (!drawRun(this.context, text, x, y, style.color as string)) {
      original.call(this, x, y, text, style);
    }
  };
  return true;
}
