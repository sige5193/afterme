<script setup lang="ts">
import { computed, ref } from 'vue';
import Modal from '@/components/layout/Modal.vue';
import { DREAM_STYLES } from '@/config/dreamStyles';
import * as api from '@/api/client';
import { itemsText, useOfferingsStore } from '@/stores/offerings';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const session = useSessionStore();
const offerings = useOfferingsStore();

const offeringId = computed(() => Number(ui.modalPayload.offeringId));
const item = computed(() => offerings.inbox.find((b) => b.id === offeringId.value));

const text = ref('');
const style = ref('plain');
const submitting = ref(false);

async function send() {
  const t = text.value.trim();
  if (!t || submitting.value) return;
  if (!session.ghostOut) {
    ui.toast('白天托不了梦，活人都醒着。');
    return;
  }
  submitting.value = true;
  try {
    await api.createDream(offeringId.value, { text: t, style: style.value as any });
    ui.closeModal();
    window.dispatchEvent(new CustomEvent('afterme:bell'));
    ui.toast('梦已托出。对方入睡后就能梦到。');
    await offerings.fetchInbox();
  } catch (e) {
    const msg =
      e instanceof api.ApiError && e.status === 409
        ? e.message
        : e instanceof api.ApiError
          ? e.message
          : api.DEFAULT_ERROR;
    ui.toast(msg, { err: true });
  } finally {
    submitting.value = false;
  }
}

function offeringItems(b: NonNullable<typeof item.value>) {
  if (Array.isArray(b.items)) {
    const o: Record<string, number> = {};
    for (const i of b.items) o[i.item_key] = i.qty;
    return o;
  }
  return b.items;
}
</script>

<template>
  <Modal @close="ui.closeModal()">
    <h2>托梦</h2>
    <p v-if="item" class="sub">
      回给「{{ item.from_name || '一位路过的活人' }}」：TA 烧了
      {{ itemsText(offeringItems(item))
      }}{{ item.message ? `，说：“${item.message}”` : '。' }}
    </p>
    <div class="field">
      <label for="dtext">梦里说什么</label>
      <textarea
        id="dtext"
        v-model="text"
        maxlength="120"
        placeholder="收到了，谢谢。这边挺好的，就是 Wi-Fi 不太行。"
      />
    </div>
    <div class="field">
      <span class="flabel">梦的气氛</span>
      <div class="chips">
        <button
          v-for="s in DREAM_STYLES"
          :key="s.k"
          class="chip"
          :class="{ on: style === s.k }"
          @click="style = s.k"
        >
          {{ s.name }}
        </button>
      </div>
    </div>
    <div class="mfoot">
      <button class="btn primary" :disabled="submitting" @click="send">入梦</button>
    </div>
  </Modal>
</template>
