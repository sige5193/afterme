/**
 * 像素界面零件：文字、九宫格边框、按钮、标签、输入框、排版盒子、滚动区。
 * 基于 rexUI 的 Sizer / Label / ScrollablePanel / BBCodeText / NinePatch。
 */

import Phaser from 'phaser';
import BBCodeText from 'phaser3-rex-plugins/plugins/bbcodetext.js';
import NinePatch from 'phaser3-rex-plugins/plugins/ninepatch2.js';
import FixWidthSizer from 'phaser3-rex-plugins/templates/ui/fixwidthsizer/FixWidthSizer.js';
import GridSizer from 'phaser3-rex-plugins/templates/ui/gridsizer/GridSizer.js';
import Label from 'phaser3-rex-plugins/templates/ui/label/Label.js';
import OverlapSizer from 'phaser3-rex-plugins/templates/ui/overlapsizer/OverlapSizer.js';
import ScrollablePanel from 'phaser3-rex-plugins/templates/ui/scrollablepanel/ScrollablePanel.js';
import Sizer from 'phaser3-rex-plugins/templates/ui/sizer/Sizer.js';
import { sfx } from '@/core/ui';
import { toast } from '@/core/ui';
import type { ButtonKind, ButtonState } from '../pixel/frames';
import { FRAME_CORNERS } from '../pixel/textures';
import { DomInput, type Rect } from './dom';
import { wrapMarkup, wrappedIndex, wrapPlain } from './linebreak';
import { BTN_H, BTN_H_SM, COL, FONT, FONT_SIZE, HEX, INPUT_H, LINE_HEIGHT, LINE_SPACING } from './theme';

export { BBCodeText, FixWidthSizer, GridSizer, Label, NinePatch, OverlapSizer, ScrollablePanel, Sizer };

export type Pad = { left?: number; right?: number; top?: number; bottom?: number };
type AnyGO = Phaser.GameObjects.GameObject;

/* ---------------- 文字 ---------------- */

/** BBCode 里原样显示用户写的字 */
export function raw(s: string | null | undefined): string {
  return `[raw]${String(s ?? '').replace(/\[\/raw\]/gi, '[ /raw]')}[/raw]`;
}

export function colored(s: string | null | undefined, color: string): string {
  return `[color=${color}]${raw(s)}[/color]`;
}

export type TxtOpts = {
  color?: string;
  wrap?: number;
  align?: 'left' | 'center' | 'right';
  scale?: number;
  maxLines?: number;
  lineSpacing?: number;
  /** true：字符串里有 [color] 之类的标记；默认按原文显示 */
  markup?: boolean;
  fixedWidth?: number;
  /** 文字底下垫一块颜色（地图上的名字牌） */
  bgColor?: string;
  pad?: number;
};

export function txt(scene: Phaser.Scene, str: string, o: TxtOpts = {}): BBCodeText {
  const scale = o.scale ?? 1;
  const style: Record<string, unknown> = {
    fontFamily: FONT,
    fontSize: `${FONT_SIZE}px`,
    color: o.color ?? COL.bone,
    lineSpacing: o.lineSpacing ?? LINE_SPACING,
    halign: o.align ?? 'left',
    testString: '|MÉqgy墓鬼',
  };
  const wrapW = o.wrap ? Math.floor(o.wrap / scale) : 0;
  // 换行自己先插好（标点不落行首），rex 的 mix 断行只当兜底
  if (wrapW) style.wrap = { mode: 'mix', width: wrapW };
  if (o.maxLines) style.maxLines = o.maxLines;
  if (o.fixedWidth) style.fixedWidth = Math.floor(o.fixedWidth / scale);
  if (o.bgColor) style.backgroundColor = o.bgColor;
  if (o.pad != null) style.padding = { left: o.pad, right: o.pad, top: o.pad, bottom: o.pad };
  const content = o.markup ? str : raw(str);
  const t = new BBCodeText(scene, 0, 0, wrapW ? wrapMarkup(content, wrapW) : content, style as never);
  scene.add.existing(t);
  if (wrapW) t.setData('wrapW', wrapW);
  if (scale !== 1) t.setScale(scale);
  return t;
}

/** 换掉 txt() 建出来的字，保持同样的断行规则 */
export function setTxt(t: BBCodeText, str: string, markup = false): void {
  const content = markup ? str : raw(str);
  const w = t.getData('wrapW') as number | undefined;
  t.setText(w ? wrapMarkup(content, w) : content);
}

