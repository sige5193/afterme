<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { ago } from '@/utils/time';
import { REDUCED, sleep } from '@/utils/text';
import { useClockStore } from '@/stores/clock';
import { useUiStore } from '@/stores/ui';

const props = defineProps<{
  text: string;
  style: string;
  fromName: string;
  at: number;
  id: string | number;
}>();
const emit = defineEmits<{ close: [] }>();
const clock = useClockStore();
const ui = useUiStore();
const ready = ref(false);
const lids = ref(false);
const sleepTxt = ref(false);

const palette = computed(() => {
  const map: Record<string, string[]> = {
    plain: ['#3b2a63', '#1d3d5c', '#0a0814'],
    warm: ['#6b3d1e', '#5c3b55', '#140a06'],
    scary: ['#5a0b0b', '#2a0606', '#0d0303'],
    mystic: ['#0f4d3a', '#2b2a63', '#050d0a'],
  };
  return map[props.style] || map.plain;
});

const chars = computed(() => [...props.text]);
const endDelay = computed(() => 0.6 + chars.value.length * 0.07 + 0.6);

const lotto = computed(() => {
  if (props.style !== 'mystic') return '';
  let seed = [...String(props.id)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296;
  const nums = new Set<number>();
  while (nums.size < 6) nums.add(1 + Math.floor(rnd() * 33));
  const bonus = String(1 + Math.floor(rnd() * 16)).padStart(2, '0');
  return [...nums]
    .sort((a, b) => a - b)
    .map((n) => String(n).padStart(2, '0'))
    .join(' ') + ' + ' + bonus;
});

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') close();
}

onMounted(async () => {
  addEventListener('keydown', onKey);
  window.dispatchEvent(new CustomEvent('afterme:bell'));
  if (!clock.isNight && !REDUCED) {
    lids.value = true;
    await sleep(30);
    document.body.classList.add('lids-closed');
    ui.lidsClosing = true;
    sleepTxt.value = true;
    await sleep(2300);
    ready.value = true;
    sleepTxt.value = false;
    document.body.classList.remove('lids-closed');
    ui.lidsClosing = false;
    await sleep(1300);
    lids.value = false;
  } else {
    ready.value = true;
  }
});

onUnmounted(() => {
  removeEventListener('keydown', onKey);
  document.body.classList.remove('lids-closed');
});

function close() {
  emit('close');
}
</script>

<template>
  <Teleport to="body">
    <div v-if="lids" class="lid-top" />
    <div v-if="lids" class="lid-bot" />
    <div v-if="sleepTxt" class="sleeptxt" :class="{ in: sleepTxt }">白天做不了梦，先眯一会儿……</div>
    <div
      v-if="ready"
      class="dream"
      :class="style"
      :style="{ background: palette[2] }"
    >
      <div
        class="blob"
        :style="{ width: '420px', height: '420px', left: '-80px', top: '-60px', background: palette[0] }"
      />
      <div
        class="blob"
        :style="{
          width: '520px',
          height: '520px',
          right: '-120px',
          bottom: '-140px',
          background: palette[1],
          animationDelay: '-6s',
        }"
      />
      <div class="card">
        <div class="kicker">你做了一个梦</div>
        <div class="txt">
          <span
            v-for="(c, i) in chars"
            :key="i"
            :style="{ animationDelay: 0.6 + i * 0.07 + 's' }"
            >{{ c === ' ' ? '\u00a0' : c }}</span
          >
        </div>
        <div class="sig" :style="{ animationDelay: endDelay + 's' }">
          —— {{ fromName }} 托梦 · {{ ago(at) }}
        </div>
        <div
          v-if="lotto"
          class="lotto"
          :style="{ animationDelay: endDelay + 0.4 + 's' }"
        >
          梦里的数字：{{ lotto }}<br />
          <small style="font-family: var(--font-body); font-size: 12px; letter-spacing: 0; color: #9fbfae"
            >仅供娱乐，阴间不负责兑奖</small
          >
        </div>
        <button class="btn wake" :style="{ animationDelay: endDelay + 0.8 + 's' }" @click="close">
          醒来
        </button>
      </div>
    </div>
  </Teleport>
</template>
