<script setup lang="ts">
import { computed } from 'vue';
import type { GridGroupMember } from '@/api/types';
import { short } from '@/utils/text';

const props = defineProps<{
  name: string;
  relationLabel: string;
  members: GridGroupMember[];
  capacity?: number;
}>();

const cap = computed(() => props.capacity ?? 6);

const slots = computed(() => {
  const list: Array<{ kind: 'member' | 'empty'; member?: GridGroupMember }> = [];
  const ms = [...props.members];
  for (let i = 0; i < cap.value; i++) {
    if (ms[i]) list.push({ kind: 'member', member: ms[i] });
    else list.push({ kind: 'empty' });
  }
  return list.reverse();
});

const full = computed(() => props.members.length >= cap.value);
</script>

<template>
  <div class="bigstone stone-group s-hanbai">
    <span v-if="full" class="seal-full">满员</span>
    <div class="sg-title brush">{{ name }} 之墓</div>
    <div class="sg-rel">{{ relationLabel }}</div>
    <div class="sg-members">
      <div v-for="(s, i) in slots" :key="i" class="sg-col">
        <template v-if="s.kind === 'member' && s.member">
          <span v-if="s.member.is_founder" class="sg-chief">长</span>
          <span class="vt sg-nm">{{ short(s.member.name, 6) }}</span>
        </template>
        <span v-else class="vt sg-empty">空穴待续</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stone-group {
  position: relative;
  width: 100%;
  max-width: 420px;
  min-height: 168px;
  padding: 18px 16px 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.seal-full {
  position: absolute;
  top: 10px;
  right: 10px;
  border: 2px solid #b8342a;
  color: #b8342a;
  font-family: var(--font-brush);
  font-size: 16px;
  padding: 2px 6px;
  transform: rotate(-8deg);
  opacity: 0.9;
}
.sg-title {
  font-size: clamp(26px, 5vw, 34px);
  line-height: 1.1;
  text-align: center;
}
.sg-rel {
  font-size: 12px;
  opacity: 0.75;
}
.sg-members {
  display: flex;
  flex-direction: row-reverse;
  justify-content: center;
  gap: 10px;
  margin-top: 8px;
  width: 100%;
}
.sg-col {
  position: relative;
  min-width: 1.4em;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.sg-nm {
  font-size: 16px;
  letter-spacing: 0.12em;
  font-weight: 600;
}
.sg-empty {
  font-size: 11px;
  color: color-mix(in srgb, var(--bone-dim) 75%, transparent);
  letter-spacing: 0.06em;
}
.sg-chief {
  font-size: 10px;
  color: var(--seal);
  border: 1px solid var(--seal);
  border-radius: 2px;
  padding: 0 2px;
  line-height: 1.2;
}
</style>