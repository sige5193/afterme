<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue';
import { FACES } from '@/config/faces';
import { COUPLETS } from '@/config/funeralText';
import Portrait from '@/components/tomb/Portrait.vue';
import StoneMini from '@/components/tomb/StoneMini.vue';
import { REDUCED, sleep } from '@/utils/text';

const props = defineProps<{
  name: string;
  portrait: number;
  style: string;
  epitaph: string;
  eulogy: string;
  verdict: string;
  couplet: number;
}>();

const emit = defineEmits<{ save: []; close: [] }>();

const scene = ref(0);
const bows = ref(0);
const cd = ref(3);
const eulText = ref('');
const typing = ref(false);
const lidClosed = ref(false);
const verdictIn = ref(false);
const buried = ref(false);
const filled = ref(false);
const bowing = ref(false);
const saveErr = ref('');
const saving = ref(false);
const btnLabel = ref('');

const [cr, cl, cb] = COUPLETS[props.couplet] || COUPLETS[0]!;

async function runSilence() {
  window.dispatchEvent(new CustomEvent('afterme:dirge'));
  for (let i = 3; i >= 1; i--) {
    cd.value = i;
    await sleep(1000);
    if (scene.value !== 1) return;
  }
  if (scene.value !== 1) return;
  scene.value = 2;
  await nextTick();
  typeEulogy();
}

async function typeEulogy() {
  typing.value = true;
  eulText.value = '';
  if (REDUCED) {
    eulText.value = props.eulogy;
    typing.value = false;
    return;
  }
  let i = 0;
  while (typing.value && i <= props.eulogy.length) {
    eulText.value = props.eulogy.slice(0, i);
    i += 2;
    await sleep(45);
  }
  typing.value = false;
}

function nextFrom0() {
  window.dispatchEvent(new CustomEvent('afterme:gong'));
  scene.value = 1;
  runSilence();
}

function nextFrom2() {
  if (typing.value) {
    typing.value = false;
    eulText.value = props.eulogy;
    return;
  }
  scene.value = 3;
}

function bow() {
  window.dispatchEvent(new CustomEvent('afterme:muyu'));
  bows.value++;
  bowing.value = true;
  setTimeout(() => {
    bowing.value = false;
    if (bows.value >= 3) setTimeout(() => (scene.value = 4), 500);
  }, 650);
}

function lid() {
  lidClosed.value = true;
  window.dispatchEvent(new CustomEvent('afterme:knock-sound'));
  btnLabel.value = '';
  setTimeout(() => {
    verdictIn.value = true;
    window.dispatchEvent(new CustomEvent('afterme:muyu'));
    btnLabel.value = '下葬';
  }, 1700);
}

async function bury() {
  scene.value = 5;
  await sleep(300);
  buried.value = true;
  window.dispatchEvent(new CustomEvent('afterme:whoosh'));
  await sleep(2000);
  filled.value = true;
  await sleep(2200);
  if (scene.value !== 5) return;
  window.dispatchEvent(new CustomEvent('afterme:stop-sound'));
  window.dispatchEvent(new CustomEvent('afterme:gong'));
  (window as any).__aftermeJoss?.burst?.(90);
  scene.value = 6;
}

function onAction() {
  if (scene.value === 0) nextFrom0();
  else if (scene.value === 2) nextFrom2();
  else if (scene.value === 3) bow();
  else if (scene.value === 4) {
    if (btnLabel.value === '下葬') bury();
    else lid();
  } else if (scene.value === 6) emit('save');
}

defineExpose({
  setSaveError(msg: string) {
    saveErr.value = msg;
    saving.value = false;
  },
  setSaving(v: boolean) {
    saving.value = v;
  },
});
</script>

<template>
  <div class="hall">
    <div class="hbanner">{{ cb }}</div>
    <div class="couplet r">{{ cr }}</div>
    <div class="couplet l">{{ cl }}</div>

    <template v-if="scene === 0 || scene === 1 || scene === 3">
      <div class="stage" :class="{ bowing }">
        <div class="altar">
          <span class="rosette" />
          <Portrait :portrait="portrait" big />
          <div class="nm">{{ name }}</div>
        </div>
        <div class="candles"><span class="candle" /><span class="candle" /></div>
      </div>
      <div v-if="scene === 1" class="countdown">{{ cd }}</div>
      <div v-if="scene === 3" class="bowcount">
        {{ ['', '一鞠躬', '二鞠躬', '三鞠躬'][bows] || '　' }}
      </div>
    </template>

    <div v-if="scene === 2" class="eulogy">{{ eulText }}</div>

    <div
      v-if="scene === 4"
      class="coffin"
      id="cof"
      :class="{ closed: lidClosed }"
    >
      <div class="cb" />
      <div class="ci"><span class="face">{{ FACES[portrait] }}</span></div>
      <div class="lid">寿</div>
      <div class="verdict" :class="{ in: verdictIn }">
        <small>盖棺定论</small>{{ verdict }}
      </div>
    </div>

    <div
      v-if="scene === 5 || scene === 6"
      class="grave"
      :class="{ filled: filled || scene === 6 }"
      id="grv"
    >
      <div
        v-if="scene === 5"
        class="coffin closed"
        :class="{ buried }"
        id="cof"
      >
        <div class="cb" />
        <div class="ci" />
        <div class="lid">寿</div>
      </div>
      <div class="dirt" />
      <div class="newstone">
        <StoneMini :name="name" :style="style" />
      </div>
    </div>

    <div class="host">
      <template v-if="scene === 0"
        ><b>主持人：</b>{{ name }}同志追悼会，现在开始。请全体起立。</template
      >
      <template v-else-if="scene === 1"><b>主持人：</b>默哀三秒。</template>
      <template v-else-if="scene === 2"><b>主持人：</b>下面宣读悼词。</template>
      <template v-else-if="scene === 3"><b>主持人：</b>向遗体三鞠躬。</template>
      <template v-else-if="scene === 4">
        <b>主持人：</b>
        {{
          verdictIn
            ? '盖棺定论：' + verdict + '。'
            : lidClosed
              ? '盖棺。'
              : '瞻仰遗容。最后看一眼。'
        }}
      </template>
      <template v-else-if="scene === 5"><b>主持人：</b>入土为安。</template>
      <template v-else-if="scene === 6">
        <b>主持人：</b>礼成。{{ name }}，一路走好。<br />
        <span style="color: #a6a192; font-size: 14px">{{ epitaph }}</span>
      </template>
    </div>

    <div style="display: flex; flex-direction: column; align-items: center; gap: 6px">
      <button
        v-if="scene === 0"
        class="btn primary"
        @click="onAction"
      >
        全体起立
      </button>
      <button v-else-if="scene === 2" class="btn primary" @click="onAction">念完了</button>
      <button
        v-else-if="scene === 3"
        class="btn primary"
        :disabled="bowing"
        @click="onAction"
      >
        鞠躬（{{ bows }}/3）
      </button>
      <button
        v-else-if="scene === 4"
        class="btn primary"
        @click="onAction"
      >
        {{ btnLabel || '盖棺' }}
      </button>
      <template v-else-if="scene === 6">
        <button class="btn primary" :disabled="saving" @click="onAction">
          {{ saving ? '正在登记户口…' : '入住新家' }}
        </button>
        <div class="err-line">{{ saveErr }}</div>
      </template>
    </div>
  </div>
</template>
