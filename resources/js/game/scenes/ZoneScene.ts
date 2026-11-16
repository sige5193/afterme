/**
 * 某一期墓园的像素地图：60 个墓位（10 排 × 6 列）、牌坊、奈何桥、在场的鬼。
 * 顶部信息条：回园区导览、园区名、期切换、在场人数、夜游 / 诈尸栏。
 */

import Phaser from 'phaser';
import type { PhaseGrid } from '@/api/types';
import { emit } from '@/core/bus';
import { fetchGrid, zoneOfPhase } from '@/core/cemetery';
import { onGhostMove, pulseNow } from '@/core/pulse';
import { navigate, zonePath } from '@/core/router';
import { avatarKind, ghostOut, setPref, zhashiActive } from '@/core/session';
import { state } from '@/core/state';
import { openPanel, toast } from '@/core/ui';
import { SPECIAL } from '@/config/specialPlots';
import { address, mmss } from '@/utils/time';
import { setFuneralPrefill } from '../director';
import { ensureGroupStone } from '../pixel/textures';
import type { EmberSpot } from '../world/embers';
import { renderGround, type GroundDecal } from '../world/ground';
import { buildWorld, TILE, type WorldCell, type WorldInput } from '../world/world';
import { button, chip, clip, flow, hbox, txt, type Sizer, vbox } from '../ui/kit';
import { cnPhaseLabel } from '../ui/format';
import { COL, HUD_H } from '../ui/theme';
import MapScene, { type MapData, type MapInteractable, type MapLight, type MapProp, type Peer } from './MapScene';
import { live } from './live';

type ZoneData = { phaseId: number; focusCell?: number | null };

export default class ZoneScene extends MapScene {
  private phaseId = 0;
  private grid: PhaseGrid | null = null;
  private focusOnLoad: number | null = null;
  private stand: ((cell: number) => { x: number; y: number } | null) | null = null;
  /** 每个墓位烧纸的地方（碑前），火星画在这里 */
  private burnSpots = new Map<number, { x: number; y: number; w: number }>();
  private overlay: Sizer[] = [];
  private overlayH = 0;
  private zsTimer: Phaser.Time.TimerEvent | null = null;
  private zsText: ReturnType<typeof txt> | null = null;
  private helpTimer: Phaser.Time.TimerEvent | null = null;
  private showHelp = true;

  constructor() {
    super({ key: 'Zone' });
  }

  create(data: ZoneData): void {
    this.phaseId = data.phaseId;
    this.focusOnLoad = data.focusCell ?? null;
    this.grid = null;
    this.stand = null;
    this.showHelp = true;
    state.viewingPhaseId = this.phaseId;
    state.ghostCell = null;
    super.create(data as unknown as Record<string, unknown>);
    this.subs
      .on('grid', (id) => {
        if (id !== this.phaseId) return;
        const g = state.grids.get(id);
        if (g && g !== this.grid) this.rebuild(g);
      })
      .on('embers', () => this.applyEmbers())
      .on('presence', () => {
        this.syncPeerTargets();
        this.refreshOverlay();
      })
      .on('session', () => this.refreshOverlay())
      .on('zones', () => this.refreshOverlay());
    this.zsTimer = this.time.addEvent({ delay: 1000, loop: true, callback: () => this.tickZhashi() });
    this.helpTimer = this.time.delayedCall(9000, () => {
      this.showHelp = false;
      this.refreshOverlay();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (state.viewingPhaseId === this.phaseId) state.viewingPhaseId = null;
      state.ghostCell = null;
      this.zsTimer?.remove();
      this.helpTimer?.remove();
    });
    pulseNow();
  }

  async loadMap(): Promise<MapData | null> {
    const grid = await fetchGrid(this.phaseId);
    if (!grid) return null;
    return this.mapFromGrid(grid);
  }

  private rebuild(grid: PhaseGrid): void {
    const m = this.mapFromGrid(grid);
    this.setMap(m);
  }

