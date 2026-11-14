<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import GameMap from './GameMap.vue';
import Ghost from './Ghost.vue';
import GhostBar from './GhostBar.vue';
import GroupBlock from './GroupBlock.vue';
import PhaseTabs from './PhaseTabs.vue';
import Plot from './Plot.vue';
import ZoneGate from './ZoneGate.vue';
import type { GridTomb, TombListItem } from '@/api/types';
import { SPECIAL } from '@/config/specialPlots';
import { COLS } from '@/utils/time';
import { address } from '@/utils/time';
import { REDUCED } from '@/utils/text';
import { clamp } from '@/utils/text';
import { useCemeteryStore } from '@/stores/cemetery';
import { usePresenceStore } from '@/stores/presence';
import { usePulseStore } from '@/stores/pulse';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';
const route = useRoute();
const router = useRouter();
const cemetery = useCemeteryStore();
const session = useSessionStore();
const presence = usePresenceStore();
const pulse = usePulseStore();
const ui = useUiStore();

const gridRef = ref<HTMLElement | null>(null);
const gameRef = ref<InstanceType<typeof GameMap> | null>(null);

const VIEW_MODE_KEY = 'afterme:zoneViewMode';
function readViewMode(): 'map' | 'list' {
  try {
    return localStorage.getItem(VIEW_MODE_KEY) === 'list' ? 'list' : 'map';
  } catch {
    return 'map';
  }
}
const viewMode = ref<'map' | 'list'>(readViewMode());
function setViewMode(mode: 'map' | 'list') {
  viewMode.value = mode;
  try {
    localStorage.setItem(VIEW_MODE_KEY, mode);
  } catch {
    /* 浏览器不让存就算了 */
  }
}
const phaseId = ref<number | null>(null);
const cells = ref(60);
const skipSpan = ref(new Set<number>());

const zoneKey = computed(() => String(route.params.zoneKey || ''));
const phaseNumber = computed(() => {
  const raw = route.params.phase;
  if (raw == null || raw === '') return 1;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 1;
});

const grid = computed(() => cemetery.currentGrid);
const zone = computed(() => grid.value?.zone);
const phase = computed(() => grid.value?.phase);
const showGhostBar = computed(() => !!session.tomb && session.ghostOut);

const phasesForTabs = computed(() => {
  const z = cemetery.zonesList.find((x) => x.key === zoneKey.value);
  return (z?.phases ?? []).map((p) => ({ id: p.id, number: p.number }));
});

const nextPhase = computed(() => {
  const z = cemetery.zonesList.find((x) => x.key === zoneKey.value);
  if (!z || !phase.value) return null;
  return z.phases.find((p) => p.number === phase.value.number + 1) ?? null;
});

const prevPhaseInZone = computed(() => {
  const z = cemetery.zonesList.find((x) => x.key === zoneKey.value);
  if (!z || !phase.value) return null;
  return z.phases.find((p) => p.number === phase.value.number - 1) ?? null;
});

const showMe = computed(
  () =>
    !!session.tomb &&
    session.ghostOut &&
    session.ghostPlot != null &&
    cemetery.viewingPhaseId === phaseId.value,
);

function tombForPlot(t: GridTomb): TombListItem {
  return {
    id: t.id ?? 0,
    code: t.code,
    name: t.name,
    cause: t.cause,
    style: t.style,
    portrait: t.portrait,
    zone: null,
    phase: null,
    cell: null,
    address: null,
    move_count: 0,
    is_npc: !!t.is_npc,
    is_orphan: false,
    hot: !!t.hot,
    group: null,
  };
}

function refreshSpan() {
  skipSpan.value = cemetery.groupSpanSkip(grid.value?.cells ?? []);
}

async function resolveAndLoad() {
  if (!cemetery.zonesList.length) await cemetery.fetchZones();
  const z = cemetery.zonesList.find((x) => x.key === zoneKey.value);
  if (!z) return;
  const ph =
    z.phases.find((p) => p.number === phaseNumber.value) ?? z.phases[0];
  if (!ph) return;
  phaseId.value = ph.id;
  await cemetery.fetchGrid(ph.id);
  cells.value = grid.value?.phase.capacity ?? 60;
  refreshSpan();
}

