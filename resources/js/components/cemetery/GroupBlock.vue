<script setup lang="ts">
import { computed } from 'vue';
import type { GridGroup } from '@/api/types';
import { short } from '@/utils/text';

const props = defineProps<{
  cell: number;
  group: GridGroup;
}>();

const emit = defineEmits<{ click: [code: string] }>();

const names = computed(() => props.group.members.map((m) => short(m.name, 4)));
</script>

<template>
  <button
    type="button"
    class="plot group-block"
    :data-plot="cell"
    :style="{ gridColumn: `span ${group.width}` }"
    :aria-label="`${group.name}，${group.relation_label}`"
    @click="emit('click', group.code)"
  >
    <span class="mound" />
    <div class="gb-stone bigstone s-hanbai">
      <span class="gb-title vt">{{ short(group.name, group.width > 2 ? 8 : 6) }}</span>
      <span class="gb-rel">{{ group.relation_label }}</span>
    </div>
    <span class="gb-names">{{ names.join(' · ') }}</span>
  </button>
</template>

<style scoped>
.group-block {
  min-width: 0;
}
.gb-stone {
  width: auto;
  min-width: 72px;
  height: 68px;
  padding: 6px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border-radius: 6px 6px 3px 3px;
}
.gb-title {
  font-size: 13px;
  letter-spacing: 0.08em;
}
.gb-rel {
  font-size: 10px;
  opacity: 0.75;
}
.gb-names {
  font-size: 10px;
  color: var(--bone-dim);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 4px;
}
</style>