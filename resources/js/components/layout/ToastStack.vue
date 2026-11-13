<script setup lang="ts">
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();

function dismiss(id: number) {
  ui.toasts = ui.toasts.filter((t) => t.id !== id);
}
</script>

<template>
  <div class="toasts" aria-live="polite">
    <div v-for="t in ui.toasts" :key="t.id" class="toast" :class="{ err: t.err }">
      <span v-html="t.html" />
      <button
        v-if="t.btn"
        class="btn"
        @click="
          () => {
            dismiss(t.id);
            t.onBtn?.();
          }
        "
      >
        {{ t.btn }}
      </button>
    </div>
  </div>
</template>
