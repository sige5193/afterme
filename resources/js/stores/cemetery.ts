import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import * as api from '@/api/client';
import type { GridCell, GroupDetail, PhaseGrid, TombDetail, ZoneInfo } from '@/api/types';
import { useSessionStore } from './session';
import { useUiStore } from './ui';

export const useCemeteryStore = defineStore('cemetery', () => {
  const detail = ref<TombDetail | null>(null);
  const openCode = ref<string | null>(null);
  const loading = ref(false);
  const gridByPhaseId = ref<Record<number, PhaseGrid>>({});
  const viewingPhaseId = ref<number | null>(null);
  const zonesList = ref<ZoneInfo[]>([]);
  const groupDetail = ref<GroupDetail | null>(null);
  const openGroupCode = ref<string | null>(null);
  const phaseVersion = ref<string | null>(null);
  const highlightMemberCode = ref<string | null>(null);

  const currentGrid = computed(() =>
    viewingPhaseId.value != null ? (gridByPhaseId.value[viewingPhaseId.value] ?? null) : null,
  );

  const gridCellMap = computed(() => {
    const m = new Map<number, GridCell>();
    for (const c of currentGrid.value?.cells ?? []) m.set(c.cell, c);
    return m;
  });

  const occupiedCells = computed(() => {
    const s = new Set<number>();
    for (const c of currentGrid.value?.cells ?? []) {
      if (c.type !== 'empty') s.add(c.cell);
      if (c.type === 'group' && c.group) {
        for (let i = 0; i < c.group.width; i++) s.add(c.cell + i);
      }
    }
    return s;
  });

  function groupSpanSkip(cells: GridCell[]): Set<number> {
    const skip = new Set<number>();
    for (const c of cells) {
      if (c.type === 'group' && c.group) {
        for (let i = 1; i < c.group.width; i++) skip.add(c.cell + i);
      }
    }
    return skip;
  }

  async function fetchGrid(phaseId: number, force = false) {
    if (!force && gridByPhaseId.value[phaseId]) {
      viewingPhaseId.value = phaseId;
      phaseVersion.value = gridByPhaseId.value[phaseId].version;
      return gridByPhaseId.value[phaseId];
    }
    loading.value = true;
    try {
      const grid = await api.getPhaseGrid(phaseId);
      gridByPhaseId.value = { ...gridByPhaseId.value, [phaseId]: grid };
      viewingPhaseId.value = phaseId;
      phaseVersion.value = grid.version;
      return grid;
    } catch {
      useUiStore().toast(api.DEFAULT_ERROR, { err: true });
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function fetchZones() {
    try {
      zonesList.value = await api.listZones();
    } catch {
      useUiStore().toast(api.DEFAULT_ERROR, { err: true });
    }
  }

  async function openTomb(code: string) {
    openGroupCode.value = null;
    groupDetail.value = null;
    openCode.value = code;
    try {
      const tomb = await api.getTomb(code);
      if (tomb.group?.code) {
        highlightMemberCode.value = code;
        openCode.value = null;
        detail.value = null;
        await openGroup(tomb.group.code);
        return;
      }
      detail.value = tomb;
    } catch {
      useUiStore().toast(api.DEFAULT_ERROR, { err: true });
      detail.value = null;
    }
  }

  async function openTombDirect(code: string) {
    highlightMemberCode.value = null;
    openGroupCode.value = null;
    groupDetail.value = null;
    openCode.value = code;
    try {
      detail.value = await api.getTomb(code);
    } catch {
      useUiStore().toast(api.DEFAULT_ERROR, { err: true });
      detail.value = null;
    }
  }

  function closeDrawer() {
    openCode.value = null;
    detail.value = null;
    highlightMemberCode.value = null;
  }

  async function openGroup(code: string) {
    openCode.value = null;
    detail.value = null;
    openGroupCode.value = code;
    try {
      groupDetail.value = await api.getGroup(code);
      const phaseId = groupDetail.value.phase?.id;
      if (phaseId) await fetchGrid(phaseId);
    } catch {
      useUiStore().toast(api.DEFAULT_ERROR, { err: true });
      groupDetail.value = null;
    }
  }

  function closeGroupDrawer() {
    openGroupCode.value = null;
    groupDetail.value = null;
    highlightMemberCode.value = null;
  }

  function myCell(): number | null {
    return useSessionStore().tomb?.cell ?? null;
  }

  return {
    detail,
    openCode,
    loading,
    gridByPhaseId,
    viewingPhaseId,
    zonesList,
    groupDetail,
    openGroupCode,
    phaseVersion,
    highlightMemberCode,
    currentGrid,
    gridCellMap,
    occupiedCells,
    groupSpanSkip,
    fetchGrid,
    fetchZones,
    openTomb,
    openTombDirect,
    closeDrawer,
    openGroup,
    closeGroupDrawer,
    myCell,
  };
});
