<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { address, mmss } from '@/utils/time';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';
import { useClockStore } from '@/stores/clock';

const emit = defineEmits<{
  goMine: [];
  sleep: [];
  invite: [];
}>();

const session = useSessionStore();
const ui = useUiStore();
const clock = useClockStore();

const zsLeft = ref('');

const zhashiActive = computed(() => {
  const t = session.tomb;
  if (!t?.zhashi_until) return false;
  return new Date(t.zhashi_until).getTime() > Date.now();
});

const myAddress = computed(() => address(session.tomb?.plot ?? 0));

function tickZs() {
  const t = session.tomb;
  if (!t?.zhashi_until) {
    zsLeft.value = '';
    return;
  }
  zsLeft.value = mmss(new Date(t.zhashi_until).getTime() - Date.now());
}

let timer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  tickZs();
  timer = setInterval(tickZs, 1000);
});
onUnmounted(() => {
  if (timer) clearInterval(timer);
});
watch(() => clock.now, tickZs);
</script>

<template>
  <div class="ghostbar">
    <span class="gb-t">{{ zhashiActive ? '诈尸中' : '夜游中' }}</span>
    <span class="gb-d">
      方向键或点墓碑移动，走到别人坟前可以串门烧纸。你的坟在{{ myAddress }}。
    </span>
    <span v-if="zhashiActive" class="zs">诈尸中 · 阳气灼烧 · 还剩 <span>{{ zsLeft }}</span></span>
    <span class="acts">
      <button class="btn sm" @click="emit('goMine')">回我的坟</button>
      <button class="btn sm" @click="emit('invite')">邀请烧纸</button>
      <button class="btn sm" @click="emit('sleep')">回棺材</button>
    </span>
  </div>
</template>
