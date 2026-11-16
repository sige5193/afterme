/**
 * 不活了 · 像素版入口。整个界面都在 Phaser 画布上，只有输入框是叠在上面的网页元素。
 *
 * rexUI 的模块在加载时就会用到全局的 Phaser，所以先把 Phaser 挂到 window 上，
 * 再动态加载游戏本体（保证执行顺序，不受打包拆分影响）。
 */

import Phaser from 'phaser';

(window as unknown as { Phaser: typeof Phaser }).Phaser = Phaser;

void import('./game/boot')
  .then((m) => m.startGame())
  .catch((e) => {
    console.error(e);
    window.__afterme?.fail('阴间服务器开小差了，请稍后再试。');
  });
