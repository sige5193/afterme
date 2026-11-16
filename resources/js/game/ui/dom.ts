/**
 * 叠在画布上的网页输入框（中文输入法只能靠真正的 <input>/<textarea>）。
 * 输入框本身透明，下面的像素边框由画布画；每帧按边框的位置同步过去，
 * 在滚动区里被卷出去的部分用 clip-path 裁掉，被别的面板盖住时隐藏。
 *
 * 手机上要多管两件事：
 * - 字数上限不用原生 maxlength：拼音还没上屏时它也算字数（iOS 拼音打不完，安卓输入法会重复出字），改成上屏后再截；
 * - 键盘盖住正在打字的输入框时，把整块画布往上推到露出来，打完再放回去。
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

/** 可见区域比画布矮这么多（CSS 像素）才算键盘弹出来了；电脑上窗口和画布差不多高，不会误推 */
const KEYBOARD_MIN = 60;

function isField(target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement {
  return target instanceof HTMLElement && target.classList.contains('px-input');
}

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
  game: Phaser.Game | null = null;
  /** 为了躲键盘，画布往上推了多少 CSS 像素 */
  lift = 0;
  private liftFrame = 0;

  attach(game: Phaser.Game): void {
    this.root = document.getElementById('dom-layer');
    this.canvas = game.canvas;
    this.game = game;
    game.events.on(Phaser.Core.Events.POST_RENDER, () => this.sync());
    this.measure();

    const recheck = () => this.scheduleLift();
    window.visualViewport?.addEventListener('resize', recheck);
    window.visualViewport?.addEventListener('scroll', recheck);
    addEventListener('resize', recheck);
    document.addEventListener('focusin', recheck);
    document.addEventListener('focusout', (e) => {
      // 下一帧再收：失焦常常发生在销毁面板的半路上，这时别去碰别的输入框
      recheck();
      // iOS 收起键盘后页面偶尔停在被顶上去的位置，之后点哪儿都错位
      if (!isField(e.relatedTarget) && (window.scrollX || window.scrollY)) window.scrollTo(0, 0);
    });
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
    return isField(document.activeElement);
  }

  blurAll(): void {
    const el = document.activeElement;
    if (isField(el)) el.blur();
  }

  private scheduleLift(): void {
    if (this.liftFrame) return;
    this.liftFrame = requestAnimationFrame(() => {
      this.liftFrame = 0;
      this.updateLift();
    });
  }

  /** 键盘盖住了正在打字的输入框：推到刚好露出来，但输入框的上沿不能推出屏幕 */
  private updateLift(): void {
    const el = document.activeElement;
    if (!isField(el) || !this.canvas) {
      this.setLift(0);
      return;
    }
    const vv = window.visualViewport;
    const top = vv ? vv.offsetTop : 0;
    const bottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
    if (bottom - top > this.canvas.getBoundingClientRect().height - KEYBOARD_MIN) {
      this.setLift(0);
      return;
    }
    // 量的时候扣掉已经推上去的部分，按没推时的位置算
    const r = el.getBoundingClientRect();
    const margin = 6 * this.cssPerPx;
    const over = r.bottom + this.lift + margin - bottom;
    const room = r.top + this.lift - margin - top;
    this.setLift(over > 0 ? Math.max(0, Math.round(Math.min(over, room))) : 0);
  }

  private setLift(px: number): void {
    if (px === this.lift) return;
    this.lift = px;
    const host = this.canvas?.parentElement;
    if (host) host.style.transform = px ? `translateY(${-px}px)` : '';
    this.measure();
    this.sync();
    // 画布挪了，Phaser 换算点击位置用的边界也得跟着更新
    this.game?.scale.updateBounds();
  }
}

export const domLayer = new DomLayer();

export class DomInput {
  readonly el: HTMLInputElement | HTMLTextAreaElement;
  private opts: DomInputOptions;
  private last = '';
  private destroyed = false;
  /** 输入法还在拼（拼音没上屏） */
  private composing = false;

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
    el.setAttribute('autocapitalize', 'off');
    el.setAttribute('autocorrect', 'off');
    if (opts.placeholder) el.placeholder = opts.placeholder;
    if (opts.readOnly) el.readOnly = true;
    el.value = opts.value ?? '';
    el.style.display = 'none';
    el.addEventListener('compositionstart', () => {
      this.composing = true;
    });
    el.addEventListener('compositionend', () => {
      this.composing = false;
      this.changed();
    });
    el.addEventListener('input', (ev) => {
      // 拼的过程中不动输入框里的字，改了输入法就断了；外面照样拿到当前内容（没点上屏就点按钮也不丢字）
      if (this.composing || (ev as InputEvent).isComposing) {
        opts.onInput?.(el.value);
        return;
      }
      this.changed();
    });
    el.addEventListener('keydown', (ev) => {
      const e = ev as KeyboardEvent;
      e.stopPropagation();
      // 229：Safari 用回车确认拼音时 isComposing 已经是 false，只能靠它认出来
      if (e.key === 'Enter' && !opts.multiline && !e.isComposing && e.keyCode !== 229) {
        e.preventDefault();
        // 键盘上的「完成」：有提交动作就提交，没有就收起键盘
        if (opts.onEnter) opts.onEnter();
        else el.blur();
      }
      if (e.key === 'Escape') el.blur();
    });
    el.addEventListener('keyup', (e) => e.stopPropagation());
    el.addEventListener('focus', () => {
      opts.onFocusChange?.(true);
      if (opts.readOnly) el.select();
    });
    el.addEventListener('blur', () => {
      if (!this.destroyed) opts.onFocusChange?.(false);
    });
    // 点输入框的事件不能漏给画布（Phaser 在 window 上也听；iOS 点完还会补发一套鼠标事件）
    const stop = (e: Event) => e.stopPropagation();
    el.addEventListener('pointerdown', stop);
    el.addEventListener('mousedown', stop);
    el.addEventListener('mouseup', stop);
    el.addEventListener('touchstart', stop, { passive: true });
    el.addEventListener('touchend', stop, { passive: true });
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

  /** 面板一打开就聚焦。手机上不自动：不是手点出来的聚焦 iOS 不弹键盘，安卓弹了又会把页面顶起来 */
  autofocus(): void {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    this.focus();
  }

  /** 字已经上屏：超出上限的截掉（像原生 maxlength 一样截刚输入的那段），再告诉外面 */
  private changed(): void {
    const el = this.el;
    const max = this.opts.maxLength;
    if (max) {
      const chars = Array.from(el.value);
      const over = chars.length - max;
      if (over > 0) {
        const caret = Array.from(el.value.slice(0, el.selectionStart ?? el.value.length)).length;
        const start = Math.max(0, caret - over);
        chars.splice(start, over);
        el.value = chars.join('');
        if (document.activeElement === el) {
          const pos = chars.slice(0, start).join('').length;
          el.setSelectionRange(pos, pos);
        }
      }
    }
    this.opts.onInput?.(el.value);
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
    // 先失焦再拿掉：直接 remove 不发 blur/focusout，推上去的画布和推迟的重排就都收不回来了
    if (document.activeElement === this.el) this.el.blur();
    this.el.remove();
  }
}
