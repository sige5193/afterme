/**
 * 园区导览：一条阴间大道，北边一排六座牌坊（六个主题园区），
 * 中间广场有户籍科（办葬礼）、土地庙（问路 / 搜索）、告示牌，南边是奈何桥。
 */

import { navigate, zonePath } from '@/core/router';
import { state } from '@/core/state';
import { openPanel, toast } from '@/core/ui';
import { ZONE_ORDER, ZONES } from '@/config/zones';
import { mulberry32 } from '../pixel/art';
import { GATE_PLAQUE_DY } from '../pixel/sprites';
import { GROUND_PLAZA, renderGround, type GroundDecal } from '../world/ground';
import { GROUND_BRIDGE, GROUND_FENCE, GROUND_GRASS, GROUND_PATH, GROUND_WATER, TILE } from '../world/world';
import { button, hbox, txt, type Sizer, vbox } from '../ui/kit';
import { COL, HUD_H } from '../ui/theme';
import MapScene, { type MapData, type MapInteractable, type MapLight, type MapProp } from './MapScene';
import { live } from './live';

const W = 52;
const H = 25;
const GATE_ROW = 7;
const AVENUE = 8;
const RIVER = H - 4;

function gateX(i: number): number {
  return 6 + i * 8;
}

export default class HubScene extends MapScene {
  private fromZone: string | null = null;
  private overlay: Sizer[] = [];
  private overlayH = 0;
  private statLabels = new Map<string, ReturnType<typeof txt>>();

  constructor() {
    super({ key: 'Hub' });
  }

  create(data: { fromZone?: string | null }): void {
    this.fromZone = data.fromZone ?? null;
    this.statLabels.clear();
    this.overlay = [];
    state.viewingPhaseId = null;
    super.create(data as Record<string, unknown>);
    this.subs.on('zones', () => this.refreshStats()).on('presence', () => this.refreshStats()).on('session', () => this.refreshOverlay());
  }

