<script setup lang="ts">
defineProps<{
  name: string;
  tagline: string;
}>();
</script>

<template>
  <header class="zone-gate">
    <div class="zg-pillar zg-l" aria-hidden="true" />
    <div class="zg-beam">
      <h1 class="brush zg-name">{{ name }}</h1>
      <p class="zg-tag">{{ tagline }}</p>
    </div>
    <div class="zg-pillar zg-r" aria-hidden="true" />
    <div class="zg-slot">
      <slot />
    </div>
  </header>
</template>

<style scoped>
.zone-gate {
  position: relative;
  display: grid;
  grid-template-columns: 14px 1fr 14px;
  align-items: end;
  gap: 0 10px;
  margin: 8px 0 6px;
  padding: 0 4px;
}
.zg-pillar {
  height: 72px;
  border-radius: 4px 4px 2px 2px;
  background: linear-gradient(90deg, #3a342a, #5c5446 45%, #3a342a);
  box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.08);
}
html[data-time='day'] .zg-pillar {
  background: linear-gradient(90deg, #6b6254, #948a7a 45%, #6b6254);
}
.zg-beam {
  grid-column: 2;
  text-align: center;
  padding: 10px 8px 8px;
  border: 2px solid color-mix(in srgb, var(--bone) 22%, transparent);
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  background: color-mix(in srgb, var(--ink-2) 88%, transparent);
}
.zg-name {
  font-size: clamp(28px, 6vw, 42px);
  line-height: 1.05;
  margin: 0;
  letter-spacing: 0.08em;
}
.zg-tag {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--bone-dim);
}
.zg-slot {
  grid-column: 1 / -1;
}
</style>