function onPhasePick(id: number) {
  const z = cemetery.zonesList.find((x) => x.key === zoneKey.value);
  const ph = z?.phases.find((p) => p.id === id);
  if (!ph) return;
  router.push(ph.number <= 1 ? `/z/${zoneKey.value}` : `/z/${zoneKey.value}/${ph.number}`);
}

function cellData(n: number) {
  return cemetery.gridCellMap.get(n);
}

function onPlotClick(plot: number, code?: string) {
  if (code) {
    router.push(`/t/${code}`);
    return;
  }
  const sp = cellData(plot)?.special ?? SPECIAL[plot];
  ui.toast(`${address(plot)}${sp ? '「' + sp + '」' : ''}，还空着。`);
}

function onEmptyCell(cell: number) {
  onPlotClick(cell);
}

function onBridge() {
  if (nextPhase.value) goNextPhase();
  else ui.toast('已是最后一期，桥那边什么都没有。');
}

function onGroupClick(code: string) {
  router.push(`/g/${code}`);
}

function goDirectory() {
  router.push('/zones');
}

function goNextPhase() {
  if (!nextPhase.value) return;
  const n = nextPhase.value.number;
  router.push(n <= 1 ? `/z/${zoneKey.value}` : `/z/${zoneKey.value}/${n}`);
}

function goPrevPhase() {
  if (prevPhaseInZone.value) {
    const n = prevPhaseInZone.value.number;
    router.push(n <= 1 ? `/z/${zoneKey.value}` : `/z/${zoneKey.value}/${n}`);
  } else goDirectory();
}

function plotPos(p: number) {
  const el = gridRef.value?.querySelector(`.plot[data-plot="${p}"]`) as HTMLElement | null;
  if (!el) return null;
  return { x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop + 2 };
}

function positionGhosts() {
  const me = gridRef.value?.querySelector('.ghost.me') as HTMLElement | null;
  if (me && session.ghostPlot != null) {
    const pos = plotPos(session.ghostPlot);
    if (pos) me.style.transform = `translate(${pos.x}px,${pos.y}px)`;
  }
  gridRef.value?.querySelectorAll('.ghost.peer').forEach((g) => {
    const el = g as HTMLElement;
    const p = Number(el.dataset.plot);
    const pos = plotPos(p);
    if (pos) el.style.transform = `translate(${pos.x}px,${pos.y + 10}px)`;
  });
}

function moveGhost(p: number) {
  const max = cells.value - 1;
  session.ghostPlot = clamp(p, 0, max);
  positionGhosts();
  void pulse.sendPulse();
  const el = gridRef.value?.querySelector(
    `.plot[data-plot="${session.ghostPlot}"]`,
  ) as HTMLElement | null;
  if (el) el.scrollIntoView({ block: 'nearest', behavior: REDUCED ? 'auto' : 'smooth' });
}

function onKey(e: KeyboardEvent) {
  if (viewMode.value === 'map') return;
  if (!session.tomb || !session.ghostOut || cemetery.viewingPhaseId !== phaseId.value) return;
  if (/INPUT|TEXTAREA/.test((document.activeElement as HTMLElement)?.tagName || '')) return;
  const p = session.ghostPlot ?? 0;
  const row = Math.floor(p / COLS);
  const col = p % COLS;
  const d = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -COLS, ArrowDown: COLS } as Record<
    string,
    number
  >)[e.key];
  if (e.key === 'ArrowUp' && row === 0) {
    e.preventDefault();
    goPrevPhase();
    return;
  }
  if (e.key === 'ArrowDown' && row >= Math.floor((cells.value - 1) / COLS)) {
    e.preventDefault();
    if (nextPhase.value) goNextPhase();
    return;
  }
  if (d != null) {
    e.preventDefault();
    moveGhost(p + d);
  }
}

function goMine() {
  const c = session.tomb?.group?.start_cell ?? session.tomb?.cell ?? session.ghostPlot;
  if (viewMode.value === 'map' && c != null && session.tomb?.phase?.id === phaseId.value) {
    gameRef.value?.walkToCell(c);
    return;
  }
  if (c != null) moveGhost(c);
  if (session.tomb) router.push(`/t/${session.tomb.code}`);
}

function sleep() {
  ui.pref = 'coffin';
  ui.toast('回棺材躺着了。');
}

watch(
  () => [route.params.zoneKey, route.params.phase] as const,
  () => void resolveAndLoad(),
  { immediate: true },
);

