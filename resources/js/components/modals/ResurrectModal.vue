<script setup lang="ts">
import { ref } from 'vue';
import Modal from '@/components/layout/Modal.vue';
import * as api from '@/api/client';
import { useCemeteryStore } from '@/stores/cemetery';
import { usePulseStore } from '@/stores/pulse';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const session = useSessionStore();
const cemetery = useCemeteryStore();
const pulse = usePulseStore();

const code = ref('');
const submitting = ref(false);
const err = ref('');

async function submit() {
  err.value = '';
  submitting.value = true;
  try {
    await session.resurrectWithCode(code.value);
    pulse.reset();
    await cemetery.fetchZones();
    ui.closeModal();
  } catch (e) {
    err.value =
      e instanceof api.ApiError
        ? e.message || '这串还魂码对不上'
        : api.DEFAULT_ERROR;
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Modal @close="ui.closeModal()">
    <h2>还魂</h2>
    <p class="sub">输入还魂码，回到自己的坟里。前缀「黄泉-」可省略。</p>
    <div class="field">
      <label for="rcode">还魂码</label>
      <input
        id="rcode"
        v-model="code"
        type="text"
        placeholder="黄泉-XXXX-XXXX-XXXX-XXXX"
        @keydown.enter="submit"
      />
    </div>
    <div v-if="err" class="err-line">{{ err }}</div>
    <div class="mfoot">
      <button class="btn primary" :disabled="submitting || !code.trim()" @click="submit">
        还魂
      </button>
    </div>
  </Modal>
</template>
