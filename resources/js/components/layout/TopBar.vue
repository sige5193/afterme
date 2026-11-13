<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useClockStore } from '@/stores/clock';
import { usePulseStore } from '@/stores/pulse';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';

const clock = useClockStore();
const session = useSessionStore();
const pulse = usePulseStore();
const ui = useUiStore();
const router = useRouter();

const whoHtml = computed(() => {
  if (session.tomb) return `亡魂 · <b>${session.tomb.name}</b>`;
  if (session.ready) return '活人';
  return '';
});

function openFuneral() {
  ui.funeralPrefill = {};
  ui.funeralOpen = true;
  router.push('/funeral');
}
</script>

<template>
  <header class="top">
    <div class="brand">不活了<small>先死为敬</small></div>
    <div class="clock">
      <b>{{ clock.shichenLabel }}</b>
      <span>{{ clock.clockText }}</span>
      <span>{{ clock.isNight ? '夜 · 阴气重' : '昼 · 阳气旺' }}</span>
    </div>
    <div class="who" v-html="whoHtml" />
    <div class="spacer" />
    <div class="acts" id="topacts">
      <template v-if="session.tomb">
        <button class="btn" @click="ui.openModal('inbox')">
          香火簿
          <span v-if="pulse.pendingDreamsCount" class="badge">{{ pulse.pendingDreamsCount }}</span>
        </button>
      </template>
      <template v-else>
        <button class="btn primary" :disabled="!session.ready" @click="openFuneral">办葬礼</button>
      </template>
      <button class="btn" @click="ui.openModal('dreams')">
        我的梦
        <span v-if="pulse.unreadDreamsCount" class="badge">{{ pulse.unreadDreamsCount }}</span>
      </button>
      <button
        class="btn quiet"
        :aria-pressed="ui.sound"
        @click="ui.toggleSound()"
      >
        {{ ui.sound ? '声音：开' : '声音：关' }}
      </button>
    </div>
    <div class="net" />
  </header>
</template>
