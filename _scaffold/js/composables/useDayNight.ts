import { computed, type MaybeRefOrGetter, toValue, type ComputedRef } from 'vue';
import {
  hhmm,
  isNightAt,
  shichen,
  untilNight,
} from '../utils/time';

export type DayNightLabel = 'day' | 'night';

/**
 * 按时钟判断昼夜，并把 `data-time="day"|"night"` 挂到 `<html>`（不用 body.day）。
 */
export function useDayNight(clock: MaybeRefOrGetter<Date>) {
  const isNight: ComputedRef<boolean> = computed(() => isNightAt(toValue(clock)));

  const timeLabel = computed<DayNightLabel>(() => (isNight.value ? 'night' : 'day'));

  const shichenLabel = computed(() => shichen(toValue(clock)));

  const clockText = computed(() => hhmm(toValue(clock)));

  const untilNightMs = computed(() => untilNight(toValue(clock)));

  /** 同步 document.documentElement 的 data-time */
  function setDataTime(night?: boolean) {
    const n = night ?? isNight.value;
    document.documentElement.dataset.time = n ? 'night' : 'day';
  }

  /** 根据当前 clock 刷新 data-time */
  function syncDataTime() {
    setDataTime(isNightAt(toValue(clock)));
  }

  return {
    isNight,
    timeLabel,
    shichenLabel,
    clockText,
    untilNightMs,
    setDataTime,
    syncDataTime,
    // re-export helpers for callers that want the raw utils via this composable
    isNightAt,
    shichen,
    untilNight,
    hhmm,
  };
}
