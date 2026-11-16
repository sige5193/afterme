/**
 * 园区、期、网格缓存（替代原来的 cemetery store）。
 */

import * as api from '@/api/client';
import type { GridCell, PhaseGrid, ZoneInfo, ZonePhaseInfo } from '@/api/types';
import { ZONE_ORDER } from '@/config/zones';
import { emit } from './bus';
import { state } from './state';
import { toast } from './ui';

export async function fetchZones(): Promise<ZoneInfo[]> {
  try {
    const list = await api.listZones();
    const order = new Map<string, number>(ZONE_ORDER.map((k, i) => [k, i]));
    state.zones = [...list].sort((a, b) => (order.get(a.key) ?? 99) - (order.get(b.key) ?? 99));
    emit('zones');
  } catch {
    toast(api.DEFAULT_ERROR, { err: true });
  }
  return state.zones;
}

export function zoneByKey(key: string): ZoneInfo | undefined {
  return state.zones.find((z) => z.key === key);
}

export function zoneOfPhase(phaseId: number): ZoneInfo | undefined {
  return state.zones.find((z) => z.phases.some((p) => p.id === phaseId));
}

export function phaseByNumber(zoneKey: string, n: number): ZonePhaseInfo | undefined {
  const z = zoneByKey(zoneKey);
  return z?.phases.find((p) => p.number === n) ?? z?.phases[0];
}

/** 最早一个还有空位的期 */
export function earliestOpenPhase(zone: ZoneInfo | undefined): ZonePhaseInfo | undefined {
  if (!zone) return undefined;
  const sorted = [...zone.phases].sort((a, b) => a.number - b.number);
  return sorted.find((p) => p.used_cells < p.capacity) ?? sorted[0];
}

export async function fetchGrid(phaseId: number, force = false): Promise<PhaseGrid | null> {
  const cached = state.grids.get(phaseId);
  if (cached && !force) return cached;
  try {
    const grid = await api.getPhaseGrid(phaseId);
    state.grids.set(phaseId, grid);
    state.phaseVersions.set(phaseId, grid.version);
    emit('grid', phaseId);
    return grid;
  } catch {
    toast(api.DEFAULT_ERROR, { err: true });
    return cached ?? null;
  }
}

/** 坟动过之后（下葬、迁坟、合葬、迁出…）：清掉缓存，正在看的那一期马上重拉 */
export function invalidateGrids(): void {
  state.grids.clear();
  if (state.viewingPhaseId != null) void fetchGrid(state.viewingPhaseId, true);
}

/** 格子 → 占用情况（合葬墓块的每一格都算占用） */
export function occupancy(grid: PhaseGrid | null | undefined): Map<number, GridCell> {
  const m = new Map<number, GridCell>();
  for (const c of grid?.cells ?? []) {
    if (c.type === 'tomb') m.set(c.cell, c);
    else if (c.type === 'group' && c.group) {
      for (let i = 0; i < c.group.width; i++) m.set(c.group.start_cell + i, c);
    }
  }
  return m;
}

export function specialOf(grid: PhaseGrid | null | undefined, cell: number): string | undefined {
  return grid?.cells.find((c) => c.cell === cell)?.special;
}
