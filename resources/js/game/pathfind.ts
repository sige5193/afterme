/**
 * 网格 A* 寻路（四方向）。墓位只有几千格，直接用数组实现就够了。
 */

export interface TilePoint {
  tx: number;
  ty: number;
}

export function findPath(
  wTiles: number,
  hTiles: number,
  isBlocked: (tx: number, ty: number) => boolean,
  from: TilePoint,
  to: TilePoint,
  maxNodes = 6000,
): TilePoint[] | null {
  if (from.tx === to.tx && from.ty === to.ty) return [];
  if (isBlocked(to.tx, to.ty)) return null;

  const size = wTiles * hTiles;
  const g = new Float32Array(size).fill(Infinity);
  const came = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);
  const key = (tx: number, ty: number) => ty * wTiles + tx;
  const h = (tx: number, ty: number) => Math.abs(tx - to.tx) + Math.abs(ty - to.ty);

  const open: number[] = [];
  const f = new Float32Array(size).fill(Infinity);
  const start = key(from.tx, from.ty);
  g[start] = 0;
  f[start] = h(from.tx, from.ty);
  open.push(start);

  const goal = key(to.tx, to.ty);
  let visited = 0;

  while (open.length) {
    let best = 0;
    for (let i = 1; i < open.length; i++) {
      if (f[open[i]] < f[open[best]]) best = i;
    }
    const current = open[best];
    open[best] = open[open.length - 1];
    open.pop();
    if (current === goal) break;
    if (closed[current]) continue;
    closed[current] = 1;
    if (++visited > maxNodes) return null;

    const cx = current % wTiles;
    const cy = Math.floor(current / wTiles);
    const neighbors: Array<[number, number]> = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= wTiles || ny >= hTiles) continue;
      if (isBlocked(nx, ny)) continue;
      const n = key(nx, ny);
      if (closed[n]) continue;
      const cost = g[current] + 1;
      if (cost < g[n]) {
        g[n] = cost;
        f[n] = cost + h(nx, ny);
        came[n] = current;
        open.push(n);
      }
    }
  }

  if (came[goal] === -1) return null;
  const path: TilePoint[] = [];
  let node = goal;
  while (node !== start) {
    path.push({ tx: node % wTiles, ty: Math.floor(node / wTiles) });
    node = came[node];
  }
  path.reverse();
  return path;
}

/** 点到被挡住的格子时，找附近最近的可走格子 */
export function nearestOpen(
  wTiles: number,
  hTiles: number,
  isBlocked: (tx: number, ty: number) => boolean,
  target: TilePoint,
  radius = 3,
): TilePoint | null {
  if (!isBlocked(target.tx, target.ty)) return target;
  let best: TilePoint | null = null;
  let bestDist = Infinity;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const tx = target.tx + dx;
      const ty = target.ty + dy;
      if (tx < 0 || ty < 0 || tx >= wTiles || ty >= hTiles || isBlocked(tx, ty)) continue;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        best = { tx, ty };
      }
    }
  }
  return best;
}
