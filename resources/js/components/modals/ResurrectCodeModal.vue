<script setup lang="ts">
import { computed } from 'vue';
import Modal from '@/components/layout/Modal.vue';
import { formatResurrectCode } from '@/utils/resurrect';
import { copyText } from '@/utils/copy';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();

const raw = computed(() => String(ui.modalPayload.code || ''));
const display = computed(() => formatResurrectCode(raw.value));

async function copy() {
  const ok = await copyText(display.value);
  ui.toast(ok ? '已复制还魂码' : '浏览器不让复制，请手动选中上面的文字复制', { err: !ok });
}

function close() {
  ui.closeModal();
}
</script>

<template>
  <Modal @close="close">
    <h2>还魂码</h2>
    <p class="sub">
      请抄下你的还魂码，换手机或清了浏览器时用它回到自己的坟里。这串码只展示这一次。
    </p>
    <div class="copybox" style="font-family: var(--font-cyber); letter-spacing: 0.08em; font-size: 18px">
      {{ display }}
    </div>
    <div class="mfoot">
      <button class="btn" @click="copy">复制</button>
      <button class="btn primary" @click="close">我记下了</button>
    </div>
  </Modal>
</template>