  protected afterBuild(): void {
    this.applyEmbers();
  }

  /** 把 pulse 报来的「最近烧过纸的格子」换成坟前的火星 */
  private applyEmbers(): void {
    if (!live(this) || !this.map) return;
    const spots: EmberSpot[] = [];
    if (state.embers.phaseId === this.phaseId) {
      for (const e of state.embers.list) {
        const at = this.burnSpots.get(e.cell);
        const since = Date.parse(e.burned_at);
        if (at && Number.isFinite(since)) spots.push({ key: String(e.cell), ...at, since });
      }
    }
    this.setEmbers(spots);
  }

  private zoneKey(): string {
    return this.grid?.zone.key ?? zoneOfPhase(this.phaseId)?.key ?? 'public';
  }

  private nextPhaseNumber(): number | null {
    const z = zoneOfPhase(this.phaseId);
    const n = this.grid?.phase.number ?? 1;
    return z?.phases.some((p) => p.number === n + 1) ? n + 1 : null;
  }

  /** 自己的坟（或所在合葬墓的起始格）在这一期的哪一格 */
  private myCell(grid: PhaseGrid): number | null {
    const t = state.tomb;
    if (!t) return null;
    const gcode = state.group?.code ?? t.group?.code;
    if (gcode) {
      const c = grid.cells.find((x) => x.type === 'group' && x.group?.code === gcode);
      return c ? c.cell : null;
    }
    if (t.phase?.id === grid.phase.id && t.cell != null) return t.cell;
    return null;
  }

