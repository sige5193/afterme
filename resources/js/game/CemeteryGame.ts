/**
 * 像素墓园小游戏：自由走动、碰撞、点哪走哪、走到坟前交互、白天黑夜、别的鬼。
 * 只负责画面和操作，跟 Vue / 接口无关；外部通过回调和 set* 方法沟通。
 */

import { findPath, nearestOpen, type TilePoint } from './pathfind.ts';
import { getSprites, type Canvas, type Facing, type SpriteSheet } from './sprites.ts';
import {
  buildWorld,
  GROUND_BRIDGE,
  GROUND_FENCE,
  GROUND_PATH,
  GROUND_WATER,
  TILE,
  type Interactable,
  type World,
  type WorldInput,
  type WorldSprite,
} from './world.ts';

export type Avatar = 'ghost' | 'living';

export interface Peer {
  id: string;
  name: string;
  cell: number | null;
}

export interface GameCallbacks {
  onInteract: (target: Interactable) => void;
  /** 玩家所在的墓位变化（合葬墓返回起始格），离开墓区时为 null */
  onCellChange?: (cell: number | null) => void;
}

export interface GameOptions {
  canvas: HTMLCanvasElement;
  world: WorldInput;
  avatar: Avatar;
  night: boolean;
  /** 进来时站在哪个墓位前；不填就站在牌坊下 */
  startCell?: number | null;
  /** 牌坊匾额上的字 */
  gateTitle?: string;
  reducedMotion?: boolean;
  coarsePointer?: boolean;
  callbacks: GameCallbacks;
}

interface PeerState extends Peer {
  x: number;
  y: number;
  tx: number;
  ty: number;
  phase: number;
}

const INTERACT_RADIUS = 20;
const TARGET_TILES_WIDE = 15;
const LABEL_FONT = '"Noto Serif SC","Songti SC","PingFang SC",sans-serif';

