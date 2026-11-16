/**
 * 大墓碑（个人）和合葬碑：像素碑身 + 遗像 + 竖排刻字。
 */

import type Phaser from 'phaser';
import type { GridGroupMember } from '@/api/types';
import { STYLES } from '@/config/styles';
import { cnDate, cnYear } from '@/utils/time';
import { ensureBigStone } from '../pixel/textures';
import { clip, image, OverlapSizer, txt, hbox, vbox } from './kit';
import { COL } from './theme';

const INK: Record<string, string> = {
  qingshi: '#24272d',
  hanbai: '#7a5a1c',
  neon: '#4ef0ff',
  tubao: '#2b1d10',
  mupai: '#2b1d10',
};

function vertical(s: string): string {
  return [...s].join('\n');
}

export type StoneProps = {
  name: string;
  style?: string | null;
  birthYear?: number | null;
  diedAt?: string | number | null;
  portrait?: number | null;
};

export function stoneStyleKey(style: string | null | undefined): string {
  return STYLES.some((s) => s.k === style) ? (style as string) : 'qingshi';
}

/** 返回一个可以塞进 rexUI 排版的大墓碑 */
export function bigStoneView(scene: Phaser.Scene, p: StoneProps): OverlapSizer {
  const st = stoneStyleKey(p.style);
  const name = clip(p.name || '某某', 8);
  const main = `${name}之墓`;
  const mainLen = [...main].length;
  const mainScale = mainLen <= 7 ? 2 : 1;
  const died = typeof p.diedAt === 'number' ? p.diedAt : p.diedAt ? new Date(p.diedAt).getTime() : Date.now();
  const left = `生于${cnYear(p.birthYear || 2000)}年`;
  const right = `${cnDate(died)}立`;
  const lineH = 13;
  const mainH = mainLen * (12 + 1) * mainScale;
  const sideH = Math.max([...left].length, [...right].length) * lineH;
  const textH = Math.max(mainH, sideH);
  const top = st === 'mupai' ? 44 : st === 'tubao' ? 34 : 40;
  const bottom = st === 'tubao' ? 30 : 20;
  const w = st === 'mupai' ? 76 : st === 'tubao' ? 120 : 92;
  const h = top + textH + bottom;
  const key = ensureBigStone(scene, st, w, h);

  const box = new OverlapSizer(scene, { width: w, height: h });
  scene.add.existing(box);
  box.add(image(scene, key), { key: 'stone', align: 'center', expand: false });
  box.add(image(scene, `portrait-${Math.max(0, Math.min(5, p.portrait ?? 0))}`), {
    key: 'portrait',
    align: 'center-top',
    offsetY: st === 'mupai' ? 14 : 6,
    expand: false,
  });
  const ink = INK[st] ?? COL.paperInk;
  const cols = hbox(scene, { space: st === 'tubao' ? 4 : 6 });
  cols.add(txt(scene, vertical(left), { color: ink, lineSpacing: 1, align: 'center' }), { align: 'top' });
  cols.add(txt(scene, vertical(main), { color: ink, lineSpacing: 1, align: 'center', scale: mainScale }), { align: 'top' });
  cols.add(txt(scene, vertical(right), { color: ink, lineSpacing: 1, align: 'center' }), { align: 'top' });
  box.add(cols, { key: 'cols', align: 'center-top', offsetY: top, expand: false });
  return box;
}

/** 合葬碑：墓名之墓、关系、成员名字竖排（入伙早的在右边）、空穴待续、满员印 */
export function groupStoneView(scene: Phaser.Scene, g: { name: string; relationLabel: string; members: GridGroupMember[] }, maxW: number): OverlapSizer {
  const cap = 6;
  const slots: Array<GridGroupMember | null> = [];
  for (let i = 0; i < cap; i++) slots.push(g.members[i] ?? null);
  slots.reverse();
  const colW = 18;
  const w = Math.min(maxW, Math.max(200, cap * colW + 40));
  const nameLen = Math.max(...slots.map((m) => (m ? [...clip(m.name, 6)].length : 4)));
  const colsH = Math.max(4, nameLen) * 13 + 14;
  const h = 64 + colsH;
  const key = ensureBigStone(scene, 'hanbai', w, h);
  const box = new OverlapSizer(scene, { width: w, height: h });
  scene.add.existing(box);
  box.add(image(scene, key), { key: 'stone', align: 'center', expand: false });
  const head = vbox(scene, { space: 2 });
  const title = `${clip(g.name, 12)} 之墓`;
  head.add(txt(scene, title, { color: '#7a5a1c', scale: [...title].length * 24 <= w - 24 ? 2 : 1 }), { align: 'center' });
  head.add(txt(scene, g.relationLabel || '', { color: '#9c8d70' }), { align: 'center' });
  box.add(head, { key: 'head', align: 'center-top', offsetY: 14, expand: false });
  const cols = hbox(scene, { space: 4 });
  for (const m of slots) {
    const col = vbox(scene, { space: 1 });
    if (m) {
      col.add(txt(scene, m.is_founder ? '长' : ' ', { color: COL.sealD }), { align: 'center' });
      col.add(txt(scene, vertical(clip(m.name, 6)), { color: '#3b2c12', lineSpacing: 1, align: 'center' }), { align: 'center' });
    } else {
      col.add(txt(scene, ' ', {}), { align: 'center' });
      col.add(txt(scene, vertical('空穴待续'), { color: '#c9bfa8', lineSpacing: 1, align: 'center' }), { align: 'center' });
    }
    cols.add(col, { align: 'top' });
  }
  box.add(cols, { key: 'cols', align: 'center-top', offsetY: 58, expand: false });
  if (g.members.length >= cap) {
    box.add(txt(scene, '满员', { color: COL.sealD }), { key: 'full', align: 'right-top', offsetX: -10, offsetY: 10, expand: false });
  }
  return box;
}
