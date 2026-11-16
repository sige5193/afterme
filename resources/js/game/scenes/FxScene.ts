/**
 * 特效层（在最上面）：纸钱雨、化纸、做梦（白天先闭眼）、合葬仪式、迁坟。
 */

import Phaser from 'phaser';
import { Subscriptions } from '@/core/bus';
import { isNight } from '@/core/clock';
import { itemsText } from '@/core/offerings';
import { type FxRequest, sfx } from '@/core/ui';
import { ago } from '@/utils/time';
import { button, revealTxt, setTxt, txt, vbox } from '../ui/kit';
import { COL } from '../ui/theme';
import { setFxActive } from '../ui/uiState';

type Coin = { img: Phaser.GameObjects.Image; vy: number; sw: number; ph: number };

const DREAM_PALETTES: Record<string, [number, number, number]> = {
  plain: [0x3b2a63, 0x1d3d5c, 0x0a0814],
  warm: [0x6b3d1e, 0x5c3b55, 0x140a06],
  scary: [0x5a0b0b, 0x2a0606, 0x0d0303],
  mystic: [0x0f4d3a, 0x2b2a63, 0x050d0a],
};

export default class FxScene extends Phaser.Scene {
  private subs = new Subscriptions();
  private coins: Coin[] = [];
  private overlay: Phaser.GameObjects.GameObject[] = [];
  private blocker: Phaser.GameObjects.Rectangle | null = null;
  private active: FxRequest['kind'] | null = null;
  private finish: (() => void) | null = null;
  private t = 0;
  private flames: Array<{ r: Phaser.GameObjects.Rectangle; vx: number; vy: number; life: number; max: number }> = [];
  private heat = 0;
  private basin = { x: 0, y: 0 };
  private queue: FxRequest[] = [];

  constructor() {
    super({ key: 'Fx' });
  }

