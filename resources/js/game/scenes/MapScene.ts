/**
 * 可以走动的像素地图（园区导览、每一期墓园共用）：
 * 自由走动 + 碰撞、点哪走哪（A* 寻路）、走到跟前按 E / 点一下交互、
 * 别的鬼、白天黑夜（夜里一块黑幕，用抖动光斑擦出灯光）。
 *
 * 两台相机：主相机按整数倍放大画地图；文字相机不放大，画名字牌、提示和场景自己的界面，
 * 这样字永远是 12px 像素字，不会跟着地图一起变粗。
 */

import Phaser from 'phaser';
import { Subscriptions } from '@/core/bus';
import { isNight, serverNow } from '@/core/clock';
import { avatarKind } from '@/core/session';
import { Embers, type EmberSpot } from '../world/embers';
import { findPath, nearestOpen, type TilePoint } from '../world/pathfind';
import { TILE } from '../world/world';
import type { Facing } from '../pixel/sprites';
import { bg, Label, setFrame, tappable, txt, type BBCodeText } from '../ui/kit';
import { COL } from '../ui/theme';
import { typingInField, uiBusy } from '../ui/uiState';
import { live } from './live';
import { onResized } from './resized';

export type MapProp = {
  key: string;
  /** 底边中点（世界像素） */
  x: number;
  y: number;
  depthY?: number;
  alpha?: number;
  /** dy：标签离底边多高；center 为 true 时这一点是标签的中心（牌匾上的字），否则是标签的底边 */
  label?: { text: string; color?: string; dy: number; dx?: number; plate?: boolean; center?: boolean };
};

export type MapLight = { x: number; y: number; r: number; glow?: 'warm' | 'wisp'; glowR?: number; strength?: number };

export type MapInteractable = {
  id: string;
  kind: string;
  /** 交互点：玩家脚下靠近这里就能交互 */
  px: number;
  py: number;
  approach: TilePoint;
  box: { x: number; y: number; w: number; h: number };
  verb: string;
  radius?: number;
  data?: unknown;
};

export type MapData = {
  wTiles: number;
  hTiles: number;
  pxW: number;
  pxH: number;
  groundKey: string;
  isBlockedTile: (tx: number, ty: number) => boolean;
  props: MapProp[];
  lights: MapLight[];
  interactables: MapInteractable[];
  spawn: { x: number; y: number; facing: Facing };
  cellNear?: (x: number, y: number) => number | null;
  standOf?: (cell: number) => { x: number; y: number } | null;
};

export type Peer = { id: string; name: string; x: number; y: number };

type PeerState = Peer & {
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  label: BBCodeText;
  light: Phaser.GameObjects.Image | null;
  cx: number;
  cy: number;
  phase: number;
};

type WorldLabel = { obj: Phaser.GameObjects.GameObject & { x: number; y: number; setVisible: (v: boolean) => unknown }; wx: number; wy: number };

const INTERACT_RADIUS = 20;
const COARSE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

export default abstract class MapScene extends Phaser.Scene {
  protected map: MapData | null = null;
  protected Z = 1;
  protected labelCam!: Phaser.Cameras.Scene2D.Camera;
  protected subs = new Subscriptions();
  protected t = 0;

  protected px = 0;
  protected py = 0;
  protected facing: Facing = 'down';
  private moving = false;
  private walkClock = 0;
  private path: TilePoint[] = [];
  private pendingInteract: MapInteractable | null = null;
  private stuckTime = 0;
  private lastProgress = Infinity;
  private keys = new Set<string>();
  protected focus: MapInteractable | null = null;
  private lastCell: number | null | undefined = undefined;

