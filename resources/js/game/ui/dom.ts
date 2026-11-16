/**
 * 叠在画布上的网页输入框（中文输入法只能靠真正的 <input>/<textarea>）。
 * 输入框本身透明，下面的像素边框由画布画；每帧按边框的位置同步过去，
 * 在滚动区里被卷出去的部分用 clip-path 裁掉，被别的面板盖住时隐藏。
 */

import Phaser from 'phaser';
import { FONT, FONT_SIZE, LINE_HEIGHT } from './theme';

export type Rect = { x: number; y: number; w: number; h: number };

export interface DomInputOptions {
  /** 用来定位的画布对象（通常是输入框的像素边框） */
  anchor: Phaser.GameObjects.GameObject & { x: number; y: number; displayWidth: number; displayHeight: number; originX: number; originY: number };
  owner: string;
  multiline?: boolean;
  placeholder?: string;
  maxLength?: number;
  value?: string;
  paper?: boolean;
  numeric?: boolean;
  readOnly?: boolean;
  /** 内边距（游戏像素） */
  padX?: number;
  padY?: number;
  onInput?: (value: string) => void;
  onEnter?: () => void;
  onFocusChange?: (focused: boolean) => void;
}

type Clipped = { __clip?: () => Rect | null };

class DomLayer {
  root: HTMLElement | null = null;
  inputs = new Set<DomInput>();
  /** 只有这个 owner 的输入框可见（最上层的面板或场景） */
  topOwner: string | null = null;
  suspended = false;
  cssPerPx = 1;
  offsetX = 0;
  offsetY = 0;
  canvas: HTMLCanvasElement | null = null;

  attach(game: Phaser.Game): void {
    this.root = document.getElementById('dom-layer');
    this.canvas = game.canvas;
    game.events.on(Phaser.Core.Events.POST_RENDER, () => this.sync());
    this.measure();
  }

  measure(): void {
    if (!this.canvas) return;
    const r = this.canvas.getBoundingClientRect();
    this.offsetX = r.left;
    this.offsetY = r.top;
    this.cssPerPx = this.canvas.width > 0 ? r.width / this.canvas.width : 1;
    for (const i of this.inputs) i.restyle();
  }

  setTopOwner(owner: string | null): void {
    this.topOwner = owner;
  }

  sync(): void {
    for (const i of this.inputs) i.sync();
  }

  /** 有输入框正在打字 */
  typing(): boolean {
    const el = document.activeElement as HTMLElement | null;
    return !!el && el.classList.contains('px-input');
  }

  blurAll(): void {
    const el = document.activeElement as HTMLElement | null;
    if (el && el.classList.contains('px-input')) el.blur();
  }
}

export const domLayer = new DomLayer();

export class DomInput {
  readonly el: HTMLInputElement | HTMLTextAreaElement;
  private opts: DomInputOptions;
  private last = '';
  private destroyed = false;

  constructor(opts: DomInputOptions) {
    this.opts = opts;
    const el = opts.multiline ? document.createElement('textarea') : document.createElement('input');
    el.className = 'px-input' + (opts.paper ? ' paper' : '') + (opts.readOnly ? ' readonly' : '');
    if (el instanceof HTMLInputElement) {
      el.type = 'text';
      if (opts.numeric) el.inputMode = 'numeric';
      el.enterKeyHint = 'done';
    }
    el.autocomplete = 'off';
    el.spellcheck = false;
    if (opts.placeholder) el.placeholder = opts.placeholder;
    if (opts.maxLength) el.maxLength = opts.maxLength;
    if (opts.readOnly) el.readOnly = true;
    el.value = opts.value ?? '';
    el.style.display = 'none';
    el.addEventListener('input', () => {
      opts.onInput?.(el.value);
    });
    el.addEventListener('keydown', (ev) => {
      const e = ev as KeyboardEvent;
      e.stopPropagation();
      if (e.key === 'Enter' && !opts.multiline && !e.isComposing) {
        e.preventDefault();
        opts.onEnter?.();
      }
      if (e.key === 'Escape') el.blur();
    });
    el.addEventListener('keyup', (e) => e.stopPropagation());
    el.addEventListener('focus', () => {
      opts.onFocusChange?.(true);
      if (opts.readOnly) el.select();
    });
    el.addEventListener('blur', () => opts.onFocusChange?.(false));
    // 画布上的 pointer 事件不能让它触发
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    domLayer.root?.appendChild(el);
    this.el = el;
    domLayer.inputs.add(this);
    this.restyle();
    opts.anchor.once(Phaser.GameObjects.Events.DESTROY, () => this.destroy());
  }

  get value(): string {
    return this.el.value;
  }

  set value(v: string) {
    this.el.value = v;
  }

  focus(): void {
    this.el.focus({ preventScroll: true });
  }

  restyle(): void {
    const k = domLayer.cssPerPx;
    const s = this.el.style;
    s.fontFamily = FONT;
    s.fontSize = `${FONT_SIZE * k}px`;
    s.lineHeight = `${(this.opts.multiline ? LINE_HEIGHT : FONT_SIZE + 2) * k}px`;
    s.padding = `${(this.opts.padY ?? 3) * k}px ${(this.opts.padX ?? 4) * k}px`;
    this.last = '';
  }

  sync(): void {
    if (this.destroyed) return;
    const a = this.opts.anchor as unknown as Phaser.GameObjects.Components.Visible &
      Phaser.GameObjects.GameObject & { x: number; y: number; displayWidth: number; displayHeight: number; originX: number; originY: number } & Clipped;
    const scene = a.scene;
    const visible =
      !domLayer.suspended &&
      domLayer.topOwner === this.opts.owner &&
      a.active &&
      a.visible &&
      !!scene &&
      scene.sys.isActive() &&
      scene.sys.isVisible();
    if (!visible) {
      if (this.last !== 'hidden') {
        this.el.style.display = 'none';
        if (document.activeElement === this.el) this.el.blur();
        this.last = 'hidden';
      }
      return;
    }
    const k = domLayer.cssPerPx;
    const x = a.x - a.originX * a.displayWidth;
    const y = a.y - a.originY * a.displayHeight;
    const w = a.displayWidth;
    const h = a.displayHeight;
    let clip = '';
    const c = a.__clip?.();
    if (c) {
      const top = Math.max(0, c.y - y);
      const bottom = Math.max(0, y + h - (c.y + c.h));
      if (top >= h || bottom >= h) {
        if (this.last !== 'hidden') {
          this.el.style.display = 'none';
          this.last = 'hidden';
        }
        return;
      }
      if (top > 0 || bottom > 0) clip = `inset(${top * k}px 0 ${bottom * k}px 0)`;
    }
    const key = `${x}|${y}|${w}|${h}|${k}|${clip}|${domLayer.offsetX}|${domLayer.offsetY}`;
    if (key === this.last) return;
    this.last = key;
    const s = this.el.style;
    s.display = 'block';
    s.left = `${domLayer.offsetX + x * k}px`;
    s.top = `${domLayer.offsetY + y * k}px`;
    s.width = `${w * k}px`;
    s.height = `${h * k}px`;
    s.clipPath = clip;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    domLayer.inputs.delete(this);
    this.el.remove();
  }
}
