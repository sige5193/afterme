/**
 * 烧完纸在坟前留下的火星：贴地几颗一明一暗的像素点，时不时往上飘一颗。
 * 刚烧完最旺，越久越少，一小时后灭。夜里画在黑幕上面（自己会发光），再给地上挖一小圈光。
 */

import Phaser from 'phaser';

export type EmberSpot = {
  /** 同一处火（一般是格子号），重建地图时用来认出来 */
  key: string;
  /** 火堆中心（世界像素） */
  x: number;
  y: number;
  /** 撒开多宽 */
  w: number;
  /** 什么时候烧的（服务器时间，毫秒） */
  since: number;
};

/** 火星留多久，跟后端 Embers::MINUTES 一致 */
export const EMBER_MS = 60 * 60 * 1000;

const TICK_MS = 90;
/** 从冷到热：暗红 → 红 → 橙 → 黄 → 白 */
const HEAT = [0x2e1610, 0x6e2616, 0xb83c24, 0xec7a2c, 0xffc54a, 0xfff2c4];
/** 夜里放在黑幕（1e6）和灯晕（1e6+1）上面 */
const NIGHT_DEPTH = 1e6 + 2;

type Dot = { obj: Phaser.GameObjects.Rectangle; heat: number; rising: boolean; risen: number; age: number };

const rand = (a: number, b: number) => a + Math.random() * (b - a);

class Fire {
  private dots: Dot[] = [];
  private glow: Phaser.GameObjects.Image;
  private light: Phaser.GameObjects.Image | null = null;
  private night = false;

  constructor(
    private scene: Phaser.Scene,
    public spot: EmberSpot,
    holder: Phaser.GameObjects.Container | null,
  ) {
    this.glow = scene.add
      .image(spot.x, spot.y - 1, 'glow-warm-28')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(NIGHT_DEPTH - 1)
      .setVisible(false);
    if (holder) {
      this.light = scene.make.image({ x: Math.round(spot.x), y: Math.round(spot.y - 1), key: 'light-14' }, false);
      holder.add(this.light);
    }
  }

  setNight(night: boolean): void {
    this.night = night;
    this.glow.setVisible(night);
    for (const d of this.dots) this.place(d);
  }

  /** 走一步；火灭了返回 false */
  step(now: number): boolean {
    const k = 1 - (now - this.spot.since) / EMBER_MS;
    if (k <= 0) return false;
    const hottest = Math.max(1, Math.min(5, Math.round(1 + 4 * k)));
    const want = Math.round(3 + 11 * k);

    const ground = this.dots.filter((d) => !d.rising);
    for (let i = ground.length; i < want; i++) this.spawn(false, 1 + Math.floor(Math.random() * hottest));
    for (let i = want; i < ground.length; i++) this.kill(ground[i]);

    if (Math.random() < 0.05 + 0.3 * k) this.spawn(true, hottest);

    for (const d of [...this.dots]) {
      d.age++;
      if (d.rising) {
        d.risen++;
        d.obj.y -= 1;
        if (Math.random() < 0.3) d.obj.x += Math.random() < 0.5 ? -1 : 1;
        if (d.age % 2 === 0) d.heat--;
        if (d.heat <= 0 || d.risen > 12) {
          this.kill(d);
          continue;
        }
      } else {
        if (Math.random() < 0.35) d.heat += Math.random() < 0.5 ? 1 : -1;
        d.heat = Math.max(0, Math.min(hottest, d.heat));
        // 熄了的火星过一会儿在旁边重新冒出来
        if (d.heat === 0 && Math.random() < 0.2) {
          this.kill(d);
          continue;
        }
      }
      this.paint(d);
    }

    this.glow.setAlpha((0.2 + 0.4 * k) * rand(0.85, 1));
    this.light?.setAlpha(0.4 + 0.6 * k);
    return true;
  }

  destroy(): void {
    for (const d of this.dots) d.obj.destroy();
    this.dots = [];
    this.glow.destroy();
    this.light?.destroy();
  }

  private spawn(rising: boolean, heat: number): void {
    const { x, y, w } = this.spot;
    const px = Math.round(x + rand(-w / 2, w / 2));
    const py = Math.round(y + rand(-3, 3));
    const obj = this.scene.add.rectangle(px, py, 1, 1, HEAT[heat]).setOrigin(0, 0);
    const d: Dot = { obj, heat, rising, risen: 0, age: 0 };
    this.dots.push(d);
    this.place(d);
    this.paint(d);
  }

  private kill(d: Dot): void {
    d.obj.destroy();
    this.dots = this.dots.filter((x) => x !== d);
  }

  private paint(d: Dot): void {
    d.obj.setVisible(d.heat > 0);
    if (d.heat > 0) d.obj.setFillStyle(HEAT[d.heat]);
  }

  /** 白天按 y 排前后（在坟前、人的脚边），夜里浮在黑幕上面 */
  private place(d: Dot): void {
    d.obj.setDepth(this.night ? NIGHT_DEPTH : this.spot.y + 0.5);
  }
}

export class Embers {
  private fires = new Map<string, Fire>();
  private acc = 0;
  private night = false;

  constructor(
    private scene: Phaser.Scene,
    private holder: () => Phaser.GameObjects.Container | null,
  ) {}

  /** 换成这一批火堆：新的点上，没了的灭掉，同一处又烧了就更旺 */
  set(spots: EmberSpot[], now: number): void {
    const keep = new Set<string>();
    for (const s of spots) {
      if (now - s.since >= EMBER_MS) continue;
      keep.add(s.key);
      const old = this.fires.get(s.key);
      if (old && old.spot.x === s.x && old.spot.y === s.y && old.spot.w === s.w) {
        old.spot.since = Math.max(old.spot.since, s.since);
        continue;
      }
      old?.destroy();
      const fire = new Fire(this.scene, s, this.holder());
      fire.setNight(this.night);
      this.fires.set(s.key, fire);
    }
    for (const [key, fire] of this.fires) {
      if (keep.has(key)) continue;
      fire.destroy();
      this.fires.delete(key);
    }
  }

  update(delta: number, now: number, night: boolean): void {
    if (night !== this.night) {
      this.night = night;
      for (const f of this.fires.values()) f.setNight(night);
    }
    this.acc += delta;
    if (this.acc < TICK_MS) return;
    this.acc = 0;
    for (const [key, fire] of this.fires) {
      if (fire.step(now)) continue;
      fire.destroy();
      this.fires.delete(key);
    }
  }

  destroy(): void {
    for (const f of this.fires.values()) f.destroy();
    this.fires.clear();
  }
}