/** 打字机效果：按全文排好版再露出前 n 个字（UTF-16 下标），行不会跳 */
export function revealTxt(t: BBCodeText, full: string, n: number): void {
  const w = t.getData('wrapW') as number | undefined;
  if (!w) {
    t.setText(raw(full.slice(0, n)));
    return;
  }
  const wrapped = wrapPlain(full, w);
  t.setText(raw(wrapped.slice(0, wrappedIndex(full, wrapped, n))));
}

/** 按 Unicode 字符截断 */
export function clip(s: string | null | undefined, n: number): string {
  const a = [...String(s ?? '')];
  return a.length > n ? a.slice(0, n).join('') + '…' : a.join('');
}

/** 估算一段字在像素字体下有多宽（中文 12，英文数字约 6） */
export function textWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += ch.charCodeAt(0) < 0x2000 ? 6 : 12;
  return w;
}

/* ---------------- 边框 ---------------- */

export function bg(scene: Phaser.Scene, name: string, w = 16, h = 16): NinePatch {
  const c = FRAME_CORNERS[name] ?? 4;
  const n = new NinePatch(scene, {
    x: 0,
    y: 0,
    width: Math.max(w, c * 2),
    height: Math.max(h, c * 2),
    key: `frame-${name}`,
    columns: [c, undefined, c],
    rows: [c, undefined, c],
    stretchMode: 0,
  });
  scene.add.existing(n);
  return n;
}

export function setFrame(n: NinePatch, name: string): void {
  const c = FRAME_CORNERS[name] ?? 4;
  n.setBaseTexture(`frame-${name}`, undefined, [c, undefined, c], [c, undefined, c]);
}

export function rect(scene: Phaser.Scene, w: number, h: number, color: number, alpha = 1): Phaser.GameObjects.Rectangle {
  return scene.add.rectangle(0, 0, w, h, color, alpha).setOrigin(0.5);
}

export function image(scene: Phaser.Scene, key: string, scale = 1): Phaser.GameObjects.Image {
  return scene.add.image(0, 0, key).setScale(scale);
}

/* ---------------- 点击 ---------------- */

type Tappable = AnyGO & { __clip?: () => Rect | null; __tap?: boolean };

export type TapOpts = {
  onState?: (st: ButtonState) => void;
  silent?: boolean;
};

/**
 * 点一下：按下和抬起离得近才算（拖动滚动区不会误触），
 * 在滚动区里被卷出去看不见的部分点不到。
 */
export function tappable(go: AnyGO, handler: (pointer: Phaser.Input.Pointer) => void, o: TapOpts = {}): void {
  const t = go as Tappable;
  t.__tap = true;
  (go as unknown as Phaser.GameObjects.Zone).setInteractive({ useHandCursor: true });
  let downAt: { x: number; y: number } | null = null;
  let over = false;
  const inClip = (p: Phaser.Input.Pointer) => {
    const c = t.__clip?.();
    return !c || (p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h);
  };
  go.on('pointerover', (p: Phaser.Input.Pointer) => {
    if (!inClip(p)) return;
    over = true;
    o.onState?.(downAt ? 'down' : 'hover');
  });
  go.on('pointerout', () => {
    over = false;
    downAt = null;
    o.onState?.('up');
  });
  go.on('pointerdown', (p: Phaser.Input.Pointer) => {
    if (!inClip(p)) return;
    downAt = { x: p.x, y: p.y };
    o.onState?.('down');
  });
  go.on('pointerup', (p: Phaser.Input.Pointer) => {
    const start = downAt;
    downAt = null;
    o.onState?.(over ? 'hover' : 'up');
    if (!start) return;
    if (Math.abs(p.x - start.x) > 6 || Math.abs(p.y - start.y) > 6) return;
    if (!inClip(p)) return;
    if (!o.silent) sfx('click');
    handler(p);
  });
}

/* ---------------- 按钮 ---------------- */

export type BtnOpts = {
  kind?: ButtonKind;
  icon?: string;
  small?: boolean;
  disabled?: boolean;
  /** 置灰时点了也提示原因 */
  why?: string;
  width?: number;
  color?: string;
  onClick?: () => void;
};

