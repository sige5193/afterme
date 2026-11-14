<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import * as api from '@/api/client';
import type { CemeteryCard, MyCemeteryResponse } from '@/api/types';
import StoneMini from '@/components/tomb/StoneMini.vue';

const router = useRouter();
const data = ref<MyCemeteryResponse | null>(null);
const loading = ref(true);

onMounted(async () => {
  loading.value = true;
  try {
    data.value = await api.myCemetery();
  } finally {
    loading.value = false;
  }
});

const sections: Array<{ key: keyof MyCemeteryResponse; title: string }> = [
  { key: 'mine', title: '我的坟' },
  { key: 'burned_me', title: '给我烧过纸的' },
  { key: 'i_burned', title: '我烧过纸的' },
  { key: 'neighbors', title: '邻居' },
];

function go(card: CemeteryCard) {
  router.push(card.kind === 'group' ? `/g/${card.code}` : `/t/${card.code}`);
}

function subline(card: CemeteryCard, key: keyof MyCemeteryResponse): string {
  if (key === 'burned_me' && card.burn_count) return `烧过 ${card.burn_count} 次`;
  if (card.relation_text) return card.relation_text;
  if (card.cause) return card.cause;
  return '';
}
</script>

<template>
  <div class="my-cem">
  <p class="note lead">
    人越来越多，这里只放跟你有关的坟。想逛逛就去园区。
  </p>
  <p v-if="loading" class="note">加载中…</p>
  <template v-else-if="data">
    <section v-for="s in sections" :key="s.key" class="sec">
      <h2 class="brush sec-title" v-if="data[s.key].length">{{ s.title }}</h2>
      <div v-if="data[s.key].length" class="cards">
        <article v-for="card in data[s.key]" :key="card.code + s.key" class="cem-card">
          <StoneMini
            :name="card.name"
            :style="card.style || 'qingshi'"
          />
          <div class="cc-body">
            <h3 class="cc-name">{{ card.name }}</h3>
            <p class="note">{{ card.address || '墓址待定' }}</p>
            <p v-if="subline(card, s.key)" class="note cc-sub">{{ subline(card, s.key) }}</p>
            <button type="button" class="btn sm primary" @click="go(card)">去看看</button>
          </div>
        </article>
      </div>
    </section>
  </template>
  </div>
</template>

<style scoped>
.my-cem {
  padding: 8px 0 32px;
  max-width: 720px;
  margin: 0 auto;
}
.lead {
  text-align: center;
  margin-bottom: 20px;
}
.sec-title {
  font-size: 28px;
  margin: 20px 0 10px;
}
.cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cem-card {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 12px;
  background: color-mix(in srgb, var(--ink-2) 65%, transparent);
}
.cc-name {
  margin: 0 0 4px;
  font-size: 18px;
}
.cc-sub {
  margin: 4px 0 8px;
}
</style>