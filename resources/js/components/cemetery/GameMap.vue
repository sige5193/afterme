<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { CemeteryGame, type Avatar, type Peer } from '@/game/CemeteryGame';
import type { Interactable, WorldCell, WorldInput } from '@/game/world';
import type { PhaseGrid } from '@/api/types';
import { SPECIAL } from '@/config/specialPlots';
import { prefersReducedMotion } from '@/utils/text';
import { useCemeteryStore } from '@/stores/cemetery';
import { useClockStore } from '@/stores/clock';
import { usePresenceStore } from '@/stores/presence';
import { usePulseStore } from '@/stores/pulse';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';

const props = defineProps<{
  grid: PhaseGrid;
  hasNext: boolean;
}>();

const emit = defineEmits<{
  (e: 'empty', cell: number): void;
  (e: 'gate'): void;
  (e: 'bridge'): void;
}>();

const router = useRouter();
const cemetery = useCemeteryStore();
const clock = useClockStore();
const presence = usePresenceStore();
const pulse = usePulseStore();
const session = useSessionStore();
const ui = useUiStore();

const canvasRef = ref<HTMLCanvasElement | null>(null);
let game: CemeteryGame | null = null;
let pulseTimer: ReturnType<typeof setTimeout> | null = null;

const coarsePointer = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

const avatar = computed<Avatar>(() => (session.tomb && session.ghostOut ? 'ghost' : 'living'));

/** 自己的坟在这一期的哪一格（合葬墓取起始格） */
const myCell = computed<number | null>(() => {
  const t = session.tomb;
  if (!t) return null;
  const group = t.group;
  if (group && group.start_cell != null && props.grid.cells.some((c) => c.group?.code === group.code)) {
    return group.start_cell;
  }
  if (t.phase?.id === props.grid.phase.id && t.cell != null) return t.cell;
  return null;
});

const paused = computed(
  () =>
    !!cemetery.openCode ||
    !!cemetery.openGroupCode ||
    !!ui.modal ||
    ui.funeralOpen ||
    !!ui.burnOverlay ||
    !!ui.dreamOverlay ||
    ui.unionOverlay,
);

function toWorld(grid: PhaseGrid): WorldInput {
  const cells: WorldCell[] = [];
  for (const c of grid.cells) {
    if (c.type === 'tomb' && c.tomb) {
      cells.push({
        cell: c.cell,
        kind: 'tomb',
        code: c.tomb.code,
        name: c.tomb.name,
        style: c.tomb.style,
        hot: !!c.tomb.hot,
        isNpc: !!c.tomb.is_npc,
      });
    } else if (c.type === 'group' && c.group) {
      cells.push({
        cell: c.cell,
        kind: 'group',
        code: c.group.code,
        name: c.group.name,
        width: c.group.width,
        memberCount: c.group.member_count,
      });
    } else {
      const special = c.special ?? (grid.zone.is_group_zone ? undefined : SPECIAL[c.cell]);
      cells.push({ cell: c.cell, kind: 'empty', special });
    }
  }
  if (!grid.zone.is_group_zone) {
    for (let i = 0; i < grid.phase.capacity; i++) {
      if (!cells.some((c) => c.cell === i) && SPECIAL[i]) cells.push({ cell: i, kind: 'empty', special: SPECIAL[i] });
    }
  }
  return {
    capacity: grid.phase.capacity,
    cells,
    hasNext: props.hasNext,
    seed: grid.phase.id * 7919,
    myCell: myCell.value,
  };
}

function peersFromPresence(): Peer[] {
  return presence.ghosts.map((g) => ({ id: g.tomb_code, name: g.name, cell: g.cell }));
}

function startCell(): number | null {
  if (avatar.value === 'ghost') {
    if (session.ghostPlot != null && cemetery.viewingPhaseId === props.grid.phase.id) return session.ghostPlot;
    return myCell.value;
  }
  return null;
}

function onInteract(target: Interactable) {
  if (target.kind === 'tomb' && target.code) router.push(`/t/${target.code}`);
  else if (target.kind === 'group' && target.code) router.push(`/g/${target.code}`);
  else if (target.kind === 'empty' && target.cell != null) emit('empty', target.cell);
  else if (target.kind === 'gate') emit('gate');
  else if (target.kind === 'bridge') emit('bridge');
}

function onCellChange(cell: number | null) {
  if (avatar.value !== 'ghost') return;
  session.ghostPlot = cell;
  if (pulseTimer) clearTimeout(pulseTimer);
  pulseTimer = setTimeout(() => void pulse.sendPulse(), 600);
}

onMounted(() => {
  if (!canvasRef.value) return;
  game = new CemeteryGame({
    canvas: canvasRef.value,
    world: toWorld(props.grid),
    avatar: avatar.value,
    night: clock.isNight,
    startCell: startCell(),
    gateTitle: props.grid.zone.name,
    reducedMotion: prefersReducedMotion(),
    coarsePointer,
    callbacks: { onInteract, onCellChange },
  });
  game.setPeers(peersFromPresence());
  game.setPaused(paused.value);
  game.start();
});

onUnmounted(() => {
  if (pulseTimer) clearTimeout(pulseTimer);
  game?.destroy();
  game = null;
});

watch(
  () => [props.grid, props.hasNext, myCell.value] as const,
  () => {
    if (!game) return;
    game.setWorld(toWorld(props.grid));
    game.setGateTitle(props.grid.zone.name);
  },
);
watch(avatar, (a) => game?.setAvatar(a));
watch(
  () => clock.isNight,
  (n) => game?.setNight(n),
);
watch(paused, (p) => game?.setPaused(p));
watch(
  () => presence.ghosts,
  () => game?.setPeers(peersFromPresence()),
);

/** 给父组件用：「回我的坟」 */
function walkToCell(cell: number) {
  game?.walkToCell(cell);
}

defineExpose({ walkToCell });
</script>

<template>
  <div class="game-map">
    <canvas
      ref="canvasRef"
      class="game-canvas"
      tabindex="0"
      role="application"
      :aria-label="`${grid.phase.display_name}的像素地图，可以用方向键或 WASD 走动，按 E 交互；也可以切换到列表模式`"
    />
    <p class="game-help note">
      <template v-if="coarsePointer">点地面走过去，点墓碑走到跟前看碑。</template>
      <template v-else>WASD 或方向键走动，按 E 看碑；也可以直接点地面、点墓碑。</template>
    </p>
  </div>
</template>

<style scoped>
.game-map {
  position: relative;
  width: 100%;
}
.game-canvas {
  display: block;
  width: 100%;
  height: clamp(360px, 66vh, 680px);
  border: 1px solid var(--line);
  border-radius: 4px;
  background: #06080d;
  image-rendering: pixelated;
  touch-action: none;
  cursor: pointer;
}
.game-canvas:focus-visible {
  outline: 2px solid var(--joss);
  outline-offset: 2px;
}
.game-help {
  margin-top: 8px;
  text-align: center;
}
</style>
