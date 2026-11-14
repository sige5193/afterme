<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import * as api from '@/api/client';
import type { CemeteryCard } from '@/api/types';
import StoneMini from '@/components/tomb/StoneMini.vue';

const route = useRoute();
const router = useRouter();

const q = ref(String(route.query.q || ''));
const results = ref<CemeteryCard[]>([]);
const loading = ref(false);
const searched = ref(false);

async function runSearch(term: string) {
  const t = term.trim();
  if (!t) {
    results.value = [];
    searched.value = false;
    return;
  }
  loading.value = true;
  try {
    const res = await api.search(t);
    if (res.redirect) {
      router.replace(res.redirect);
      return;
    }
    results.value = res.results ?? [];
    searched.value = true;
  } catch {
    results.value = [];
    searched.value = true;
  } finally {
    loading.value = false;
  }
}

function onSubmit() {
  router.replace({ path: '/search', query: q.value.trim() ? { q: q.value.trim() } : {} });
  void runSearch(q.value);
}

function go(card: CemeteryCard) {
  router.push(card.kind === 'group' ? `/g/${card.code}` : `/t/${card.code}`);
}

watch(
  () => route.query.q,
  (v) => {
    q.value = String(v || '');
    void runSearch(q.value);
  },
  { immediate: true },
);
</script>

<template>
  <div class="search-view">
    <form class="search-form" @submit.prevent="onSubmit">
      <label class="note" for="sq">搜名字或 6 位墓址码</label>
      <div class="search-row">
        <input id="sq" v-model="q" type="search" maxlength="32" placeholder="例如：老王 或 abc123" />
        <button class="btn primary" type="submit" :disabled="loading">搜索</button>
      </div>
    </form>
    <p v-if="loading" class="note">查找中…</p>
    <p v-else-if="searched && !results.length" class="note">没找到。可能 TA 还活着。</p>
    <div v-else class="cards">
      <article v-for="card in results" :key="card.code" class="cem-card">
        <StoneMini :name="card.name" :style="card.style || 'qingshi'" />
        <div class="cc-body">
          <h3 class="cc-name">{{ card.name }}</h3>
          <p class="note">{{ card.address || '墓址待定' }}</p>
          <p v-if="card.cause" class="note">{{ card.cause }}</p>
          <button type="button" class="btn sm" @click="go(card)">去看看</button>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.search-view {
  max-width: 640px;
  margin: 0 auto;
  padding: 8px 0 32px;
}
.search-form {
  margin-bottom: 20px;
}
.search-row {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
.search-row input {
  flex: 1;
}
.cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cem-card {
  display: flex;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
}
.cc-name {
  margin: 0 0 4px;
  font-size: 18px;
}
</style>