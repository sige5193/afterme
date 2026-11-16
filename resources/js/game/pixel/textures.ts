/**
 * 启动时把所有代码画的素材注册成 Phaser 纹理。
 */

import Phaser from 'phaser';
import { ITEMS } from '@/config/items';
import { ZONE_ORDER } from '@/config/zones';
import { type Canvas, glowBrush, lightBrush, makeCanvas, ctx2d } from './art';
import { buildFrames } from './frames';
import { faceIcon, HUD_ICONS, hudIcon, itemIcon, portraitFrame, RAIN_ART, rainSprite } from './icons';
import {
  bench,
  bigStone,
  bridgeTile,
  cypress,
  deadTree,
  fenceTile,
  flag,
  gate,
  GATE_THEMES,
  ghostFrame,
  ghostLying,
  ghostLyingBack,
  grassTile,
  groupStone,
  jossCoin,
  lamp,
  lantern,
  noticeBoard,
  officeBuilding,
  pathTile,
  personFrame,
  plazaTile,
  shrine,
  smallCoffin,
  STONE_STYLES,
  stoneSprite,
  waterTile,
  type Facing,
} from './sprites';

export const FRAME_CORNERS: Record<string, number> = {};

export const LIGHT_RADII = [14, 28, 40, 46, 50, 64, 90] as const;

/** 拼地图地面用的地砖画布（不注册成纹理，直接画进地面大图） */
export const tiles = {
  grass: [] as Canvas[],
  path: [] as Canvas[],
  plaza: [] as Canvas[],
  water: [] as Canvas[],
  fence: null as Canvas | null,
  bridge: null as Canvas | null,
};

function add(textures: Phaser.Textures.TextureManager, key: string, canvas: Canvas): void {
  if (textures.exists(key)) textures.remove(key);
  textures.addCanvas(key, canvas);
}

export function registerTextures(scene: Phaser.Scene): void {
  const t = scene.textures;
  const facings: Facing[] = ['down', 'up', 'left', 'right'];
  for (const f of facings) {
    for (const fr of [0, 1] as const) {
      add(t, `ghost-${f}-${fr}`, ghostFrame(f, fr));
      add(t, `soul-${f}-${fr}`, ghostFrame(f, fr, true));
    }
    add(t, `person-${f}-idle`, personFrame(f, 'idle'));
    add(t, `person-${f}-walkA`, personFrame(f, 'walkA'));
    add(t, `person-${f}-walkB`, personFrame(f, 'walkB'));
  }
  add(t, 'ghost-lying', ghostLying());
  add(t, 'ghost-lying-back', ghostLyingBack());

  for (const s of STONE_STYLES) {
    add(t, `stone-${s}`, stoneSprite(s));
  }

  add(t, 'tree', cypress());
  add(t, 'deadtree', deadTree());
  add(t, 'lamp', lamp());
  add(t, 'lantern', lantern());
  add(t, 'flag', flag());
  add(t, 'notice', noticeBoard());
  add(t, 'bench', bench());
  add(t, 'office', officeBuilding());
  add(t, 'shrine', shrine());
  add(t, 'coffin-small', smallCoffin());
  for (const p of [0, 1, 2]) add(t, `coin-${p}`, jossCoin(p));
  for (const key of ZONE_ORDER) add(t, `gate-${key}`, gate(GATE_THEMES[key]));

  for (const it of ITEMS) add(t, `item-${it.k}`, itemIcon(it.k));
  for (const name of Object.keys(RAIN_ART)) add(t, `rain-${name}`, rainSprite(name));
  for (let i = 0; i < 6; i++) {
    add(t, `face-${i}`, faceIcon(i));
    add(t, `facec-${i}`, faceIcon(i, true));
    add(t, `portrait-${i}`, portraitFrame(i));
  }
  for (const name of Object.keys(HUD_ICONS)) add(t, `icon-${name}`, hudIcon(name));

  const frames = buildFrames();
  for (const [name, def] of Object.entries(frames)) {
    add(t, `frame-${name}`, def.canvas);
    FRAME_CORNERS[name] = def.corner;
  }

  for (const r of LIGHT_RADII) {
    add(t, `light-${r}`, lightBrush(r));
    add(t, `glow-warm-${r}`, glowBrush(r, [255, 190, 110], 0.32));
    add(t, `glow-wisp-${r}`, glowBrush(r, [150, 240, 215], 0.3));
  }

  const sh = makeCanvas(12, 4);
  const sx = ctx2d(sh);
  sx.fillStyle = 'rgba(0,0,0,0.28)';
  sx.fillRect(2, 0, 8, 1);
  sx.fillRect(0, 1, 12, 2);
  sx.fillRect(2, 3, 8, 1);
  add(t, 'shadow', sh);

  const px = makeCanvas(2, 2);
  const x = ctx2d(px);
  x.fillStyle = '#fff';
  x.fillRect(0, 0, 2, 2);
  add(t, 'px', px);

  tiles.grass = [0, 1, 2, 3].map((i) => grassTile(i));
  tiles.path = [0, 1, 2].map((i) => pathTile(5 + i));
  tiles.plaza = [0, 1].map((i) => plazaTile(21 + i));
  tiles.water = [waterTile(0), waterTile(1)];
  tiles.fence = fenceTile();
  tiles.bridge = bridgeTile();
}

/** 合葬碑宽度和人数不固定，用到时再生成 */
export function ensureGroupStone(scene: Phaser.Scene, pw: number, members: number, capacity: number): string {
  const key = `group-stone-${Math.round(pw)}-${members}-${capacity}`;
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, groupStone(pw, members, capacity));
  return key;
}

/** 大墓碑按要刻的字决定尺寸，用到时再生成 */
export function ensureBigStone(scene: Phaser.Scene, style: string, w: number, h: number): string {
  const key = `bigstone-${style}-${w}x${h}`;
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, bigStone(style, w, h));
  return key;
}

/** 有些画（例如放大的遗像）只在某个场景里用，按需注册 */
export function ensureCanvasTexture(scene: Phaser.Scene, key: string, make: () => Canvas): string {
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, make());
  return key;
}

