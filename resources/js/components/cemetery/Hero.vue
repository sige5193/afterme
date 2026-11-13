<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';
import { REDUCED } from '@/utils/text';

const emit = defineEmits<{ scrollYard: [] }>();
const session = useSessionStore();
const ui = useUiStore();
const router = useRouter();

function openFuneral() {
  ui.funeralPrefill = {};
  ui.funeralOpen = true;
  router.push('/funeral');
}

function openResurrect() {
  ui.openModal('resurrect');
}
</script>

<template>
  <section class="hero">
    <h1>先死<span>为敬</span></h1>
    <p>
      在这里给自己提前办一场葬礼。之后亲友来坟前烧纸、留话；你<b>白天躺在棺材里</b>，<b>天黑出来溜达</b>，看看谁来过，再<b>托个梦</b>回去。
    </p>
    <div class="row">
      <button class="btn primary" :disabled="!session.ready" @click="openFuneral">
        办一场我的葬礼
      </button>
      <button class="btn" @click="emit('scrollYard')">我是活人，来扫墓</button>
    </div>
    <p style="margin-top: 14px; font-size: 13px">
      <button class="btn quiet" style="padding: 0; border: 0" @click="openResurrect">
        我死过，回到我的坟
      </button>
    </p>
  </section>
</template>
