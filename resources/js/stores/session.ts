import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import * as api from '@/api/client';
import type { Tomb, User } from '@/api/types';
import { useClockStore } from './clock';
import { useUiStore } from './ui';

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';
  } catch {
    return 'Asia/Shanghai';
  }
}

export const useSessionStore = defineStore('session', () => {
  const user = ref<User | null>(null);
  const tomb = ref<Tomb | null>(null);
  const ready = ref(false);
  const bootstrapping = ref(false);
  const ghostOutServer = ref(false);
  const isNightServer = ref(false);
  const ghostPlot = ref<number | null>(null);
  const lastResurrectCode = ref<string | null>(null);

  const hasTomb = computed(() => !!tomb.value);
  const uid = computed(() => user.value?.id ?? null);

  function isGhostOutLocal(): boolean {
    const clock = useClockStore();
    const t = tomb.value;
    if (!t) return false;
    if (clock.isNight) return true;
    if (t.zhashi_until) {
      const until = new Date(t.zhashi_until).getTime();
      if (until > Date.now()) return true;
    }
    return false;
  }

  const ghostOut = computed(() => {
    // Prefer server when primed; local clock fills gaps between pulses
    if (ready.value) {
      const t = tomb.value;
      if (!t) return false;
      if (ghostOutServer.value) return true;
      if (t.zhashi_until && new Date(t.zhashi_until).getTime() > Date.now()) return true;
      return useClockStore().isNight;
    }
    return isGhostOutLocal();
  });

  async function bootstrap() {
    if (bootstrapping.value) return;
    bootstrapping.value = true;
    const ui = useUiStore();
    const tz = browserTimezone();
    try {
      const token = api.getToken();
      if (token) {
        try {
          const me = await api.me(tz);
          user.value = me.user;
          tomb.value = me.tomb;
          isNightServer.value = me.is_night;
          ghostOutServer.value = me.ghost_out;
          ready.value = true;
          applyPref();
          return;
        } catch (e) {
          if (!(e instanceof api.ApiError) || e.status !== 401) {
            ui.toast(api.DEFAULT_ERROR, { err: true });
          }
        }
      }
      const entered = await api.enter({ timezone: tz });
      api.setToken(entered.token);
      user.value = entered.user;
      tomb.value = null;
      // refresh me for is_night / ghost_out
      try {
        const me = await api.me(tz);
        user.value = me.user;
        tomb.value = me.tomb;
        isNightServer.value = me.is_night;
        ghostOutServer.value = me.ghost_out;
      } catch {
        /* ok */
      }
      ready.value = true;
      applyPref();
    } catch {
      ui.toast(api.DEFAULT_ERROR, { err: true });
      ready.value = true;
    } finally {
      bootstrapping.value = false;
    }
  }

  function applyPref() {
    const ui = useUiStore();
    if (tomb.value && !ghostOut.value) ui.pref = 'coffin';
    else ui.pref = 'cemetery';
  }

  function setFromMe(me: {
    user: User;
    tomb: Tomb | null;
    is_night: boolean;
    ghost_out: boolean;
  }) {
    user.value = me.user;
    tomb.value = me.tomb;
    isNightServer.value = me.is_night;
    ghostOutServer.value = me.ghost_out;
  }

  function setTomb(t: Tomb | null) {
    tomb.value = t;
  }

  function patchTomb(partial: Partial<Tomb>) {
    if (!tomb.value) return;
    tomb.value = { ...tomb.value, ...partial };
  }

  async function resurrectWithCode(code: string) {
    const ui = useUiStore();
    const res = await api.resurrect({ code });
    api.setToken(res.token);
    user.value = res.user;
    const me = await api.me(browserTimezone());
    setFromMe(me);
    applyPref();
    ui.toast('还魂成功，欢迎回来。');
  }

  async function regenerateCode() {
    const res = await api.regenerateResurrectCode();
    lastResurrectCode.value = res.resurrect_code;
    return res.resurrect_code;
  }

  return {
    user,
    tomb,
    ready,
    bootstrapping,
    ghostOutServer,
    isNightServer,
    ghostPlot,
    lastResurrectCode,
    hasTomb,
    uid,
    ghostOut,
    bootstrap,
    applyPref,
    setFromMe,
    setTomb,
    patchTomb,
    resurrectWithCode,
    regenerateCode,
    browserTimezone,
  };
});
