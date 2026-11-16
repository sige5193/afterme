/**
 * 面板里常用的内容块：段落、小标题、键值表、标签行、香火统计、卡片。
 */

import type Phaser from 'phaser';
import { ITEM } from '@/config/items';
import { bg, button, type BtnOpts, chip, flow, hbox, image, Label, type Sizer, txt, vbox } from './kit';
import { COL } from './theme';

export function para(scene: Phaser.Scene, text: string, w: number, color: string = COL.bone): Phaser.GameObjects.GameObject {
  return txt(scene, text, { wrap: w, color });
}

export function note(scene: Phaser.Scene, text: string, w: number): Phaser.GameObjects.GameObject {
  return txt(scene, text, { wrap: w, color: COL.dim });
}

/** 小节标题：金色小字 + 下划线点 */
export function heading(scene: Phaser.Scene, text: string, w: number): Sizer {
  const row = vbox(scene, { width: w, space: 2 });
  row.add(txt(scene, text, { color: COL.joss }), { align: 'left' });
  const dots = scene.add.tileSprite(0, 0, w, 1, 'px').setTint(0x3a3d4a);
  row.add(dots, { expand: true });
  return row;
}

/** 键值表：左边灰字，右边白字 */
export function facts(scene: Phaser.Scene, rows: Array<[string, string]>, w: number): Sizer {
  const box = vbox(scene, { width: w, space: 3 });
  const keyW = 36;
  for (const [k, v] of rows) {
    const r = hbox(scene, { width: w, space: 6 });
    r.add(txt(scene, k, { color: COL.dim, fixedWidth: keyW }), { align: 'left-top' });
    r.add(txt(scene, v, { wrap: w - keyW - 6 }), { proportion: 1, align: 'left-top' });
    box.add(r, { expand: true });
  }
  return box;
}

export function buttonRow(scene: Phaser.Scene, w: number, list: Array<[string, BtnOpts]>, align: 'left' | 'center' | 'right' = 'left'): Sizer {
  const f = flow(scene, w, { space: 4, line: 4, align });
  for (const [label, o] of list) f.add(button(scene, label, o));
  return f as unknown as Sizer;
}

/** 单选标签行 */
export function choiceRow<T extends string | number>(
  scene: Phaser.Scene,
  w: number,
  options: Array<{ value: T; label: string; icon?: string }>,
  selected: T | null | undefined,
  onPick: (v: T) => void,
  o: { paper?: boolean } = {},
): Sizer {
  const f = flow(scene, w, { space: 4, line: 4 });
  for (const opt of options) {
    f.add(chip(scene, opt.label, { on: opt.value === selected, paper: o.paper, icon: opt.icon, onClick: () => onPick(opt.value) }));
  }
  return f as unknown as Sizer;
}

/** 香火统计：图标 × 数量 */
export function itemTotals(scene: Phaser.Scene, totals: Record<string, number> | null | undefined, w: number): Sizer | null {
  const entries = Object.entries(totals ?? {})
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  if (!entries.length) return null;
  const f = flow(scene, w, { space: 4, line: 3 });
  for (const [k, n] of entries) {
    const it = ITEM[k];
    const l = new Label(scene, {
      background: bg(scene, 'chip'),
      icon: scene.add.image(0, 0, `item-${k}`),
      text: txt(scene, `${it?.name ?? k}×${n}`, { color: COL.bone }),
      space: { left: 2, right: 5, top: 1, bottom: 1, icon: 2 },
      align: 'center',
    });
    scene.add.existing(l);
    f.add(l);
  }
  return f as unknown as Sizer;
}

/** 碑上的标记（诈尸次数、迁坟次数……） */
export function marks(scene: Phaser.Scene, list: string[], w: number): Sizer | null {
  if (!list.length) return null;
  const f = flow(scene, w, { space: 4, line: 3 });
  for (const m of list) {
    const l = new Label(scene, {
      background: bg(scene, 'cardSeal'),
      text: txt(scene, m, { color: COL.seal }),
      space: { left: 5, right: 5, top: 2, bottom: 3 },
    });
    scene.add.existing(l);
    f.add(l);
  }
  return f as unknown as Sizer;
}

/** 卡片：边框里竖着排内容 */
export function card(scene: Phaser.Scene, w: number, frame = 'card'): Sizer {
  return vbox(scene, { width: w, pad: { left: 6, right: 6, top: 5, bottom: 6 }, space: 4, bg: frame });
}

export function iconLine(scene: Phaser.Scene, icon: string, text: string, w: number, color: string = COL.bone): Sizer {
  const r = hbox(scene, { width: w, space: 4 });
  r.add(image(scene, icon), { align: 'left-top' });
  r.add(txt(scene, text, { wrap: w - 20, color }), { proportion: 1, align: 'left-center' });
  return r;
}
