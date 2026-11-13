import { type MaybeRefOrGetter, toValue } from 'vue';
import { REDUCED } from '../utils/text';

type Part = {
  x: number;
  y: number;
  vy: number;
  sw: number;
  r: number;
  rot: number;
  vr: number;
  flip: number;
};

export type UseJossRainOptions = {
  /** 全屏纸钱 canvas（原型 `#joss`） */
  canvas: MaybeRefOrGetter<HTMLCanvasElement | null | undefined>;
};

/**
 * 原型 Joss：圆形方孔纸钱雨。
 */
export function useJossRain(opts: UseJossRainOptions) {
  let parts: Part[] = [];
  let raf = 0;
  let onResize: (() => void) | null = null;

  function resolve(): { cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
    const cv = toValue(opts.canvas);
    if (!cv) return null;
    const ctx = cv.getContext('2d');
    if (!ctx) return null;
    return { cv, ctx };
  }

  function size() {
    const r = resolve();
    if (!r) return;
    const d = Math.min(2, devicePixelRatio || 1);
    r.cv.width = innerWidth * d;
    r.cv.height = innerHeight * d;
    r.ctx.setTransform(d, 0, 0, d, 0, 0);
  }

  function ensureResize() {
    if (onResize) return;
    onResize = () => {
      if (raf) size();
    };
    addEventListener('resize', onResize);
  }

  function loop(t: number) {
    const r = resolve();
    if (!r) {
      raf = 0;
      return;
    }
    const { ctx } = r;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter((p) => p.y < innerHeight + 30);
    for (const p of parts) {
      p.y += p.vy;
      p.x += Math.sin(t / 600 + p.sw) * 0.8;
      p.rot += p.vr;
      const sx = Math.abs(Math.cos(t / 400 + p.flip));
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(Math.max(0.15, sx), 1);
      ctx.fillStyle = '#e2c27a';
      ctx.strokeStyle = 'rgba(140,100,30,.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, p.r, 0, 7);
      ctx.rect(p.r * 0.32, -p.r * 0.32, -p.r * 0.64, p.r * 0.64);
      ctx.fill('evenodd');
      ctx.stroke();
      ctx.restore();
    }
    if (parts.length) raf = requestAnimationFrame(loop);
    else {
      raf = 0;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
    }
  }

  /** 落下 n 张纸钱（默认 70） */
  function burst(n = 70) {
    if (REDUCED) return;
    ensureResize();
    size();
    for (let i = 0; i < n; i++) {
      parts.push({
        x: Math.random() * innerWidth,
        y: -20 - Math.random() * innerHeight * 0.6,
        vy: 1.8 + Math.random() * 1.8,
        sw: Math.random() * 6,
        r: 8 + Math.random() * 7,
        rot: Math.random() * 6,
        vr: (Math.random() - 0.5) * 0.08,
        flip: Math.random() * 6,
      });
    }
    if (!raf) raf = requestAnimationFrame(loop);
  }

  function dispose() {
    cancelAnimationFrame(raf);
    raf = 0;
    parts = [];
    if (onResize) {
      removeEventListener('resize', onResize);
      onResize = null;
    }
  }

  return { burst, dispose };
}
