/**
 * 把一期墓位（60 格，10 排 × 6 列）换算成一张像素地图：地面、碰撞、精灵和可交互物。
 * 纯数据，不依赖 DOM，方便单独测试。
 */

export const TILE = 16;
export const GRID_COLS = 6;

/** 每个墓位占 3 × 3 格，墓位之间隔 1 格小路 */
const PLOT_W = 3;
const PLOT_H = 3;
const GAP = 1;
const STEP_X = PLOT_W + GAP;
const STEP_Y = PLOT_H + GAP;
/** 左右留 3 格：围栏、树、环路 */
const MARGIN_X = 3;
/** 顶部留 7 格放牌坊 */
const TOP = 7;
/** 底部留 5 格：环路、通往奈何桥的路、河、草地、围栏 */
const BOTTOM = 5;

export const GROUND_GRASS = 0;
export const GROUND_PATH = 1;
export const GROUND_WATER = 2;
export const GROUND_FENCE = 3;
export const GROUND_BRIDGE = 4;

export type CellKind = 'tomb' | 'group' | 'empty';

export interface WorldCell {
  cell: number;
  kind: CellKind;
  code?: string;
  name?: string;
  style?: string;
  /** 合葬墓占几个墓位（2 / 4 / 6） */
  width?: number;
  special?: string;
  hot?: boolean;
  memberCount?: number;
  isNpc?: boolean;
}

export interface WorldInput {
  capacity: number;
  cells: WorldCell[];
  hasNext: boolean;
  /** 用来决定花草位置，同一期每次进来都一样 */
  seed: number;
  /** 自己的坟所在的格子（合葬墓填起始格），用于标注「我的坟」 */
  myCell?: number | null;
}

export type InteractKind = 'tomb' | 'group' | 'empty' | 'gate' | 'bridge';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Interactable {
  kind: InteractKind;
  code?: string;
  cell?: number;
  name?: string;
  special?: string;
  /** 交互点（像素），玩家脚下靠近这里就能交互 */
  px: number;
  py: number;
  /** 寻路时走到的格子 */
  approach: { tx: number; ty: number };
  /** 点击命中区域（像素） */
  box: Box;
}

export type SpriteKind = 'stone' | 'group' | 'tree' | 'lamp' | 'gate' | 'bridge' | 'flag' | 'emptyPlot';

export interface WorldSprite {
  kind: SpriteKind;
  /** 底边中心点（像素），用于摆放和前后遮挡排序 */
  x: number;
  y: number;
  style?: string;
  /** 合葬墓碑的像素宽度 */
  pw?: number;
  memberCount?: number;
  name?: string;
  hot?: boolean;
  mine?: boolean;
  cell?: number;
}

