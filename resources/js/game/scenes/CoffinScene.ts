/**
 * 棺材里：白天躺着（敲棺材板、翻个身、数家当、诈尸），天黑可以推开棺材板出去；
 * 旁边是「上面的动静」——谁来烧过纸，留了什么话。
 */

import Phaser from 'phaser';
import * as api from '@/api/client';
import type { Offering } from '@/api/types';
import { Subscriptions } from '@/core/bus';
import { clockText, isNight, serverNow, shichenLabel, untilNightMs } from '@/core/clock';
import { fetchInbox, itemsRecord, itemsText } from '@/core/offerings';
import { ghostOut, patchTomb, setPref } from '@/core/session';
import { state } from '@/core/state';
import { openPanel, sfx, toast } from '@/core/ui';
import { fmtDur } from '@/utils/time';
import { button, clipToScroller, flow, scroller, setTxt, txt, type BBCodeText, type Sizer, vbox } from '../ui/kit';
import { offeringList } from '../ui/offeringList';
import { COL, HUD_H } from '../ui/theme';
import { uiBusy } from '../ui/uiState';
import { live } from './live';

/** 往棺材里掉的一样东西 */
type Drop = {
  obj: Phaser.GameObjects.Image;
  /** 冥币：一边落一边翻 */
  flutter: boolean;
  /** 还要等多久才开始落（毫秒） */
  wait: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 重力（像素/秒²）；0 表示匀速飘 */
  g: number;
  /** 左右晃的幅度和快慢 */
  amp: number;
  freq: number;
  t: number;
  /** 落到哪条线停下 */
  floor: number;
  landed: boolean;
  bounced: boolean;
  /** 落地后还留多久（毫秒） */
  ttl: number;
  frame: number;
  frameT: number;
};

type DropOpts = Pick<Drop, 'x' | 'y' | 'vx' | 'vy' | 'floor' | 'wait' | 'ttl'> & Partial<Pick<Drop, 'flutter' | 'g' | 'amp' | 'freq'>> & { key: string };

const FLUTTER = [0, 1, 2, 1];
const DAY_MS = 24 * 3600 * 1000;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * 在棺材里看过的最后一条香火（按坟记在本机）：没在棺材里时有人烧的，下次进棺材补一场。
 * 浏览器不让记的时候退回到内存里。
 */
const rainMemory = new Map<string, number>();

function rainKey(): string | null {
  return state.tomb ? `afterme:rained:${state.tomb.id}` : null;
}

function rainedUpTo(): number | null {
  const key = rainKey();
  if (!key) return null;
  try {
    const v = localStorage.getItem(key);
    if (v != null) return Number(v) || 0;
  } catch {
    /* 读不了就看内存 */
  }
  return rainMemory.get(key) ?? null;
}

function markRained(id: number): void {
  const key = rainKey();
  if (!key) return;
  const value = Math.max(id, rainedUpTo() ?? 0);
  rainMemory.set(key, value);
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* 隐私模式记不住就算了 */
  }
}

export default class CoffinScene extends Phaser.Scene {
  private subs = new Subscriptions();
  private gfx: Phaser.GameObjects.Graphics | null = null;
  private sleeper: Phaser.GameObjects.Image | null = null;
  private zzz: BBCodeText | null = null;
  private ui: Sizer[] = [];
  private status: BBCodeText | null = null;
  private stats: BBCodeText | null = null;
  private motes: Phaser.GameObjects.Rectangle[] = [];
  private box = { x: 0, y: 0, w: 0, h: 0 };
  private knockPending = 0;
  private knockTimer: Phaser.Time.TimerEvent | null = null;
  private knockWriting = false;
  private revealed = new Set<number>();
  private listScroll = 0;
  private listPanel: ReturnType<typeof scroller> | null = null;
  private lastNight: boolean | null = null;
  private lastOut: boolean | null = null;
  private drops: Drop[] = [];
  /** 等面板关了再下的雨（合并在一起） */
  private pendingRain: Record<string, number> | null = null;
  private pendingWait = 0;
  private boxKey = '';

