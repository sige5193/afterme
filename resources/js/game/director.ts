/**
 * 导演：根据路由和会话状态决定现在演哪一场（标题 / 园区导览 / 某一期墓园 / 棺材 / 葬礼），
 * 并负责打开路由对应的面板（坟、合葬墓、我的墓园、搜索）。
 */

import type Phaser from 'phaser';
import * as api from '@/api/client';
import type { GroupDetail, TombDetail } from '@/api/types';
import { on } from '@/core/bus';
import { fetchZones, phaseByNumber, zoneByKey, zoneOfPhase } from '@/core/cemetery';
import { currentRoute, navigate, type Route, zonePath } from '@/core/router';
import { setPref } from '@/core/session';
import { state } from '@/core/state';
import { openPanel, type PanelKind, toast } from '@/core/ui';
import type UIScene from './scenes/UIScene';

export type MainSpec =
  | { key: 'Title' }
  | { key: 'Hub'; fromZone?: string | null }
  | { key: 'Zone'; phaseId: number; focusCell?: number | null }
  | { key: 'Coffin' }
  | { key: 'Funeral' };

export type FuneralPrefill = { zoneKey?: string; zonePhaseId?: number; cell?: number };

let game: Phaser.Game | null = null;
let current: MainSpec | null = null;
let firstRoute = true;
let routeSeq = 0;
let lastZoneKey: string | null = null;
let funeralPrefill: FuneralPrefill = {};

export function currentMain(): MainSpec | null {
  return current;
}

export function setFuneralPrefill(p: FuneralPrefill): void {
  funeralPrefill = p;
}

export function takeFuneralPrefill(): FuneralPrefill {
  const p = funeralPrefill;
  funeralPrefill = {};
  return p;
}

function ui(): UIScene {
  return game!.scene.getScene('UI') as UIScene;
}

function sameSpec(a: MainSpec | null, b: MainSpec): boolean {
  if (!a || a.key !== b.key) return false;
  if (a.key === 'Zone' && b.key === 'Zone') return a.phaseId === b.phaseId;
  return true;
}

function switchMain(spec: MainSpec): void {
  if (!game) return;
  const mgr = game.scene;
  if (sameSpec(current, spec)) {
    if (spec.key === 'Zone' && spec.focusCell != null) {
      const zs = mgr.getScene('Zone') as unknown as { focusCell?: (c: number) => void };
      zs.focusCell?.(spec.focusCell);
    }
    current = spec;
    return;
  }
  if (current) mgr.stop(current.key);
  if (current?.key === 'Zone') {
    const z = zoneOfPhase(current.phaseId);
    if (z) lastZoneKey = z.key;
  }
  const data: Record<string, unknown> = { ...spec };
  if (spec.key === 'Hub') data.fromZone = spec.fromZone ?? lastZoneKey;
  current = spec;
  mgr.start(spec.key, data);
  mgr.bringToTop('UI');
  mgr.bringToTop('Fx');
  ui().setHudVisible(spec.key !== 'Funeral');
}

/** 有坟的人「回家」：白天躺棺材，夜里站在自己坟前 */
function homeSpec(): MainSpec {
  if (!state.tomb) return { key: 'Title' };
  if (state.pref === 'coffin') return { key: 'Coffin' };
  const phaseId = state.tomb.phase?.id;
  if (phaseId) return { key: 'Zone', phaseId, focusCell: state.group?.start_cell ?? state.tomb.cell };
  return { key: 'Hub' };
}

function ensureMain(): void {
  if (!current || current.key === 'Funeral') switchMain(state.tomb ? homeSpec() : { key: 'Hub' });
}

function closeBasePanels(): void {
  const u = ui();
  for (const k of ['tomb', 'group', 'mine', 'search', 'zones', 'menu'] as PanelKind[]) {
    if (u.hasPanel(k)) u.closeAll();
  }
}

export function canonicalPath(): string {
  if (!current) return '/';
  switch (current.key) {
    case 'Hub':
      return '/zones';
    case 'Zone': {
      const z = zoneOfPhase(current.phaseId);
      const p = z?.phases.find((x) => x.id === (current as { phaseId: number }).phaseId);
      return z && p ? zonePath(z.key, p.number) : '/zones';
    }
    case 'Funeral':
      return '/funeral';
    default:
      return '/';
  }
}

