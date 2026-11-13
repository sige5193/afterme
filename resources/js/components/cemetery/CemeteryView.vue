<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import Hero from './Hero.vue';
import GhostBar from './GhostBar.vue';
import PlotGrid from './PlotGrid.vue';
import { useCanvasScene } from '@/composables/useCanvasScene';
import { useCemeteryStore } from '@/stores/cemetery';
import { usePresenceStore } from '@/stores/presence';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';
import { useClockStore } from '@/stores/clock';
import { SPECIAL } from '@/config/specialPlots';
import { address } from '@/utils/time';
import { REDUCED } from '@/utils/text';

const cemetery = useCemeteryStore();
const session = useSessionStore();
const presence = usePresenceStore();
const ui = useUiStore();
const clock = useClockStore();
const router = useRouter();

const bgRef = ref<HTMLCanvasElement | null>(null);
const gridComp = ref<InstanceType<typeof PlotGrid> | null>(null);
const yardRef = ref<HTMLElement | null>(null);

const showHero = computed(() => !session.tomb);
const showGhostBar = computed(() => !!session.tomb && session.ghostOut);

useCanvasScene({
  canvas: bgRef,
  isNight: () => clock.isNight,
  isActive: true,
});

function scrollYard() {
  document.getElementById('grid')?.scrollIntoView({
    behavior: REDUCED ? 'auto' : 'smooth',
    block: 'start',
  });
}

function onPlotClick(plot: number, code?: string) {
  if (code) {
    router.push(`/t/${code}`);
    return;
  }
  const sp = SPECIAL[plot];
  ui.toast(`${address(plot)}${sp ? '「' + sp + '」' : ''}，还空着。`, session.tomb
    ? {}
    : {
        btn: '我要这块',
        onBtn: () => {
          ui.funeralPrefill = { plot };
          ui.funeralOpen = true;
          router.push('/funeral');
        },
      });
}

function goMine() {
  const p = session.tomb?.plot;
  if (p == null) return;
  gridComp.value?.moveGhost(p);
  if (session.tomb) router.push(`/t/${session.tomb.code}`);
}

function sleep() {
  ui.pref = 'coffin';
  ui.toast('回棺材躺着了。');
}

function invite() {
  ui.openModal('invite');
}

function setTopH() {
  const top = document.querySelector('.top') as HTMLElement | null;
  if (top) document.documentElement.style.setProperty('--toph', top.offsetHeight + 'px');
}

onMounted(() => {
  setTopH();
  addEventListener('resize', setTopH);
});
onUnmounted(() => removeEventListener('resize', setTopH));
</script>

<template>
  <div class="scene">
    <canvas id="bg" ref="bgRef" />
    <div class="yard" ref="yardRef">
      <Hero v-if="showHero" @scroll-yard="scrollYard" />
      <GhostBar
        v-else-if="showGhostBar"
        @go-mine="goMine"
        @sleep="sleep"
        @invite="invite"
      />
      <div class="yard-meta">
        <span>新坟 <b>{{ cemetery.humanCount }}</b> 座</span>
        <span>原住民 <b>{{ cemetery.npcCount }}</b> 位</span>
        <span>此刻在场：活人 <b>{{ presence.livingCount }}</b> · 鬼 <b>{{ presence.ghosts.length }}</b></span>
      </div>
      <PlotGrid ref="gridComp" @plot-click="onPlotClick" />
    </div>
  </div>
</template>
