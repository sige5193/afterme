<script setup lang="ts">
import { computed, ref } from 'vue';
import Modal from '@/components/layout/Modal.vue';
import * as api from '@/api/client';
import { useCemeteryStore } from '@/stores/cemetery';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const session = useSessionStore();
const cemetery = useCemeteryStore();

const groupName = computed(
  () => String(ui.modalPayload.name || cemetery.groupDetail?.name || '这座合葬墓'),
);
const submitting = ref(false);

async function confirm() {
  if (submitting.value) return;
  submitting.value = true;
  try {
    const res = await api.leaveGroup();
    if (res.tomb) session.setTomb(res.tomb);
    cemetery.closeGroupDrawer();
    ui.closeModal();
    ui.toast(res.address ? `你回到了 ${res.address}，夜里可以迁坟换个地方。` : '已迁出合葬墓。');
  } catch (e) {
    ui.toast(e instanceof api.ApiError ? e.message : api.DEFAULT_ERROR, { err: true });
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Modal @close="ui.closeModal()">
    <h2>迁出合葬墓</h2>
    <p class="sub">
      迁出后，你的碑上会刻下「曾与 {{ groupName }} 合葬」，这座合葬墓的碑上也会留下你的名字。
    </p>
    <div class="mfoot">
      <button class="btn quiet" type="button" @click="ui.closeModal()">再躺会儿</button>
      <button class="btn primary" type="button" :disabled="submitting" @click="confirm">确认迁出</button>
    </div>
  </Modal>
</template>