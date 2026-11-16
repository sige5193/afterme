/**
 * 标题画面（没坟的人进来先看到这个）：先死为敬。
 */

import Phaser from 'phaser';
import { Subscriptions } from '@/core/bus';
import { isNight } from '@/core/clock';
import { navigate } from '@/core/router';
import { state } from '@/core/state';
import { openPanel } from '@/core/ui';
import { mulberry32 } from '../pixel/art';
import { button, colored, flow, txt, type Sizer, vbox } from '../ui/kit';
import { COL, HUD_H } from '../ui/theme';
import { live } from './live';
import { onResized } from './resized';

export default class TitleScene extends Phaser.Scene {
  private subs = new Subscriptions();
  private objs: Phaser.GameObjects.GameObject[] = [];
  private ui: Sizer | null = null;
  private stars: Array<{ r: Phaser.GameObjects.Rectangle; p: number }> = [];
  private wisps: Array<{ r: Phaser.GameObjects.Image; vx: number; vy: number; p: number }> = [];
  private ghost: Phaser.GameObjects.Image | null = null;
  private t = 0;

  constructor() {
    super({ key: 'Title' });
  }

  create(): void {
    this.cameras.main.fadeIn(300, 0, 0, 0);
    this.subs.on('daynight', () => this.render()).on('session', () => this.render());
    onResized(this, () => this.render());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.subs.clear();
      this.objs = [];
      this.ui = null;
    });
    this.render();
  }

  private render(): void {
    if (!live(this)) return;
    for (const o of this.objs) o.destroy();
    this.objs = [];
    this.stars = [];
    this.wisps = [];
    this.ui?.destroy();
    this.ui = null;
    const W = this.scale.width;
    const H = this.scale.height;
    const night = isNight();
    const rand = mulberry32(42);

    this.cameras.main.setBackgroundColor(night ? '#070a12' : '#8d958c');
    const g = this.add.graphics();
    this.objs.push(g);
    const horizon = Math.round(H * 0.72);
    // 天空分层
    const sky = night ? [0x070a12, 0x0b1020, 0x111830, 0x162036] : [0x9aa39a, 0x8d958c, 0x80887f, 0x737b72];
    const band = Math.ceil(horizon / sky.length);
    sky.forEach((c, i) => {
      g.fillStyle(c, 1);
      g.fillRect(0, i * band, W, band);
    });
    if (night) {
      for (let i = 0; i < Math.round(W / 6); i++) {
        const r = this.add.rectangle(Math.floor(rand() * W), Math.floor(rand() * (horizon - 40)), 1, 1, 0xdde4f0, 0.8);
        this.stars.push({ r, p: rand() * 6 });
        this.objs.push(r);
      }
      // 月亮
      const mx = Math.round(W * 0.8);
      const my = Math.round(H * 0.18);
      g.fillStyle(0xe9e4d0, 1);
      g.fillCircle(mx, my, 14);
      g.fillStyle(0x070a12, 1);
      g.fillCircle(mx + 6, my - 3, 12);
    } else {
      g.fillStyle(0xd9dccf, 0.7);
      g.fillCircle(Math.round(W * 0.8), Math.round(H * 0.18), 12);
    }
    // 远山
    g.fillStyle(night ? 0x0d1424 : 0x6c746b, 1);
    for (let x = 0; x <= W; x += 4) {
      const hgt = 18 + Math.round(Math.sin(x / 47) * 8 + Math.sin(x / 19) * 3);
      g.fillRect(x, horizon - hgt, 4, hgt);
    }
    // 地面
    g.fillStyle(night ? 0x0e1a12 : 0x4f7a45, 1);
    g.fillRect(0, horizon, W, H - horizon);
    g.fillStyle(night ? 0x14241a : 0x5d8a50, 1);
    for (let i = 0; i < W / 3; i++) g.fillRect(Math.floor(rand() * W), horizon + Math.floor(rand() * (H - horizon)), 1, 1);
    // 一排墓碑和牌坊剪影
    const styles = ['qingshi', 'mupai', 'hanbai', 'tubao', 'neon', 'qingshi'];
    const gap = Math.max(26, Math.floor(W / 10));
    for (let i = 0, x = 14; x < W - 10; i++, x += gap) {
      if (Math.abs(x - W / 2) < 50) continue;
      const img = this.add.image(x, horizon + 6 + (i % 2) * 4, `stone-${styles[i % styles.length]}`).setOrigin(0.5, 1);
      if (night) img.setTint(0x6b7690);
      this.objs.push(img);
    }
    const gate = this.add.image(Math.round(W / 2), horizon + 4, 'gate-public').setOrigin(0.5, 1);
    if (night) gate.setTint(0x8a90a8);
    this.objs.push(gate);
    for (let i = 0; i < 4; i++) {
      const tr = this.add.image(Math.round(W * (0.08 + i * 0.28)), horizon - 2, i % 2 ? 'deadtree' : 'tree').setOrigin(0.5, 1);
      if (night) tr.setTint(0x50607a);
      this.objs.push(tr);
    }
    if (night) {
      for (let i = 0; i < 7; i++) {
        const r = this.add.image(rand() * W, horizon + rand() * (H - horizon), 'glow-wisp-14').setBlendMode(Phaser.BlendModes.ADD);
        this.wisps.push({ r, vx: (rand() - 0.5) * 6, vy: -(3 + rand() * 6), p: rand() * 6 });
        this.objs.push(r);
      }
    }

    // 文字和按钮
    const panelW = Math.min(W - 24, 460);
    const titleScale = W >= 520 ? 5 : W >= 360 ? 4 : 3;
    const box = vbox(this, { width: panelW, space: 8 });
    box.setOrigin(0.5, 0);
    box.add(txt(this, `先死${colored('为敬', COL.seal)}`, { markup: true, color: COL.bone, scale: titleScale }), { align: 'center' });
    box.add(
      txt(
        this,
        `在这里给自己提前办一场葬礼。之后亲友来坟前烧纸、留话；你${colored('白天躺在棺材里', COL.joss)}，${colored('天黑出来溜达', COL.joss)}，看看谁来过，再${colored('托个梦', COL.joss)}回去。`,
        { markup: true, wrap: panelW, color: COL.bone, align: 'center' },
      ),
      { align: 'center' },
    );
    const row = flow(this, panelW, { space: 6, line: 6, align: 'center' });
    row.add(button(this, '办一场我的葬礼', { kind: 'primary', icon: 'funeral', disabled: !state.ready, onClick: () => navigate('/funeral') }));
    row.add(button(this, '我是活人，来扫墓', { icon: 'person', onClick: () => navigate('/zones') }));
    box.add(row, { align: 'center', expand: true });
    box.add(button(this, '我死过，回到我的坟', { kind: 'quiet', small: true, onClick: () => openPanel('resurrect') }), { align: 'center' });
    box.layout();
    const titleTop = Math.max(HUD_H + 16, Math.round((horizon - box.height) / 2) - 10);
    box.setPosition(Math.round(W / 2), titleTop);
    this.ui = box;

    this.ghost = this.add.image(Math.round(W / 2 + Math.min(panelW / 2, 150) + 8), titleTop + 10, 'ghost-left-0').setScale(titleScale >= 4 ? 3 : 2);
    this.ghost.setAlpha(night ? 0.9 : 0.75);
    this.objs.push(this.ghost);
  }

  update(_t: number, delta: number): void {
    const dt = delta / 1000;
    this.t += dt;
    for (const s of this.stars) s.r.setAlpha(0.35 + 0.5 * Math.abs(Math.sin(this.t * 0.8 + s.p)));
    const H = this.scale.height;
    const W = this.scale.width;
    for (const w of this.wisps) {
      w.r.x += w.vx * dt + Math.sin(this.t + w.p) * 0.2;
      w.r.y += w.vy * dt;
      if (w.r.y < H * 0.55) {
        w.r.y = H - 4;
        w.r.x = Math.random() * W;
      }
    }
    if (this.ghost) {
      this.ghost.y += Math.sin(this.t * 2.4) * 0.12;
      this.ghost.setTexture(`ghost-left-${Math.floor(this.t * 3) % 2}`);
    }
  }
}
