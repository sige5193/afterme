/**
 * 把地面格子数据画成一整张大图（只画一次）。
 */

import { type Canvas, ctx2d, makeCanvas } from '../pixel/art';
import { tiles } from '../pixel/textures';
import { GROUND_BRIDGE, GROUND_FENCE, GROUND_PATH, GROUND_WATER, TILE } from './world';

export const GROUND_PLAZA = 5;

export type GroundDecal =
  | { kind: 'mound'; x: number; y: number; w: number }
  | { kind: 'emptyPlot'; x: number; y: number }
  | { kind: 'bridgeRails'; x: number; y: number };

export function renderGround(
  wTiles: number,
  hTiles: number,
  ground: Uint8Array,
  deco: Uint8Array,
  decals: GroundDecal[],
): Canvas {
  const c = makeCanvas(wTiles * TILE, hTiles * TILE);
  const x = ctx2d(c);
  for (let ty = 0; ty < hTiles; ty++) {
    for (let tx = 0; tx < wTiles; tx++) {
      const i = ty * wTiles + tx;
      const g = ground[i];
      const v = (tx * 7 + ty * 13) % 4;
      let img: Canvas = tiles.grass[v];
      if (g === GROUND_PATH) img = tiles.path[v % 3];
      else if (g === GROUND_PLAZA) img = tiles.plaza[(tx + ty) % 2];
      else if (g === GROUND_FENCE) img = tiles.fence!;
      else if (g === GROUND_WATER || g === GROUND_BRIDGE) img = tiles.water[0];
      x.drawImage(img, tx * TILE, ty * TILE);
      if (g === GROUND_BRIDGE) x.drawImage(tiles.bridge!, tx * TILE, ty * TILE);
      const d = deco[i];
      if (d === 1) {
        const colors = ['#e9e2d0', '#d8b45e', '#c96a5e'];
        x.fillStyle = colors[(tx + ty) % 3];
        x.fillRect(tx * TILE + 5, ty * TILE + 6, 1, 1);
        x.fillRect(tx * TILE + 4, ty * TILE + 7, 3, 1);
        x.fillRect(tx * TILE + 5, ty * TILE + 8, 1, 1);
        x.fillStyle = '#2f5a3a';
        x.fillRect(tx * TILE + 5, ty * TILE + 9, 1, 2);
      } else if (d === 2) {
        x.fillStyle = '#3c6236';
        x.fillRect(tx * TILE + 9, ty * TILE + 10, 1, 3);
        x.fillRect(tx * TILE + 11, ty * TILE + 9, 1, 4);
        x.fillRect(tx * TILE + 13, ty * TILE + 11, 1, 2);
      } else if (d === 3) {
        x.fillStyle = '#9a9488';
        x.fillRect(tx * TILE + 3, ty * TILE + 12, 2, 1);
        x.fillStyle = '#6f6a60';
        x.fillRect(tx * TILE + 3, ty * TILE + 13, 2, 1);
      }
    }
  }
  for (const d of decals) {
    if (d.kind === 'bridgeRails') {
      const left = Math.round(d.x - TILE * 1.5);
      const top = Math.round(d.y - TILE * 2 - 4);
      x.fillStyle = '#16131d';
      x.fillRect(left, top, 2, TILE * 2 + 4);
      x.fillRect(left + TILE * 3 - 2, top, 2, TILE * 2 + 4);
      x.fillStyle = '#a3302a';
      for (let yy = top; yy < top + TILE * 2 + 4; yy += 6) {
        x.fillRect(left - 1, yy, 4, 3);
        x.fillRect(left + TILE * 3 - 3, yy, 4, 3);
      }
    } else if (d.kind === 'mound') {
      x.fillStyle = 'rgba(70,50,30,0.55)';
      const hw = Math.round(d.w / 2);
      // 像素化的椭圆土堆
      for (let yy = -3; yy <= 3; yy++) {
        const k = Math.sqrt(1 - (yy * yy) / 16);
        const ww = Math.round(hw * k);
        x.fillRect(Math.round(d.x) - ww, Math.round(d.y) + 1 + yy, ww * 2, 1);
      }
    } else if (d.kind === 'emptyPlot') {
      const left = Math.round(d.x - 14);
      const top = Math.round(d.y - 10);
      x.fillStyle = 'rgba(40,30,20,0.35)';
      x.fillRect(left, top, 28, 12);
      x.fillStyle = 'rgba(230,220,200,0.55)';
      for (let i = 0; i < 28; i += 2) {
        x.fillRect(left + i, top, 1, 1);
        x.fillRect(left + i, top + 11, 1, 1);
      }
      for (let i = 0; i < 12; i += 2) {
        x.fillRect(left, top + i, 1, 1);
        x.fillRect(left + 27, top + i, 1, 1);
      }
    }
  }
  return c;
}