  constructor() {
    super({ key: 'Coffin' });
  }

  create(): void {
    // 场景实例会被重复使用：上一次留下的对象已经随场景销毁，引用要清掉，不然 render 一读就报错
    this.gfx = null;
    this.sleeper = null;
    this.zzz = null;
    this.status = null;
    this.stats = null;
    this.listPanel = null;
    this.knockTimer = null;
    this.ui = [];
    this.motes = [];
    this.revealed = new Set();
    this.listScroll = 0;
    this.knockPending = 0;
    this.drops = [];
    this.pendingRain = null;
    this.pendingWait = 0;
    this.boxKey = '';
    this.cameras.main.setBackgroundColor('#0b0806');
    this.cameras.main.fadeIn(260, 0, 0, 0);
    this.subs
      .on('inbox', () => this.render())
      .on('offering', (o) => this.onOffering(o))
      .on('session', () => this.render())
      .on('clock', () => this.tick())
      .on('daynight', () => this.render());
    this.scale.on(Phaser.Scale.Events.RESIZE, this.render, this);
    document.addEventListener('visibilitychange', this.onVisible);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.subs.clear();
      this.scale.off(Phaser.Scale.Events.RESIZE, this.render, this);
      document.removeEventListener('visibilitychange', this.onVisible);
      this.clearDrops();
      void this.flushKnocks();
    });
    this.render();
    void fetchInbox().then(() => this.catchUp());
  }

  update(_time: number, delta: number): void {
    if (this.pendingRain && !uiBusy()) {
      this.pendingWait -= delta;
      if (this.pendingWait <= 0) {
        const items = this.pendingRain;
        this.pendingRain = null;
        this.rain(items);
      }
    }
    if (this.drops.length) this.stepDrops(delta);
  }

  /* ---------------- 钱雨 ---------------- */

  /** 正在棺材里时有人烧纸：马上下（被面板挡着就等关了再下） */
  private onOffering(o: Offering): void {
    const marker = rainedUpTo();
    if (live(this) && !document.hidden && marker != null && o.id > marker) {
      markRained(o.id);
      this.queueRain(itemsRecord(o.items), 0);
    }
    // 「上面的动静」跟着刷新；还没对过账的（或者刚才页面不在前台的）拉完再补
    void fetchInbox().then(() => this.catchUp());
  }

  private onVisible = (): void => {
    if (!document.hidden && live(this)) void fetchInbox().then(() => this.catchUp());
  };

  /** 进棺材（或回到页面）时：不在的时候有人烧过纸，补一场，再说一声是谁烧的 */
  private catchUp(): void {
    if (!live(this) || !state.tomb || document.hidden) return;
    const offerings = state.inbox.filter((i) => i.type !== 'join_request') as Offering[];
    const marker = rainedUpTo();
    // 这台设备第一次进来：只补最近一天的
    const cutoff = serverNow() - DAY_MS;
    const fresh = offerings.filter((o) => (marker == null ? Date.parse(o.created_at) >= cutoff : o.id > marker));
    markRained(offerings.reduce((m, o) => Math.max(m, o.id), marker ?? 0));
    if (!fresh.length) return;
    const merged: Record<string, number> = {};
    for (const o of fresh) {
      for (const [k, n] of Object.entries(itemsRecord(o.items))) merged[k] = (merged[k] ?? 0) + n;
    }
    const names = [...new Set(fresh.map((o) => o.from_name || '有人'))];
    const who = names.length <= 2 ? names.join('、') : `${names.slice(0, 2).join('、')} 等 ${names.length} 人`;
    toast(`你不在的时候，${who} 给你烧了 ${itemsText(merged)}`, { ms: 7000 });
    this.queueRain(merged, 700);
  }

  private queueRain(items: Record<string, number>, wait: number): void {
    const merged = { ...(this.pendingRain ?? {}) };
    for (const [k, n] of Object.entries(items)) merged[k] = (merged[k] ?? 0) + n;
    this.pendingRain = merged;
    this.pendingWait = Math.max(this.pendingWait, wait);
  }

  /** 从棺材板缝里往下掉：冥币是一场钱雨，菊花一朵朵落在身上，别的纸扎掉在旁边 */
  private rain(items: Record<string, number>): void {
    if (!live(this) || !this.sleeper) return;
    const { x, y, w } = this.box;
    const crackW = Math.floor(w * 0.36);
    const crackX = Math.round(x + w / 2 - crackW / 2);
    const s = this.sleeper;
    const floor = Math.round(s.y + s.displayHeight / 2);
    const chest = Math.round(s.y - s.displayHeight / 2 + 4);
    const top = y + 6;
    const before = this.drops.length;
    let money = false;
    for (const [key, qty] of Object.entries(items)) {
      if (qty <= 0) continue;
      if (key === 'mingbi') {
        money = true;
        const n = Math.min(60, 12 + qty * 8);
        for (let i = 0; i < n; i++) {
          const paper = i % 3 === 2;
          this.addDrop({
            key: paper ? 'rain-paper' : 'rain-bill-0',
            flutter: !paper,
            x: crackX + Math.random() * crackW,
            y: top,
            vx: rand(-22, 22),
            vy: rand(26, 44),
            amp: rand(3, 9),
            freq: rand(1.6, 3),
            floor: floor + Math.round(rand(-3, 3)),
            wait: rand(0, 2400),
            ttl: rand(7000, 9500),
          });
        }
      } else if (key === 'juhua') {
        for (let i = 0; i < Math.min(5, qty); i++) {
          const target = s.x + rand(-s.displayWidth / 3, s.displayWidth / 3);
          const x0 = crackX + Math.random() * crackW;
          const vy = rand(20, 26);
          this.addDrop({ key: 'item-juhua', x: x0, y: top, vx: (target - x0) / ((chest - top) / vy), vy, amp: rand(3, 6), freq: rand(1.2, 2), floor: chest, wait: 300 + i * 900, ttl: 12000 });
        }
      } else {
        const heavy = key === 'yuanbao';
        if (heavy) money = true;
        for (let i = 0; i < (heavy ? Math.min(12, qty * 2) : Math.min(3, qty)); i++) {
          this.addDrop({ key: `item-${key}`, x: crackX + Math.random() * crackW, y: top, vx: rand(-40, 40), vy: rand(10, 30), g: heavy ? 320 : 260, floor: floor + Math.round(rand(-2, 2)), wait: rand(200, 1800), ttl: 9000 });
        }
      }
    }
    if (this.drops.length === before) return;
    sfx(money ? 'coins' : 'whoosh', money ? 10 : undefined);
    // 棺材板缝亮一下，像是上面有人掀开了一点
    const flash = this.add.rectangle(crackX, y + 3, crackW, 4, 0xfff6d0).setOrigin(0, 0).setDepth(1);
    this.tweens.add({ targets: flash, alpha: 0, duration: 700, ease: 'Stepped', easeParams: [4], onComplete: () => flash.destroy() });
  }

  private addDrop(o: DropOpts): void {
    if (this.drops.length >= 120 || !this.textures.exists(o.key)) return;
    const obj = this.add.image(Math.round(o.x), Math.round(o.y), o.key).setOrigin(0.5, 1).setScale(2).setDepth(1).setVisible(false);
    this.drops.push({
      obj,
      flutter: !!o.flutter,
      wait: o.wait,
      x: o.x,
      y: o.y,
      vx: o.vx,
      vy: o.vy,
      g: o.g ?? 0,
      amp: o.amp ?? 0,
      freq: o.freq ?? 0,
      t: Math.random() * 6,
      floor: o.floor,
      landed: false,
      bounced: false,
      ttl: o.ttl,
      frame: 0,
      frameT: 0,
    });
  }

  private stepDrops(delta: number): void {
    const dt = Math.min(0.05, delta / 1000);
    const minX = this.box.x + 10;
    const maxX = this.box.x + this.box.w - 10;
    for (const d of [...this.drops]) {
      if (d.wait > 0) {
        d.wait -= delta;
        if (d.wait <= 0) d.obj.setVisible(true);
        continue;
      }
      if (d.landed) {
        d.ttl -= delta;
        if (d.ttl <= 0) {
          d.obj.destroy();
          this.drops.splice(this.drops.indexOf(d), 1);
        } else if (d.ttl < 1200) {
          // 一格一格淡掉
          d.obj.setAlpha(d.ttl > 800 ? 0.7 : d.ttl > 400 ? 0.4 : 0.15);
        }
        continue;
      }
      d.t += dt;
      d.vy += d.g * dt;
      d.y += d.vy * dt;
      d.x += d.vx * dt;
      if (d.x < minX || d.x > maxX) {
        d.x = Phaser.Math.Clamp(d.x, minX, maxX);
        d.vx = -d.vx * 0.5;
      }
      if (d.flutter) {
        d.frameT -= delta;
        if (d.frameT <= 0) {
          d.frameT = rand(90, 160);
          d.frame = (d.frame + 1) % FLUTTER.length;
          d.obj.setTexture(`rain-bill-${FLUTTER[d.frame]}`);
        }
      }
      if (d.y >= d.floor) {
        d.y = d.floor;
        if (d.g && d.vy > 90 && !d.bounced) {
          d.vy = -d.vy * 0.3;
          d.vx *= 0.5;
          d.bounced = true;
        } else {
          d.landed = true;
          d.x += Math.sin(d.t * d.freq) * d.amp;
          d.amp = 0;
          if (d.flutter) d.obj.setTexture('rain-bill-0');
        }
      }
      const sway = d.amp ? Math.sin(d.t * d.freq) * d.amp : 0;
      d.obj.setPosition(Math.round(Phaser.Math.Clamp(d.x + sway, minX, maxX)), Math.round(d.y));
    }
  }

  private clearDrops(): void {
    for (const d of this.drops) d.obj.destroy();
    this.drops = [];
  }

  private render(): void {
    if (!live(this)) return;
    if (this.listPanel && live(this)) this.listScroll = this.listPanel.t;
    for (const u of this.ui) u.destroy();
    this.ui = [];
    this.gfx?.destroy();
    this.sleeper?.destroy();
    this.zzz?.destroy();
    this.stats?.destroy();
    this.stats = null;
    for (const m of this.motes) m.destroy();
    this.motes = [];
    this.listPanel = null;
    const t = state.tomb;
    if (!t) return;

    const W = this.scale.width;
    const H = this.scale.height;
    const top = HUD_H + 4;
    const wide = W >= 600 && W > H * 1.05;
    const night = isNight();
    const out = ghostOut();
    this.lastNight = night;
    this.lastOut = out;

    const boxW = wide ? Math.floor(W * 0.58) - 12 : W - 12;
    const boxH = wide ? H - top - 8 : Math.min(Math.max(250, Math.floor((H - top) * 0.58)), 330);
    const bx = 6;
    const by = top;
    this.box = { x: bx, y: by, w: boxW, h: boxH };
    const boxKey = `${bx},${by},${boxW},${boxH}`;
    // 棺材换了大小（转屏、改窗口）：正在掉的东西位置都不对了，直接清掉
    if (boxKey !== this.boxKey) {
      this.clearDrops();
      this.boxKey = boxKey;
    }
    this.drawCoffin(night);

    // 躺着的鬼
    const scale = boxW >= 360 ? 4 : 3;
    this.sleeper = this.add.image(Math.round(bx + boxW / 2), Math.round(by + boxH * 0.62), state.flipped ? 'ghost-lying-back' : 'ghost-lying').setScale(scale);
    this.zzz = txt(this, 'z z z', { color: '#8fa0b8' });
    this.zzz.setPosition(Math.round(bx + boxW / 2 + 10 * scale), Math.round(by + boxH * 0.62 - 10 * scale));
    this.tweens.add({ targets: this.zzz, y: this.zzz.y - 8, alpha: 0.2, duration: 1800, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [6] });

    // 状态
    const innerW = boxW - 20;
    const head = vbox(this, { width: innerW, space: 4 });
    head.setOrigin(0, 0);
    head.add(txt(this, night ? '天黑了' : '棺材里', { color: night ? COL.wisp : COL.joss, scale: 2 }), { align: 'left' });
    this.status = txt(this, this.statusText(night), { color: COL.bone, wrap: innerW, markup: true });
    head.add(this.status, { align: 'left' });
    head.layout();
    head.setPosition(bx + 10, by + 22);
    // 字和按钮压在掉下来的东西上面
    head.setDepth(2);
    this.ui.push(head);

    // 操作
    const acts = flow(this, innerW, { space: 4, line: 4 });
    acts.add(button(this, '敲棺材板', { onClick: () => this.knock() }));
    acts.add(button(this, '翻个身', { onClick: () => this.flip() }));
    acts.add(button(this, '数数家当', { onClick: () => openPanel('wealth') }));
    if (out) acts.add(button(this, '推开棺材板，出去溜达', { kind: 'primary', icon: 'ghost', onClick: () => this.goOut() }));
    else acts.add(button(this, '诈尸（白天强行出棺）', { kind: 'seal', onClick: () => openPanel('zhashi') }));
    acts.setOrigin(0, 1);
    acts.layout();
    this.stats = txt(this, this.statsText(), { color: COL.dim, wrap: innerW });
    this.stats.setOrigin(0, 1);
    this.stats.setPosition(bx + 10, by + boxH - 8);
    acts.setPosition(bx + 10, by + boxH - 12 - this.stats.height);
    acts.setDepth(2);
    this.stats.setDepth(2);
    this.ui.push(acts as unknown as Sizer);

    // 上面的动静
    const sideX = wide ? bx + boxW + 8 : 6;
    const sideY = wide ? top : by + boxH + 6;
    const sideW = wide ? W - sideX - 6 : W - 12;
    const sideH = H - sideY - 4;
    if (sideH < 60) return;
    const side = vbox(this, { width: sideW, pad: { left: 6, right: 6, top: 5, bottom: 6 }, space: 4, bg: 'drawer' });
    side.setOrigin(0, 0);
    side.add(txt(this, `上面的动静  ${state.inbox.length} 次`, { color: COL.joss }), { align: 'left' });
    side.add(
      txt(this, out ? '可以托梦回复了。活人睡着以后就能梦到。' : '隔着棺材板听得见，但白天活人不睡觉，托梦要等天黑。点模糊的字可以贴着板子听清楚。', {
        color: COL.dim,
        wrap: sideW - 12,
      }),
      { align: 'left' },
    );
    const list = offeringList(this, sideW - 20, state.inbox, {
      muffle: !out,
      canReply: out,
      revealed: this.revealed,
      onReveal: (id) => {
        this.revealed.add(id);
        this.render();
      },
    });
    list.layout();
    side.layout();
    const listH = Math.max(40, sideH - side.height - 6);
    const sc = scroller(this, list, { width: sideW - 12, height: listH });
    side.add(sc, { expand: true });
    side.layout();
    side.setPosition(sideX, sideY);
    clipToScroller(sc);
    if (this.listScroll > 0) sc.t = this.listScroll;
    this.listPanel = sc;
    this.ui.push(side);
  }

  private drawCoffin(night: boolean): void {
    const { x, y, w, h } = this.box;
    const g = this.add.graphics();
    this.gfx = g;
    g.fillStyle(0x120a05, 1);
    g.fillRect(x - 2, y - 2, w + 4, h + 4);
    g.fillStyle(0x2a1a0e, 1);
    g.fillRect(x, y, w, h);
    g.fillStyle(0x1f130a, 1);
    for (let px = x + 18; px < x + w; px += 22) g.fillRect(px, y, 1, h);
    for (let py = y + 30; py < y + h; py += 40) g.fillRect(x, py, w, 1);
    g.fillStyle(0x3b2414, 1);
    g.fillRect(x, y, w, 2);
    g.fillRect(x, y, 2, h);
    g.fillStyle(0x160d06, 1);
    g.fillRect(x, y + h - 3, w, 3);
    // 棺材板缝和光
    const cw = Math.floor(w * 0.36);
    const cx = Math.round(x + w / 2 - cw / 2);
    g.fillStyle(night ? 0x2b3a5c : 0xffe4a3, 1);
    g.fillRect(cx, y + 4, cw, 2);
    if (!night) {
      for (let i = 0; i < 6; i++) {
        const spread = i * 6;
        g.fillStyle(0xffe4a3, 0.05);
        g.fillRect(cx - spread, y + 6 + i * 16, cw + spread * 2, 16);
      }
      for (let i = 0; i < 9; i++) {
        const m = this.add.rectangle(cx + Math.random() * cw, y + 20 + Math.random() * 60, 1, 1, 0xfff2c8, 0.8);
        this.motes.push(m);
        this.tweens.add({
          targets: m,
          y: m.y + 30 + Math.random() * 30,
          x: m.x + (Math.random() - 0.5) * 20,
          alpha: 0,
          duration: 3000 + Math.random() * 3000,
          repeat: -1,
          delay: Math.random() * 2000,
        });
      }
    }
  }

  private statusText(night: boolean): string {
    if (night) return '外面安静下来了，可以推开棺材板出去遛遛。';
    return `阳间 [color=${COL.joss}]${clockText()}[/color] · ${shichenLabel()} · 阳气太重，出不去。\n距天黑还有 [color=${COL.joss}]${fmtDur(untilNightMs())}[/color]（18:00 出棺）`;
  }

  private statsText(): string {
    const t = state.tomb;
    if (!t) return '';
    return `敲过 ${(t.knock_count || 0) + this.knockPending} 次棺材板 · 诈尸 ${t.zhashi_count || 0} 次 · 墓址 ${t.address || '某处'}`;
  }

  private tick(): void {
    if (!live(this)) return;
    if (this.lastNight !== isNight() || this.lastOut !== ghostOut()) {
      this.render();
      return;
    }
    if (this.status) setTxt(this.status, this.statusText(isNight()), true);
  }

  private knock(): void {
    sfx('knock');
    this.cameras.main.shake(260, 0.006);
    this.knockPending++;
    if (this.stats) setTxt(this.stats, this.statsText());
    this.knockTimer?.remove();
    this.knockTimer = this.time.delayedCall(1500, () => void this.flushKnocks());
  }

  private async flushKnocks(): Promise<void> {
    if (this.knockWriting || !this.knockPending || !state.tomb) return;
    this.knockWriting = true;
    const n = this.knockPending;
    this.knockPending = 0;
    try {
      const res = await api.knock({ count: Math.min(100, n) });
      patchTomb({ knock_count: res.knock_count, last_knock_at: res.last_knock_at });
    } catch {
      /* 敲没敲上无所谓 */
    }
    this.knockWriting = false;
    if (this.knockPending) void this.flushKnocks();
  }

  private flip(): void {
    state.flipped = !state.flipped;
    this.sleeper?.setTexture(state.flipped ? 'ghost-lying-back' : 'ghost-lying');
    toast(state.flipped ? '你翻了个身，现在脸朝下。' : '又翻回来了。');
  }

  private goOut(): void {
    state.ghostCell = null;
    sfx('whoosh');
    setPref('cemetery');
  }
}
