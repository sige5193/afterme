/**
 * 棺材里：白天躺着（敲棺材板、翻个身、数家当、诈尸），天黑可以推开棺材板出去；
 * 旁边是「上面的动静」——谁来烧过纸，留了什么话。
 */

import Phaser from 'phaser';
import * as api from '@/api/client';
import { Subscriptions } from '@/core/bus';
import { clockText, isNight, shichenLabel, untilNightMs } from '@/core/clock';
import { fetchInbox } from '@/core/offerings';
import { ghostOut, patchTomb, setPref } from '@/core/session';
import { state } from '@/core/state';
import { openPanel, sfx, toast } from '@/core/ui';
import { fmtDur } from '@/utils/time';
import { button, clipToScroller, flow, scroller, setTxt, txt, type BBCodeText, type Sizer, vbox } from '../ui/kit';
import { offeringList } from '../ui/offeringList';
import { COL, HUD_H } from '../ui/theme';
import { live } from './live';

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

  constructor() {
    super({ key: 'Coffin' });
  }

  create(): void {
    this.ui = [];
    this.motes = [];
    this.revealed = new Set();
    this.listScroll = 0;
    this.knockPending = 0;
    this.cameras.main.setBackgroundColor('#0b0806');
    this.cameras.main.fadeIn(260, 0, 0, 0);
    this.subs
      .on('inbox', () => this.render())
      .on('session', () => this.render())
      .on('clock', () => this.tick())
      .on('daynight', () => this.render());
    this.scale.on(Phaser.Scale.Events.RESIZE, this.render, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.subs.clear();
      this.scale.off(Phaser.Scale.Events.RESIZE, this.render, this);
      void this.flushKnocks();
    });
    this.render();
    void fetchInbox();
  }

  private render(): void {
    if (!live(this)) return;
    if (this.listPanel) this.listScroll = this.listPanel.t;
    for (const u of this.ui) u.destroy();
    this.ui = [];
    this.gfx?.destroy();
    this.sleeper?.destroy();
    this.zzz?.destroy();
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