watch(phaseId, (id) => {
  cemetery.viewingPhaseId = id;
  void pulse.sendPulse();
});

watch(
  () => [session.ghostPlot, presence.ghosts, cells.value] as const,
  () => nextTick(positionGhosts),
);

onMounted(() => {
  addEventListener('keydown', onKey);
  addEventListener('resize', positionGhosts);
  nextTick(positionGhosts);
});

onUnmounted(() => {
  removeEventListener('keydown', onKey);
  removeEventListener('resize', positionGhosts);
  if (cemetery.viewingPhaseId === phaseId.value) cemetery.viewingPhaseId = null;
});

watch(
  () => cemetery.phaseVersion,
  async (v, old) => {
    if (phaseId.value && v && v !== old) await cemetery.fetchGrid(phaseId.value, true);
  },
);
</script>

<template>
  <div class="scene zone-view">
    <div class="yard">
      <ZoneGate v-if="zone" :name="zone.name" :tagline="zone.tagline">
        <PhaseTabs
          v-if="phasesForTabs.length > 1 && phaseId"
          :phases="phasesForTabs"
          :model-value="phaseId"
          @update:model-value="onPhasePick"
        />
      </ZoneGate>
      <GhostBar
        v-if="showGhostBar"
        @go-mine="goMine"
        @sleep="sleep"
        @invite="ui.openModal('invite')"
      />
      <div class="road-sign top">
        <button type="button" class="btn sm" @click="goDirectory">← 回园区导览</button>
        <div class="view-toggle" role="group" aria-label="显示方式">
          <button
            type="button"
            class="btn sm"
            :class="{ on: viewMode === 'map' }"
            :aria-pressed="viewMode === 'map'"
            @click="setViewMode('map')"
          >
            地图模式
          </button>
          <button
            type="button"
            class="btn sm"
            :class="{ on: viewMode === 'list' }"
            :aria-pressed="viewMode === 'list'"
            @click="setViewMode('list')"
          >
            列表模式
          </button>
        </div>
      </div>
      <div v-if="!grid && cemetery.loading" class="note">加载墓位…</div>
      <GameMap
        v-else-if="grid && viewMode === 'map'"
        ref="gameRef"
        :key="grid.phase.id"
        :grid="grid"
        :has-next="!!nextPhase"
        @empty="onEmptyCell"
        @gate="goDirectory"
        @bridge="onBridge"
      />
      <div v-else class="grid grid-scroll" id="grid" ref="gridRef">
        <template v-for="i in cells" :key="i - 1">
          <template v-if="!skipSpan.has(i - 1)">
            <GroupBlock
              v-if="cellData(i - 1)?.type === 'group' && cellData(i - 1)?.group"
              :cell="i - 1"
              :group="cellData(i - 1)!.group!"
              @click="onGroupClick"
            />
            <Plot
              v-else-if="cellData(i - 1)?.type === 'tomb' && cellData(i - 1)?.tomb"
              :plot="i - 1"
              :tomb="tombForPlot(cellData(i - 1)!.tomb!)"
              @click="onPlotClick"
            />
            <Plot
              v-else
              :plot="i - 1"
              @click="onPlotClick"
            />
          </template>
        </template>
        <Ghost v-if="showMe" tag="我" :plot="session.ghostPlot ?? undefined" />
        <Ghost
          v-for="g in presence.ghosts"
          :key="g.tomb_code"
          peer
          :tag="g.name"
          :plot="g.cell ?? undefined"
        />
      </div>
      <div v-if="viewMode === 'list'" class="road-sign bottom">
        <button
          v-if="nextPhase"
          type="button"
          class="btn sm"
          @click="goNextPhase"
        >
          下一期 →
        </button>
        <span v-else class="note">已是最后一期</span>
      </div>
      <p v-if="phase" class="note yard-foot">{{ phase.display_name }}</p>
    </div>
  </div>
</template>

<style scoped>
.zone-view .road-sign {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin: 10px 0;
}
.view-toggle {
  display: inline-flex;
  gap: 4px;
}
.view-toggle .btn.on {
  background: var(--joss);
  border-color: var(--joss);
  color: #17120a;
  font-weight: 600;
}
.grid-scroll {
  overflow-x: auto;
  max-width: 100%;
}
.yard-foot {
  text-align: center;
  margin-top: 8px;
}
</style>