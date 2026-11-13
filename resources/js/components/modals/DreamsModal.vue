<script setup lang="ts">
import { computed, onMounted } from 'vue';
import Modal from '@/components/layout/Modal.vue';
import * as api from '@/api/client';
import { itemsText, useOfferingsStore } from '@/stores/offerings';
import { useUiStore } from '@/stores/ui';
import { ago } from '@/utils/time';

const ui = useUiStore();
const offerings = useOfferingsStore();

onMounted(() => {
  void offerings.fetchDreams();
});

const sent = computed(() => offerings.dreams);
const replied = computed(() => offerings.dreams.filter((d) => d.dream));

function offeringItems(b: (typeof offerings.dreams)[0]['offering']) {
  if (Array.isArray(b.items)) {
    const o: Record<string, number> = {};
    for (const i of b.items) o[i.item_key] = i.qty;
    return o;
  }
  return b.items;
}

function openDream(row: (typeof offerings.dreams)[0]) {
  if (!row.dream) return;
  ui.closeModal();
  ui.dreamOverlay = {
    text: row.dream.text,
    style: row.dream.style,
    fromName: row.dream.tomb_name || '某位故人',
    at: new Date(row.dream.visible_at || row.dream.created_at).getTime(),
    id: row.dream.id,
  };
  void api.markDreamRead(row.dream.id);
}

function resurrect() {
  ui.closeModal();
  ui.openModal('resurrect');
}
</script>

<template>
  <Modal @close="ui.closeModal()">
    <h2>我的梦</h2>
    <p class="sub">你烧过 {{ sent.length }} 次纸，收到 {{ replied.length }} 个梦。</p>
    <ul v-if="sent.length" class="list">
      <li v-for="row in sent" :key="row.offering.id" class="bl">
        <div class="bl-h">
          <b>给 {{ row.dream?.tomb_name || '某位故人' }}</b>
          <time>{{ ago(new Date(row.offering.created_at).getTime()) }}</time>
        </div>
        <div class="bl-items">烧了 {{ itemsText(offeringItems(row.offering)) }}</div>
        <div class="bl-f">
          <template v-if="row.dream">
            <span class="ok">{{ row.dream.read_at ? 'TA 托过梦' : 'TA 托梦了，还没做' }}</span>
            <button class="btn sm primary" @click="openDream(row)">
              {{ row.dream.read_at ? '再梦一次' : '去做梦' }}
            </button>
          </template>
          <span v-else>还没回音。鬼白天睡觉，晚上才出来。</span>
        </div>
      </li>
    </ul>
    <div v-else class="empty-note">还没给谁烧过纸。</div>
    <p class="note" style="margin-top: 18px">
      换设备会丢失你的梦。想留住，就先办一场葬礼拿到还魂码。
      <button class="btn quiet sm" @click="resurrect">我死过，回到我的坟</button>
    </p>
  </Modal>
</template>
