/**
 * 大墓碑（个人）和合葬碑：像素碑身 + 遗像 + 竖排刻字。
 */

import type Phaser from 'phaser';
import type { GridGroupMember } from '@/api/types';
import { STYLES } from '@/config/styles';
import { cnDate, cnYear } from '@/utils/time';
import { TUBAO_MOUND, TUBAO_MOUND_MAX, TUBAO_STAKE, tubaoMoundH } from '../pixel/sprites';
import { ensureBigStone } from '../pixel/textures';
import { type BBCodeText, clip, hbox, image, OverlapSizer, txt, vbox } from './kit';
import { TEXT_METRICS } from './pixelFont';
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

/** 竖排刻字：一个字一行，行距 13（字 12 + 空 1） */
function column(scene: Phaser.Scene, s: string, color: string, scale = 1): BBCodeText {
  return txt(scene, vertical(s), { color, lineSpacing: -1, align: 'center', scale });
}

/** 先量一下这列字多大：建了马上拆，碑身要先建，才能压在字下面 */
function columnSize(scene: Phaser.Scene, s: string, scale = 1): { w: number; h: number } {
  const t = column(scene, s, '#000', scale);
  const size = { w: Math.ceil(t.displayWidth), h: Math.ceil(t.displayHeight) };
  t.destroy();
  return size;
}

const PORTRAIT_H = 28;

/** 每种碑能刻字的地方不一样：按字的大小算出碑多宽多高、遗像和字从哪儿开始 */
function stoneBox(st: string, colsW: number, textH: number): { w: number; h: number; portraitY: number; top: number } {
  switch (st) {
    case 'mupai': {
      // 尖顶木牌：遗像放在尖顶下面
      const w = Math.max(76, colsW + 16);
      const portraitY = Math.max(14, Math.floor(w / 3) - 12);
      const top = portraitY + PORTRAIT_H + 4;
      return { w, h: top + textH + 10, portraitY, top };
    }
    case 'tubao': {
      // 字刻在中间的木桩上，木桩下面一截被土包盖住
      const w = Math.max(120, Math.ceil((colsW + 10) / TUBAO_STAKE));
      const top = 6 + PORTRAIT_H + 6;
      const above = top + textH + 6;
      // 土包按比例长，长到顶就不再长
      let h = Math.ceil(above / (1 - TUBAO_MOUND));
      if (tubaoMoundH(h) >= TUBAO_MOUND_MAX) h = above + TUBAO_MOUND_MAX;
      return { w, h, portraitY: 6, top };
    }
    case 'neon':
      return { w: Math.max(92, colsW + 20), h: 40 + textH + 12, portraitY: 6, top: 40 };
    default:
      // 青石、汉白玉：底下有 12 像素的碑座
      return { w: Math.max(92, colsW + 24), h: 40 + textH + 20, portraitY: 6, top: 40 };
  }
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

/** 返回一个可以塞进 rexUI 排版的大墓碑；maxW 是能给它的最大宽度 */
export function bigStoneView(scene: Phaser.Scene, p: StoneProps, maxW = Infinity): OverlapSizer {
  const st = stoneStyleKey(p.style);
  const name = clip(p.name || '某某', 8);
  const main = `${name}之墓`;
  const died = typeof p.diedAt === 'number' ? p.diedAt : p.diedAt ? new Date(p.diedAt).getTime() : Date.now();
  const left = `生于${cnYear(p.birthYear || 2000)}年`;
  const right = `${cnDate(died)}立`;
  const space = st === 'tubao' ? 3 : 6;

  const leftSize = columnSize(scene, left);
  const rightSize = columnSize(scene, right);
  const sideW = leftSize.w + rightSize.w + space * 2;
  // 名字尽量刻大字；太长、或者大字会把碑撑得比给的地方还宽，就刻小字
  let mainScale = [...main].length <= 7 ? 2 : 1;
  let mainSize = columnSize(scene, main, mainScale);
  if (mainScale > 1 && stoneBox(st, sideW + mainSize.w, 0).w > maxW) {
    mainScale = 1;
    mainSize = columnSize(scene, main, 1);
  }
  const textH = Math.max(leftSize.h, rightSize.h, mainSize.h);
  const { w, h, portraitY, top } = stoneBox(st, sideW + mainSize.w, textH);
  const key = ensureBigStone(scene, st, w, h);

  const box = new OverlapSizer(scene, { width: w, height: h });
  scene.add.existing(box);
  box.add(image(scene, key), { key: 'stone', align: 'center', expand: false });
  box.add(image(scene, `portrait-${Math.max(0, Math.min(5, p.portrait ?? 0))}`), {
    key: 'portrait',
    align: 'center-top',
    offsetY: portraitY,
    expand: false,
  });
  const ink = INK[st] ?? COL.paperInk;
  const cols = hbox(scene, { space });
  cols.add(column(scene, left, ink), { align: 'top' });
  cols.add(column(scene, main, ink, mainScale), { align: 'top' });
  cols.add(column(scene, right, ink), { align: 'top' });
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
  const names = slots.map((m) => (m ? clip(m.name, 6) : '空穴待续'));
  // 每列：上面一行「长」字，下面竖排名字；碑高按最长那列量
  const markH = Math.ceil(TEXT_METRICS.fontSize);
  const colsH = markH + 1 + Math.max(...names.map((n) => columnSize(scene, n).h));
  const h = 58 + colsH + 20;
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
      col.add(column(scene, clip(m.name, 6), '#3b2c12'), { align: 'center' });
    } else {
      col.add(txt(scene, ' ', {}), { align: 'center' });
      col.add(column(scene, '空穴待续', '#c9bfa8'), { align: 'center' });
    }
    cols.add(col, { align: 'top' });
  }
  box.add(cols, { key: 'cols', align: 'center-top', offsetY: 58, expand: false });
  if (g.members.length >= cap) {
    box.add(txt(scene, '满员', { color: COL.sealD }), { key: 'full', align: 'right-top', offsetX: -10, offsetY: 10, expand: false });
  }
  return box;
}
