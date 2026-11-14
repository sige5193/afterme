<script setup lang="ts">
import { cnN } from '@/utils/time';

export type PhaseTab = { id: number; number: number };

const props = defineProps<{
  phases: PhaseTab[];
  modelValue: number;
}>();

const emit = defineEmits<{ 'update:modelValue': [id: number] }>();

function label(n: number): string {
  return n <= 1 ? '一期' : `${cnN(n)}期`;
}
</script>

<template>
  <nav class="phase-tabs" aria-label="期数切换">
    <button
      v-for="p in phases"
      :key="p.id"
      type="button"
      class="btn sm"
      :class="{ primary: p.id === modelValue }"
      @click="emit('update:modelValue', p.id)"
    >
      {{ label(p.number) }}
    </button>
  </nav>
</template>

<style scoped>
.phase-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin: 12px 0 4px;
}
</style>