/**
 * 匿名身份、自己的坟、出棺状态（替代原来的 session store）。
 */

import * as api from '@/api/client';
import type { MeResponse, Tomb } from '@/api/types';
import { emit } from './bus';
import { isNight } from './clock';
import { state, type Pref } from './state';
import { toast } from './ui';

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';
  } catch {
    return 'Asia/Shanghai';
  }
}

export function zhashiActive(): boolean {
  const until = state.tomb?.zhashi_until;
  return !!until && new Date(until).getTime() > Date.now();
}

/** 能不能出棺：有坟，并且夜里或者正在诈尸。以服务器为准，本地时钟补两次轮询之间的空档。 */
export function ghostOut(): boolean {
  if (!state.tomb) return false;
  if (state.ghostOutServer) return true;
  if (zhashiActive()) return true;
  return isNight();
}

/** 自己现在以什么样子出现在地图上 */
export function avatarKind(): 'ghost' | 'soul' | 'living' {
  if (!state.tomb) return 'living';
  return ghostOut() ? 'ghost' : 'soul';
}

export function inCoffin(): boolean {
  return !!state.tomb && state.pref === 'coffin';
}

export function setPref(pref: Pref): void {
  if (state.pref === pref) return;
  state.pref = pref;
  emit('session');
}

/** 白天有坟 → 躺棺材；其余在外面 */
export function applyPref(): void {
  state.pref = state.tomb && !ghostOut() ? 'coffin' : 'cemetery';
  emit('session');
}

export function setFromMe(me: MeResponse): void {
  state.user = me.user;
  state.tomb = me.tomb;
  state.group = me.group;
  state.isNightServer = me.is_night;
  state.ghostOutServer = me.ghost_out;
  emit('session');
}

export function setTomb(t: Tomb | null): void {
  state.tomb = t;
  if (!t?.group) state.group = null;
  emit('session');
}

export function patchTomb(partial: Partial<Tomb>): void {
  if (!state.tomb) return;
  state.tomb = { ...state.tomb, ...partial };
  emit('session');
}

export async function refreshMe(): Promise<void> {
  try {
    setFromMe(await api.me(browserTimezone()));
  } catch {
    /* 下一次轮询会补上 */
  }
}

/** 启动：有令牌就 /me，没有或失效就 /enter 领一个新的匿名身份 */
export async function bootstrap(): Promise<void> {
  const tz = browserTimezone();
  if (api.getToken()) {
    try {
      setFromMe(await api.me(tz));
      state.ready = true;
      applyPref();
      return;
    } catch (e) {
      if (!(e instanceof api.ApiError) || e.status !== 401) throw e;
    }
  }
  const entered = await api.enter({ timezone: tz });
  api.setToken(entered.token);
  state.user = entered.user;
  state.tomb = null;
  state.group = null;
  try {
    setFromMe(await api.me(tz));
  } catch {
    /* 拿到令牌就够了 */
  }
  state.ready = true;
  applyPref();
}

export async function resurrectWithCode(code: string): Promise<void> {
  const res = await api.resurrect({ code });
  api.setToken(res.token);
  state.user = res.user;
  setFromMe(await api.me(browserTimezone()));
  applyPref();
  toast('还魂成功，欢迎回来。');
}

export async function regenerateCode(): Promise<string> {
  const res = await api.regenerateResurrectCode();
  return res.resurrect_code;
}

export function isOwnTomb(code: string | null | undefined): boolean {
  return !!code && state.tomb?.code === code;
}

export function myGroupCode(): string | null {
  return state.group?.code ?? state.tomb?.group?.code ?? null;
}