/** 关掉路由对应的面板后，地址栏回到当前场景的地址 */
export function onPanelClosed(kind: PanelKind, remaining: PanelKind[]): void {
  const r = currentRoute().name;
  const linked: Record<string, PanelKind[]> = { tomb: ['tomb', 'group'], group: ['group', 'tomb'], mine: ['mine'], search: ['search'] };
  if ((linked[r] ?? []).includes(kind) && !remaining.some((k) => (linked[r] ?? []).includes(k))) {
    navigate(canonicalPath(), { replace: true });
  }
}

async function handleRoute(route: Route): Promise<void> {
  const seq = ++routeSeq;
  const stale = () => seq !== routeSeq;
  const first = firstRoute;
  firstRoute = false;
  if (!state.zones.length) await fetchZones();
  if (stale()) return;

  switch (route.name) {
    case 'funeral':
      ui().closeAll();
      switchMain({ key: 'Funeral' });
      return;
    case 'home':
      if (!state.tomb) {
        if (current?.key !== 'Title') ui().closeAll();
        switchMain({ key: 'Title' });
      } else {
        switchMain(homeSpec());
        if (first) openPanel('mine');
      }
      return;
    case 'mine':
      if (!state.tomb) {
        navigate('/zones', { replace: true });
        return;
      }
      ensureMain();
      if (!ui().hasPanel('mine')) openPanel('mine');
      return;
    case 'search':
      ensureMain();
      openPanel('search', { q: route.q });
      return;
    case 'zones':
      setPref('cemetery');
      closeBasePanels();
      switchMain({ key: 'Hub' });
      return;
    case 'zone': {
      const z = zoneByKey(route.zoneKey);
      const ph = phaseByNumber(route.zoneKey, route.phase);
      if (!z || !ph) {
        navigate('/zones', { replace: true });
        return;
      }
      setPref('cemetery');
      closeBasePanels();
      switchMain({ key: 'Zone', phaseId: ph.id });
      return;
    }
    case 'tomb': {
      let t: TombDetail;
      try {
        t = await api.getTomb(route.code);
      } catch {
        if (stale()) return;
        toast('没找到这座坟。可能 TA 还活着。');
        navigate(current ? canonicalPath() : '/zones', { replace: true });
        return;
      }
      if (stale()) return;
      if (t.group?.code) {
        navigate(`/g/${t.group.code}?m=${encodeURIComponent(t.code)}`, { replace: true });
        return;
      }
      setPref('cemetery');
      if (t.phase?.id) switchMain({ key: 'Zone', phaseId: t.phase.id, focusCell: t.cell });
      else ensureMain();
      openPanel('tomb', { code: t.code, tomb: t });
      return;
    }
    case 'group': {
      let g: GroupDetail;
      try {
        g = await api.getGroup(route.code);
      } catch {
        if (stale()) return;
        toast('这座合葬墓已经拆了');
        navigate(current ? canonicalPath() : '/zones', { replace: true });
        return;
      }
      if (stale()) return;
      setPref('cemetery');
      if (g.phase?.id && !g.disbanded_at) switchMain({ key: 'Zone', phaseId: g.phase.id, focusCell: g.start_cell });
      else if (!current || current.key === 'Funeral' || current.key === 'Title') switchMain({ key: 'Hub' });
      const m = new URLSearchParams(location.search).get('m');
      openPanel('group', { code: g.code, group: g, highlight: m });
      return;
    }
  }
}

function onSession(): void {
  if (!current || current.key === 'Funeral') return;
  if (state.tomb && state.pref === 'coffin' && current.key !== 'Coffin') {
    switchMain({ key: 'Coffin' });
    if (currentRoute().name !== 'mine' && currentRoute().name !== 'search') navigate('/', { replace: true });
    return;
  }
  if (current.key === 'Coffin' && (!state.tomb || state.pref === 'cemetery')) {
    const spec = homeSpec();
    switchMain(spec);
    navigate(canonicalPath(), { replace: true });
    return;
  }
  if (current.key === 'Title' && state.tomb) {
    switchMain(homeSpec());
    navigate(canonicalPath(), { replace: true });
  }
}

export function startDirector(g: Phaser.Game): void {
  game = g;
  on('route', (r) => void handleRoute(r));
  on('session', onSession);
  void handleRoute(currentRoute());
}