  private buildingUi = false;
  private worldObjs: Phaser.GameObjects.GameObject[] = [];
  private player: Phaser.GameObjects.Image | null = null;
  private playerShadow: Phaser.GameObjects.Image | null = null;
  private meLabel: BBCodeText | null = null;
  private peers = new Map<string, PeerState>();
  private labels: WorldLabel[] = [];
  private prompt: Label | null = null;
  private promptFor: string | null = null;
  /** 夜里的黑幕：一块深色矩形，用反相位图遮罩挖出灯光（光斑是抖动的像素圆） */
  private dark: Phaser.GameObjects.Rectangle | null = null;
  private lightHolder: Phaser.GameObjects.Container | null = null;
  private staticLights: Phaser.GameObjects.Image[] = [];
  private playerLight: Phaser.GameObjects.Image | null = null;
  private glows: Array<{ img: Phaser.GameObjects.Image; light: MapLight }> = [];
  private playerGlow: Phaser.GameObjects.Image | null = null;
  private dayTint: Phaser.GameObjects.Rectangle | null = null;
  /** 坟前烧纸留下的火星 */
  private embers: Embers | null = null;
  private camX = 0;
  private camY = 0;
  private night = false;
  private meText = '';
  private meColor = '';

  abstract loadMap(data: Record<string, unknown>): Promise<MapData | null>;
  abstract onInteract(it: MapInteractable): void;
  protected onCellChange?(cell: number | null): void;
  /** 场景自己的屏幕界面（顶部信息条之类），在文字相机里画 */
  protected buildOverlay(): void {}
  protected destroyOverlay(): void {}
  /** 地图准备好以后、第一次放人之前 */
  protected afterBuild(): void {}
  protected spawnPoint(): { x: number; y: number; facing: Facing } | null {
    return null;
  }

  create(data: Record<string, unknown>): void {
    this.map = null;
    this.t = 0;
    this.keys.clear();
    this.path = [];
    this.pendingInteract = null;
    this.focus = null;
    this.lastCell = undefined;
    this.peers.clear();
    this.labels = [];
    this.glows = [];
    this.worldObjs = [];
    this.prompt = null;
    this.promptFor = null;
    this.staticLights = [];
    this.dark = null;
    this.playerLight = null;
    this.lightHolder = this.make.container({ x: 0, y: 0 }, false);
    this.embers = new Embers(this, () => this.lightHolder);

    const cam = this.cameras.main;
    cam.setOrigin(0, 0);
    cam.setBackgroundColor(isNight() ? '#06080d' : '#7d8577');
    this.labelCam = this.cameras.add(0, 0, this.scale.width, this.scale.height, false, 'labels');
    this.labelCam.setOrigin(0, 0);
    this.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, this.routeCamera, this);

