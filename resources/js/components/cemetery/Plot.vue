<script setup lang="ts">
import { computed } from 'vue';
import type { TombListItem } from '@/api/types';
import { SPECIAL } from '@/config/specialPlots';
import { address } from '@/utils/time';
import StoneMini from '@/components/tomb/StoneMini.vue';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';

const props = defineProps<{
  plot: number;
  tomb?: TombListItem | null;
}>();

const emit = defineEmits<{ click: [plot: number, code?: string] }>();

const session = useSessionStore();
const ui = useUiStore();

const isMine = computed(() => !!props.tomb && session.tomb?.id === props.tomb.id);
const special = computed(() => SPECIAL[props.plot]);
const wobble = computed(() => ui.shakePlot === props.plot);
</script>

<template>
  <button
    v-if="!tomb"
    class="plot empty"
    :data-plot="plot"
    :aria-label="`${address(plot)}，空位${special ? '，' + special : ''}`"
    @click="emit('click', plot)"
  >
    <span class="hole" />
    <span class="plabel" :class="{ sp: !!special }">{{ special || '空位' }}</span>
  </button>
  <button
    v-else
    class="plot"
    :class="{ hot: tomb.hot, mine: isMine, wobble }"
    :data-plot="plot"
    :data-tomb="tomb.code"
    :aria-label="`${tomb.name}之墓，${address(plot)}`"
    @click="emit('click', plot, tomb.code)"
  >
    <span class="mound" />
    <StoneMini :name="tomb.name" :style="tomb.style" />
    <span class="pname">{{ tomb.name }}</span>
    <span class="psub">{{ tomb.is_npc ? '原住民 · ' : '' }}{{ tomb.cause || '' }}{{ tomb.is_orphan ? ' · 孤坟' : '' }}</span>
  </button>
</template>