  create(): void {
    this.subs.on('fx', (req) => this.play(req));
    addEventListener('keydown', this.onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.subs.clear();
      removeEventListener('keydown', this.onKey);
    });
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && (this.active === 'dream' || this.active === 'burn')) this.finish?.();
  };

  private play(req: FxRequest): void {
    if (req.kind === 'joss') {
      this.joss(req.count ?? 70);
      return;
    }
    if (req.kind === 'shake') {
      this.cameras.main.shake(300, 0.01);
      return;
    }
    if (this.active) {
      this.queue.push(req);
      return;
    }
    if (req.kind === 'burn') this.burn(req.items, req.name, req.label, req.onDone);
    else if (req.kind === 'dream') this.dream(req);
    else if (req.kind === 'union') this.union(req.onDone);
    else if (req.kind === 'move') this.move(req.onDone);
  }

  private begin(kind: FxRequest['kind'], dim = 0.72): void {
    this.active = kind;
    setFxActive(true);
    const { width, height } = this.scale;
    this.blocker = this.add.rectangle(0, 0, width, height, 0x000000, dim).setOrigin(0, 0).setInteractive();
    this.overlay.push(this.blocker);
  }

  private end(cb?: () => void): void {
    const objs = this.overlay;
    this.overlay = [];
    this.flames = [];
    this.finish = null;
    this.tweens.add({
      targets: objs.filter((o) => 'alpha' in o),
      alpha: 0,
      duration: 300,
      ease: 'Stepped',
      easeParams: [4],
      onComplete: () => {
        for (const o of objs) o.destroy();
      },
    });
    this.time.delayedCall(310, () => {
      this.active = null;
      setFxActive(false);
      cb?.();
      const next = this.queue.shift();
      if (next) this.play(next);
    });
  }

  private add2<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.overlay.push(o);
    return o;
  }

  /* ---------------- 纸钱雨 ---------------- */

  joss(n: number): void {
    const { width, height } = this.scale;
    for (let i = 0; i < n; i++) {
      const img = this.add.image(Math.random() * width, -10 - Math.random() * height * 0.6, 'coin-0').setDepth(100);
      this.coins.push({ img, vy: 40 + Math.random() * 50, sw: Math.random() * 6, ph: Math.random() * 6 });
    }
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(0.05, delta / 1000);
    this.t += dt;
    const H = this.scale.height;
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.img.y += c.vy * dt;
      c.img.x += Math.sin(this.t * 1.6 + c.sw) * 0.5;
      c.img.setTexture(`coin-${Math.floor(Math.abs(Math.sin(this.t * 2.5 + c.ph)) * 2.99)}`);
      if (c.img.y > H + 12) {
        c.img.destroy();
        this.coins.splice(i, 1);
      }
    }
    if (this.active === 'burn') this.updateFire(dt);
  }

  /* ---------------- 化纸 ---------------- */

  private burn(items: Record<string, number>, name: string, label: string | undefined, onDone?: () => void): void {
    this.begin('burn', 0.78);
    const { width: W, height: H } = this.scale;
    const cx = Math.round(W / 2);
    const cy = Math.round(H * 0.66);
    this.basin = { x: cx, y: cy };
    this.heat = 0.25;
    const g = this.add2(this.add.graphics());
    // 火盆
    g.fillStyle(0x16131d, 1);
    g.fillRect(cx - 46, cy, 92, 22);
    g.fillStyle(0x4a4f5a, 1);
    g.fillRect(cx - 44, cy + 2, 88, 18);
    g.fillStyle(0x6b717c, 1);
    g.fillRect(cx - 44, cy + 2, 88, 3);
    g.fillStyle(0x2a2d35, 1);
    g.fillRect(cx - 36, cy + 22, 6, 10);
    g.fillRect(cx + 30, cy + 22, 6, 10);
    const msg = this.add2(txt(this, '正在化纸……', { color: COL.joss, scale: 2 }));
    msg.setOrigin(0.5, 0).setPosition(cx, Math.round(cy + 44));
    const sub = this.add2(txt(this, `给 ${name} · ${label ?? itemsText(items)}`, { color: COL.dim, wrap: Math.min(W - 20, 420), align: 'center' }));
    sub.setOrigin(0.5, 0).setPosition(cx, Math.round(cy + 72));
    sfx('crackle', 3.6);

    const icons: string[] = [];
    for (const [k, n] of Object.entries(items)) for (let i = 0; i < Math.min(n, 3); i++) icons.push(k);
    icons.splice(14);
    icons.forEach((k, i) => {
      const sx = cx + (Math.random() - 0.5) * Math.min(W * 0.8, 520);
      const img = this.add2(this.add.image(sx, -20, k.startsWith('__') ? `icon-${k.slice(2)}` : `item-${k}`).setScale(2));
      this.tweens.add({
        targets: img,
        x: cx + (Math.random() - 0.5) * 40,
        y: cy - 4,
        angle: (Math.random() - 0.5) * 400,
        scale: 0.6,
        delay: 200 + i * 170,
        duration: 1400,
        ease: 'Quad.easeIn',
        onComplete: () => {
          img.setVisible(false);
          this.heat = Math.min(1.25, this.heat + 0.14);
        },
      });
    });
    const total = Math.max(3400, 200 + icons.length * 170 + 1800);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      this.end(onDone);
    };
    this.finish = finish;
    this.time.delayedCall(total - 900, () => {
      if (done) return;
      msg.setText('[raw]已送达 · 阴间到账[/raw]');
      this.joss(40);
    });
    this.time.delayedCall(total + 600, finish);
    this.time.delayedCall(1500, () => this.blocker?.once('pointerdown', finish));
  }

  private updateFire(dt: number): void {
    const { x, y } = this.basin;
    const n = Math.round(4 * this.heat + 1);
    for (let i = 0; i < n; i++) {
      const ember = Math.random() < 0.1;
      const size = ember ? 1 : 2 + Math.floor(Math.random() * 3 * this.heat);
      const r = this.add.rectangle(x + (Math.random() - 0.5) * 80 * Math.min(1, this.heat + 0.3), y, size, size, ember ? 0xffd27a : 0xffb347);
      r.setBlendMode(Phaser.BlendModes.ADD);
      this.overlay.push(r);
      this.flames.push({ r, vx: (Math.random() - 0.5) * 20, vy: -(30 + Math.random() * 70 * this.heat) * (ember ? 1.6 : 1), life: 0, max: 0.5 + Math.random() * 0.7 });
    }
    for (let i = this.flames.length - 1; i >= 0; i--) {
      const f = this.flames[i];
      f.life += dt;
      const k = f.life / f.max;
      if (k >= 1) {
        f.r.destroy();
        this.flames.splice(i, 1);
        continue;
      }
      f.r.x += f.vx * dt + Math.sin((f.life + f.r.y) * 4) * 0.3;
      f.r.y += f.vy * dt;
      f.r.setFillStyle(k < 0.3 ? 0xffe08a : k < 0.6 ? 0xff9a3a : 0xc4453a, 1 - k);
    }
  }

  /* ---------------- 做梦 ---------------- */

  private dream(req: Extract<FxRequest, { kind: 'dream' }>): void {
    this.begin('dream', 0);
    sfx('bell');
    const { width: W, height: H } = this.scale;
    const showCard = () => this.dreamCard(req);
    if (isNight()) {
      showCard();
      return;
    }
    // 白天：先闭眼眯一会儿
    const top = this.add2(this.add.rectangle(0, -H / 2, W, H / 2, 0x000000).setOrigin(0, 0));
    const bot = this.add2(this.add.rectangle(0, H, W, H / 2, 0x000000).setOrigin(0, 0));
    this.tweens.add({ targets: top, y: 0, duration: 800, ease: 'Stepped', easeParams: [8] });
    this.tweens.add({ targets: bot, y: H / 2, duration: 800, ease: 'Stepped', easeParams: [8] });
    const t = this.add2(txt(this, '白天做不了梦，先眯一会儿……', { color: COL.dim }));
    t.setOrigin(0.5, 0.5).setPosition(Math.round(W / 2), Math.round(H / 2)).setDepth(10).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, delay: 700, duration: 400 });
    this.time.delayedCall(2300, () => {
      t.destroy();
      showCard();
      top.setDepth(20);
      bot.setDepth(20);
      this.tweens.add({ targets: top, y: -H / 2, duration: 1000, ease: 'Stepped', easeParams: [8] });
      this.tweens.add({ targets: bot, y: H, duration: 1000, ease: 'Stepped', easeParams: [8] });
    });
  }

  private dreamCard(req: Extract<FxRequest, { kind: 'dream' }>): void {
    const { width: W, height: H } = this.scale;
    const pal = DREAM_PALETTES[req.style] ?? DREAM_PALETTES.plain;
    this.add2(this.add.rectangle(0, 0, W, H, pal[2]).setOrigin(0, 0));
    const g = this.add2(this.add.graphics());
    // 两团慢慢飘的光（像素圆）
    const blob = (cx: number, cy: number, r: number, color: number) => {
      for (let i = 4; i >= 1; i--) {
        g.fillStyle(color, 0.12 * (5 - i));
        g.fillCircle(cx, cy, Math.round((r * i) / 4));
      }
    };
    blob(Math.round(W * 0.15), Math.round(H * 0.18), 160, pal[0]);
    blob(Math.round(W * 0.88), Math.round(H * 0.85), 200, pal[1]);
    this.tweens.add({ targets: g, x: 12, y: -8, duration: 6000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const cardW = Math.min(W - 24, 440);
    const card = vbox(this, { width: cardW, pad: { left: 12, right: 12, top: 10, bottom: 12 }, space: 8, bg: 'dream' });
    card.add(txt(this, '你做了一个梦', { color: COL.dim }), { align: 'center' });
    const body = txt(this, '', { color: COL.bone, wrap: cardW - 24, align: 'center', scale: cardW >= 300 && [...req.text].length <= 40 ? 2 : 1 });
    card.add(body, { align: 'center' });
    const sig = txt(this, `—— ${req.fromName} 托梦 · ${ago(req.at)}`, { color: COL.dim, wrap: cardW - 24, align: 'center' });
    card.add(sig, { align: 'center' });
    let lotto: ReturnType<typeof txt> | null = null;
    if (req.style === 'mystic') {
      lotto = txt(this, `梦里的数字：${lottoOf(req.id)}\n仅供娱乐，阴间不负责兑奖`, { color: COL.green, align: 'center', wrap: cardW - 24 });
      card.add(lotto, { align: 'center' });
    }
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      this.end(req.onClose);
    };
    this.finish = close;
    const wake = button(this, '醒来', { kind: 'primary', onClick: close });
    card.add(wake, { align: 'center' });
    // 先用全文排一次版，保证卡片高度不跳
    setTxt(body, req.text);
    card.setOrigin(0.5, 0.5);
    card.layout();
    card.setPosition(Math.round(W / 2), Math.round(H / 2));
    this.add2(card);
    const chars = [...req.text];
    body.setText('');
    sig.setAlpha(0);
    lotto?.setAlpha(0);
    wake.setAlpha(0);
    let i = 0;
    const step = () => {
      if (closed) return;
      i++;
      revealTxt(body, req.text, chars.slice(0, i).join('').length);
      if (i < chars.length) this.time.delayedCall(70, step);
      else {
        this.tweens.add({ targets: sig, alpha: 1, duration: 500, delay: 300 });
        if (lotto) this.tweens.add({ targets: lotto, alpha: 1, duration: 500, delay: 700 });
        this.tweens.add({ targets: wake, alpha: 1, duration: 400, delay: 1000 });
      }
    };
    this.time.delayedCall(600, step);
  }

  /* ---------------- 合葬 ---------------- */

  private union(onDone?: () => void): void {
    this.begin('union', 0.6);
    const { width: W, height: H } = this.scale;
    const cx = Math.round(W / 2);
    const cy = Math.round(H * 0.45);
    const a = this.add2(this.add.image(-20, cy, 'ghost-right-0').setScale(3));
    const b = this.add2(this.add.image(W + 20, cy, 'ghost-left-0').setScale(3));
    this.tweens.add({ targets: a, x: cx - 14, duration: 1200, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: b, x: cx + 14, duration: 1200, ease: 'Sine.easeOut' });
    const glow = this.add2(this.add.image(cx, cy, 'glow-wisp-90').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0));
    this.tweens.add({ targets: glow, alpha: 1, delay: 1100, duration: 600 });
    const t = this.add2(txt(this, '从今往后，一起躺', { color: COL.joss, scale: W >= 420 ? 3 : 2 }));
    t.setOrigin(0.5, 0).setPosition(cx, cy + 40).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, y: cy + 34, delay: 900, duration: 800 });
    this.time.delayedCall(1200, () => this.joss(60));
    this.time.delayedCall(3000, () => this.end(onDone));
  }

  /* ---------------- 迁坟 ---------------- */

  private move(onDone?: () => void): void {
    this.begin('move', 0.35);
    const { width: W, height: H } = this.scale;
    const y = Math.round(H * 0.5);
    const g = this.add2(this.add.image(-30, y, 'ghost-right-0').setScale(3));
    const c = this.add2(this.add.image(-30, y - 34, 'coffin-small').setScale(2));
    sfx('whoosh');
    this.tweens.add({ targets: [g, c], x: W + 40, duration: 900, ease: 'Sine.easeInOut' });
    this.time.delayedCall(950, () => this.end(onDone));
  }
}

function lottoOf(id: string | number): string {
  let seed = [...String(id)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296;
  const nums = new Set<number>();
  while (nums.size < 6) nums.add(1 + Math.floor(rnd() * 33));
  const bonus = String(1 + Math.floor(rnd() * 16)).padStart(2, '0');
  return (
    [...nums]
      .sort((a, b) => a - b)
      .map((n) => String(n).padStart(2, '0'))
      .join(' ') +
    ' + ' +
    bonus
  );
}