export function button(scene: Phaser.Scene, label: string, o: BtnOpts = {}): Label {
  const kind = o.kind ?? 'normal';
  const disabled = !!o.disabled;
  const back = bg(scene, `btn-${kind}-${disabled ? 'off' : 'up'}`);
  const textColor = disabled ? COL.dim2 : o.color ?? (kind === 'primary' ? COL.dark : kind === 'quiet' ? COL.dim : COL.bone);
  const text = label ? txt(scene, label, { color: textColor }) : undefined;
  const icon = o.icon ? scene.add.image(0, 0, `icon-${o.icon}`) : undefined;
  if (icon && disabled) icon.setAlpha(0.4);
  const h = o.small ? BTN_H_SM : BTN_H;
  const btn = new Label(scene, {
    width: o.width ?? 0,
    height: h,
    background: back,
    icon,
    text,
    space: { left: label ? 7 : 4, right: label ? 7 : 4, top: 0, bottom: 2, icon: label ? 3 : 0 },
    align: 'center',
  });
  scene.add.existing(btn);
  let shifted = false;
  const press = (down: boolean) => {
    if (down === shifted) return;
    shifted = down;
    const d = down ? 1 : -1;
    if (text) text.y += d;
    if (icon) icon.y += d;
  };
  if (disabled) {
    if (o.why) tappable(btn, () => toast(o.why!), { silent: true });
  } else if (o.onClick) {
    const onClick = o.onClick;
    tappable(btn, () => onClick(), {
      onState: (st) => {
        setFrame(back, `btn-${kind}-${st}`);
        press(st === 'down');
      },
    });
  }
  return btn;
}

export function iconButton(scene: Phaser.Scene, icon: string, onClick: () => void, o: { kind?: ButtonKind; badge?: number; small?: boolean } = {}): Phaser.GameObjects.GameObject {
  const btn = button(scene, '', { icon, kind: o.kind ?? 'quiet', small: o.small, onClick });
  if (!o.badge) return btn;
  const wrap = new OverlapSizer(scene, { width: 0, height: 0 });
  scene.add.existing(wrap);
  wrap.add(btn, { key: 'btn', align: 'center', expand: false });
  wrap.add(badge(scene, o.badge), { key: 'badge', align: 'right-top', expand: false, offsetX: 3, offsetY: -3 });
  return wrap;
}

export function badge(scene: Phaser.Scene, n: number): Label {
  const t = txt(scene, n > 99 ? '99+' : String(n), { color: COL.bone });
  const l = new Label(scene, { background: bg(scene, 'badge', 10, 10), text: t, space: { left: 3, right: 3, top: 0, bottom: 1 }, align: 'center', height: 14 });
  scene.add.existing(l);
  return l;
}

export type ChipOpts = { on?: boolean; paper?: boolean; onClick?: () => void; disabled?: boolean; icon?: string };

export function chip(scene: Phaser.Scene, label: string, o: ChipOpts = {}): Label {
  const base = o.paper ? 'chipPaper' : 'chip';
  const on = o.on ? (o.paper ? 'chipPaperOn' : 'chipOn') : base;
  const back = bg(scene, on);
  const color = o.paper ? (o.on ? COL.paperRed : COL.paperInk) : o.on ? COL.joss : o.disabled ? COL.dim2 : COL.bone;
  const text = txt(scene, label, { color });
  const icon = o.icon ? scene.add.image(0, 0, o.icon) : undefined;
  const c = new Label(scene, {
    height: 18,
    background: back,
    icon,
    text,
    space: { left: 5, right: 5, top: 0, bottom: 1, icon: 3 },
    align: 'center',
  });
  scene.add.existing(c);
  if (o.onClick && !o.disabled) {
    const onClick = o.onClick;
    tappable(c, () => onClick(), {
      onState: (st) => {
        if (o.on || o.paper) return;
        setFrame(back, st === 'hover' || st === 'down' ? 'chipHover' : 'chip');
      },
    });
  }
  return c;
}

/* ---------------- 输入框 ---------------- */

export type InputOpts = {
  owner: string;
  width: number;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  maxLength?: number;
  value?: string;
  paper?: boolean;
  numeric?: boolean;
  readOnly?: boolean;
  onInput?: (v: string) => void;
  onEnter?: () => void;
};

/**
 * 输入框：像素边框 + 叠在上面的网页输入框。
 * 返回的 box 是放进排版用的（rex 的九宫格把边角宽度当最小宽度，直接放进去会被排窄）。
 */
export function inputBox(scene: Phaser.Scene, o: InputOpts): { box: Sizer; frame: NinePatch; input: DomInput } {
  const h = o.multiline ? 6 + LINE_HEIGHT * (o.rows ?? 3) : INPUT_H;
  const name = o.paper ? 'insetPaper' : 'inset';
  const box = new Sizer(scene, { width: o.width, height: h, orientation: 'x' });
  scene.add.existing(box);
  const frame = bg(scene, name, o.width, h);
  box.addBackground(frame);
  const input = new DomInput({
    anchor: frame as never,
    owner: o.owner,
    multiline: o.multiline,
    placeholder: o.placeholder,
    maxLength: o.maxLength,
    value: o.value,
    paper: o.paper,
    numeric: o.numeric,
    readOnly: o.readOnly,
    padX: 4,
    padY: o.multiline ? 3 : 3,
    onInput: o.onInput,
    onEnter: o.onEnter,
    onFocusChange: (f) => setFrame(frame, f ? `${name}Focus` : name),
  });
  return { box, frame, input };
}

