<script setup lang="ts">
import { ref } from 'vue';
import Modal from '@/components/layout/Modal.vue';
import { EPITAPHS } from '@/config/epitaphs';
import * as api from '@/api/client';
import { useCemeteryStore } from '@/stores/cemetery';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const session = useSessionStore();
const cemetery = useCemeteryStore();

const text = ref(session.tomb?.epitaph || '');
const submitting = ref(false);

async function save() {
  const v = text.value.trim();
  if (!v || v === session.tomb?.epitaph) {
    ui.closeModal();
    return;
  }
  if (!session.ghostOut) {
    ui.toast('白天出不去，改不了碑文。');
    return;
  }
  submitting.value = true;
  try {
    const res = await api.patchEpitaph({ epitaph: v });
    session.setTomb(res.tomb);
    if (cemetery.detail?.id === res.tomb.id) cemetery.detail = res.tomb;
    cemetery.upsertListItem(res.tomb);
    ui.closeModal();
    ui.toast('刻好了。');
  } catch (e) {
    ui.toast(e instanceof api.ApiError ? e.message : api.DEFAULT_ERROR, { err: true });
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Modal @close="ui.closeModal()">
    <h2>改碑文</h2>
    <p class="sub">半夜蹲在自己坟前拿指甲刻。最多 40 个字。</p>
    <div class="field">
      <textarea id="eptext" v-model="text" maxlength="40" />
    </div>
    <div class="field">
      <span class="flabel">没灵感就抄一句</span>
      <div class="chips">
        <button v-for="e in EPITAPHS" :key="e" class="chip" @click="text = e">{{ e }}</button>
      </div>
    </div>
    <div class="mfoot">
      <button class="btn primary" :disabled="submitting" @click="save">刻上去</button>
    </div>
  </Modal>
</template>
