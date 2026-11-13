<script setup lang="ts">
import { ref } from 'vue';
import Modal from '@/components/layout/Modal.vue';
import * as api from '@/api/client';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const session = useSessionStore();
const submitting = ref(false);

async function go() {
  submitting.value = true;
  try {
    const res = await api.zhashi();
    session.patchTomb({
      zhashi_count: res.zhashi_count,
      zhashi_until: res.zhashi_until,
    });
    session.ghostOutServer = true;
    ui.closeModal();
    ui.pref = 'cemetery';
    session.ghostPlot = null;
    window.dispatchEvent(new CustomEvent('afterme:whoosh'));
    ui.toast('你诈尸了。抓紧时间，10 分钟后会被晒回棺材。');
  } catch (e) {
    ui.toast(e instanceof api.ApiError ? e.message : api.DEFAULT_ERROR, { err: true });
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Modal @close="ui.closeModal()">
    <h2>诈尸</h2>
    <p class="sub">
      大白天强行出棺，能在墓园里待 10 分钟。阳气会灼烧你，而且<b>这次诈尸会被刻在墓碑上</b>，路过的人都看得见。
    </p>
    <div class="mfoot">
      <button class="btn" @click="ui.closeModal()">算了，接着躺</button>
      <button class="btn seal" :disabled="submitting" @click="go">诈！</button>
    </div>
  </Modal>
</template>
