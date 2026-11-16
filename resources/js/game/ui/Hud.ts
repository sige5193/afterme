/**
 * 顶栏：品牌、时辰、身份、导航按钮（我的墓园 / 园区 / 搜索 / 香火簿或办葬礼 / 我的梦 / 回棺材 / 声音）。
 * 窄屏只留图标。
 */

import type Phaser from 'phaser';
import { Subscriptions } from '@/core/bus';
import { clockText, isNight, shichenLabel } from '@/core/clock';
import { currentRoute, navigate } from '@/core/router';
import { ghostOut, setPref } from '@/core/session';
import { state } from '@/core/state';
import { openPanel, setSound } from '@/core/ui';
import { badge, button, clip, hbox, OverlapSizer, type Sizer, textWidth, txt, type BBCodeText } from './kit';
import { COL, HUD_H } from './theme';

type Item = {
  key: string;
  icon: string;
  label: string;
  on?: boolean;
  kind?: 'normal' | 'primary' | 'quiet';
  badge?: number;
  onClick: () => void;
};

export class Hud {
  private scene: Phaser.Scene;
  private root: Sizer | null = null;
  private clockTxt: BBCodeText | null = null;
  private lastClock = '';
  private subs = new Subscriptions();
  visible = true;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.subs
      .on('session', () => this.render())
      .on('counts', () => this.render())
      .on('sound', () => this.render())
      .on('route', () => this.render())
      .on('daynight', () => this.render())
      .on('clock', () => this.tick());
  }

  setVisible(v: boolean): void {
    if (this.visible === v) return;
    this.visible = v;
    this.render();
  }

  private items(): Item[] {
    const r = currentRoute().name;
    const list: Item[] = [];
    if (state.tomb) list.push({ key: 'mine', icon: 'mine', label: '我的墓园', on: r === 'mine', onClick: () => navigate('/mine') });
    list.push({ key: 'zones', icon: 'zones', label: '园区', on: r === 'zones' || r === 'zone', onClick: () => navigate('/zones') });
    list.push({ key: 'search', icon: 'search', label: '搜索', on: r === 'search', onClick: () => navigate('/search') });
    if (state.tomb) {
      list.push({ key: 'inbox', icon: 'inbox', label: '香火簿', badge: state.pendingCount, onClick: () => openPanel('inbox') });
    } else {
      list.push({ key: 'funeral', icon: 'funeral', label: '办葬礼', kind: 'primary', onClick: () => navigate('/funeral') });
    }
    list.push({ key: 'dreams', icon: 'dreams', label: '我的梦', badge: state.unreadCount, onClick: () => openPanel('dreams') });
    if (state.tomb) {
      if (state.pref === 'cemetery') list.push({ key: 'coffin', icon: 'coffin', label: '回棺材', onClick: () => setPref('coffin') });
      else if (ghostOut()) list.push({ key: 'out', icon: 'ghost', label: '出棺', onClick: () => setPref('cemetery') });
    }
    list.push({ key: 'sound', icon: state.sound ? 'soundOn' : 'soundOff', label: state.sound ? '声音开' : '声音关', onClick: () => setSound(!state.sound) });
    return list;
  }

  render(): void {
    this.root?.destroy();
    this.root = null;
    this.clockTxt = null;
    if (!this.visible) return;
    const W = this.scene.scale.width;
    const items = this.items();
    // 先估一下放不放得下：按钮带字 → 只留图标 → 再去掉时辰
    const btnW = (labels: boolean) => items.reduce((a, it) => a + (labels ? textWidth(it.label) + 26 : 22), 0);
    const left = (wide: boolean, clock: boolean) => 40 + (wide ? 56 + textWidth(this.clockString(true)) + 60 : clock ? textWidth(this.clockString(false)) + 8 : 0);
    let labels = W >= 640 && left(true, true) + btnW(true) <= W - 12;
    let wide = labels;
    if (!labels && W >= 640 && left(true, true) + btnW(false) <= W - 12) wide = true;
    const mid = !wide && left(false, true) + btnW(false) <= W - 8;
    this.build(items, labels, wide, mid);
  }

  private build(items: Item[], labels: boolean, wide: boolean, mid: boolean): void {
    const scene = this.scene;
    const W = scene.scale.width;

    const bar = hbox(scene, { width: W, height: HUD_H, pad: { left: 6, right: 4, top: 1, bottom: 2 }, space: 6, bg: 'hud' });
    bar.setOrigin(0, 0);
    bar.add(txt(scene, '不活了', { color: COL.joss }), { align: 'center' });
    if (wide) bar.add(txt(scene, '先死为敬', { color: COL.dim2 }), { align: 'center' });
    if (wide || mid) {
      this.lastClock = this.clockString(wide);
      this.clockTxt = txt(scene, this.lastClock, { color: COL.dim });
      bar.add(this.clockTxt, { align: 'center' });
    }
    if (wide) {
      const who = state.tomb ? `亡魂 · ${clip(state.tomb.name, 6)}` : state.ready ? '活人' : '';
      if (who) bar.add(txt(scene, who, { color: state.tomb ? COL.wisp : COL.bone }), { align: 'center' });
    }
    bar.addSpace(1);
    const btns = hbox(scene, { space: 2 });
    for (const it of items) {
      const b = button(scene, labels ? it.label : '', {
        icon: it.icon,
        small: true,
        kind: it.on ? 'normal' : it.kind ?? 'quiet',
        color: it.on ? COL.joss : undefined,
        onClick: it.onClick,
      });
      if (it.badge) {
        const o = new OverlapSizer(scene, {});
        scene.add.existing(o);
        o.add(b, { align: 'center', expand: false, key: 'b' });
        o.add(badge(scene, it.badge), { align: 'right-top', expand: false, offsetX: 4, offsetY: -3, key: 'n' });
        btns.add(o, { align: 'center' });
      } else {
        btns.add(b, { align: 'center' });
      }
    }
    bar.add(btns, { align: 'center' });
    bar.layout();
    bar.setPosition(0, 0);
    bar.setDepth(900);
    this.root = bar;
  }

  private clockString(wide: boolean): string {
    const day = isNight() ? '夜' : '昼';
    return wide ? `${shichenLabel()} ${clockText()} · ${isNight() ? '夜 · 阴气重' : '昼 · 阳气旺'}` : `${shichenLabel()} ${clockText()} ${day}`;
  }

  private tick(): void {
    if (!this.clockTxt || !this.root) return;
    const wide = this.lastClock.includes('·');
    const s = this.clockString(wide);
    if (this.lastClock !== s) this.render();
  }

  destroy(): void {
    this.subs.clear();
    this.root?.destroy();
  }
}
