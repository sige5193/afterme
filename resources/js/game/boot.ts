/**
 * 创建 Phaser 游戏。
 *
 * 像素放大策略：画布按「每个游戏像素占 k 个物理像素」整数倍放大（k 由屏幕大小决定），
 * 这样像素字体和像素画在任何屏幕上都是方方正正、不糊的；
 * 手机上一个游戏像素约 1.3 个 CSS 像素，电脑上约 2 个。
 */

import Phaser from 'phaser';
import { emit } from '@/core/bus';
import { pixelRatio } from '@/core/pixelRatio';
import { domLayer } from './ui/dom';
import BootScene from './scenes/BootScene';
import CoffinScene from './scenes/CoffinScene';
import FuneralScene from './scenes/FuneralScene';
import FxScene from './scenes/FxScene';
import HubScene from './scenes/HubScene';
import TitleScene from './scenes/TitleScene';
import UIScene from './scenes/UIScene';
import ZoneScene from './scenes/ZoneScene';

export type Viewport = { w: number; h: number; zoom: number; k: number };

export function viewport(): Viewport {
  const dpr = pixelRatio();
  const cssW = Math.max(200, window.innerWidth);
  const cssH = Math.max(200, window.innerHeight);
  const short = Math.min(cssW, cssH);
  let k = Math.max(1, Math.round(dpr * Math.min(2, Math.max(1, short / 300))));
  while (k > 1 && (short * dpr) / k < 240) k--;
  const w = Math.floor((cssW * dpr) / k);
  const h = Math.floor((cssH * dpr) / k);
  return { w, h, zoom: k / dpr, k };
}

export function startGame(): Phaser.Game {
  const vp = viewport();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'app',
    width: vp.w,
    height: vp.h,
    backgroundColor: '#07080c',
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    banner: false,
    disableContextMenu: true,
    scale: { mode: Phaser.Scale.NONE, zoom: vp.zoom },
    input: { keyboard: false, gamepad: false, activePointers: 2 },
    render: { pixelArt: true, roundPixels: true, antialias: false, powerPreference: 'high-performance' },
    scene: [BootScene, TitleScene, HubScene, ZoneScene, CoffinScene, FuneralScene, UIScene, FxScene],
  });

  game.events.once(Phaser.Core.Events.READY, () => {
    domLayer.attach(game);
  });
  // 方便在控制台里排查
  (window as unknown as { __aftermeGame: Phaser.Game }).__aftermeGame = game;

  let pending = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const apply = () => {
    // 手机上弹出键盘也会触发 resize，正在打字时先不动，免得输入框被重建
    if (domLayer.typing()) {
      pending = true;
      return;
    }
    pending = false;
    const v = viewport();
    if (v.w === game.scale.width && v.h === game.scale.height && Math.abs(v.zoom - game.scale.zoom) < 1e-6) {
      domLayer.measure();
      return;
    }
    game.scale.setZoom(v.zoom);
    game.scale.resize(v.w, v.h);
    domLayer.measure();
    emit('resize', { width: v.w, height: v.h });
  };
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(apply, 120);
  };
  addEventListener('resize', schedule);
  addEventListener('orientationchange', schedule);
  document.addEventListener('focusout', () => {
    if (pending) setTimeout(apply, 50);
  });
  return game;
}
