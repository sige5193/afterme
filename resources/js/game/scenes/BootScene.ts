/**
 * 启动：等像素字体、画素材、领匿名身份、拉园区，然后交给导演。
 * 这期间页面上一直是加载画面（loader.ts 里那个走向墓地的小人）。
 */

import Phaser from 'phaser';
import * as api from '@/api/client';
import { fetchZones } from '@/core/cemetery';
import { startClock } from '@/core/clock';
import { startPolling } from '@/core/pulse';
import { startRouter } from '@/core/router';
import { bootstrap } from '@/core/session';
import { setSoundHandler } from '@/core/ui';
import { playSound } from '@/core/sound';
import { startDirector } from '../director';
import { registerTextures } from '../pixel/textures';
import { FONT_FAMILY, FONT_SIZE } from '../ui/theme';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Boot' });
  }

  create(): void {
    void this.run();
  }

  private async run(): Promise<void> {
    const loader = window.__afterme;
    try {
      await Promise.race([
        (loader?.fontReady ?? Promise.resolve()).then(() => document.fonts.load(`${FONT_SIZE}px ${FONT_FAMILY}`)),
        new Promise((r) => setTimeout(r, 6000)),
      ]);
    } catch {
      /* 字体出问题就用系统字体顶上 */
    }
    registerTextures(this);
    setSoundHandler(playSound);
    startClock();
    try {
      await bootstrap();
    } catch {
      loader?.fail(api.DEFAULT_ERROR);
      return;
    }
    await fetchZones();
    this.scene.launch('UI');
    this.scene.launch('Fx');
    startRouter();
    startPolling();
    // 等界面层建好再开场
    this.time.delayedCall(0, () => {
      startDirector(this.game);
      loader?.done();
      this.scene.stop();
    });
  }
}
