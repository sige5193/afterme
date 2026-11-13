import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { hhmm, isNightAt, shichen, untilNight } from '@/utils/time';
import { useDayNight } from '@/composables/useDayNight';

export const useClockStore = defineStore('clock', () => {
  const now = ref(new Date());
  let timer: ReturnType<typeof setInterval> | null = null;

  const dn = useDayNight(now);
  const isNight = computed(() => dn.isNight.value);
  const shichenLabel = computed(() => dn.shichenLabel.value);
  const clockText = computed(() => dn.clockText.value);
  const untilNightMs = computed(() => dn.untilNightMs.value);

  function tick() {
    now.value = new Date();
    dn.syncDataTime();
  }

  function start() {
    if (timer) return;
    tick();
    timer = setInterval(tick, 1000);
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  /** Apply server is_night as soft correction (still drive UI from local clock primarily) */
  function syncFromServer(isNightServer: boolean) {
    dn.setDataTime(isNightServer);
  }

  return {
    now,
    isNight,
    shichenLabel,
    clockText,
    untilNightMs,
    start,
    stop,
    tick,
    syncFromServer,
    hhmm,
    shichen,
    isNightAt,
    untilNight,
  };
});
