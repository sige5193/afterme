<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';

const emit = defineEmits<{ close: [] }>();

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close');
}

onMounted(() => addEventListener('keydown', onKey));
onUnmounted(() => removeEventListener('keydown', onKey));

function onBack(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close');
}
</script>

<template>
  <div class="modal-back" @click="onBack">
    <div class="modal" role="dialog" aria-modal="true">
      <button class="x" aria-label="关闭" @click="emit('close')">✕</button>
      <slot />
    </div>
  </div>
</template>
