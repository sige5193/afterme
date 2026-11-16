/**
 * 本地时钟：每秒 tick 一次，用于倒计时和昼夜切换；以服务器 pulse 返回的 is_night 为准纠偏。
 */

import { emit } from './bus';
import { state } from './state';
import { hhmm, isNightAt, shichen, untilNight } from '@/utils/time';

let now = new Date();
let lastNight: boolean | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

export function clockNow(): Date {
  return now;
}

/** 按服务器时间算的「现在」（毫秒） */
export function serverNow(): number {
  return Date.now() + state.serverSkew;
}

/** 画面上的昼夜跟着本地时钟走；能不能出棺以服务器为准（见 session.ghostOut） */
export function isNight(): boolean {
  return isNightAt(now);
}

export function shichenLabel(): string {
  return shichen(now);
}

export function clockText(): string {
  return hhmm(now);
}

export function untilNightMs(): number {
  return untilNight(now);
}

function tick(): void {
  now = new Date();
  const night = isNightAt(now);
  if (lastNight !== night) {
    lastNight = night;
    emit('daynight', night);
  }
  emit('clock');
}

export function startClock(): void {
  if (timer) return;
  tick();
  timer = setInterval(tick, 1000);
}
