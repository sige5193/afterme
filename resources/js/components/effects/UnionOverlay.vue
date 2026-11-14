<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

const emit = defineEmits<{ done: [] }>();
const visible = ref(false);

let t1: ReturnType<typeof setTimeout> | null = null;
let t2: ReturnType<typeof setTimeout> | null = null;

onMounted(() => {
  requestAnimationFrame(() => {
    visible.value = true;
  });
  t1 = setTimeout(() => {
    visible.value = false;
  }, 2400);
  t2 = setTimeout(() => emit('done'), 3000);
});

onUnmounted(() => {
  if (t1) clearTimeout(t1);
  if (t2) clearTimeout(t2);
});
</script>

<template>
  <div class="union-ov" :class="{ show: visible }" aria-live="polite">
    <p class="brush union-txt">从今往后，一起躺</p>
  </div>
</template>

<style scoped>
.union-ov {
  position: fixed;
  inset: 0;
  z-index: 88;
  display: grid;
  place-items: center;
  background: rgba(8, 6, 4, 0.55);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.6s;
}
.union-ov.show {
  opacity: 1;
}
.union-txt {
  font-size: clamp(32px, 8vw, 52px);
  color: var(--joss);
  text-shadow: 0 2px 24px rgba(0, 0, 0, 0.6);
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.8s, transform 0.8s;
}
.union-ov.show .union-txt {
  opacity: 1;
  transform: translateY(0);
}
</style>