export class CemeteryGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private buffer: Canvas;
  private bctx: CanvasRenderingContext2D;
  private light: Canvas;
  private lctx: CanvasRenderingContext2D;
  private groundLayer: Canvas | null = null;
  private sprites: SpriteSheet;
  private world!: World;
  private worldInput!: WorldInput;
  private callbacks: GameCallbacks;
  private avatar: Avatar;
  private night: boolean;
  private gateTitle: string;
  private reduced: boolean;
  private coarse: boolean;

  private scale = 3;
  private dpr = 1;
  private viewW = 0;
  private viewH = 0;
  private camX = 0;
  private camY = 0;

  private px = 0;
  private py = 0;
  private facing: Facing = 'down';
  private moving = false;
  private walkClock = 0;
  private path: TilePoint[] = [];
  private pendingInteract: Interactable | null = null;
  private stuckTime = 0;
  private lastProgress = 0;
  private keys = new Set<string>();
  private focusTarget: Interactable | null = null;
  private lastCell: number | null | undefined = undefined;
  private peers = new Map<string, PeerState>();
  private paused = false;

  private raf = 0;
  private lastTime = 0;
  private time = 0;
  private resizeObserver: ResizeObserver | null = null;
  private destroyed = false;

  constructor(opts: GameOptions) {
    this.canvas = opts.canvas;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d unavailable');
    this.ctx = ctx;
    this.buffer = document.createElement('canvas');
    this.bctx = this.buffer.getContext('2d') as CanvasRenderingContext2D;
    this.light = document.createElement('canvas');
    this.lctx = this.light.getContext('2d') as CanvasRenderingContext2D;
    this.sprites = getSprites();
    this.callbacks = opts.callbacks;
    this.avatar = opts.avatar;
    this.night = opts.night;
    this.gateTitle = opts.gateTitle ?? '';
    this.reduced = !!opts.reducedMotion;
    this.coarse = !!opts.coarsePointer;
    this.setWorld(opts.world, opts.startCell ?? null, true);

    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onBlur = this.onBlur.bind(this);
    this.loop = this.loop.bind(this);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    if (this.canvas.parentElement && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.canvas.parentElement);
    }
    this.resize();
  }

  /* ---------------- 对外接口 ---------------- */

  start(): void {
    if (this.raf || this.destroyed) return;
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.resizeObserver?.disconnect();
  }

  /** 墓位数据变了（有人下葬、迁坟），重建地图，尽量保持玩家位置 */
  setWorld(input: WorldInput, startCell: number | null = null, initial = false): void {
    this.worldInput = input;
    this.world = buildWorld(input);
    this.groundLayer = null;
    if (initial || this.isBlockedAt(this.px, this.py)) {
      const stand = startCell != null ? this.world.cellStand(startCell) : null;
      const spawn = stand ?? this.world.spawnGate;
      this.px = spawn.x;
      this.py = spawn.y;
      this.facing = stand ? 'up' : 'down';
      this.path = [];
      this.pendingInteract = null;
    }
    for (const p of this.peers.values()) this.placePeer(p, true);
    this.snapCamera();
  }

  setAvatar(avatar: Avatar): void {
    this.avatar = avatar;
  }

  setNight(night: boolean): void {
    this.night = night;
  }

  setGateTitle(title: string): void {
    this.gateTitle = title;
  }

  /** 打开抽屉或弹窗时暂停操作（画面照常） */
  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      this.keys.clear();
      this.path = [];
      this.pendingInteract = null;
    }
  }

  setPeers(list: Peer[]): void {
    const seen = new Set<string>();
    for (const p of list) {
      seen.add(p.id);
      const existing = this.peers.get(p.id);
      if (existing) {
        existing.name = p.name;
        if (existing.cell !== p.cell) {
          existing.cell = p.cell;
          this.placePeer(existing, false);
        }
      } else {
        const state: PeerState = { ...p, x: 0, y: 0, tx: 0, ty: 0, phase: Math.random() * Math.PI * 2 };
        this.placePeer(state, true);
        this.peers.set(p.id, state);
      }
    }
    for (const id of [...this.peers.keys()]) {
      if (!seen.has(id)) this.peers.delete(id);
    }
  }

  /** 走到某个墓位前（例如「回我的坟」） */
  walkToCell(cell: number): void {
    const target = this.world.interactables.find((i) => i.cell === cell && i.kind !== 'gate' && i.kind !== 'bridge');
    if (target) this.walkTo(target.approach, null);
  }

  /** 当前脚下的墓位 */
  currentCell(): number | null {
    return this.world.cellNear(this.px, this.py);
  }

  /* ---------------- 尺寸与镜头 ---------------- */

  resize(): void {
    const parent = this.canvas.parentElement;
    const cssW = Math.max(1, parent ? parent.clientWidth : this.canvas.clientWidth || 320);
    const cssH = Math.max(1, this.canvas.clientHeight || parent?.clientHeight || 400);
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    const bw = Math.round(cssW * this.dpr);
    const bh = Math.round(cssH * this.dpr);
    if (this.canvas.width !== bw) this.canvas.width = bw;
    if (this.canvas.height !== bh) this.canvas.height = bh;
    this.scale = Math.max(2, Math.floor(bw / (TILE * TARGET_TILES_WIDE)));
    this.viewW = Math.ceil(bw / this.scale);
    this.viewH = Math.ceil(bh / this.scale);
    this.buffer.width = this.viewW;
    this.buffer.height = this.viewH;
    this.light.width = this.viewW;
    this.light.height = this.viewH;
    this.bctx.imageSmoothingEnabled = false;
    this.snapCamera();
  }

  private cameraTarget(): { x: number; y: number } {
    const { pxW, pxH } = this.world;
    const x = pxW <= this.viewW ? (pxW - this.viewW) / 2 : Math.max(0, Math.min(pxW - this.viewW, this.px - this.viewW / 2));
    const y = pxH <= this.viewH ? (pxH - this.viewH) / 2 : Math.max(0, Math.min(pxH - this.viewH, this.py - this.viewH / 2));
    return { x, y };
  }

  private snapCamera(): void {
    const t = this.cameraTarget();
    this.camX = t.x;
    this.camY = t.y;
  }

  /* ---------------- 输入 ---------------- */

  private typingInField(e: KeyboardEvent): boolean {
    const el = e.target as HTMLElement | null;
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (this.paused || this.typingInField(e) || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    const moveKeys = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'];
    if (moveKeys.includes(k)) {
      e.preventDefault();
      this.keys.add(k);
      this.path = [];
      this.pendingInteract = null;
      return;
    }
    if (k === 'e' || k === 'enter' || k === ' ') {
      if (this.focusTarget) {
        e.preventDefault();
        this.callbacks.onInteract(this.focusTarget);
      }
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keys.delete(e.key.toLowerCase());
  }

  private onBlur(): void {
    this.keys.clear();
  }

  private onPointerDown(e: PointerEvent): void {
    if (this.paused) return;
    const rect = this.canvas.getBoundingClientRect();
    const bx = ((e.clientX - rect.left) / rect.width) * this.canvas.width;
    const by = ((e.clientY - rect.top) / rect.height) * this.canvas.height;
    const wx = bx / this.scale + this.camX;
    const wy = by / this.scale + this.camY;

    const hit = this.hitInteractable(wx, wy);
    if (hit) {
      if (this.distanceTo(hit) <= INTERACT_RADIUS) {
        this.callbacks.onInteract(hit);
        return;
      }
      this.walkTo(hit.approach, hit);
      return;
    }
    const tile = { tx: Math.floor(wx / TILE), ty: Math.floor(wy / TILE) };
    const open = nearestOpen(this.world.wTiles, this.world.hTiles, (x, y) => this.world.isBlockedTile(x, y), tile);
    if (open) this.walkTo(open, null);
  }

  private hitInteractable(wx: number, wy: number): Interactable | null {
    let best: Interactable | null = null;
    let bestArea = Infinity;
    for (const it of this.world.interactables) {
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

  private walkTo(goal: TilePoint, interact: Interactable | null): void {
    const from = { tx: Math.floor(this.px / TILE), ty: Math.floor((this.py - 2) / TILE) };
    const isBlocked = (x: number, y: number) => this.world.isBlockedTile(x, y);
    const start = nearestOpen(this.world.wTiles, this.world.hTiles, isBlocked, from, 2) ?? from;
    const path = findPath(this.world.wTiles, this.world.hTiles, isBlocked, start, goal);
    if (!path) return;
    this.path = path;
    this.pendingInteract = interact;
    this.stuckTime = 0;
    this.lastProgress = Infinity;
  }

  /* ---------------- 主循环 ---------------- */

  private loop(now: number): void {
    if (this.destroyed) return;
    const dt = Math.max(0, Math.min(0.05, (now - this.lastTime) / 1000));
    this.lastTime = now;
    if (!document.hidden) {
      this.update(dt);
      this.render();
    }
    this.raf = requestAnimationFrame(this.loop);
  }

  /** 测试用：手动推进若干帧 */
  step(seconds: number, frames = 1): void {
    for (let i = 0; i < frames; i++) this.update(seconds);
    this.render();
  }

  private update(dt: number): void {
    this.time += dt;
    let dx = 0;
    let dy = 0;
    if (!this.paused) {
      if (this.keys.has('arrowleft') || this.keys.has('a')) dx -= 1;
      if (this.keys.has('arrowright') || this.keys.has('d')) dx += 1;
      if (this.keys.has('arrowup') || this.keys.has('w')) dy -= 1;
      if (this.keys.has('arrowdown') || this.keys.has('s')) dy += 1;
    }

    if (!dx && !dy && this.path.length) {
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
          this.callbacks.onInteract(target);
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

    this.moving = !!(dx || dy);
    if (this.moving) {
      const len = Math.hypot(dx, dy) || 1;
      const speed = this.avatar === 'ghost' ? 64 : 56;
      const mx = (dx / len) * speed * dt;
      const my = (dy / len) * speed * dt;
      if (Math.abs(dx) > Math.abs(dy)) this.facing = dx < 0 ? 'left' : 'right';
      else this.facing = dy < 0 ? 'up' : 'down';
      if (!this.isBlockedAt(this.px + mx, this.py)) this.px += mx;
      if (!this.isBlockedAt(this.px, this.py + my)) this.py += my;
      this.px = Math.max(4, Math.min(this.world.pxW - 4, this.px));
      this.py = Math.max(8, Math.min(this.world.pxH - 2, this.py));
      this.walkClock += dt;
    } else {
      this.walkClock = 0;
    }

    // 附近可交互的东西
    let best: Interactable | null = null;
    let bestD = Infinity;
    for (const it of this.world.interactables) {
      const d = this.distanceTo(it);
      const radius = it.kind === 'gate' || it.kind === 'bridge' ? INTERACT_RADIUS + 6 : INTERACT_RADIUS;
      if (d <= radius && this.py >= it.py - 8 && d < bestD) {
        best = it;
        bestD = d;
      }
    }
    this.focusTarget = best;

    const cell = this.world.cellNear(this.px, this.py);
    if (cell !== this.lastCell) {
      this.lastCell = cell;
      this.callbacks.onCellChange?.(cell);
    }

    for (const p of this.peers.values()) {
      const k = this.reduced ? 1 : Math.min(1, dt * 2.2);
      p.x += (p.tx - p.x) * k;
      p.y += (p.ty - p.y) * k;
    }

    const t = this.cameraTarget();
    const ck = this.reduced ? 1 : Math.min(1, dt * 8);
    this.camX += (t.x - this.camX) * ck;
    this.camY += (t.y - this.camY) * ck;
  }

  private distanceTo(it: Interactable): number {
    return Math.hypot(it.px - this.px, it.py - this.py);
  }

  private isBlockedAt(x: number, y: number): boolean {
    const halfW = 4;
    const h = 5;
    const x0 = Math.floor((x - halfW) / TILE);
    const x1 = Math.floor((x + halfW - 0.01) / TILE);
    const y0 = Math.floor((y - h) / TILE);
    const y1 = Math.floor((y - 0.01) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (this.world.isBlockedTile(tx, ty)) return true;
      }
    }
    return false;
  }

  private placePeer(p: PeerState, snap: boolean): void {
    const stand = p.cell != null ? this.world.cellStand(p.cell) : null;
    const base = stand ?? this.world.spawnGate;
    // 同一格多个鬼时错开一点
    let hash = 0;
    for (const ch of p.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    p.tx = base.x + ((hash % 5) - 2) * 5;
    p.ty = base.y + 2 + ((hash >> 3) % 3) * 2;
    if (snap) {
      p.x = p.tx;
      p.y = p.ty;
    }
  }

  /* ---------------- 绘制 ---------------- */

  private buildGroundLayer(): Canvas {
    const w = this.world;
    const layer = document.createElement('canvas');
    layer.width = w.pxW;
    layer.height = w.pxH;
    const x = layer.getContext('2d') as CanvasRenderingContext2D;
    x.imageSmoothingEnabled = false;
    const s = this.sprites;
    for (let ty = 0; ty < w.hTiles; ty++) {
      for (let tx = 0; tx < w.wTiles; tx++) {
        const i = ty * w.wTiles + tx;
        const g = w.ground[i];
        const v = (tx * 7 + ty * 13) % 4;
        let img: Canvas = s.grass[v];
        if (g === GROUND_PATH) img = s.path[v % 3];
        else if (g === GROUND_FENCE) img = s.fence;
        else if (g === GROUND_WATER || g === GROUND_BRIDGE) img = s.water[0];
        x.drawImage(img, tx * TILE, ty * TILE);
        if (g === GROUND_BRIDGE) x.drawImage(s.bridge, tx * TILE, ty * TILE);
        const d = w.deco[i];
        if (d === 1) {
          const colors = ['#e9e2d0', '#d8b45e', '#c96a5e'];
          x.fillStyle = colors[(tx + ty) % 3];
          x.fillRect(tx * TILE + 5, ty * TILE + 6, 1, 1);
          x.fillRect(tx * TILE + 4, ty * TILE + 7, 3, 1);
          x.fillRect(tx * TILE + 5, ty * TILE + 8, 1, 1);
          x.fillStyle = '#2f5a3a';
          x.fillRect(tx * TILE + 5, ty * TILE + 9, 1, 2);
        } else if (d === 2) {
          x.fillStyle = '#3c6236';
          x.fillRect(tx * TILE + 9, ty * TILE + 10, 1, 3);
          x.fillRect(tx * TILE + 11, ty * TILE + 9, 1, 4);
          x.fillRect(tx * TILE + 13, ty * TILE + 11, 1, 2);
        } else if (d === 3) {
          x.fillStyle = '#9a9488';
          x.fillRect(tx * TILE + 3, ty * TILE + 12, 2, 1);
          x.fillStyle = '#6f6a60';
          x.fillRect(tx * TILE + 3, ty * TILE + 13, 2, 1);
        }
      }
    }
    // 桥的栏杆
    for (const sp of w.sprites) {
      if (sp.kind !== 'bridge') continue;
      const left = Math.round(sp.x - TILE * 1.5);
      const top = Math.round(sp.y - TILE * 2 - 4);
      x.fillStyle = '#16131d';
      x.fillRect(left, top, 2, TILE * 2 + 4);
      x.fillRect(left + TILE * 3 - 2, top, 2, TILE * 2 + 4);
      x.fillStyle = '#a3302a';
      for (let yy = top; yy < top + TILE * 2 + 4; yy += 6) {
        x.fillRect(left - 1, yy, 4, 3);
        x.fillRect(left + TILE * 3 - 3, yy, 4, 3);
      }
    }
    // 坟前土堆与空墓位的虚线框
    for (const sp of w.sprites) {
      if (sp.kind === 'stone' || sp.kind === 'group') {
        const mw = sp.kind === 'group' ? (sp.pw ?? 40) + 8 : 26;
        x.fillStyle = 'rgba(70,50,30,0.55)';
        x.beginPath();
        x.ellipse(Math.round(sp.x), Math.round(sp.y + 1), mw / 2, 4, 0, 0, Math.PI * 2);
        x.fill();
      } else if (sp.kind === 'emptyPlot') {
        const left = Math.round(sp.x - 14);
        const top = Math.round(sp.y - 10);
        x.fillStyle = 'rgba(40,30,20,0.35)';
        x.fillRect(left, top, 28, 12);
        x.fillStyle = 'rgba(230,220,200,0.55)';
        for (let i = 0; i < 28; i += 2) {
          x.fillRect(left + i, top, 1, 1);
          x.fillRect(left + i, top + 11, 1, 1);
        }
        for (let i = 0; i < 12; i += 2) {
          x.fillRect(left, top + i, 1, 1);
          x.fillRect(left + 27, top + i, 1, 1);
        }
      }
    }
    return layer;
  }

  private render(): void {
    const b = this.bctx;
    const camX = Math.round(this.camX);
    const camY = Math.round(this.camY);
    b.fillStyle = this.night ? '#06080d' : '#9aa196';
    b.fillRect(0, 0, this.viewW, this.viewH);
    if (!this.groundLayer) this.groundLayer = this.buildGroundLayer();
    b.drawImage(this.groundLayer, -camX, -camY);

    // 河水动起来：只重画可见的水格
    if (!this.reduced && Math.floor(this.time * 2) % 2 === 1) {
      const w = this.world;
      const tx0 = Math.max(0, Math.floor(camX / TILE));
      const ty0 = Math.max(0, Math.floor(camY / TILE));
      const tx1 = Math.min(w.wTiles - 1, Math.floor((camX + this.viewW) / TILE));
      const ty1 = Math.min(w.hTiles - 1, Math.floor((camY + this.viewH) / TILE));
      for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          if (w.ground[ty * w.wTiles + tx] === GROUND_WATER) b.drawImage(this.sprites.water[1], tx * TILE - camX, ty * TILE - camY);
        }
      }
    }

    // 交互目标脚下的光圈
    if (this.focusTarget && !this.paused) {
      const f = this.focusTarget;
      b.fillStyle = this.night ? 'rgba(159,232,212,0.35)' : 'rgba(217,178,90,0.45)';
      b.beginPath();
      b.ellipse(Math.round(f.px - camX), Math.round(f.py - camY), f.kind === 'group' ? 30 : 12, 4, 0, 0, Math.PI * 2);
      b.fill();
    }

    // 按底边排序后绘制
    type Drawable = { y: number; draw: () => void };
    const list: Drawable[] = [];
    for (const sp of this.world.sprites) {
      if (sp.kind === 'bridge' || sp.kind === 'emptyPlot') continue;
      list.push({ y: sp.y, draw: () => this.drawSprite(sp, camX, camY) });
    }
    for (const p of this.peers.values()) {
      list.push({ y: p.y, draw: () => this.drawGhost(p.x - camX, p.y - camY, 'down', p.phase, 0.78) });
    }
    list.push({
      y: this.py,
      draw: () => {
        if (this.avatar === 'ghost') this.drawGhost(this.px - camX, this.py - camY, this.facing, 0, 1);
        else this.drawPerson(this.px - camX, this.py - camY);
      },
    });
    list.sort((a, c) => a.y - c.y);
    for (const d of list) d.draw();

    if (this.night) this.renderNight(camX, camY);
    else {
      b.fillStyle = 'rgba(200,206,196,0.16)';
      b.fillRect(0, 0, this.viewW, this.viewH);
    }

    const c = this.ctx;
    c.imageSmoothingEnabled = false;
    c.drawImage(this.buffer, 0, 0, this.viewW * this.scale, this.viewH * this.scale);
    this.renderLabels(camX, camY);
  }

  private drawSprite(sp: WorldSprite, camX: number, camY: number): void {
    const b = this.bctx;
    const s = this.sprites;
    let img: Canvas | null = null;
    if (sp.kind === 'stone') img = s.stones[sp.style ?? 'qingshi'] ?? s.stones.qingshi;
    else if (sp.kind === 'group') {
      const seats = this.groupSeats(sp.pw ?? 40);
      img = s.groupStone(sp.pw ?? 40, sp.memberCount ?? 0, seats);
    } else if (sp.kind === 'tree') img = s.tree;
    else if (sp.kind === 'lamp') img = s.lamp;
    else if (sp.kind === 'flag') img = s.flag;
    else if (sp.kind === 'gate') img = s.gate;
    if (!img) return;
    const x = Math.round(sp.x - img.width / 2 - camX);
    const y = Math.round(sp.y - img.height - camY);
    if (x > this.viewW || y > this.viewH || x + img.width < 0 || y + img.height < 0) return;
    b.drawImage(img, x, y);
    if (sp.hot && (sp.kind === 'stone' || sp.kind === 'group')) {
      // 香火：两缕烟
      const t = this.time;
      b.fillStyle = 'rgba(230,226,214,0.55)';
      for (let i = 0; i < 2; i++) {
        const phase = (t * 0.8 + i * 0.5) % 1;
        const sx = Math.round(sp.x - camX + 6 + Math.sin(t * 2 + i) * 2);
        const sy = Math.round(sp.y - camY - 4 - phase * 14);
        b.globalAlpha = 1 - phase;
        b.fillRect(sx, sy, 1, 2);
      }
      b.globalAlpha = 1;
      b.fillStyle = '#e8743b';
      b.fillRect(Math.round(sp.x - camX + 6), Math.round(sp.y - camY - 3), 1, 1);
    }
  }

  private groupSeats(pw: number): number {
    // 双穴宽约 78px，四穴约 206px，六穴约 334px
    if (pw < 120) return 2;
    if (pw < 260) return 4;
    return 6;
  }

  private drawGhost(x: number, y: number, facing: Facing, phase: number, alpha: number): void {
    const b = this.bctx;
    const frames = this.sprites.ghost[facing];
    const frame = frames[Math.floor((this.time + phase) * 3) % 2];
    const bob = this.reduced ? 0 : Math.round(Math.sin((this.time + phase) * 3.2) * 1.5);
    b.fillStyle = 'rgba(0,0,0,0.25)';
    b.beginPath();
    b.ellipse(Math.round(x), Math.round(y), 5, 2, 0, 0, Math.PI * 2);
    b.fill();
    b.globalAlpha = alpha;
    b.drawImage(frame, Math.round(x - frame.width / 2), Math.round(y - frame.height - 3 + bob));
    b.globalAlpha = 1;
  }

  private drawPerson(x: number, y: number): void {
    const b = this.bctx;
    const set = this.sprites.person[this.facing];
    const frame = !this.moving ? set.idle : Math.floor(this.walkClock * 7) % 2 === 0 ? set.walkA : set.walkB;
    b.fillStyle = 'rgba(0,0,0,0.25)';
    b.beginPath();
    b.ellipse(Math.round(x), Math.round(y), 5, 2, 0, 0, Math.PI * 2);
    b.fill();
    b.drawImage(frame, Math.round(x - frame.width / 2), Math.round(y - frame.height));
  }

  private renderNight(camX: number, camY: number): void {
    const l = this.lctx;
    l.globalCompositeOperation = 'source-over';
    l.clearRect(0, 0, this.viewW, this.viewH);
    l.fillStyle = 'rgba(6,10,30,0.8)';
    l.fillRect(0, 0, this.viewW, this.viewH);
    l.globalCompositeOperation = 'destination-out';
    const hole = (x: number, y: number, r: number, strength = 1) => {
      if (x + r < 0 || y + r < 0 || x - r > this.viewW || y - r > this.viewH) return;
      const g = l.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${strength})`);
      g.addColorStop(0.6, `rgba(0,0,0,${strength * 0.6})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = g;
      l.beginPath();
      l.arc(x, y, r, 0, Math.PI * 2);
      l.fill();
    };
    hole(this.px - camX, this.py - camY - 8, this.avatar === 'ghost' ? 64 : 50);
    for (const sp of this.world.sprites) {
      if (sp.kind === 'lamp') hole(sp.x - camX, sp.y - camY - 18, 46, 0.9);
      else if (sp.kind === 'gate') hole(sp.x - camX, sp.y - camY - 30, 40, 0.5);
      else if (sp.hot) hole(sp.x - camX + 6, sp.y - camY - 4, 14, 0.7);
    }
    for (const p of this.peers.values()) hole(p.x - camX, p.y - camY - 8, 28, 0.85);
    l.globalCompositeOperation = 'source-over';
    this.bctx.drawImage(this.light, 0, 0);

    // 暖光与鬼火的颜色
    const b = this.bctx;
    b.globalCompositeOperation = 'lighter';
    const glow = (x: number, y: number, r: number, color: string) => {
      if (x + r < 0 || y + r < 0 || x - r > this.viewW || y - r > this.viewH) return;
      const g = b.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      b.fillStyle = g;
      b.beginPath();
      b.arc(x, y, r, 0, Math.PI * 2);
      b.fill();
    };
    for (const sp of this.world.sprites) {
      if (sp.kind === 'lamp') glow(sp.x - camX, sp.y - camY - 18, 26, 'rgba(255,190,110,0.28)');
    }
    const glowColor = this.avatar === 'ghost' ? 'rgba(150,240,215,0.25)' : 'rgba(255,200,120,0.22)';
    glow(this.px - camX, this.py - camY - 10, 22, glowColor);
    for (const p of this.peers.values()) glow(p.x - camX, p.y - camY - 10, 18, 'rgba(150,240,215,0.22)');
    b.globalCompositeOperation = 'source-over';
  }

  /** 文字画在高分辨率画布上，避免像素放大后发糊 */
  private renderLabels(camX: number, camY: number): void {
    const c = this.ctx;
    const k = this.scale;
    const dpr = this.dpr;
    const text = (str: string, wx: number, wy: number, size: number, color: string, weight = 400) => {
      const x = (wx - camX) * k;
      const y = (wy - camY) * k;
      if (x < -200 || y < -40 || x > this.canvas.width + 200 || y > this.canvas.height + 40) return;
      c.font = `${weight} ${Math.round(size * dpr)}px ${LABEL_FONT}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineJoin = 'round';
      c.lineWidth = Math.max(2, 3 * dpr);
      c.strokeStyle = 'rgba(10,10,16,0.85)';
      c.strokeText(str, x, y);
      c.fillStyle = color;
      c.fillText(str, x, y);
    };

    const nameColor = this.night ? '#e9e4d7' : '#f6f2e8';
    for (const sp of this.world.sprites) {
      if ((sp.kind === 'stone' || sp.kind === 'group') && sp.name) {
        const short = sp.name.length > 8 ? sp.name.slice(0, 8) + '…' : sp.name;
        const label = sp.mine ? `${short}（我的坟）` : short;
        const top = sp.kind === 'group' ? 34 : sp.style === 'tubao' ? 22 : sp.style === 'mupai' ? 26 : 25;
        text(label, sp.x, sp.y - top, 11, sp.mine ? '#e8c46a' : nameColor, sp.mine ? 600 : 400);
      } else if (sp.kind === 'flag' && sp.name) {
        text(sp.name, sp.x, sp.y + 4, 10, '#e8c46a');
      } else if (sp.kind === 'gate' && this.gateTitle) {
        text(this.gateTitle.length > 6 ? this.gateTitle.slice(0, 6) : this.gateTitle, sp.x, sp.y - 46, 9, '#e8c46a', 600);
      }
    }
    for (const p of this.peers.values()) text(p.name, p.x, p.y - 24, 11, '#9fe8d4', 600);
    text('我', this.px, this.py + 7, 11, this.avatar === 'ghost' ? '#9fe8d4' : '#e8c46a', 600);

    if (this.focusTarget && !this.paused) {
      const f = this.focusTarget;
      const verb =
        f.kind === 'gate' ? '回园区导览' : f.kind === 'bridge' ? (this.world.hasNext ? '过桥去下一期' : '已是最后一期') : f.kind === 'empty' ? '看看这块空地' : '看碑';
      const key = this.coarse ? '点一下' : 'E';
      const label = `${key} · ${verb}`;
      const bx = (f.px - camX) * k;
      const by = (f.box.y - camY) * k;
      c.font = `600 ${Math.round(12 * dpr)}px ${LABEL_FONT}`;
      const tw = c.measureText(label).width + 16 * dpr;
      const th = 22 * dpr;
      c.fillStyle = 'rgba(14,16,22,0.88)';
      c.fillRect(Math.round(bx - tw / 2), Math.round(by - th / 2), Math.round(tw), Math.round(th));
      c.strokeStyle = this.night ? '#9fe8d4' : '#d8b45e';
      c.lineWidth = Math.max(1, dpr);
      c.strokeRect(Math.round(bx - tw / 2) + 0.5, Math.round(by - th / 2) + 0.5, Math.round(tw) - 1, Math.round(th) - 1);
      c.fillStyle = '#f2ede0';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(label, bx, by + dpr);
    }
  }
}
