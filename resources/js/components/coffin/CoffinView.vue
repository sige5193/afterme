<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import OfferingList from './OfferingList.vue';
import { GHOST_SVG } from '@/config/faces';
import { address, fmtDur, hhmm, shichen, untilNight } from '@/utils/time';
import { REDUCED } from '@/utils/text';
import * as api from '@/api/client';
import { useOfferingsStore } from '@/stores/offerings';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';
import { useClockStore } from '@/stores/clock';

const session = useSessionStore();
const offerings = useOfferingsStore();
const ui = useUiStore();
const clock = useClockStore();

const cvbox = ref<HTMLElement | null>(null);
const leftText = ref('');
let knockPending = 0;
let knockTimer: ReturnType<typeof setTimeout> | null = null;
let knockWriting = false;

const night = computed(() => clock.isNight);
const out = computed(() => session.ghostOut);

const motes = computed(() => {
  if (REDUCED) return [] as { left: string; top: string; delay: string }[];
  return Array.from({ length: 9 }, (_, i) => ({
    left: `${38 + Math.random() * 24}%`,
    top: `${30 + Math.random() * 30}px`,
    delay: `${-i * 1.1}s`,
  }));
});

function tickLeft() {
  leftText.value = fmtDur(untilNight(clock.now));
}

function knock() {
  window.dispatchEvent(new CustomEvent('afterme:knock-sound'));
  if (cvbox.value) {
    cvbox.value.classList.remove('shake');
    void cvbox.value.offsetWidth;
    cvbox.value.classList.add('shake');
  }
  knockPending++;
  clearTimeout(knockTimer!);
  knockTimer = setTimeout(flushKnocks, 1500);
}

async function flushKnocks() {
  if (knockWriting || !knockPending || !session.tomb) return;
  knockWriting = true;
  const n = knockPending;
  knockPending = 0;
  try {
    const res = await api.knock({ count: n });
    session.patchTomb({ knock_count: res.knock_count, last_knock_at: res.last_knock_at });
  } catch {
    /* ignore */
  }
  knockWriting = false;
  if (knockPending) flushKnocks();
}

function flip() {
  ui.flipped = !ui.flipped;
  ui.toast(ui.flipped ? '你翻了个身，现在脸朝下。' : '又翻回来了。');
}

function wealth() {
  ui.openModal('wealth');
}

function goOut() {
  ui.pref = 'cemetery';
  session.ghostPlot = null;
  window.dispatchEvent(new CustomEvent('afterme:whoosh'));
}

function zhashi() {
  ui.openModal('zhashi');
}

let leftTimer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  tickLeft();
  void offerings.fetchInbox();
  leftTimer = setInterval(tickLeft, 1000);
});

onUnmounted(() => {
  if (leftTimer) clearInterval(leftTimer);
});
</script>

<template>
  <section v-if="session.tomb" class="coffinview" :class="{ 'cv-night': night }">
    <div class="cv-box" id="cvbox" ref="cvbox">
      <div class="crack" />
      <div class="beam" />
      <span
        v-for="(m, i) in motes"
        :key="i"
        class="mote"
        :style="{ left: m.left, top: m.top, animationDelay: m.delay }"
      />
      <div class="cv-status">
        <div class="cv-title">{{ night ? '天黑了' : '棺材里' }}</div>
        <div class="cv-sub">
          <template v-if="night">外面安静下来了，可以推开棺材板出去遛遛。</template>
          <template v-else>
            阳间 <b>{{ hhmm(clock.now) }}</b> · {{ shichen(clock.now) }} · 阳气太重，出不去。<br />
            距天黑还有 <b>{{ leftText }}</b>（18:00 出棺）
          </template>
        </div>
      </div>
      <div class="sleeper" :class="{ flipped: ui.flipped }">
        <div class="ghost-lie" v-html="GHOST_SVG" />
        <span class="zzz">z z z</span>
      </div>
      <div class="cv-actions">
        <button class="btn" @click="knock">敲棺材板</button>
        <button class="btn" @click="flip">翻个身</button>
        <button class="btn" @click="wealth">数数家当</button>
        <button v-if="out" class="btn primary" @click="goOut">推开棺材板，出去溜达</button>
        <button v-else class="btn seal" @click="zhashi">诈尸（白天强行出棺）</button>
      </div>
      <div class="cv-stats">
        敲过 <span>{{ (session.tomb.knock_count || 0) + knockPending }}</span> 次棺材板 · 诈尸
        {{ session.tomb.zhashi_count || 0 }} 次 · 墓址 {{ address(session.tomb.plot) }}
      </div>
    </div>
    <aside class="cv-side">
      <h3>上面的动静 <span>{{ offerings.inbox.length }} 次</span></h3>
      <p class="hint">
        {{
          out
            ? '可以托梦回复了。活人睡着以后就能梦到。'
            : '隔着棺材板听得见，但白天活人不睡觉，托梦要等天黑。点模糊的字可以贴着板子听清楚。'
        }}
      </p>
      <OfferingList :list="offerings.inbox" :muffle="!out" :can-reply="out" />
    </aside>
  </section>
</template>
