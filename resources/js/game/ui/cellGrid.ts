/**
 * 10 排 × 6 列的选墓位小网格（葬礼选墓、迁坟、合葬墓整体迁墓共用）。
 */

import type Phaser from 'phaser';
import { toast } from '@/core/ui';
import { bg, grid, Label, setFrame, tappable, txt, type GridSizer } from './kit';
import { COL } from './theme';

export type CellState = 'free' | 'special' | 'taken' | 'blocked';

export type CellInfo = {
  cell: number;
  state: CellState;
  /** 格子里显示的字（最多两三个字） */
  label: string;
  /** 点到不能选的格子时的提示 */
  why?: string;
};

export function cellGrid(
  scene: Phaser.Scene,
  w: number,
  cells: CellInfo[],
  selected: number | null,
  onPick: (cell: number) => void,
  o: { paper?: boolean } = {},
): GridSizer {
  const cols = 6;
  const rows = Math.ceil(cells.length / cols);
  const space = 2;
  const cw = Math.floor((w - space * (cols - 1)) / cols);
  const g = grid(scene, cols, rows, { space, rowSpace: space });
  for (const c of cells) {
    const on = c.cell === selected;
    const frame = on ? 'chipOn' : c.state === 'taken' || c.state === 'blocked' ? 'tab' : c.state === 'special' ? 'cardHi' : o.paper ? 'chipPaper' : 'chip';
    const back = bg(scene, frame, cw, 18);
    const color = on
      ? COL.joss
      : c.state === 'taken'
        ? COL.dim2
        : c.state === 'blocked'
          ? '#3f3c36'
          : c.state === 'special'
            ? COL.joss
            : o.paper
              ? COL.paperInk
              : COL.dim;
    const l = new Label(scene, {
      width: cw,
      height: 18,
      background: back,
      text: txt(scene, c.label, { color }),
      align: 'center',
      space: { left: 1, right: 1, top: 0, bottom: 1 },
    });
    scene.add.existing(l);
    tappable(
      l,
      () => {
        if (c.state === 'taken' || c.state === 'blocked') {
          if (c.why) toast(c.why);
          return;
        }
        onPick(c.cell);
      },
      {
        onState: (st) => {
          if (on || c.state === 'taken' || c.state === 'blocked') return;
          setFrame(back, st === 'hover' || st === 'down' ? 'chipHover' : frame);
        },
      },
    );
    g.add(l, { column: c.cell % cols, row: Math.floor(c.cell / cols), expand: false });
  }
  return g;
}
