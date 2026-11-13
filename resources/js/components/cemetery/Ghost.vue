<script setup lang="ts">
import { GHOST_SVG } from '@/config/faces';

defineProps<{
  tag: string;
  peer?: boolean;
  noanim?: boolean;
  plot?: number;
}>();
</script>

<template>
  <div
    class="ghost"
    :class="{ peer, me: !peer, noanim }"
    :data-plot="plot"
  >
    <span v-html="GHOST_SVG" />
    <span class="tag">{{ tag }}</span>
  </div>
</template>
