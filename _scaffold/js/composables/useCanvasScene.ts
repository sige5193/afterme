import { type MaybeRefOrGetter, toValue } from 'vue';
import { clamp, REDUCED } from '../utils/text';

type Star = { x: number; y: number; r: number; p: number };
type Wisp = { x: number; y: number; vy: number; vx: number; r: number; p: number; life: number };
type Fog = { x: number; y: number; rx: number; ry: number; v: number };
type Tree = { x: number; hgt: number; wd: number };

export type UseCanvasSceneOptions = {
  /** 背景 canvas */
  canvas: MaybeRefOrGetter<HTMLCanvasElement | null | undefined>;
  /** 是否夜里（替代原型 body.day 判断） */
  isNight: MaybeRefOrGetter<boolean>;
  /**
   * 可选：用于计算地平线的墓位网格元素（原型 `#grid`）。
   * 不传则在 canvas 父级内找 `.grid`。
   */
  gridEl?: MaybeRefOrGetter<HTMLElement | null | undefined>;
  /** 可选：场景是否可见；默认看 canvas 是否连在文档上 */
  isActive?: MaybeRefOrGetter<boolean>;
};

/**
 * 原型 BG：夜空、月亮、雾、鬼火。白天画阴天太阳。
 */
export function useCanvasScene(opts: UseCanvasSceneOptions) {
  let cv: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let w = 0;
  let h = 0;
  let lastSig = '';
  let horizon = 260;
  let stars: Star[] = [];
  let wisps: Wisp[] = [];
  let fogs: Fog[] = [];
  let hills: number[] = [];
  let trees: Tree[] = [];
  let raf = 0;
  let lastT = 0;
  let resizeObs: ResizeObserver | null = null;
  let onVis: (() => void) | null = null;

  function resolveCanvas(): HTMLCanvasElement | null {
    return toValue(opts.canvas) ?? null;
  }

  function nightNow(): boolean {
    return !!toValue(opts.isNight);
  }

  function activeNow(): boolean {
    if (opts.isActive != null) return !!toValue(opts.isActive);
    return !!cv?.isConnected;
  }

  function newWisp(any: boolean): Wisp {
    return {
      x: Math.random() * w,
      y: any ? horizon + Math.random() * (h - horizon) : h + 20,
      vy: -(0.15 + Math.random() * 0.35),
      vx: (Math.random() - 0.5) * 0.3,
      r: 5 + Math.random() * 7,
      p: Math.random() * 6,
      life: 0,
    };
  }

  function kick() {
    cancelAnimationFrame(raf);
    raf = 0;
    if (REDUCED) draw(0);
    else raf = requestAnimationFrame(loop);
  }

  function loop(t: number) {
    if (document.hidden || !cv?.isConnected || !activeNow()) {
      raf = 0;
      return;
    }
    if (t - lastT > 33) {
      draw(t);
      lastT = t;
    }
    raf = requestAnimationFrame(loop);
  }

  function relayout() {
    cv = resolveCanvas();
    if (!cv) return;
    ctx = cv.getContext('2d');
    if (!ctx) return;
    const parent = cv.parentElement;
    if (!parent) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    w = parent.clientWidth;
    h = parent.clientHeight;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const g =
      (opts.gridEl != null ? toValue(opts.gridEl) : null) ??
      (parent.querySelector('.grid') as HTMLElement | null);
    const hz = g
      ? clamp(g.getBoundingClientRect().top - cv.getBoundingClientRect().top - 16, 120, h - 60)
      : 260;
    const sig = `${w}|${h}|${Math.round(hz)}`;
    if (sig === lastSig) {
      kick();
      return;
    }
    lastSig = sig;
    horizon = hz;
    stars = Array.from({ length: Math.round(w / 9) }, () => ({
      x: Math.random() * w,
      y: Math.random() * (horizon - 30),
      r: Math.random() * 1.2 + 0.2,
      p: Math.random() * 6,
    }));
    wisps = Array.from({ length: Math.max(6, Math.round(w / 130)) }, () => newWisp(true));
    fogs = Array.from({ length: 5 }, (_, i) => ({
      x: Math.random() * w,
      y: horizon + 30 + i * (h - horizon) / 5,
      rx: 260 + Math.random() * 260,
      ry: 26 + Math.random() * 24,
      v: 0.08 + Math.random() * 0.16,
    }));
    hills = [];
    for (let x = 0; x <= w + 40; x += 40) {
      hills.push(horizon - 14 - Math.sin(x / 170) * 12 - Math.sin(x / 61) * 5);
    }
    trees = [];
    for (let x = 10; x < w; x += 50 + Math.random() * 120) {
      if (x < w * 0.3 || x > w * 0.7 || Math.random() < 0.3) {
        trees.push({ x, hgt: 40 + Math.random() * 46, wd: 9 + Math.random() * 8 });
      }
    }
    kick();
  }

  function draw(t: number) {
    if (!ctx) return;
    const night = nightNow();
    ctx.clearRect(0, 0, w, h);

    let g = ctx.createLinearGradient(0, 0, 0, horizon);
    if (night) {
      g.addColorStop(0, '#060912');
      g.addColorStop(1, '#162032');
    } else {
      g.addColorStop(0, '#dde1da');
      g.addColorStop(1, '#c4cac2');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, horizon);

    g = ctx.createLinearGradient(0, horizon, 0, h);
    if (night) {
      g.addColorStop(0, '#10161a');
      g.addColorStop(1, '#090c0e');
    } else {
      g.addColorStop(0, '#bfc5bb');
      g.addColorStop(1, '#c9cdc5');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, horizon, w, h - horizon);

    if (night) {
      for (const s of stars) {
        ctx.globalAlpha = 0.35 + 0.5 * Math.abs(Math.sin(t / 1400 + s.p));
        ctx.fillStyle = '#e8eefc';
        ctx.fillRect(s.x, s.y, s.r, s.r);
      }
      ctx.globalAlpha = 1;
      const mx = w * 0.84;
      const my = Math.min(80, horizon * 0.35);
      const halo = ctx.createRadialGradient(mx, my, 10, mx, my, 110);
      halo.addColorStop(0, 'rgba(230,236,255,.35)');
      halo.addColorStop(1, 'rgba(230,236,255,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(mx, my, 110, 0, 7);
      ctx.fill();
      ctx.fillStyle = '#eef0f6';
      ctx.beginPath();
      ctx.arc(mx, my, 24, 0, 7);
      ctx.fill();
      ctx.fillStyle = 'rgba(160,170,190,.35)';
      ctx.beginPath();
      ctx.arc(mx - 7, my - 4, 5, 0, 7);
      ctx.arc(mx + 8, my + 7, 3.5, 0, 7);
      ctx.fill();
    } else {
      const sx = w * 0.18;
      const sy = Math.min(70, horizon * 0.3);
      const sun = ctx.createRadialGradient(sx, sy, 4, sx, sy, 120);
      sun.addColorStop(0, 'rgba(255,253,240,.9)');
      sun.addColorStop(0.25, 'rgba(255,250,230,.35)');
      sun.addColorStop(1, 'rgba(255,250,230,0)');
      ctx.fillStyle = sun;
      ctx.beginPath();
      ctx.arc(sx, sy, 120, 0, 7);
      ctx.fill();
    }

    ctx.fillStyle = night ? '#0c1118' : '#a9b0a6';
    ctx.beginPath();
    ctx.moveTo(0, horizon + 2);
    hills.forEach((y, i) => ctx!.lineTo(i * 40, y));
    ctx.lineTo(w, horizon + 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = night ? '#080b10' : '#8f978c';
    for (const tr of trees) {
      ctx.beginPath();
      ctx.ellipse(tr.x, horizon - tr.hgt / 2 + 4, tr.wd, tr.hgt / 2, 0, 0, 7);
      ctx.fill();
      ctx.fillRect(tr.x - 1, horizon - 4, 2, 8);
    }

    for (const f of fogs) {
      f.x += REDUCED ? 0 : f.v;
      if (f.x - f.rx > w) f.x = -f.rx;
      const fg = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.rx);
      fg.addColorStop(0, night ? 'rgba(160,180,190,.07)' : 'rgba(255,255,255,.28)');
      fg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.scale(1, f.ry / f.rx);
      ctx.translate(-f.x, -f.y);
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.rx, 0, 7);
      ctx.fill();
      ctx.restore();
    }

    if (night) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < wisps.length; i++) {
        const p = wisps[i]!;
        if (!REDUCED) {
          p.x += p.vx + Math.sin(t / 900 + p.p) * 0.25;
          p.y += p.vy;
          p.life++;
        }
        if (p.y < horizon - 10) wisps[i] = newWisp(false);
        const a = (0.35 + 0.35 * Math.sin(t / 300 + p.p)) * clamp((p.y - horizon) / 60, 0, 1);
        const rg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
        rg.addColorStop(0, `rgba(190,255,235,${a})`);
        rg.addColorStop(0.35, `rgba(120,230,200,${a * 0.5})`);
        rg.addColorStop(1, 'rgba(80,200,170,0)');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 3, 0, 7);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  function init(c?: HTMLCanvasElement | null) {
    dispose();
    cv = c ?? resolveCanvas();
    if (!cv) return;
    ctx = cv.getContext('2d');
    if (!ctx) return;
    const parent = cv.parentElement;
    if (parent && typeof ResizeObserver !== 'undefined') {
      resizeObs = new ResizeObserver(() => relayout());
      resizeObs.observe(parent);
    }
    onVis = () => {
      if (!document.hidden) kick();
    };
    document.addEventListener('visibilitychange', onVis);
    relayout();
  }

  function dispose() {
    cancelAnimationFrame(raf);
    raf = 0;
    resizeObs?.disconnect();
    resizeObs = null;
    if (onVis) document.removeEventListener('visibilitychange', onVis);
    onVis = null;
  }

  return { init, relayout, kick, dispose };
}