export interface World {
  wTiles: number;
  hTiles: number;
  pxW: number;
  pxH: number;
  rows: number;
  ground: Uint8Array;
  blocked: Uint8Array;
  /** 每格的装饰（0 无，1 花，2 草丛，3 石子），由 seed 决定 */
  deco: Uint8Array;
  sprites: WorldSprite[];
  interactables: Interactable[];
  hasNext: boolean;
  spawnGate: { x: number; y: number };
  /** 墓位号 → 站位（像素） */
  cellStand(cell: number): { x: number; y: number } | null;
  /** 像素位置 → 最近的墓位号（合葬墓返回起始格）；离墓区太远返回 null */
  cellNear(x: number, y: number): number | null;
  isBlockedTile(tx: number, ty: number): boolean;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function plotOrigin(cell: number): { tx: number; ty: number } {
  const col = cell % GRID_COLS;
  const row = Math.floor(cell / GRID_COLS);
  return { tx: MARGIN_X + col * STEP_X, ty: TOP + row * STEP_Y };
}

export function buildWorld(input: WorldInput): World {
  const rows = Math.max(1, Math.ceil(input.capacity / GRID_COLS));
  const gridW = GRID_COLS * PLOT_W + (GRID_COLS - 1) * GAP;
  const gridH = rows * PLOT_H + (rows - 1) * GAP;
  const wTiles = MARGIN_X * 2 + gridW;
  const hTiles = TOP + gridH + BOTTOM;
  const size = wTiles * hTiles;
  const ground = new Uint8Array(size);
  const blocked = new Uint8Array(size);
  const deco = new Uint8Array(size);
  const sprites: WorldSprite[] = [];
  const interactables: Interactable[] = [];
  const idx = (tx: number, ty: number) => ty * wTiles + tx;
  const inside = (tx: number, ty: number) => tx >= 0 && ty >= 0 && tx < wTiles && ty < hTiles;
  const setGround = (tx: number, ty: number, g: number) => {
    if (inside(tx, ty)) ground[idx(tx, ty)] = g;
  };
  const block = (tx: number, ty: number) => {
    if (inside(tx, ty)) blocked[idx(tx, ty)] = 1;
  };

  const cx = Math.floor(wTiles / 2);
  const gridTop = TOP;
  const gridBottom = TOP + gridH - 1;
  const ringTop = gridTop - 1;
  const ringBottom = gridBottom + 1;
  const ringLeft = MARGIN_X - 1;
  const ringRight = wTiles - MARGIN_X;
  const waterY = hTiles - 3;

  // 围栏
  for (let x = 0; x < wTiles; x++) {
    setGround(x, 0, GROUND_FENCE);
    setGround(x, hTiles - 1, GROUND_FENCE);
    block(x, 0);
    block(x, hTiles - 1);
  }
  for (let y = 0; y < hTiles; y++) {
    setGround(0, y, GROUND_FENCE);
    setGround(wTiles - 1, y, GROUND_FENCE);
    block(0, y);
    block(wTiles - 1, y);
  }

  // 环路
  for (let y = ringTop; y <= ringBottom; y++) {
    setGround(ringLeft, y, GROUND_PATH);
    setGround(ringRight, y, GROUND_PATH);
  }
  for (let x = ringLeft; x <= ringRight; x++) {
    setGround(x, ringTop, GROUND_PATH);
    setGround(x, ringBottom, GROUND_PATH);
  }

  // 墓区内部的小路（墓位之间的行和列）
  for (let r = 0; r < rows - 1; r++) {
    const y = gridTop + r * STEP_Y + PLOT_H;
    for (let x = ringLeft; x <= ringRight; x++) setGround(x, y, GROUND_PATH);
  }
  for (let c = 0; c < GRID_COLS - 1; c++) {
    const x = MARGIN_X + c * STEP_X + PLOT_W;
    for (let y = ringTop; y <= ringBottom; y++) setGround(x, y, GROUND_PATH);
  }

  // 牌坊前的广场和主路
  for (let y = 4; y < ringTop; y++) {
    for (let x = cx - 1; x <= cx + 1; x++) setGround(x, y, GROUND_PATH);
  }
  for (let x = cx - 3; x <= cx + 3; x++) setGround(x, 5, GROUND_PATH);

  // 牌坊：5 格宽，底边在第 4 行，两根柱子挡路
  sprites.push({ kind: 'gate', x: cx * TILE + TILE / 2, y: 5 * TILE });
  block(cx - 2, 4);
  block(cx + 2, 4);
  block(cx - 2, 3);
  block(cx + 2, 3);
  for (let x = cx - 2; x <= cx + 2; x++) {
    for (let y = 1; y <= 2; y++) block(x, y);
  }
  interactables.push({
    kind: 'gate',
    px: cx * TILE + TILE / 2,
    py: 5 * TILE + 2,
    approach: { tx: cx, ty: 5 },
    box: { x: (cx - 2) * TILE, y: 1 * TILE, w: 5 * TILE, h: 4 * TILE },
  });

  // 河与奈何桥
  for (let x = 1; x < wTiles - 1; x++) {
    setGround(x, waterY, GROUND_WATER);
    block(x, waterY);
  }
  for (let y = ringBottom + 1; y < waterY; y++) {
    for (let x = cx - 1; x <= cx + 1; x++) setGround(x, y, GROUND_PATH);
  }
  for (let x = cx - 1; x <= cx + 1; x++) {
    setGround(x, waterY, GROUND_BRIDGE);
    blocked[idx(x, waterY)] = 0;
  }
  sprites.push({ kind: 'bridge', x: cx * TILE + TILE / 2, y: (waterY + 1) * TILE + 4 });
  interactables.push({
    kind: 'bridge',
    px: cx * TILE + TILE / 2,
    py: waterY * TILE + 2,
    approach: { tx: cx, ty: waterY - 1 },
    box: { x: (cx - 1) * TILE, y: (waterY - 1) * TILE, w: 3 * TILE, h: 3 * TILE },
  });

  // 墓位
  const byCell = new Map<number, WorldCell>();
  for (const c of input.cells) byCell.set(c.cell, c);
  const coveredBy = new Map<number, number>();
  const standOf = new Map<number, { x: number; y: number }>();

  for (let cell = 0; cell < input.capacity; cell++) {
    if (coveredBy.has(cell)) continue;
    const data = byCell.get(cell);
    const { tx: ox, ty: oy } = plotOrigin(cell);
    const kind: CellKind = data?.kind ?? 'empty';

    if (kind === 'group' && data) {
      const width = Math.max(1, Math.min(GRID_COLS - (cell % GRID_COLS), data.width ?? 2));
      for (let i = 0; i < width; i++) coveredBy.set(cell + i, cell);
      const spanTiles = width * PLOT_W + (width - 1) * GAP;
      // 合葬墓块内部的小路铺成草地，墓碑是一整块
      for (let x = ox; x < ox + spanTiles; x++) {
        for (let y = oy; y < oy + PLOT_H; y++) setGround(x, y, GROUND_GRASS);
      }
      const leftTx = ox + 1;
      const rightTx = ox + spanTiles - 2;
      for (let x = leftTx; x <= rightTx; x++) block(x, oy + 1);
      const centerPx = ((leftTx + rightTx + 1) / 2) * TILE;
      const pw = (rightTx - leftTx + 1) * TILE - 2;
      const baseY = (oy + 2) * TILE - 2;
      sprites.push({ kind: 'group', x: centerPx, y: baseY, pw, memberCount: data.memberCount ?? 0, name: data.name, hot: data.hot, mine: input.myCell === cell, cell });
      const approachTx = Math.floor(centerPx / TILE);
      interactables.push({
        kind: 'group',
        code: data.code,
        cell,
        name: data.name,
        px: centerPx,
        py: baseY + 2,
        approach: { tx: approachTx, ty: oy + 2 },
        box: { x: centerPx - pw / 2, y: oy * TILE - 6, w: pw, h: 2 * TILE + 6 },
      });
      const stand = { x: centerPx, y: (oy + 2) * TILE + 11 };
      for (let i = 0; i < width; i++) standOf.set(cell + i, stand);
      continue;
    }

    coveredBy.set(cell, cell);
    const stoneTx = ox + 1;
    const centerPx = stoneTx * TILE + TILE / 2;
    const baseY = (oy + 2) * TILE - 2;
    standOf.set(cell, { x: centerPx, y: (oy + 2) * TILE + 11 });

    if (kind === 'tomb' && data) {
      block(stoneTx, oy + 1);
      sprites.push({ kind: 'stone', x: centerPx, y: baseY, style: data.style ?? 'qingshi', name: data.name, hot: data.hot, mine: input.myCell === cell, cell });
      interactables.push({
        kind: 'tomb',
        code: data.code,
        cell,
        name: data.name,
        px: centerPx,
        py: baseY + 2,
        approach: { tx: stoneTx, ty: oy + 2 },
        box: { x: centerPx - 10, y: oy * TILE - 6, w: 20, h: 2 * TILE + 6 },
      });
    } else {
      sprites.push({ kind: 'emptyPlot', x: centerPx, y: baseY, cell });
      if (data?.special) sprites.push({ kind: 'flag', x: centerPx + 13, y: baseY - 2, name: data.special, cell });
      interactables.push({
        kind: 'empty',
        cell,
        special: data?.special,
        px: centerPx,
        py: baseY + 2,
        approach: { tx: stoneTx, ty: oy + 2 },
        box: { x: centerPx - 18, y: oy * TILE + 8, w: 36, h: TILE + 8 },
      });
    }
  }

  // 树：两侧一排柏树，牌坊两边各几棵，河对岸点缀
  const rand = mulberry32(input.seed || 1);
  const addTree = (tx: number, ty: number) => {
    if (!inside(tx, ty) || blocked[idx(tx, ty)] || ground[idx(tx, ty)] !== GROUND_GRASS) return;
    block(tx, ty);
    sprites.push({ kind: 'tree', x: tx * TILE + TILE / 2, y: (ty + 1) * TILE - 1 });
  };
  for (let y = 2; y < waterY - 1; y += 3) {
    addTree(1, y);
    addTree(wTiles - 2, y);
  }
  for (const [dx, y] of [[-6, 2], [-9, 3], [-12, 2], [6, 2], [9, 3], [12, 2], [-5, 4], [5, 4]] as const) {
    addTree(cx + dx, y);
  }
  for (let x = 2; x < wTiles - 2; x += 4) {
    if (Math.abs(x - cx) > 2 && rand() < 0.7) addTree(x, waterY + 1);
  }

  // 路灯：墓区小路的部分路口
  const addLamp = (tx: number, ty: number) => {
    if (!inside(tx, ty) || blocked[idx(tx, ty)]) return;
    block(tx, ty);
    sprites.push({ kind: 'lamp', x: tx * TILE + TILE / 2, y: (ty + 1) * TILE - 2 });
  };
  for (let r = 0; r < rows - 1; r += 2) {
    const y = gridTop + r * STEP_Y + PLOT_H;
    addLamp(MARGIN_X + 1 * STEP_X + PLOT_W, y);
    addLamp(MARGIN_X + 3 * STEP_X + PLOT_W, y);
  }
  addLamp(ringLeft, ringTop);
  addLamp(ringRight, ringTop);
  addLamp(ringLeft, ringBottom);
  addLamp(ringRight, ringBottom);

  // 地面装饰
  for (let ty = 1; ty < hTiles - 1; ty++) {
    for (let tx = 1; tx < wTiles - 1; tx++) {
      const i = idx(tx, ty);
      if (ground[i] !== GROUND_GRASS || blocked[i]) continue;
      const v = rand();
      deco[i] = v < 0.06 ? 1 : v < 0.16 ? 2 : v < 0.2 ? 3 : 0;
    }
  }

  const pxW = wTiles * TILE;
  const pxH = hTiles * TILE;

  function cellStand(cell: number) {
    return standOf.get(cell) ?? null;
  }

  function cellNear(x: number, y: number): number | null {
    const gx = x / TILE - MARGIN_X;
    const gy = y / TILE - gridTop;
    if (gx < -2 || gy < -2 || gx > gridW + 2 || gy > gridH + 2) return null;
    const col = Math.max(0, Math.min(GRID_COLS - 1, Math.floor(gx / STEP_X)));
    const row = Math.max(0, Math.min(rows - 1, Math.floor(gy / STEP_Y)));
    const cell = row * GRID_COLS + col;
    if (cell >= input.capacity) return null;
    return coveredBy.get(cell) ?? cell;
  }

  function isBlockedTile(tx: number, ty: number) {
    if (!inside(tx, ty)) return true;
    return blocked[idx(tx, ty)] === 1;
  }

  return {
    wTiles,
    hTiles,
    pxW,
    pxH,
    rows,
    ground,
    blocked,
    deco,
    sprites,
    interactables,
    hasNext: input.hasNext,
    spawnGate: { x: cx * TILE + TILE / 2, y: 6 * TILE + 11 },
    cellStand,
    cellNear,
    isBlockedTile,
  };
}
