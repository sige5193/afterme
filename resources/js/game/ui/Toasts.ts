/**
 * 底部的提示条：像素边框 + 一句话 + 可选按钮；点一下关掉，到时自己消失。
 */

import type Phaser from 'phaser';
import type { ToastOptions } from '@/core/ui';
import { bg, button, hbox, tappable, txt, type Sizer } from './kit';
import { COL } from './theme';

type Item = {
  id: number;
  text: string;
  opts: ToastOptions;
  node: Sizer | null;
  timer: Phaser.Time.TimerEvent | null;
};

let seq = 1;

export class Toasts {
  private scene: Phaser.Scene;
  private items: Item[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  push(text: string, opts: ToastOptions): void {
    const ms = (opts.ms ?? 4200) + (opts.btn ? 3000 : 0);
    const item: Item = { id: seq++, text, opts, node: null, timer: null };
    item.timer = this.scene.time.delayedCall(ms, () => this.dismiss(item.id));
    this.items.push(item);
    while (this.items.length > 4) this.dismiss(this.items[0].id);
    this.layout();
  }

  dismiss(id: number): void {
    const i = this.items.findIndex((t) => t.id === id);
    if (i < 0) return;
    const [it] = this.items.splice(i, 1);
    it.timer?.remove();
    it.node?.destroy();
    this.layout();
  }

  layout(): void {
    const scene = this.scene;
    const W = scene.scale.width;
    const H = scene.scale.height;
    const maxW = Math.min(W - 12, 360);
    let y = H - 6;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.node?.destroy();
      const row = hbox(scene, { width: maxW, pad: { left: 7, right: 5, top: 4, bottom: 5 }, space: 6 });
      row.addBackground(bg(scene, it.opts.err ? 'toastErr' : 'toast'));
      const textW = maxW - 14 - (it.opts.btn ? 64 : 0);
      row.add(txt(scene, it.text, { wrap: textW, color: it.opts.err ? COL.seal : COL.bone }), { proportion: 1, align: 'left-center' });
      if (it.opts.btn) {
        const onBtn = it.opts.onBtn;
        row.add(
          button(scene, it.opts.btn, {
            small: true,
            kind: 'primary',
            onClick: () => {
              this.dismiss(it.id);
              onBtn?.();
            },
          }),
          { align: 'center' },
        );
      }
      row.setOrigin(0.5, 1);
      row.layout();
      row.setPosition(Math.round(W / 2), Math.round(y));
      row.setDepth(5000);
      tappable(row, () => this.dismiss(it.id), { silent: true });
      it.node = row;
      y -= row.height + 4;
    }
  }

  clear(): void {
    for (const it of [...this.items]) this.dismiss(it.id);
  }
}
