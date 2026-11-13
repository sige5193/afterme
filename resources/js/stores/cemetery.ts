import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import * as api from '@/api/client';
import type { TombDetail, TombListItem } from '@/api/types';
import { COLS } from '@/utils/time';
import { useSessionStore } from './session';
import { useUiStore } from './ui';

export const useCemeteryStore = defineStore('cemetery', () => {
  const tombs = ref<TombListItem[]>([]);
  const detail = ref<TombDetail | null>(null);
  const openCode = ref<string | null>(null);
  const tombsVersion = ref<string | null>(null);
  const loading = ref(false);

  const byPlot = computed(() => {
    const m = new Map<number, TombListItem>();
    for (const t of tombs.value) m.set(t.plot, t);
    return m;
  });

  const maxPlot = computed(() => {
    let mx = -1;
    for (const t of tombs.value) if (t.plot > mx) mx = t.plot;
    return mx;
  });

  /** 最少 30；接近上限时多一排 */
  const totalPlots = computed(() => {
    const base = 30;
    const need = maxPlot.value + 1;
    if (need <= base) return base;
    const rows = Math.ceil(need / COLS);
    return Math.max(base, rows * COLS);
  });

  const npcCount = computed(() => tombs.value.filter((t) => t.is_npc).length);
  const humanCount = computed(() => tombs.value.filter((t) => !t.is_npc).length);

  const occupiedPlots = computed(() => new Set(tombs.value.map((t) => t.plot)));

  async function fetchTombs() {
    loading.value = true;
    try {
      tombs.value = await api.listTombs();
    } catch {
      useUiStore().toast(api.DEFAULT_ERROR, { err: true });
    } finally {
      loading.value = false;
    }
  }

  async function openTomb(code: string) {
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
  }

  function findByCode(code: string) {
    return tombs.value.find((t) => t.code === code) ?? null;
  }

  function findById(id: number) {
    return tombs.value.find((t) => t.id === id) ?? null;
  }

  function myPlot(): number | null {
    const session = useSessionStore();
    return session.tomb?.plot ?? null;
  }

  function upsertListItem(t: TombListItem) {
    const i = tombs.value.findIndex((x) => x.id === t.id);
    if (i >= 0) tombs.value[i] = { ...tombs.value[i], ...t };
    else tombs.value = [...tombs.value, t];
  }

  return {
    tombs,
    detail,
    openCode,
    tombsVersion,
    loading,
    byPlot,
    maxPlot,
    totalPlots,
    npcCount,
    humanCount,
    occupiedPlots,
    fetchTombs,
    openTomb,
    closeDrawer,
    findByCode,
    findById,
    myPlot,
    upsertListItem,
  };
});
