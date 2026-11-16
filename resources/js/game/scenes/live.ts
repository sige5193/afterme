/**
 * 场景还活着吗（create 里也算）。Phaser 的 isActive() 在 create 期间是 false，不能用来判断。
 */

import Phaser from 'phaser';

export function live(scene: Phaser.Scene): boolean {
  const s = scene.sys.settings.status;
  return s >= Phaser.Scenes.CREATING && s <= Phaser.Scenes.SLEEPING;
}
