<script setup lang="ts">
import { computed, onMounted } from 'vue';
import Modal from '@/components/layout/Modal.vue';
import * as api from '@/api/client';
import type { Dream } from '@/api/types';
import { itemsText, useOfferingsStore } from '@/stores/offerings';
import { useUiStore } from '@/stores/ui';
import { ago } from '@/utils/time';

const ui = useUiStore();
const offerings = useOfferingsStore();

onMounted(() => {
  void offerings.fetchDreams();
});

const sent = computed(() => offerings.dreams);
const special = computed(() => offerings.specialDreams);
const repliedCount = computed(() =>
  offerings.dreams.reduce((n, d) => n + (d.dreams?.length || (d.dream ? 1 : 0)), 0),
);

function offeringItems(b: (typeof offerings.dreams)[0]['offering']) {
  if (Array.isArray(b.items)) {
    const o: Record<string, number> = {};
    for (const i of b.items) o[i.item_key] = i.qty;
    return o;
  }
  return b.items;
}

function openDream(d: Dream, playUnion = false) {
  ui.closeModal();
  ui.dreamOverlay = {
    text: d.text,
    style: d.style,
    fromName: d.tomb_name || d.tomb?.name || '某位故人',
    at: new Date(d.visible_at || d.created_at).getTime(),
    id: d.id,
  };
  void api.markDreamRead(d.id);
  if (playUnion && d.kind === 'join_result') {
    setTimeout(() => {
      ui.unionOverlay = true;
    }, 400);
  }
}

function targetName(row: (typeof offerings.dreams)[0]) {
  return row.offering.group?.name || row.offering.tomb?.name || row.dream?.tomb_name || '某位故人';
}

function resurrect() {
  ui.closeModal();
  ui.openModal('resurrect');
}
</script>

<template>
  <Modal @close="ui.closeModal()">
    <h2>我的梦</h2>
    <p class="sub">你烧过 {{ sent.length }} 次纸，收到 {{ repliedCount }} 个梦。</p>

    <template v-if="special.length">
      <h3 class="brush" style="font-size: 22px; margin: 12px 0 8px">结伴帖的回音</h3>
      <ul class="list">
        <li v-for="d in special" :key="'sp-' + d.id" class="bl">
          <div class="bl-h">
            <b>{{ d.kind === 'system' ? '系统消息' : d.tomb?.name || '回音' }}</b>
            <time>{{ ago(new Date(d.visible_at || d.created_at).getTime()) }}</time>
          </div>
          <p class="bl-msg">{{ d.text }}</p>
          <div class="bl-f">
            <button class="btn sm primary" @click="openDream(d, d.kind === 'join_result')">
              {{ d.read_at ? '再看一次' : '去做梦' }}
            </button>
          </div>
        </li>
      </ul>
    </template>

    <ul v-if="sent.length" class="list">
      <li v-for="row in sent" :key="row.offering.id" class="bl">
        <div class="bl-h">
          <b>给 {{ targetName(row) }}</b>
          <time>{{ ago(new Date(row.offering.created_at).getTime()) }}</time>
        </div>
        <div class="bl-items">烧了 {{ itemsText(offeringItems(row.offering)) }}</div>
        <div v-if="row.dreams?.length" class="note">
          <div v-for="d in row.dreams" :key="d.id" style="margin-top: 4px">
            {{ d.tomb?.name || d.tomb_name || '有人' }}
            {{ d.read_at ? '托过梦了' : '托梦了' }}
            <button class="btn sm" style="margin-left: 6px" @click="openDream(d)">去做梦</button>
          </div>
        </div>
        <div v-else class="bl-f">
          <span>还没回音。鬼白天睡觉，晚上才出来。</span>
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
