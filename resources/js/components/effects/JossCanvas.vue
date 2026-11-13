<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useJossRain } from '@/composables/useJossRain';

const canvas = ref<HTMLCanvasElement | null>(null);
const joss = useJossRain({ canvas });

onMounted(() => {
  (window as any).__aftermeJoss = joss;
});
onUnmounted(() => {
  joss.dispose();
  delete (window as any).__aftermeJoss;
});

defineExpose({ burst: (n?: number) => joss.burst(n) });
</script>

<template>
  <canvas id="joss" ref="canvas" />
</template>