  private mapFromGrid(grid: PhaseGrid): MapData {
    this.grid = grid;
    const isGroupZone = grid.zone.is_group_zone;
    const cells: WorldCell[] = [];
    for (const c of grid.cells) {
      if (c.type === 'tomb' && c.tomb) {
        cells.push({ cell: c.cell, kind: 'tomb', code: c.tomb.code, name: c.tomb.name, style: c.tomb.style, hot: !!c.tomb.hot, isNpc: !!c.tomb.is_npc });
      } else if (c.type === 'group' && c.group) {
        cells.push({ cell: c.cell, kind: 'group', code: c.group.code, name: c.group.name, width: c.group.width, memberCount: c.group.member_count });
      } else {
        cells.push({ cell: c.cell, kind: 'empty', special: c.special ?? (isGroupZone ? undefined : SPECIAL[c.cell]) });
      }
    }
    const myCell = this.myCell(grid);
    const input: WorldInput = {
      capacity: grid.phase.capacity,
      cells,
      hasNext: this.nextPhaseNumber() != null,
      seed: grid.phase.id * 7919,
      myCell,
    };
    const w = buildWorld(input);
    this.stand = (cell) => w.cellStand(cell);

    const decals: GroundDecal[] = [];
    const props: MapProp[] = [];
    const lights: MapLight[] = [];
    const zoneName = grid.zone.name;
    this.burnSpots.clear();
    for (const sp of w.sprites) {
      // 烧纸的地方：碑前小路上
      if (sp.kind === 'stone' && sp.cell != null) this.burnSpots.set(sp.cell, { x: sp.x, y: sp.y + 8, w: 30 });
      if (sp.kind === 'group' && sp.cell != null) this.burnSpots.set(sp.cell, { x: sp.x, y: sp.y + 8, w: Math.min((sp.pw ?? 40) - 4, 64) });
      switch (sp.kind) {
        case 'stone': {
          decals.push({ kind: 'mound', x: sp.x, y: sp.y, w: 26 });
          const name = clip(sp.name, 6);
          const top = sp.style === 'tubao' ? 20 : sp.style === 'mupai' ? 24 : 22;
          props.push({
            key: `stone-${sp.style ?? 'qingshi'}`,
            x: sp.x,
            y: sp.y,
            label: { text: sp.mine ? `${name}（我的坟）` : name, color: sp.mine ? COL.joss : COL.bone, dy: top },
          });
          if (sp.style === 'neon') lights.push({ x: sp.x, y: sp.y - 10, r: 14 });
          break;
        }
        case 'group': {
          const pw = sp.pw ?? 40;
          decals.push({ kind: 'mound', x: sp.x, y: sp.y, w: pw + 8 });
          const seats = pw < 120 ? 2 : pw < 260 ? 4 : 6;
          props.push({
            key: ensureGroupStone(this, pw, sp.memberCount ?? 0, seats),
            x: sp.x,
            y: sp.y,
            label: { text: sp.mine ? `${clip(sp.name, 8)}（我们的墓）` : clip(sp.name, 8), color: sp.mine ? COL.joss : COL.bone, dy: 30 },
          });
          break;
        }
        case 'emptyPlot':
          decals.push({ kind: 'emptyPlot', x: sp.x, y: sp.y });
          break;
        case 'flag':
          props.push({ key: 'flag', x: sp.x, y: sp.y, label: { text: clip(sp.name, 5), color: COL.joss, dy: -16, dx: -13, plate: true } });
          break;
        case 'tree':
          props.push({ key: 'tree', x: sp.x, y: sp.y });
          break;
        case 'lamp':
          props.push({ key: 'lamp', x: sp.x, y: sp.y });
          lights.push({ x: sp.x, y: sp.y - 18, r: 46, glow: 'warm', glowR: 28 });
          break;
        case 'gate':
          props.push({ key: `gate-${grid.zone.key}`, x: sp.x, y: sp.y, label: { text: clip(zoneName, 6), color: COL.joss, dy: 44, plate: false } });
          lights.push({ x: sp.x, y: sp.y - 30, r: 40 });
          break;
        case 'bridge':
          decals.push({ kind: 'bridgeRails', x: sp.x, y: sp.y });
          props.push({
            key: 'px',
            x: sp.x,
            y: sp.y + 2,
            alpha: 0,
            label: { text: input.hasNext ? '下一期 →' : '已是最后一期', color: COL.dim, dy: 0 },
          });
          break;
      }
    }

    const key = `ground-zone-${grid.phase.id}-${grid.version ?? '0'}-${myCell ?? 'x'}`;
    if (!this.textures.exists(key)) this.textures.addCanvas(key, renderGround(w.wTiles, w.hTiles, w.ground, w.deco, decals));

    const interactables: MapInteractable[] = w.interactables.map((it, i) => ({
      id: `${it.kind}-${it.cell ?? i}`,
      kind: it.kind,
      px: it.px,
      py: it.py,
      approach: it.approach,
      box: it.box,
      radius: it.kind === 'gate' || it.kind === 'bridge' ? 26 : undefined,
      verb:
        it.kind === 'tomb'
          ? '看碑'
          : it.kind === 'group'
            ? '看合葬墓'
            : it.kind === 'empty'
              ? '看看这块空地'
              : it.kind === 'gate'
                ? '回园区导览'
                : input.hasNext
                  ? '过桥去下一期'
                  : '已是最后一期',
      data: it,
    }));

    let spawn = { x: w.spawnGate.x, y: w.spawnGate.y, facing: 'down' as const };
    return {
      wTiles: w.wTiles,
      hTiles: w.hTiles,
      pxW: w.pxW,
      pxH: w.pxH,
      groundKey: key,
      isBlockedTile: (tx, ty) => w.isBlockedTile(tx, ty),
      props,
      lights,
      interactables,
      spawn,
      cellNear: (x, y) => w.cellNear(x, y),
      standOf: (c) => w.cellStand(c),
    };
  }

  protected spawnPoint() {
    const focus = this.focusOnLoad;
    this.focusOnLoad = null;
    const cell = focus ?? (avatarKind() !== 'living' && this.grid ? this.myCell(this.grid) : null);
    if (cell != null && this.stand) {
      const s = this.stand(cell);
      if (s) return { x: s.x, y: s.y, facing: 'up' as const };
    }
    return null;
  }

