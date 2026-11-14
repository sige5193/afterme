<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import Modal from '@/components/layout/Modal.vue';
import { ITEMS } from '@/config/items';
import * as api from '@/api/client';
import { itemsText } from '@/stores/offerings';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const session = useSessionStore();

const code = computed(() => String(ui.modalPayload.code || ''));
const name = computed(() => String(ui.modalPayload.name || ''));
const own = computed(() => !!ui.modalPayload.own);

const cart = reactive<Record<string, number>>({});
const message = ref('');
const fromName = ref(
  session.tomb ? `${session.tomb.name}（鬼）` : localStorage.getItem('afterme:fromName') || '',
);
const submitting = ref(false);

const total = computed(() => Object.values(cart).reduce((a, b) => a + b, 0));
const sumText = computed(() =>
  total.value ? `共 ${total.value} 件 · ${itemsText({ ...cart })}` : '还没挑东西',
);

function add(k: string) {
  cart[k] = Math.min(99, (cart[k] || 0) + 1);
}
function sub(k: string) {
  cart[k] = Math.max(0, (cart[k] || 0) - 1);
  if (!cart[k]) delete cart[k];
}

async function fire() {
  if (!total.value || submitting.value) return;
  submitting.value = true;
  const items = { ...cart };
  const msg = message.value.trim();
  const fn = fromName.value.trim() || '一位路过的活人';
  const tombCode = code.value;
  const tombName = name.value;
  const isOwn = own.value;
  if (!tombCode) {
    submitting.value = false;
    ui.toast(api.DEFAULT_ERROR, { err: true });
    return;
  }
  if (!session.tomb) {
    try {
      localStorage.setItem('afterme:fromName', fromName.value.trim());
    } catch {
      /* ignore */
    }
  }
  ui.closeModal();
  ui.burnOverlay = { items, name: tombName };
  try {
    await api.createOffering(tombCode, {
      items,
      message: msg || null,
      from_name: fn,
    });
    // burn overlay finishes separately; toast after overlay closes via App
    (window as any).__aftermePendingBurnToast = isOwn
      ? '烧给自己了。去香火簿里给自己托个梦吧。'
      : `已送达 ${tombName}。TA 白天躺在棺材里，天黑后会出来看；有回音会托梦给你，留意顶栏的「我的梦」。`;
  } catch (e) {
    ui.burnOverlay = null;
    ui.toast(e instanceof api.ApiError ? e.message : api.DEFAULT_ERROR, { err: true });
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Modal @close="ui.closeModal()">
    <h2>{{ own ? '给自己烧点' : '给' + name + '烧纸' }}</h2>
    <p class="sub">
      {{
        own
          ? '自力更生，丰衣足食。'
          : name + '之墓。挑点东西，写句话，点火就送到。'
      }}
    </p>
    <div class="items">
      <div v-for="i in ITEMS" :key="i.k" class="iw">
        <button class="item" :class="{ on: cart[i.k] }" @click="add(i.k)">
          <span class="ic">{{ i.icon }}</span>
          <span class="nm">{{ i.name }}</span>
          <span class="nt">{{ i.note }}</span>
        </button>
        <template v-if="cart[i.k]">
          <span class="badge cnt">{{ cart[i.k] }}</span>
          <button class="minus" aria-label="少烧一件" @click.stop="sub(i.k)">−</button>
        </template>
      </div>
    </div>
    <div class="field">
      <label for="bmsg">想说的话</label>
      <textarea
        id="bmsg"
        v-model="message"
        maxlength="120"
        placeholder="最近挺好的，就是有点想你。下面 Wi-Fi 怎么样？"
      />
    </div>
    <div class="field">
      <label for="bname">落款</label>
      <input
        id="bname"
        v-model="fromName"
        type="text"
        maxlength="12"
        placeholder="不填就是「一位路过的活人」"
      />
    </div>
    <div class="mfoot">
      <span class="why" style="margin-right: auto">{{ sumText }}</span>
      <button class="btn primary" :disabled="!total || submitting" @click="fire">点火</button>
    </div>
  </Modal>
</template>
