<script setup lang="ts">
import { computed } from 'vue';
import Modal from '@/components/layout/Modal.vue';
import { address } from '@/utils/time';
import { copyText } from '@/utils/copy';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';

const session = useSessionStore();
const ui = useUiStore();

const text = computed(() => {
  const t = session.tomb;
  if (!t) return '';
  const p = t.plot;
  return `我在「不活了」提前死了一下，坟在${address(p)}，死因「${t.cause}」。来给我烧点纸：https://afterme.space/t/${t.code} ，我晚上会托梦回你。`;
});

async function copy() {
  const ok = await copyText(text.value);
  ui.toast(ok ? '复制好了，去发给朋友吧' : '浏览器不让复制，请手动选中上面的文字复制', {
    err: !ok,
  });
}
</script>

<template>
  <Modal @close="ui.closeModal()">
    <h2>邀请烧纸</h2>
    <p class="sub">让朋友找到你的坟。</p>
    <div class="field">
      <span class="flabel">可以直接发的话</span>
      <div class="copybox">{{ text }}</div>
    </div>
    <div class="mfoot">
      <button class="btn primary" @click="copy">复制这段话</button>
    </div>
  </Modal>
</template>
