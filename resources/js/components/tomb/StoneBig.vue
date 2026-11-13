<script setup lang="ts">
import { computed } from 'vue';
import { STYLES } from '@/config/styles';
import { cnDate, cnYear } from '@/utils/time';
import Portrait from './Portrait.vue';

const props = defineProps<{
  name: string;
  style?: string;
  birthYear?: number;
  diedAt?: string | number;
  portrait?: number;
  shake?: boolean;
}>();

const st = computed(() =>
  STYLES.some((s) => s.k === props.style) ? props.style! : 'qingshi',
);

const fsMain = computed(() => {
  const k = [...String(props.name || '')].length + 2;
  return k <= 5 ? 30 : k <= 6 ? 26 : k <= 8 ? 21 : 17;
});

const diedMs = computed(() => {
  if (typeof props.diedAt === 'number') return props.diedAt;
  if (props.diedAt) return new Date(props.diedAt).getTime();
  return Date.now();
});
</script>

<template>
  <div class="bigstone" :class="[`s-${st}`, { shake }]" id="bigstone">
    <Portrait :portrait="portrait ?? 0" />
    <div class="bs-cols">
      <span class="vt bs-side">生于{{ cnYear(birthYear || 2000) }}年</span>
      <span class="vt bs-main" :style="{ fontSize: fsMain + 'px' }">{{ name }}之墓</span>
      <span class="vt bs-side">{{ cnDate(diedMs) }}立</span>
    </div>
  </div>
</template>
