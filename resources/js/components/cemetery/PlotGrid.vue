<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import Ghost from './Ghost.vue';
import Plot from './Plot.vue';
import { useCemeteryStore } from '@/stores/cemetery';
import { usePresenceStore } from '@/stores/presence';
import { useSessionStore } from '@/stores/session';
import { usePulseStore } from '@/stores/pulse';
import { clamp, REDUCED } from '@/utils/text';

const emit = defineEmits<{
  plotClick: [plot: number, code?: string];
}>();

const cemetery = useCemeteryStore();
const session = useSessionStore();
const presence = usePresenceStore();
const pulse = usePulseStore();

const gridRef = ref<HTMLElement | null>(null);
const meNoanim = ref(true);
let moveTimer: ReturnType<typeof setTimeout> | null = null;

const showMe = computed(
  () => !!session.tomb && session.ghostOut && session.ghostPlot != null,
);

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
  session.ghostPlot = clamp(p, 0, cemetery.totalPlots - 1);
  positionGhosts();
  if (moveTimer) clearTimeout(moveTimer);
  moveTimer = setTimeout(() => {
    moveTimer = null;
    void pulse.sendPulse();
  }, 500);
  const el = gridRef.value?.querySelector(
    `.plot[data-plot="${session.ghostPlot}"]`,
  ) as HTMLElement | null;
  if (el) el.scrollIntoView({ block: 'nearest', behavior: REDUCED ? 'auto' : 'smooth' });
}

function onPlotClick(plot: number, code?: string) {
  if (session.tomb && session.ghostOut) moveGhost(plot);
  emit('plotClick', plot, code);
}

function gridCols() {
  if (!gridRef.value) return 6;
  return getComputedStyle(gridRef.value).gridTemplateColumns.split(' ').length;
}

function onKey(e: KeyboardEvent) {
  if (!session.tomb || !session.ghostOut) return;
  if (/INPUT|TEXTAREA/.test((document.activeElement as HTMLElement)?.tagName || '')) return;
  const cols = gridCols();
  const d = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols } as Record<
    string,
    number
  >)[e.key];
  if (d != null) {
    e.preventDefault();
    moveGhost((session.ghostPlot ?? 0) + d);
    const t = cemetery.byPlot.get(session.ghostPlot!);
    if (cemetery.openCode && t) emit('plotClick', session.ghostPlot!, t.code);
  }
  if (e.key === 'Enter' && document.activeElement === document.body) {
    const t = cemetery.byPlot.get(session.ghostPlot ?? -1);
    if (t) emit('plotClick', session.ghostPlot!, t.code);
  }
}

watch(
  () => [session.ghostPlot, presence.ghosts, cemetery.totalPlots] as const,
  () => nextTick(positionGhosts),
);

onMounted(() => {
  addEventListener('keydown', onKey);
  addEventListener('resize', positionGhosts);
  if (session.tomb && session.ghostOut) {
    if (session.ghostPlot == null || session.ghostPlot >= cemetery.totalPlots) {
      session.ghostPlot = session.tomb.plot ?? 0;
    }
  }
  nextTick(() => {
    positionGhosts();
    requestAnimationFrame(() => {
      meNoanim.value = false;
    });
  });
});

onUnmounted(() => {
  removeEventListener('keydown', onKey);
  removeEventListener('resize', positionGhosts);
});

defineExpose({ moveGhost, positionGhosts });
</script>

<template>
  <div class="grid" id="grid" ref="gridRef">
    <Plot
      v-for="i in cemetery.totalPlots"
      :key="i - 1"
      :plot="i - 1"
      :tomb="cemetery.byPlot.get(i - 1)"
      @click="onPlotClick"
    />
    <Ghost v-if="showMe" tag="我" :noanim="meNoanim" :plot="session.ghostPlot ?? undefined" />
    <Ghost
      v-for="g in presence.ghosts"
      :key="g.tomb_id"
      peer
      :tag="g.name"
      :plot="g.plot"
    />
  </div>
</template>