  async loadMap(): Promise<MapData | null> {
    const size = W * H;
    const ground = new Uint8Array(size);
    const blocked = new Uint8Array(size);
    const deco = new Uint8Array(size);
    const idx = (x: number, y: number) => y * W + x;
    const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
    const set = (x: number, y: number, g: number) => {
      if (inside(x, y)) ground[idx(x, y)] = g;
    };
    const block = (x: number, y: number) => {
      if (inside(x, y)) blocked[idx(x, y)] = 1;
    };
    const fill = (x0: number, y0: number, x1: number, y1: number, g: number) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, g);
    };

    for (let x = 0; x < W; x++) {
      set(x, 0, GROUND_FENCE);
      set(x, H - 1, GROUND_FENCE);
      block(x, 0);
      block(x, H - 1);
    }
    for (let y = 0; y < H; y++) {
      set(0, y, GROUND_FENCE);
      set(W - 1, y, GROUND_FENCE);
      block(0, y);
      block(W - 1, y);
    }

    const props: MapProp[] = [];
    const lights: MapLight[] = [];
    const interactables: MapInteractable[] = [];
    const decals: GroundDecal[] = [];

    // 阴间大道
    fill(2, AVENUE, W - 3, AVENUE + 1, GROUND_PATH);

    // 六座牌坊
    ZONE_ORDER.forEach((key, i) => {
      const cx = gateX(i);
      fill(cx - 1, 5, cx + 1, AVENUE, GROUND_PATH);
      for (let x = cx - 2; x <= cx + 2; x++) {
        block(x, 3);
        block(x, 4);
        block(x, 2);
      }
      block(cx - 2, 5);
      block(cx + 2, 5);
      block(cx - 2, 6);
      block(cx + 2, 6);
      const px = cx * TILE + TILE / 2;
      const py = GATE_ROW * TILE;
      const zone = ZONES[key];
      props.push({ key: `gate-${key}`, x: px, y: py, label: { text: zone.name, color: COL.joss, dy: GATE_PLAQUE_DY, plate: false, center: true } });
      lights.push({ x: px, y: py - 30, r: 40, glow: 'warm', glowR: 28 });
      interactables.push({
        id: `gate-${key}`,
        kind: 'gate',
        px,
        py: py + 2,
        approach: { tx: cx, ty: GATE_ROW },
        box: { x: (cx - 2) * TILE, y: 2 * TILE, w: 5 * TILE, h: 5 * TILE },
        radius: 26,
        verb: `进${zone.name}`,
        data: key,
      });
    });

    // 广场
    const pl = { x0: 17, x1: 35, y0: 11, y1: 18 };
    fill(25, AVENUE + 2, 27, pl.y0 - 1, GROUND_PATH);
    fill(pl.x0, pl.y0, pl.x1, pl.y1, GROUND_PLAZA);

    // 告示牌
    const nbx = 26;
    block(nbx - 1, 12);
    block(nbx, 12);
    block(nbx + 1, 12);
    props.push({ key: 'notice', x: nbx * TILE + TILE / 2, y: 13 * TILE - 1, label: { text: '告示', color: COL.bone, dy: 30 } });
    interactables.push({
      id: 'notice',
      kind: 'notice',
      px: nbx * TILE + TILE / 2,
      py: 13 * TILE + 2,
      approach: { tx: nbx, ty: 13 },
      box: { x: (nbx - 1) * TILE, y: 11 * TILE - 4, w: 3 * TILE, h: 2 * TILE + 4 },
      verb: '看告示',
    });

    // 户籍科
    const ox = 9;
    for (let y = 12; y <= 14; y++) for (let x = ox - 2; x <= ox + 1; x++) block(x, y);
    fill(ox - 1, 15, pl.x0, 16, GROUND_PATH);
    props.push({ key: 'office', x: ox * TILE, y: 15 * TILE, label: { text: '户籍科 · 办葬礼', color: COL.joss, dy: 52 } });
    lights.push({ x: ox * TILE, y: 14 * TILE, r: 46, glow: 'warm', glowR: 28 });
    interactables.push({
      id: 'office',
      kind: 'office',
      px: ox * TILE,
      py: 15 * TILE + 2,
      approach: { tx: ox, ty: 15 },
      box: { x: (ox - 2) * TILE, y: 12 * TILE - 8, w: 4 * TILE, h: 3 * TILE + 8 },
      verb: state.tomb ? '重办葬礼' : '办葬礼',
    });

    // 土地庙
    const sx = 43;
    for (let y = 13; y <= 14; y++) for (let x = sx - 1; x <= sx + 1; x++) block(x, y);
    fill(pl.x1, 15, sx + 1, 16, GROUND_PATH);
    props.push({ key: 'shrine', x: sx * TILE + TILE / 2, y: 15 * TILE, label: { text: '土地庙 · 问路', color: COL.joss, dy: 44 } });
    lights.push({ x: sx * TILE + TILE / 2, y: 14 * TILE + 4, r: 28 });
    interactables.push({
      id: 'shrine',
      kind: 'shrine',
      px: sx * TILE + TILE / 2,
      py: 15 * TILE + 2,
      approach: { tx: sx, ty: 15 },
      box: { x: (sx - 1) * TILE - 4, y: 12 * TILE - 8, w: 3 * TILE + 8, h: 3 * TILE + 8 },
      verb: '问土地公（搜索）',
    });

    // 奈何桥
    fill(25, pl.y1 + 1, 27, RIVER - 1, GROUND_PATH);
    for (let x = 1; x < W - 1; x++) {
      set(x, RIVER, GROUND_WATER);
      block(x, RIVER);
    }
    for (let x = 25; x <= 27; x++) {
      set(x, RIVER, GROUND_BRIDGE);
      set(x, RIVER + 1, GROUND_PATH);
      blocked[idx(x, RIVER)] = 0;
    }
    for (let x = 24; x <= 28; x++) block(x, RIVER + 2);
    decals.push({ kind: 'bridgeRails', x: 26 * TILE + TILE / 2, y: (RIVER + 1) * TILE + 4 });
    props.push({ key: 'px', x: 26 * TILE + TILE / 2, y: (RIVER + 2) * TILE + 2, alpha: 0, label: { text: '奈何桥', color: COL.dim, dy: 0 } });
    interactables.push({
      id: 'bridge',
      kind: 'bridge',
      px: 26 * TILE + TILE / 2,
      py: (RIVER + 1) * TILE + 2,
      approach: { tx: 26, ty: RIVER + 1 },
      box: { x: 25 * TILE, y: RIVER * TILE - 8, w: 3 * TILE, h: 2 * TILE + 8 },
      verb: '看看奈何桥',
    });

    // 灯、凳子、树
    const lamp = (tx: number, ty: number) => {
      if (blocked[idx(tx, ty)]) return;
      block(tx, ty);
      props.push({ key: 'lamp', x: tx * TILE + TILE / 2, y: (ty + 1) * TILE - 2 });
      lights.push({ x: tx * TILE + TILE / 2, y: (ty + 1) * TILE - 20, r: 46, glow: 'warm', glowR: 28 });
    };
    lamp(pl.x0, pl.y0);
    lamp(pl.x1, pl.y0);
    lamp(pl.x0, pl.y1);
    lamp(pl.x1, pl.y1);
    for (let i = 0; i < 5; i++) lamp(gateX(i) + 4, AVENUE - 1);
    for (const [bx, by] of [
      [21, 17],
      [31, 17],
    ]) {
      block(bx, by);
      block(bx + 1, by);
      props.push({ key: 'bench', x: (bx + 1) * TILE, y: (by + 1) * TILE - 4 });
    }
    const rand = mulberry32(20261116);
    const tree = (tx: number, ty: number, key = 'tree') => {
      if (!inside(tx, ty) || blocked[idx(tx, ty)] || ground[idx(tx, ty)] !== GROUND_GRASS) return;
      block(tx, ty);
      props.push({ key, x: tx * TILE + TILE / 2, y: (ty + 1) * TILE - 1 });
    };
    for (let x = 2; x < W - 2; x += 3) {
      if (rand() < 0.75) tree(x, 1);
    }
    for (let y = 10; y < RIVER - 1; y += 2) {
      tree(2, y);
      tree(W - 3, y);
    }
    for (let i = 0; i < 26; i++) {
      const tx = 3 + Math.floor(rand() * (W - 6));
      const ty = AVENUE + 3 + Math.floor(rand() * (RIVER - AVENUE - 4));
      if (tx >= pl.x0 - 1 && tx <= pl.x1 + 1 && ty >= pl.y0 - 1 && ty <= pl.y1 + 1) continue;
      tree(tx, ty, rand() < 0.4 ? 'deadtree' : 'tree');
    }
    for (let x = 3; x < W - 3; x += 4) {
      if (Math.abs(x - 26) > 3 && rand() < 0.6) tree(x, RIVER + 1);
    }

    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = idx(x, y);
        if (ground[i] !== GROUND_GRASS || blocked[i]) continue;
        const v = rand();
        deco[i] = v < 0.05 ? 1 : v < 0.15 ? 2 : v < 0.19 ? 3 : 0;
      }
    }

    const key = 'ground-hub';
    if (!this.textures.exists(key)) this.textures.addCanvas(key, renderGround(W, H, ground, deco, decals));

    return {
      wTiles: W,
      hTiles: H,
      pxW: W * TILE,
      pxH: H * TILE,
      groundKey: key,
      isBlockedTile: (tx, ty) => !inside(tx, ty) || blocked[idx(tx, ty)] === 1,
      props,
      lights,
      interactables,
      // 落在大道上：抬头就是牌坊，低头就是广场
      spawn: { x: 26 * TILE + TILE / 2, y: AVENUE * TILE + 11, facing: 'up' },
    };
  }

  protected spawnPoint() {
    const i = this.fromZone ? ZONE_ORDER.indexOf(this.fromZone as (typeof ZONE_ORDER)[number]) : -1;
    this.fromZone = null;
    if (i < 0) return null;
    return { x: gateX(i) * TILE + TILE / 2, y: (GATE_ROW + 1) * TILE + 11, facing: 'down' as const };
  }

  protected afterBuild(): void {
    this.statLabels.clear();
    ZONE_ORDER.forEach((key, i) => {
      const l = this.addWorldLabel('', gateX(i) * TILE + TILE / 2, (AVENUE + 2) * TILE + 4, COL.dim, true);
      this.statLabels.set(key, l);
    });
    this.refreshStats();
  }

  private refreshStats(): void {
    // 缩放为 1 时牌坊挨得近，字写短点免得叠在一起
    const compact = this.Z < 2;
    for (const [key, label] of this.statLabels) {
      const z = state.zones.find((x) => x.key === key);
      const ghosts = state.zoneGhosts[key] ?? z?.ghosts_online ?? 0;
      const text = !z ? '' : compact ? `住 ${z.tomb_count} · 鬼 ${ghosts}` : `入住 ${z.tomb_count} · ${z.phases.length} 期 · 鬼 ${ghosts}`;
      label.setText(`[raw]${text}[/raw]`);
    }
  }

  protected onResize(): void {
    super.onResize();
    this.refreshStats();
  }

  onInteract(it: MapInteractable): void {
    switch (it.kind) {
      case 'gate':
        navigate(zonePath(String(it.data), 1));
        return;
      case 'office':
        if (state.tomb) {
          openPanel('confirm', {
            title: '重办葬礼',
            text: '再办一次葬礼：登记信息、碑和碑文都可以重来，位置不变。敲棺材板和诈尸的次数会留着。',
            ok: '重办',
            onOk: () => navigate('/funeral'),
          });
        } else {
          navigate('/funeral');
        }
        return;
      case 'shrine':
        navigate('/search');
        return;
      case 'notice':
        openPanel('help');
        return;
      case 'bridge':
        toast('桥那边是阳间。过了奈何桥就回不来了——不过你本来也没走远。');
        return;
    }
  }

  /* ---------------- 顶部信息条 ---------------- */

  protected topInset(): number {
    return HUD_H + this.overlayH;
  }

  private refreshOverlay(): void {
    if (!live(this)) return;
    this.destroyOverlay();
    this.ui(() => this.buildOverlay());
  }

  protected destroyOverlay(): void {
    for (const o of this.overlay) o.destroy();
    this.overlay = [];
  }

  protected buildOverlay(): void {
    const Wd = this.scale.width;
    const barW = Math.min(Wd - 4, 640);
    const bar = vbox(this, { width: barW, pad: { left: 5, right: 4, top: 3, bottom: 4 }, space: 2, bg: 'card' });
    bar.setOrigin(0, 0);
    const row = hbox(this, { width: barW - 9, space: 6 });
    row.add(txt(this, '园区导览', { color: COL.joss }), { align: 'center' });
    if (Wd >= 420) row.add(txt(this, '走到牌坊前进园区', { color: COL.dim2 }), { align: 'center' });
    row.addSpace(1);
    row.add(button(this, '列表', { small: true, icon: 'zones', onClick: () => openPanel('zones') }), { align: 'center' });
    bar.add(row, { expand: true });
    bar.layout();
    bar.setPosition(Math.round((Wd - barW) / 2), HUD_H + 2);
    bar.setDepth(30);
    this.overlay.push(bar);
    this.overlayH = bar.height + 4;
  }
}

