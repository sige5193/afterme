/**
 * 游戏画面尺寸真的变了才重排。
 *
 * Phaser 的 RESIZE 在尺寸没变时也会发：手机弹出键盘把外框压矮、页面被顶上去一点，它都会 refresh 一次。
 * 场景要是每次都重建界面，正在打字的输入框会被销毁，键盘一弹出来焦点就丢了。
 */

import Phaser from 'phaser';

export function onResized(scene: Phaser.Scene, handler: () => void): void {
  let width = scene.scale.width;
  let height = scene.scale.height;
  const check = (): void => {
    if (scene.scale.width === width && scene.scale.height === height) return;
    width = scene.scale.width;
    height = scene.scale.height;
    handler();
  };
  scene.scale.on(Phaser.Scale.Events.RESIZE, check);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off(Phaser.Scale.Events.RESIZE, check));
}
