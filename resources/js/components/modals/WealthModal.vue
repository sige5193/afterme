<script setup lang="ts">
import { computed, onMounted } from 'vue';
import Modal from '@/components/layout/Modal.vue';
import { ITEMS, ITEM } from '@/config/items';
import { itemTotals, useOfferingsStore } from '@/stores/offerings';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const offerings = useOfferingsStore();

onMounted(() => {
  void offerings.fetchInbox();
});

const tot = computed(() => itemTotals(offerings.inbox));
const val = computed(() =>
  Object.entries(tot.value).reduce((a, [k, n]) => a + (ITEM[k]?.val || 0) * n, 0),
);
const rows = computed(() => ITEMS.filter((i) => tot.value[i.k]));
</script>

<template>
  <Modal @close="ui.closeModal()">
    <h2>数数家当</h2>
    <p class="sub">按天地银行牌价折算。</p>
    <div class="bignum">{{ val.toLocaleString('zh-CN') }} 亿</div>
    <p class="note" style="margin: 2px 0 14px">
      冥币总资产{{
        val > 1000 ? '，在下面算是中产了' : val > 0 ? '，省着点花' : '，目前穷得叮当响'
      }}。
    </p>
    <div v-if="rows.length" class="wealth">
      <div v-for="i in rows" :key="i.k">
        <span>{{ i.icon }} {{ i.name }}</span>
        <b>×{{ tot[i.k] }}</b>
      </div>
    </div>
    <div v-else class="empty-note">一件都没有。</div>
  </Modal>
</template>
