/**
 * 界面层：一直在最上面跑。顶栏、提示条、面板栈（抽屉 + 弹窗）。
 */

import Phaser from 'phaser';
import { Subscriptions } from '@/core/bus';
import type { PanelKind } from '@/core/ui';
import { onPanelClosed } from '../director';
import { domLayer } from '../ui/dom';
import { Hud } from '../ui/Hud';
import type { Panel, PanelHost } from '../ui/Panel';
import { PANELS } from '../ui/panels';
import { Toasts } from '../ui/Toasts';
import { setPanelCount, uiState } from '../ui/uiState';

/** 这几种是「底层」抽屉：再开一个同类的会替换掉，不会叠起来 */
const BASE_KINDS: PanelKind[] = ['tomb', 'group', 'mine', 'search', 'zones', 'menu'];

export default class UIScene extends Phaser.Scene implements PanelHost {
  private hud!: Hud;
  private toasts!: Toasts;
  private stack: Panel[] = [];
  private blocker!: Phaser.GameObjects.Rectangle;
  private subs = new Subscriptions();
  private hudOn = true;

  constructor() {
    super({ key: 'UI', active: false });
  }

  create(): void {
    this.hud = new Hud(this);
    this.toasts = new Toasts(this);
    this.blocker = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.5).setOrigin(0, 0).setVisible(false);
    this.blocker.setInteractive();
    this.blocker.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const top = this.topPanel();
      if (!top || !top.dismissable()) return;
      const b = top.bounds();
      if (b && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return;
      this.closePanel(top);
    });

    this.subs
      .on('panel', (req) => this.openPanel(req.kind, req.payload))
      .on('panel:close', (kind) => {
        const target = kind ? [...this.stack].reverse().find((p) => p.kind === kind) : this.topPanel();
        if (target) this.closePanel(target);
      })
      .on('toast', ({ text, opts }) => this.toasts.push(text, opts));

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    addEventListener('keydown', this.onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.subs.clear();
      removeEventListener('keydown', this.onKey);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    });
    this.onResize();
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || domLayer.typing()) return;
    const top = this.topPanel();
    if (top) {
      e.preventDefault();
      this.closePanel(top);
    }
  };

  private onResize(): void {
    const { width, height } = this.scale;
    this.blocker.setSize(width, height);
    if (this.blocker.input) (this.blocker.input.hitArea as Phaser.Geom.Rectangle).setSize(width, height);
    this.hud.render();
    for (const p of this.stack) p.rerender();
    this.toasts.layout();
  }

  hudVisible(): boolean {
    return this.hudOn;
  }

  setHudVisible(v: boolean): void {
    this.hudOn = v;
    this.hud.setVisible(v);
    for (const p of this.stack) p.rerender();
  }

  topPanel(): Panel | undefined {
    return this.stack[this.stack.length - 1];
  }

  hasPanel(kind: PanelKind): boolean {
    return this.stack.some((p) => p.kind === kind);
  }

  findPanel(kind: PanelKind): Panel | undefined {
    return this.stack.find((p) => p.kind === kind);
  }

  openPanel(kind: PanelKind, payload: Record<string, unknown>): void {
    const Ctor = PANELS[kind];
    if (!Ctor) return;
    if (BASE_KINDS.includes(kind)) {
      // 新的底层抽屉替换掉旧的（连同上面叠着的弹窗）
      for (const p of [...this.stack].reverse()) {
        if (BASE_KINDS.includes(p.kind)) this.removePanel(p, false);
      }
    } else {
      const same = this.stack.find((p) => p.kind === kind);
      if (same) this.removePanel(same, false);
    }
    const panel = new Ctor(this, payload);
    this.stack.push(panel);
    this.restack();
    panel.render();
    panel.onOpen();
    this.sync();
  }

  closePanel(p: Panel): void {
    if (!this.stack.includes(p)) return;
    this.removePanel(p, true);
  }

  closeAll(): void {
    for (const p of [...this.stack].reverse()) this.removePanel(p, false);
  }

  private removePanel(p: Panel, notify: boolean): void {
    const i = this.stack.indexOf(p);
    if (i < 0) return;
    this.stack.splice(i, 1);
    p.onClose();
    p.destroy();
    this.restack();
    this.sync();
    if (notify) onPanelClosed(p.kind, this.stack.map((x) => x.kind));
  }

  private restack(): void {
    this.stack.forEach((p, i) => p.setDepth(1000 + i * 100));
    const top = this.topPanel();
    if (!top) {
      this.blocker.setVisible(false);
      this.blocker.disableInteractive();
      return;
    }
    const W = this.scale.width;
    const drawerWide = top.layout() === 'drawer' && W >= 560;
    this.blocker.setFillStyle(0x000000, drawerWide ? 0.18 : 0.55);
    this.blocker.setDepth(top.depth - 1);
    this.blocker.setVisible(true);
    this.blocker.setInteractive();
  }

  private sync(): void {
    const top = this.topPanel();
    setPanelCount(this.stack.length, top ? top.id : null);
    if (!top) domLayer.setTopOwner(uiState.sceneOwner);
  }
}
