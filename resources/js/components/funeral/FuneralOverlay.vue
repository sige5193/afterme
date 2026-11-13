<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import StepRegister from './StepRegister.vue';
import StepPick from './StepPick.vue';
import StepEpitaph from './StepEpitaph.vue';
import Ceremony from './Ceremony.vue';
import { COUPLETS, makeEulogy, VERDICTS } from '@/config/funeralText';
import { SPECIAL } from '@/config/specialPlots';
import { pick } from '@/utils/text';
import * as api from '@/api/client';
import { useCemeteryStore } from '@/stores/cemetery';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';
import type { StoneStyleKey } from '@/api/types';

const emit = defineEmits<{ close: [] }>();
const router = useRouter();
const session = useSessionStore();
const cemetery = useCemeteryStore();
const ui = useUiStore();

const step = ref(0);
const err = ref('');
const ceremonyRef = ref<InstanceType<typeof Ceremony> | null>(null);

const prev = session.tomb;
const taken = cemetery.occupiedPlots;
let plot = ui.funeralPrefill.plot ?? prev?.plot;
if (plot == null || (taken.has(plot) && plot !== prev?.plot)) {
  const specials = Object.keys(SPECIAL).map(Number);
  plot = specials.find((p) => !taken.has(p));
  if (plot == null) {
    plot = 0;
    while (taken.has(plot)) plot++;
  }
}

const F = reactive({
  name: prev?.name || '',
  birthYear: (prev?.birth_year as number | string) || '',
  cause: prev?.cause || '',
  portrait: prev?.portrait ?? 0,
  lastWords: prev?.last_words || '',
  style: (prev?.style || 'qingshi') as string,
  plot: plot as number,
  epitaph: prev?.epitaph || '',
  eulogy: '',
  verdict: '',
  couplet: Math.floor(Math.random() * COUPLETS.length),
  regNo: Math.random().toString().slice(2, 8),
});

const stepNames = ['登记', '选墓', '碑文', '出殡'];

function validateRegister(): boolean {
  const y = +F.birthYear;
  const now = new Date().getFullYear();
  err.value = !F.name
    ? '先写上名字，碑上要刻的。'
    : !(y >= 1900 && y <= now)
      ? `出生年份要在 1900 到 ${now} 之间。`
      : !F.cause
        ? '选一个死因，或者自己写一个。'
        : '';
  if (err.value) return false;
  F.birthYear = y;
  return true;
}

function next() {
  if (step.value === 0 && !validateRegister()) return;
  if (step.value === 2 && !F.epitaph.trim()) F.epitaph = '终于不用上班了';
  step.value++;
  if (step.value === 3) {
    F.eulogy = makeEulogy({
      name: F.name,
      birthYear: +F.birthYear,
      cause: F.cause,
      lastWords: F.lastWords,
    });
    F.verdict = pick(VERDICTS);
  }
}

function back() {
  if (step.value > 0) step.value--;
}

function close() {
  window.dispatchEvent(new CustomEvent('afterme:stop-sound'));
  ui.funeralOpen = false;
  emit('close');
  if (router.currentRoute.value.name === 'funeral') router.push('/');
}

async function save() {
  ceremonyRef.value?.setSaving(true);
  try {
    const res = await api.saveTomb({
      name: F.name,
      birth_year: +F.birthYear,
      cause: F.cause,
      portrait: F.portrait,
      last_words: F.lastWords || null,
      style: F.style as StoneStyleKey,
      plot: F.plot,
      epitaph: F.epitaph,
      eulogy: F.eulogy,
      verdict: F.verdict,
      couplet: F.couplet,
    });
    session.setTomb(res.tomb);
    cemetery.upsertListItem(res.tomb);
    await cemetery.fetchTombs();
    ui.funeralOpen = false;
    session.ghostPlot = null;

    const showCode = !!res.resurrect_code;
    if (showCode) {
      ui.openModal('resurrectCode', { code: res.resurrect_code });
    }

    const finishView = () => {
      session.applyPref();
      if (session.ghostOut) {
        ui.pref = 'cemetery';
        ui.toast('下葬完成。天已经黑了，出去转转吧。', {
          btn: '邀请烧纸',
          onBtn: () => ui.openModal('invite'),
          ms: 6000,
        });
      } else {
        ui.pref = 'coffin';
        ui.toast('下葬完成。现在是白天，先在棺材里躺着，18:00 天黑后可以出来。', {
          btn: '邀请烧纸',
          onBtn: () => ui.openModal('invite'),
          ms: 7000,
        });
      }
      if (router.currentRoute.value.name === 'funeral') router.push('/');
    };

    if (showCode) {
      // after modal closes, apply view — watch modal
      const stop = watch(
        () => ui.modal,
        (m) => {
          if (m !== 'resurrectCode') {
            stop();
            finishView();
          }
        },
      );
    } else {
      finishView();
    }
    emit('close');
  } catch (e) {
    if (e instanceof api.ApiError && e.status === 409) {
      ceremonyRef.value?.setSaveError(e.message || '这块刚被人占了');
      await cemetery.fetchTombs();
      step.value = 1;
      return;
    }
    ceremonyRef.value?.setSaveError(
      e instanceof api.ApiError ? e.message : api.DEFAULT_ERROR,
    );
  }
}
</script>

<template>
  <div class="fun" role="dialog" aria-label="葬礼">
    <div class="fun-top">
      <span class="brand" style="font-size: 24px">{{ step < 3 ? '葬礼筹备' : '追悼会' }}</span>
      <div class="steps">
        <span
          v-for="(n, i) in stepNames"
          :key="n"
          :class="{ on: i === step, done: i < step }"
          >{{ i + 1 }} {{ n }}</span
        >
      </div>
      <button class="x" aria-label="取消葬礼" @click="close">✕</button>
    </div>
    <div v-if="step < 3" class="fun-body">
      <StepRegister v-if="step === 0" v-model="F" v-model:err="err" @next="next" />
      <StepPick v-else-if="step === 1" v-model="F" @next="next" @back="back" />
      <StepEpitaph v-else-if="step === 2" v-model="F" @next="next" @back="back" />
    </div>
    <Ceremony
      v-else
      ref="ceremonyRef"
      :name="F.name"
      :portrait="F.portrait"
      :style="F.style"
      :epitaph="F.epitaph"
      :eulogy="F.eulogy"
      :verdict="F.verdict"
      :couplet="F.couplet"
      @save="save"
      @close="close"
    />
  </div>
</template>