  /** 从别处（我的墓园、搜索）跳到这一期的某座坟 */
  focusCell(cell: number): void {
    const s = this.stand?.(cell);
    if (!s) {
      this.focusOnLoad = cell;
      return;
    }
    if (Math.hypot(s.x - this.px, s.y - this.py) > TILE * 3) this.teleport(s.x, s.y, 'up');
  }

  protected syncPeerTargets(): void {
    if (!this.stand) return;
    const peers: Peer[] = [];
    for (const g of state.ghosts) {
      if (state.tomb && g.tomb_code === state.tomb.code) continue;
      const s = g.cell != null ? this.stand(g.cell) : null;
      const base = s ?? this.map?.spawn ?? { x: 0, y: 0 };
      let hash = 0;
      for (const ch of g.tomb_code) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
      peers.push({ id: g.tomb_code, name: g.name, x: base.x + ((hash % 5) - 2) * 5, y: base.y + 2 + ((hash >> 3) % 3) * 2 });
    }
    this.setPeers(peers);
  }

  protected onCellChange(cell: number | null): void {
    if (avatarKind() !== 'ghost' || state.pref !== 'cemetery') return;
    state.ghostCell = cell;
    onGhostMove();
  }

  onInteract(it: MapInteractable): void {
    const data = it.data as { kind: string; code?: string; cell?: number; special?: string };
    switch (it.kind) {
      case 'tomb':
        if (data.code) navigate(`/t/${data.code}`);
        return;
      case 'group':
        if (data.code) navigate(`/g/${data.code}`);
        return;
      case 'gate':
        navigate('/zones');
        return;
      case 'bridge': {
        const n = this.nextPhaseNumber();
        if (n) navigate(zonePath(this.zoneKey(), n));
        else toast('已是最后一期，桥那边什么都没有。');
        return;
      }
      case 'empty': {
        const cell = data.cell ?? 0;
        const sp = data.special;
        const where = `${this.grid?.phase.display_name ?? ''} ${address(cell)}`.trim();
        const isGroupZone = !!this.grid?.zone.is_group_zone;
        if (!state.tomb && !isGroupZone) {
          toast(`${where}${sp ? `「${sp}」` : ''}，还空着。`, {
            btn: '就葬这儿',
            onBtn: () => {
              setFuneralPrefill({ zoneKey: this.zoneKey(), zonePhaseId: this.phaseId, cell });
              navigate('/funeral');
            },
          });
        } else if (state.tomb && !state.tomb.group && !isGroupZone && ghostOut()) {
          toast(`${where}${sp ? `「${sp}」` : ''}，还空着。`, {
            btn: '迁到这儿',
            onBtn: () => openPanel('moveTomb', { zoneKey: this.zoneKey(), phaseId: this.phaseId, cell }),
          });
        } else {
          toast(`${where}${sp ? `「${sp}」` : ''}，还空着。`);
        }
        return;
      }
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
    this.zsText = null;
  }

  protected buildOverlay(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const z = zoneOfPhase(this.phaseId);
    const g = this.grid;
    const barW = Math.min(W - 4, 640);
    const x0 = Math.round((W - barW) / 2);
    let y = HUD_H + 2;

    const bar = vbox(this, { width: barW, pad: { left: 4, right: 4, top: 3, bottom: 4 }, space: 3, bg: 'card' });
    bar.setOrigin(0, 0);
    const row = hbox(this, { width: barW - 8, space: 6 });
    row.add(button(this, W >= 400 ? '园区导览' : '', { small: true, icon: 'back', onClick: () => navigate('/zones') }), { align: 'center' });
    row.add(txt(this, g?.phase.display_name ?? z?.name ?? '', { color: COL.joss }), { align: 'center' });
    if (W >= 420 && g) row.add(txt(this, g.zone.tagline, { color: COL.dim2 }), { align: 'center' });
    row.addSpace(1);
    const ghosts = state.ghosts.length + (state.tomb && ghostOut() && state.pref === 'cemetery' ? 1 : 0);
    row.add(txt(this, `在场：活人 ${state.livingCount + (state.tomb ? 0 : 1)} · 鬼 ${ghosts}`, { color: COL.dim }), { align: 'center' });
    bar.add(row, { expand: true });
    if (z && z.phases.length > 1) {
      const tabs = flow(this, barW - 8, { space: 3 });
      for (const p of [...z.phases].sort((a, b) => a.number - b.number)) {
        tabs.add(
          chip(this, cnPhaseLabel(p.number), {
            on: p.id === this.phaseId,
            onClick: () => navigate(zonePath(z.key, p.number)),
          }),
        );
      }
      bar.add(tabs, { expand: true });
    }
    bar.layout();
    bar.setPosition(x0, y);
    bar.setDepth(30);
    this.overlay.push(bar);
    y += bar.height + 2;

    if (state.tomb && ghostOut() && state.pref === 'cemetery') {
      const gb = vbox(this, { width: barW, pad: { left: 5, right: 4, top: 3, bottom: 4 }, space: 3, bg: 'toast' });
      gb.setOrigin(0, 0);
      const zs = zhashiActive();
      const head = hbox(this, { width: barW - 9, space: 6 });
      head.add(txt(this, zs ? '诈尸中' : '夜游中', { color: zs ? COL.seal : COL.wisp }), { align: 'center' });
      if (zs) {
        this.zsText = txt(this, `阳气灼烧 · 还剩 ${this.zhashiLeft()}`, { color: COL.seal });
        head.add(this.zsText, { align: 'center' });
      } else if (W >= 460) {
        head.add(txt(this, `你的坟在${state.tomb.address ?? '某处'}`, { color: COL.dim }), { align: 'center' });
      }
      gb.add(head, { expand: true });
      const acts = flow(this, barW - 9, { space: 3 });
      acts.add(button(this, '回我的坟', { small: true, onClick: () => this.goMine() }));
      acts.add(button(this, '邀请烧纸', { small: true, onClick: () => openPanel('invite') }));
      acts.add(button(this, '回棺材', { small: true, icon: 'coffin', onClick: () => this.sleep() }));
      gb.add(acts, { expand: true });
      gb.layout();
      gb.setPosition(x0, y);
      gb.setDepth(30);
      this.overlay.push(gb);
      y += gb.height + 2;
    }
    this.overlayH = y - HUD_H;

    if (this.showHelp) {
      const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
      const help = vbox(this, { pad: { left: 5, right: 5, top: 2, bottom: 3 }, bg: 'card' });
      help.add(txt(this, coarse ? '点地面走过去，点墓碑走到跟前看碑。' : 'WASD 或方向键走动，按 E 看碑；也可以直接点地面、点墓碑。', { color: COL.dim, wrap: Math.min(W - 24, 360) }));
      help.setOrigin(0.5, 1);
      help.layout();
      help.setPosition(Math.round(W / 2), H - 6);
      help.setDepth(30);
      this.overlay.push(help);
    }
  }

  private zhashiLeft(): string {
    const until = state.tomb?.zhashi_until;
    return until ? mmss(new Date(until).getTime() - Date.now()) : '00:00';
  }

  private tickZhashi(): void {
    if (this.zsText) this.zsText.setText(`[raw]阳气灼烧 · 还剩 ${this.zhashiLeft()}[/raw]`);
  }

  private goMine(): void {
    const t = state.tomb;
    if (!t) return;
    const cell = state.group?.start_cell ?? t.cell;
    if (t.phase?.id === this.phaseId && cell != null) {
      const id = `${state.group ? 'group' : 'tomb'}-${cell}`;
      this.walkToInteractable(id);
      return;
    }
    navigate(state.group?.code ? `/g/${state.group.code}` : `/t/${t.code}`);
  }

  private sleep(): void {
    setPref('coffin');
    toast('回棺材躺着了。');
    emit('session');
  }
}
