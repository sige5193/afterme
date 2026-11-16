/**
 * 面板基类：标题 + 关闭按钮 + 副标题 + 可滚动的正文 + 底部按钮。
 * 弹窗居中；抽屉在宽屏靠右、窄屏变成底部弹层。内容变了就整棵重建（rerender）。
 */

import type Phaser from 'phaser';
import { Subscriptions } from '@/core/bus';
import type { PanelKind } from '@/core/ui';
import { clipToScroller, flow, type FixWidthSizer, hbox, iconButton, type ScrollablePanel, scroller as makeScroller, type Sizer, textWidth, txt, vbox } from './kit';
import { COL, HUD_H } from './theme';

let seq = 0;

export type PanelLayout = 'modal' | 'drawer';

export interface PanelHost extends Phaser.Scene {
  closePanel(p: Panel): void;
  hudVisible(): boolean;
}

export abstract class Panel {
  readonly id = `panel-${++seq}`;
  abstract readonly kind: PanelKind;
  readonly scene: PanelHost;
  readonly payload: Record<string, unknown>;
  root: Sizer | null = null;
  depth = 1000;
  closed = false;
  protected subs = new Subscriptions();
  protected scroller: ScrollablePanel | null = null;
  private scrollT = 0;

  constructor(scene: PanelHost, payload: Record<string, unknown> = {}) {
    this.scene = scene;
    this.payload = payload;
  }

  layout(): PanelLayout {
    return 'modal';
  }

  /** 点面板外面能不能关 */
  dismissable(): boolean {
    return true;
  }

  preferredWidth(): number {
    return 380;
  }

  abstract title(): string;

  subtitle(): string | null {
    return null;
  }

  abstract buildBody(body: Sizer, w: number): void;

  buildFooter?(foot: FixWidthSizer, w: number): void;

  onOpen(): void {}

  onClose(): void {}

  close(): void {
    this.scene.closePanel(this);
  }

  /** 面板占的矩形（游戏像素） */
  geometry(): { x: number; y: number; w: number; maxH: number; anchor: 'center' | 'right' | 'bottom' } {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    const top = this.scene.hudVisible() ? HUD_H + 2 : 2;
    if (this.layout() === 'drawer') {
      if (W >= 560) {
        const w = Math.min(Math.max(300, Math.floor(W * 0.36)), 380);
        return { x: W - w - 2, y: top, w, maxH: H - top - 2, anchor: 'right' };
      }
      return { x: 0, y: H, w: W, maxH: Math.floor(H * 0.88) - 2, anchor: 'bottom' };
    }
    const w = Math.min(W - 12, this.preferredWidth());
    return { x: Math.floor((W - w) / 2), y: top, w, maxH: H - top - 8, anchor: 'center' };
  }

  rerender(keepScroll = true): void {
    if (this.closed) return;
    if (keepScroll && this.scroller) this.scrollT = this.scroller.t;
    if (!keepScroll) this.scrollT = 0;
    this.render();
  }

  render(): void {
    const scene = this.scene;
    this.destroyTree();
    const g = this.geometry();
    const padX = 8;
    const innerW = g.w - padX * 2;
    const drawer = this.layout() === 'drawer';
    const root = vbox(scene, {
      width: g.w,
      pad: { left: padX, right: padX, top: 6, bottom: 8 },
      space: 6,
      bg: drawer ? 'drawer' : 'panel',
    });
    root.setOrigin(0, 0);

    const head = hbox(scene, { width: innerW, space: 6 });
    const title = this.title();
    const big = textWidth(title) * 2 <= innerW - 28;
    head.add(txt(scene, title, { color: COL.joss, scale: big ? 2 : 1, wrap: big ? undefined : innerW - 28 }), { proportion: 1, align: 'left-center' });
    head.add(iconButton(scene, 'close', () => this.close(), { small: true }), { proportion: 0, align: 'right-top' });
    root.add(head, { expand: true });

    const sub = this.subtitle();
    let subText: Phaser.GameObjects.GameObject & { height: number } | null = null;
    if (sub) {
      subText = txt(scene, sub, { color: COL.dim, wrap: innerW });
      root.add(subText, { align: 'left' });
    }

    const bodyW = innerW - 8;
    const body = vbox(scene, { width: bodyW, space: 6 });
    this.buildBody(body, bodyW);
    body.layout();

    let foot: FixWidthSizer | null = null;
    if (this.buildFooter) {
      foot = flow(scene, innerW, { space: 4, line: 4, align: 'right' });
      this.buildFooter(foot, innerW);
      if (!foot.getChildren().length) {
        foot.destroy();
        foot = null;
      } else {
        foot.layout();
      }
    }
    head.layout();

    const chrome = 6 + head.height + 6 + (subText ? subText.height + 6 : 0) + (foot ? foot.height + 6 : 0) + 8;
    const bodyH = Math.max(40, Math.min(body.height + 6, g.maxH - chrome));
    const sc = makeScroller(scene, body, { width: innerW, height: bodyH });
    root.add(sc, { expand: true });
    if (foot) root.add(foot, { expand: true });
    root.layout();

    let x = g.x;
    let y = g.y;
    if (g.anchor === 'center') {
      const availH = scene.scale.height - g.y;
      y = g.y + Math.max(0, Math.floor((availH - root.height) / 2) - 4);
    } else if (g.anchor === 'bottom') {
      y = scene.scale.height - root.height;
    }
    root.setPosition(Math.round(x), Math.round(y));
    root.setDepth(this.depth);
    clipToScroller(sc);
    if (this.scrollT > 0) sc.t = Math.min(1, this.scrollT);
    this.scroller = sc;
    this.root = root;
  }

  /** 面板在屏幕上的矩形（点外面关面板用） */
  bounds(): { x: number; y: number; w: number; h: number } | null {
    if (!this.root) return null;
    return { x: this.root.x, y: this.root.y, w: this.root.width, h: this.root.height };
  }

  setDepth(d: number): void {
    this.depth = d;
    this.root?.setDepth(d);
  }

  private destroyTree(): void {
    this.root?.destroy();
    this.root = null;
    this.scroller = null;
  }

  destroy(): void {
    this.closed = true;
    this.subs.clear();
    this.destroyTree();
  }
}
