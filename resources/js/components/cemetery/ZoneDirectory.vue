<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import * as api from '@/api/client';
import type { ZoneInfo } from '@/api/types';
import { ZONE_ORDER, ZONES } from '@/config/zones';
import StoneMini from '@/components/tomb/StoneMini.vue';

const router = useRouter();
const zones = ref<ZoneInfo[]>([]);
const loading = ref(true);

onMounted(async () => {
  loading.value = true;
  try {
    zones.value = await api.listZones();
  } finally {
    loading.value = false;
  }
});

function sorted(): ZoneInfo[] {
  const byKey = new Map(zones.value.map((z) => [z.key, z]));
  return ZONE_ORDER.map((k) => byKey.get(k)).filter(Boolean) as ZoneInfo[];
}

function go(z: ZoneInfo) {
  router.push(`/z/${z.key}`);
}

function previewStyle(key: string) {
  return ZONES[key as keyof typeof ZONES]?.default_style ?? 'qingshi';
}
</script>

<template>
  <div class="zone-dir">
    <p v-if="loading" class="note">加载园区…</p>
    <div v-else class="zone-cards">
      <button
        v-for="z in sorted()"
        :key="z.key"
        type="button"
        class="zone-card"
        @click="go(z)"
      >
        <div class="zc-top">
          <StoneMini :name="z.name" :style="previewStyle(z.key)" />
          <div class="zc-txt">
            <h2 class="brush zc-name">{{ z.name }}</h2>
            <p class="zc-tag">{{ z.tagline }}</p>
          </div>
        </div>
        <div class="zc-meta note">
          <span>共 {{ z.phases.length }} 期</span>
          <span>入住 {{ z.tomb_count }} 人</span>
          <span>此刻鬼 {{ z.ghosts_online }} 位</span>
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.zone-dir {
  padding: 8px 0 24px;
}
.zone-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
}
.zone-card {
  text-align: left;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 14px;
  background: color-mix(in srgb, var(--ink-2) 70%, transparent);
  cursor: pointer;
  transition: border-color 0.2s;
}
.zone-card:hover {
  border-color: color-mix(in srgb, var(--joss) 35%, var(--line));
}
.zc-top {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.zc-name {
  font-size: 26px;
  line-height: 1.1;
  margin: 0;
}
.zc-tag {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--bone-dim);
}
.zc-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
}
</style>