    addEventListener('keydown', this.onKeyDown);
    addEventListener('keyup', this.onKeyUp);
    addEventListener('blur', this.onBlur);
    this.input.on('pointerdown', this.onPointerDown, this);
    onResized(this, () => this.onResize());
    this.subs
      .on('panel:state', (busy) => {
        if (busy) {
          this.keys.clear();
          this.path = [];
          this.pendingInteract = null;
        }
      })
      .on('daynight', () => this.applyNight())
      .on('session', () => this.applyNight());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdownMap, this);

    this.cameras.main.fadeIn(220, 0, 0, 0);
    void this.loadMap(data).then((m) => {
      if (!live(this) || !m) return;
      this.setMap(m);
    });
  }

  private routeCamera(go: Phaser.GameObjects.GameObject): void {
    if (this.buildingUi) this.cameras.main.ignore(go);
    else this.labelCam.ignore(go);
  }

  /** 在文字相机里建界面 */
  protected ui<T>(fn: () => T): T {
    const prev = this.buildingUi;
    this.buildingUi = true;
    try {
      return fn();
    } finally {
      this.buildingUi = prev;
    }
  }

  /** 换一张地图（墓位变了时重建），尽量保持人的位置 */
  protected setMap(m: MapData): void {
    const keepPos = !!this.map;
    for (const o of this.worldObjs) o.destroy();
    this.worldObjs = [];
    for (const l of this.labels) l.obj.destroy();
    this.labels = [];
    this.glows = [];
    for (const l of this.staticLights) l.destroy();
    this.staticLights = [];
    this.dark?.destroy();
    this.dark = null;
    this.dayTint?.destroy();
    this.dayTint = null;
    this.map = m;

    const ground = this.add.image(0, 0, m.groundKey).setOrigin(0, 0).setDepth(-10);
    this.worldObjs.push(ground);
    for (const p of m.props) {
      const img = this.add.image(Math.round(p.x), Math.round(p.y), p.key).setOrigin(0.5, 1);
      img.setDepth(p.depthY ?? p.y);
      if (p.alpha != null) img.setAlpha(p.alpha);
      this.worldObjs.push(img);
      if (p.label) {
        const l = this.addWorldLabel(p.label.text, p.x + (p.label.dx ?? 0), p.y - p.label.dy, p.label.color ?? COL.bone, p.label.plate ?? true);
        if (p.label.center) l.setOrigin(0.5, 0.5);
      }
    }

    if (!this.player) {
      this.playerShadow = this.add.image(0, 0, 'shadow').setOrigin(0.5, 0.5);
      this.player = this.add.image(0, 0, 'ghost-down-0').setOrigin(0.5, 1);
      this.meLabel = this.ui(() => txt(this, '我', { color: COL.wisp, bgColor: 'rgba(8,10,14,0.55)', pad: 1 }));
      this.meLabel.setOrigin(0.5, 0);
      this.meLabel.setDepth(10);
      this.meText = '';
      this.meColor = '';
    }

    this.dark = this.add.rectangle(0, 0, 8, 8, 0x060a1e, 0.86).setOrigin(0, 0).setDepth(1e6);
    const holder = this.lightHolder!;
    if (!this.playerLight) {
      this.playerLight = this.make.image({ x: 0, y: 0, key: 'light-64' }, false);
      holder.add(this.playerLight);
    }
    for (const l of m.lights) {
      const im = this.make.image({ x: Math.round(l.x), y: Math.round(l.y), key: `light-${l.r}` }, false);
      holder.add(im);
      this.staticLights.push(im);
    }
    if (this.renderer.type === Phaser.WEBGL) {
      const mask = new Phaser.Display.Masks.BitmapMask(this, holder);
      mask.invertAlpha = true;
      this.dark.setMask(mask);
    } else {
      // Canvas 渲染器不支持位图遮罩：黑幕调淡一点，靠光晕
      this.dark.setFillStyle(0x060a1e, 0.6);
    }
    for (const l of m.lights) {
      if (!l.glow) continue;
      const r = l.glowR ?? 28;
      const img = this.add.image(l.x, l.y, `glow-${l.glow}-${r}`).setBlendMode(Phaser.BlendModes.ADD).setDepth(1e6 + 1);
      this.glows.push({ img, light: l });
      this.worldObjs.push(img);
    }
    this.playerGlow?.destroy();
    this.playerGlow = this.add.image(0, 0, 'glow-wisp-28').setBlendMode(Phaser.BlendModes.ADD).setDepth(1e6 + 1);
    this.dayTint = this.add.rectangle(0, 0, 8, 8, 0xc8cec4, 0.12).setOrigin(0, 0).setDepth(1e6);

    this.afterBuild();

    if (!keepPos || this.isBlockedAt(this.px, this.py)) {
      const s = this.spawnPoint() ?? m.spawn;
      this.px = s.x;
      this.py = s.y;
      this.facing = s.facing;
      this.path = [];
    }
    this.onResize();
    this.snapCamera();
    this.applyNight();
    this.syncPeerTargets();
  }

  /** 换一批坟前火星（世界坐标） */
  protected setEmbers(spots: EmberSpot[]): void {
    this.embers?.set(spots, serverNow());
  }

  protected addWorldLabel(text: string, wx: number, wy: number, color: string, plate = true): BBCodeText {
    const t = this.ui(() => txt(this, text, { color, bgColor: plate ? 'rgba(8,10,14,0.62)' : undefined, pad: plate ? 1 : 0 }));
    t.setOrigin(0.5, 1);
    t.setDepth(5);
    this.labels.push({ obj: t, wx, wy });
    return t;
  }

  /* ---------------- 别的鬼 ---------------- */

  protected setPeers(list: Peer[]): void {
    const seen = new Set<string>();
    for (const p of list) {
      seen.add(p.id);
      const ex = this.peers.get(p.id);
      if (ex) {
        ex.name = p.name;
        ex.x = p.x;
        ex.y = p.y;
        ex.label.setText(`[raw]${p.name}[/raw]`);
      } else {
        const sprite = this.add.image(p.x, p.y, 'ghost-down-0').setOrigin(0.5, 1).setAlpha(0.78);
        const shadow = this.add.image(p.x, p.y, 'shadow');
        const label = this.ui(() => txt(this, p.name, { color: COL.wisp, bgColor: 'rgba(8,10,14,0.55)', pad: 1 }));
        label.setOrigin(0.5, 1);
        label.setDepth(6);
        const glow = this.add.image(p.x, p.y, 'glow-wisp-28').setBlendMode(Phaser.BlendModes.ADD).setDepth(1e6 + 1);
        sprite.setData('glow', glow);
        const light = this.make.image({ x: p.x, y: p.y, key: 'light-28' }, false);
        this.lightHolder?.add(light);
        this.peers.set(p.id, { ...p, sprite, shadow, label, light, cx: p.x, cy: p.y, phase: Math.random() * Math.PI * 2 });
      }
    }
    for (const [id, st] of [...this.peers]) {
      if (seen.has(id)) continue;
      (st.sprite.getData('glow') as Phaser.GameObjects.Image | undefined)?.destroy();
      st.sprite.destroy();
      st.shadow.destroy();
      st.label.destroy();
      st.light?.destroy();
      this.peers.delete(id);
    }
  }

  /** 子类按需要把在线的鬼换算成地图坐标 */
  protected syncPeerTargets(): void {}

  /* ---------------- 输入 ---------------- */

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.map || uiBusy() || typingInField(e) || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) {
      e.preventDefault();
      this.keys.add(k);
      this.path = [];
      this.pendingInteract = null;
      return;
    }
    if ((k === 'e' || k === 'enter' || k === ' ') && this.focus) {
      e.preventDefault();
      this.onInteract(this.focus);
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };

  private onBlur = () => {
    this.keys.clear();
  };

  private onPointerDown(p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    if (!this.map || uiBusy()) return;
    if (over && over.length) return;
    const wx = this.camX + p.x / this.Z;
    const wy = this.camY + p.y / this.Z;
    const hit = this.hitInteractable(wx, wy);
    if (hit) {
      if (this.distanceTo(hit) <= (hit.radius ?? INTERACT_RADIUS)) {
        this.onInteract(hit);
        return;
      }
      this.walkTo(hit.approach, hit);
      return;
    }
    const m = this.map;
    const tile = { tx: Math.floor(wx / TILE), ty: Math.floor(wy / TILE) };
    const open = nearestOpen(m.wTiles, m.hTiles, m.isBlockedTile, tile);
    if (open) this.walkTo(open, null);
  }

  private hitInteractable(wx: number, wy: number): MapInteractable | null {
    let best: MapInteractable | null = null;
    let bestArea = Infinity;
    for (const it of this.map?.interactables ?? []) {
      const b = it.box;
      if (wx >= b.x && wx <= b.x + b.w && wy >= b.y && wy <= b.y + b.h) {
        const area = b.w * b.h;
        if (area < bestArea) {
          best = it;
          bestArea = area;
        }
      }
    }
    return best;
  }

  protected walkTo(goal: TilePoint, interact: MapInteractable | null): void {
    const m = this.map;
    if (!m) return;
    const from = { tx: Math.floor(this.px / TILE), ty: Math.floor((this.py - 2) / TILE) };
    const start = nearestOpen(m.wTiles, m.hTiles, m.isBlockedTile, from, 2) ?? from;
    const path = findPath(m.wTiles, m.hTiles, m.isBlockedTile, start, goal);
    if (!path) return;
    this.path = path;
    this.pendingInteract = interact;
    this.stuckTime = 0;
    this.lastProgress = Infinity;
    if (!path.length && interact) {
      this.pendingInteract = null;
      this.onInteract(interact);
    }
  }

  /** 直接站到某处（传送） */
  protected teleport(x: number, y: number, facing: Facing = 'up'): void {
    this.px = x;
    this.py = y;
    this.facing = facing;
    this.path = [];
    this.pendingInteract = null;
    this.snapCamera();
  }

  protected walkToInteractable(id: string): void {
    const it = this.map?.interactables.find((i) => i.id === id);
    if (it) this.walkTo(it.approach, null);
  }

  /* ---------------- 主循环 ---------------- */

  update(_time: number, delta: number): void {
    const m = this.map;
    if (!m || !this.player) return;
    this.embers?.update(delta, serverNow(), this.night);
    const dt = Math.max(0, Math.min(0.05, delta / 1000));
    this.t += dt;
    const busy = uiBusy();
    let dx = 0;
    let dy = 0;
    if (!busy) {
      if (this.keys.has('arrowleft') || this.keys.has('a')) dx -= 1;
      if (this.keys.has('arrowright') || this.keys.has('d')) dx += 1;
      if (this.keys.has('arrowup') || this.keys.has('w')) dy -= 1;
      if (this.keys.has('arrowdown') || this.keys.has('s')) dy += 1;
    }

    if (!busy && !dx && !dy && this.path.length) {
      const next = this.path[0];
      const tx = next.tx * TILE + TILE / 2;
      const ty = next.ty * TILE + 11;
      const ddx = tx - this.px;
      const ddy = ty - this.py;
      const dist = Math.hypot(ddx, ddy);
      if (dist < 1.5) {
        this.px = tx;
        this.py = ty;
        this.path.shift();
        this.stuckTime = 0;
        this.lastProgress = Infinity;
        if (!this.path.length && this.pendingInteract) {
          const target = this.pendingInteract;
          this.pendingInteract = null;
          this.facing = target.py < this.py ? 'up' : 'down';
          // 进门会切场景，这一帧到此为止（切完 map 已经清空了）
          this.onInteract(target);
          return;
        }
      } else {
        dx = ddx / dist;
        dy = ddy / dist;
        if (dist < this.lastProgress - 0.3) {
          this.lastProgress = dist;
          this.stuckTime = 0;
        } else {
          this.stuckTime += dt;
          if (this.stuckTime > 0.7) {
            this.path = [];
            this.pendingInteract = null;
          }
        }
      }
    }

    const kind = avatarKind();
    this.moving = !!(dx || dy);
    if (this.moving) {
      const len = Math.hypot(dx, dy) || 1;
      const speed = kind === 'living' ? 56 : 64;
      const mx = (dx / len) * speed * dt;
      const my = (dy / len) * speed * dt;
      if (Math.abs(dx) > Math.abs(dy)) this.facing = dx < 0 ? 'left' : 'right';
      else this.facing = dy < 0 ? 'up' : 'down';
      if (!this.isBlockedAt(this.px + mx, this.py)) this.px += mx;
      if (!this.isBlockedAt(this.px, this.py + my)) this.py += my;
      this.px = Math.max(4, Math.min(m.pxW - 4, this.px));
      this.py = Math.max(8, Math.min(m.pxH - 2, this.py));
      this.walkClock += dt;
    } else {
      this.walkClock = 0;
    }

    let best: MapInteractable | null = null;
    let bestD = Infinity;
    for (const it of m.interactables) {
      const d = this.distanceTo(it);
      const radius = it.radius ?? INTERACT_RADIUS;
      if (d <= radius && this.py >= it.py - 8 && d < bestD) {
        best = it;
        bestD = d;
      }
    }
    this.focus = busy ? null : best;

    if (m.cellNear) {
      const cell = m.cellNear(this.px, this.py);
      if (cell !== this.lastCell) {
        this.lastCell = cell;
        this.onCellChange?.(cell);
      }
    }

    for (const p of this.peers.values()) {
      const k = Math.min(1, dt * 2.2);
      p.cx += (p.x - p.cx) * k;
      p.cy += (p.y - p.cy) * k;
    }

    this.updateCamera(dt);
    this.drawActors(kind);
    this.drawLabels();
    this.drawPrompt();
    this.drawNight(kind);
  }

  private distanceTo(it: MapInteractable): number {
    return Math.hypot(it.px - this.px, it.py - this.py);
  }

  private isBlockedAt(x: number, y: number): boolean {
    const m = this.map;
    if (!m) return true;
    const halfW = 4;
    const h = 5;
    const x0 = Math.floor((x - halfW) / TILE);
    const x1 = Math.floor((x + halfW - 0.01) / TILE);
    const y0 = Math.floor((y - h) / TILE);
    const y1 = Math.floor((y - 0.01) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (m.isBlockedTile(tx, ty)) return true;
      }
    }
    return false;
  }

  /* ---------------- 镜头 ---------------- */

  private viewW(): number {
    return this.scale.width / this.Z;
  }

  private viewH(): number {
    return this.scale.height / this.Z;
  }

  /** 顶上被顶栏和信息条挡住的高度（屏幕像素），镜头中心往下挪一点 */
  protected topInset(): number {
    return 0;
  }

  private cameraTarget(): { x: number; y: number } {
    const m = this.map;
    if (!m) return { x: this.camX, y: this.camY };
    const vw = this.viewW();
    const vh = this.viewH();
    const inset = this.topInset() / this.Z;
    const x = m.pxW <= vw ? (m.pxW - vw) / 2 : Math.max(0, Math.min(m.pxW - vw, this.px - vw / 2));
    const y = m.pxH <= vh - inset ? (m.pxH - vh) / 2 - inset / 2 : Math.max(-inset, Math.min(m.pxH - vh, this.py - inset - (vh - inset) / 2));
    return { x, y };
  }

  protected snapCamera(): void {
    if (!this.map) return;
    const t = this.cameraTarget();
    this.camX = t.x;
    this.camY = t.y;
    this.applyCamera();
  }

  private updateCamera(dt: number): void {
    const t = this.cameraTarget();
    const k = Math.min(1, dt * 8);
    this.camX += (t.x - this.camX) * k;
    this.camY += (t.y - this.camY) * k;
    if (Math.abs(t.x - this.camX) < 0.2) this.camX = t.x;
    if (Math.abs(t.y - this.camY) < 0.2) this.camY = t.y;
    this.applyCamera();
  }

  private applyCamera(): void {
    const cam = this.cameras.main;
    cam.setScroll(Math.round(this.camX), Math.round(this.camY));
  }

  private screenX(wx: number): number {
    return Math.round((wx - Math.round(this.camX)) * this.Z);
  }

  private screenY(wy: number): number {
    return Math.round((wy - Math.round(this.camY)) * this.Z);
  }

  protected onResize(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    this.Z = Math.max(1, Math.min(Math.floor(W / (TILE * 18)), Math.floor(H / (TILE * 11))));
    this.cameras.main.setSize(W, H);
    this.cameras.main.setZoom(this.Z);
    this.labelCam.setSize(W, H);
    if (this.dark) {
      const w = Math.ceil(this.viewW()) + 2;
      const h = Math.ceil(this.viewH()) + 2;
      this.dark.setSize(w, h);
      this.dayTint?.setSize(w, h);
    }
    this.destroyOverlay();
    this.ui(() => this.buildOverlay());
    if (this.map) this.snapCamera();
  }

  /* ---------------- 画 ---------------- */

  private drawActors(kind: 'ghost' | 'soul' | 'living'): void {
    const p = this.player!;
    const x = Math.round(this.px);
    const y = Math.round(this.py);
    if (kind === 'living') {
      const pose = !this.moving ? 'idle' : Math.floor(this.walkClock * 7) % 2 === 0 ? 'walkA' : 'walkB';
      p.setTexture(`person-${this.facing}-${pose}`);
      p.setPosition(x, y).setAlpha(1);
    } else {
      const frame = Math.floor(this.t * 3) % 2;
      const bob = Math.round(Math.sin(this.t * 3.2) * 1.5);
      p.setTexture(`${kind === 'soul' ? 'soul' : 'ghost'}-${this.facing}-${frame}`);
      p.setPosition(x, y - 3 + bob).setAlpha(kind === 'soul' ? 0.55 : 1);
    }
    p.setDepth(this.py);
    this.playerShadow!.setPosition(x, y).setDepth(this.py - 0.5);
    this.playerGlow?.setPosition(x, y - 10).setTexture(kind === 'living' ? 'glow-warm-28' : 'glow-wisp-28');
    const me = this.meLabel!;
    const meText = kind === 'soul' ? '[raw]我（魂游）[/raw]' : '[raw]我[/raw]';
    const meColor = kind === 'living' ? COL.joss : COL.wisp;
    if (meText !== this.meText) {
      this.meText = meText;
      me.setText(meText);
    }
    if (meColor !== this.meColor) {
      this.meColor = meColor;
      me.setColor(meColor);
    }
    me.setPosition(this.screenX(this.px), this.screenY(this.py + 3));

    for (const peer of this.peers.values()) {
      const frame = Math.floor(this.t * 3 + peer.phase) % 2;
      const bob = Math.round(Math.sin(this.t * 3.2 + peer.phase) * 1.5);
      const px = Math.round(peer.cx);
      const py = Math.round(peer.cy);
      peer.sprite.setTexture(`ghost-down-${frame}`).setPosition(px, py - 3 + bob).setDepth(peer.cy);
      peer.shadow.setPosition(px, py).setDepth(peer.cy - 0.5);
      (peer.sprite.getData('glow') as Phaser.GameObjects.Image | undefined)?.setPosition(px, py - 10).setVisible(this.night);
      peer.label.setPosition(this.screenX(peer.cx), this.screenY(peer.cy - 22));
    }
  }

  private drawLabels(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    for (const l of this.labels) {
      const x = this.screenX(l.wx);
      const y = this.screenY(l.wy);
      const vis = x > -80 && x < W + 80 && y > -20 && y < H + 40;
      l.obj.setVisible(vis);
      if (vis) {
        l.obj.x = x;
        l.obj.y = y;
      }
    }
  }

  private drawPrompt(): void {
    const f = this.focus;
    const key = f ? `${f.id}|${this.night}` : null;
    if (key !== this.promptFor) {
      this.prompt?.destroy();
      this.prompt = null;
      this.promptFor = key;
      if (f) {
        const label = `${COARSE ? '点一下' : 'E'} · ${f.verb}`;
        this.prompt = this.ui(() => {
          const back = bg(this, this.night ? 'promptNight' : 'prompt');
          const l = new Label(this, {
            background: back,
            text: txt(this, label, { color: COL.bone }),
            space: { left: 5, right: 5, top: 2, bottom: 3 },
          });
          this.add.existing(l);
          l.setOrigin(0.5, 1);
          l.layout();
          tappable(l, () => this.onInteract(f), {
            onState: (st) => setFrame(back, st === 'hover' || st === 'down' ? 'cardHi' : this.night ? 'promptNight' : 'prompt'),
          });
          return l;
        });
        this.prompt.setDepth(20);
      }
    }
    if (this.prompt && f) {
      // 提示浮在自己头顶，不挡目标的名字
      this.prompt.setPosition(this.screenX(this.px), Math.max(this.topInset() + 24, this.screenY(this.py - 24)));
    }
  }

  protected applyNight(): void {
    if (!live(this)) return;
    this.night = isNight();
    this.cameras.main.setBackgroundColor(this.night ? '#06080d' : '#7d8577');
    this.dark?.setVisible(this.night);
    this.dayTint?.setVisible(!this.night);
    for (const g of this.glows) g.img.setVisible(this.night);
    this.playerGlow?.setVisible(this.night);
    this.promptFor = null;
  }

  private drawNight(kind: 'ghost' | 'soul' | 'living'): void {
    const sx = Math.round(this.camX);
    const sy = Math.round(this.camY);
    this.dayTint?.setPosition(sx, sy);
    if (!this.night || !this.dark) return;
    this.dark.setPosition(sx, sy);
    const r = kind === 'living' ? 50 : 64;
    const pl = this.playerLight;
    if (pl) {
      if (pl.texture.key !== `light-${r}`) pl.setTexture(`light-${r}`);
      pl.setPosition(Math.round(this.px), Math.round(this.py - 8));
    }
    for (const p of this.peers.values()) p.light?.setPosition(Math.round(p.cx), Math.round(p.cy - 8));
  }

  private shutdownMap(): void {
    removeEventListener('keydown', this.onKeyDown);
    removeEventListener('keyup', this.onKeyUp);
    removeEventListener('blur', this.onBlur);
    this.input.off('pointerdown', this.onPointerDown, this);
    this.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, this.routeCamera, this);
    this.subs.clear();
    this.destroyOverlay();
    this.embers?.destroy();
    this.embers = null;
    this.lightHolder?.destroy();
    this.lightHolder = null;
    this.staticLights = [];
    this.playerLight = null;
    this.map = null;
    this.player = null;
    this.playerShadow = null;
    this.playerGlow = null;
    this.meLabel = null;
    this.dark = null;
    this.dayTint = null;
    this.peers.clear();
    this.labels = [];
    this.glows = [];
    this.worldObjs = [];
    this.prompt = null;
  }
}