/* ---------------- 排版 ---------------- */

export type BoxOpts = {
  space?: number;
  pad?: number | Pad;
  bg?: string;
  width?: number;
  height?: number;
};

function padOf(p: number | Pad | undefined): Required<Pad> {
  if (typeof p === 'number') return { left: p, right: p, top: p, bottom: p };
  return { left: p?.left ?? 0, right: p?.right ?? 0, top: p?.top ?? 0, bottom: p?.bottom ?? 0 };
}

function box(scene: Phaser.Scene, orientation: 'x' | 'y', o: BoxOpts): Sizer {
  const p = padOf(o.pad);
  const s = new Sizer(scene, {
    orientation,
    width: o.width,
    height: o.height,
    space: { ...p, item: o.space ?? 0 },
  });
  scene.add.existing(s);
  if (o.bg) s.addBackground(bg(scene, o.bg));
  return s;
}

export function vbox(scene: Phaser.Scene, o: BoxOpts = {}): Sizer {
  return box(scene, 'y', o);
}

export function hbox(scene: Phaser.Scene, o: BoxOpts = {}): Sizer {
  return box(scene, 'x', o);
}

/** 自动换行的一排（标签、按钮） */
export function flow(scene: Phaser.Scene, width: number, o: { space?: number; line?: number; align?: 'left' | 'center' | 'right'; pad?: number | Pad } = {}): FixWidthSizer {
  const p = padOf(o.pad);
  const s = new FixWidthSizer(scene, {
    width,
    space: { ...p, item: o.space ?? 4, line: o.line ?? 4 },
    align: o.align ?? 'left',
  });
  scene.add.existing(s);
  return s;
}

export function grid(scene: Phaser.Scene, cols: number, rows: number, o: { width?: number; space?: number; rowSpace?: number } = {}): GridSizer {
  const g = new GridSizer(scene, {
    width: o.width,
    column: cols,
    row: rows,
    columnProportions: o.width ? 1 : 0,
    space: { column: o.space ?? 4, row: o.rowSpace ?? o.space ?? 4 },
  });
  scene.add.existing(g);
  return g;
}

export function spacer(scene: Phaser.Scene, w: number, h: number): Phaser.GameObjects.Zone {
  return scene.add.zone(0, 0, w, h);
}

/** 一条分隔线 */
export function divider(scene: Phaser.Scene, w: number, color: number = HEX.line): Phaser.GameObjects.Rectangle {
  return scene.add.rectangle(0, 0, w, 1, color);
}

/* ---------------- 滚动区 ---------------- */

export function scroller(scene: Phaser.Scene, child: Sizer | FixWidthSizer | GridSizer, o: { width: number; height: number }): ScrollablePanel {
  const track = scene.add.rectangle(0, 0, 4, 8, HEX.ink1).setStrokeStyle(1, HEX.line);
  const thumb = scene.add.rectangle(0, 0, 4, 12, HEX.joss);
  const panel = new ScrollablePanel(scene, {
    width: o.width,
    height: o.height,
    scrollMode: 'y',
    panel: { child, mask: { padding: 0 } },
    slider: { track, thumb, hideUnscrollableSlider: true, adaptThumbSize: true, minThumbSize: 10 } as never,
    // focus 2：在场景上听滚轮再判断指针在不在区域里（子元素挡着也能滚）
    mouseWheelScroller: { focus: 2, speed: 0.5 },
    scroller: { threshold: 6 } as never,
    space: { panel: 3 },
  } as never);
  scene.add.existing(panel);
  return panel;
}

/** 滚动区布局好以后调用：里面的按钮和输入框只在可见范围内响应 */
export function clipToScroller(panel: ScrollablePanel): void {
  const block = panel.getElement('child') as unknown as { getBounds: () => Phaser.Geom.Rectangle } | null;
  const inner = panel.getElement('panel') as unknown as { getAllChildren: () => AnyGO[] } | null;
  if (!block || !inner) return;
  const clipFn = () => {
    const b = block.getBounds();
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  };
  for (const c of inner.getAllChildren()) (c as Tappable).__clip = clipFn;
}

/** 让一组对象只在某个矩形里响应点击（固定区域用） */
export function clipTo(objs: AnyGO[], r: () => Rect | null): void {
  for (const c of objs) (c as Tappable).__clip = r;
}
