import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import * as api from '@/api/client';
import type { PresenceMode, PulseResponse } from '@/api/types';
import { itemsText } from './offerings';
import { useCemeteryStore } from './cemetery';
import { usePresenceStore } from './presence';
import { useSessionStore } from './session';
import { useUiStore } from './ui';
import { useClockStore } from './clock';

export const usePulseStore = defineStore('pulse', () => {
  const since = ref<string | null>(null);
  const pendingDreamsCount = ref(0);
  const unreadDreamsCount = ref(0);
  const zoneGhosts = ref<Record<string, number>>({});
  const knownOfferingIds = ref(new Set<number>());
  const knownDreamIds = ref(new Set<number>());
  const knownJoinIds = ref(new Set<number>());
  const primed = ref(false);
  const lastViewKnockAt = ref<string | null>(null);

  const session = () => useSessionStore();
  const cemetery = () => useCemeteryStore();
  const presence = () => usePresenceStore();
  const ui = () => useUiStore();

  const mode = computed<PresenceMode>(() => {
    const s = session();
    const u = ui();
    if (!s.tomb) return 'living';
    if (s.ghostOut && u.pref === 'cemetery') return 'ghost';
    return 'coffin';
  });

  const activePolling = computed(() => {
    const s = session();
    const c = cemetery();
    const u = ui();
    if (c.openCode || c.openGroupCode) return true;
    if (s.tomb && s.ghostOut && u.pref === 'cemetery') return true;
    return false;
  });

  async function sendPulse() {
    const s = session();
    if (!s.ready || !api.getToken()) return;

    const c = cemetery();
    const viewingId = c.detail?.id ?? null;

    let res: PulseResponse;
    try {
      res = await api.pulse({
        since: since.value,
        mode: mode.value,
        zone_phase_id: c.viewingPhaseId,
        cell: mode.value === 'ghost' ? s.ghostPlot : null,
        viewing_tomb_id: viewingId,
      });
    } catch {
      return;
    }

    since.value = res.now;
    s.isNightServer = res.is_night;
    s.ghostOutServer = res.ghost_out;
    useClockStore().syncFromServer(res.is_night);

    pendingDreamsCount.value = res.pending_dreams_count;
    unreadDreamsCount.value = res.unread_dreams_count;
    zoneGhosts.value = res.zone_ghosts ?? {};
    presence().apply(res.ghosts, res.living_count);

    if (c.viewingPhaseId && res.phase_version && res.phase_version !== c.phaseVersion) {
      c.phaseVersion = res.phase_version;
      if (primed.value) await c.fetchGrid(c.viewingPhaseId, true);
    }

    for (const o of res.new_offerings) {
      if (knownOfferingIds.value.has(o.id)) continue;
      knownOfferingIds.value.add(o.id);
      if (!primed.value) continue;
      const prefix = ui().pref === 'coffin' ? '头顶传来烧纸声……' : '';
      ui().toast(`${prefix}${o.from_name || '有人'}给你烧了 ${itemsText(o.items)}`, {
        btn: '看看',
        onBtn: () => {
          if (ui().pref !== 'coffin') ui().openModal('inbox');
        },
      });
    }

    for (const d of res.new_dreams) {
      if (knownDreamIds.value.has(d.id)) continue;
      knownDreamIds.value.add(d.id);
      if (!primed.value) continue;
      if (d.kind === 'join_result') {
        ui().toast('有人回了你的结伴帖', {
          btn: '去做梦',
          onBtn: () => {
            ui().dreamOverlay = {
              text: d.text,
              style: d.style,
              fromName: d.tomb?.name || d.tomb_name || '故人',
              at: new Date(d.visible_at || d.created_at).getTime(),
              id: d.id,
            };
            void api.markDreamRead(d.id);
            if (d.text && !/下辈子|八字|不想|驳回|没空|没人|连上网|自助/.test(d.text)) {
              /* accept-ish: show union after dream close handled elsewhere */
            }
          },
          ms: 8000,
        });
        continue;
      }
      if (d.kind === 'system') {
        ui().toast(d.text, { ms: 8000 });
        void api.markDreamRead(d.id);
        continue;
      }
      if (s.tomb && d.tomb_id === s.tomb.id && d.to_user_id === s.user?.id) {
        /* skip */
      } else {
        const name = d.tomb_name || d.tomb?.name || '某位故人';
        ui().toast(`${name}给你托梦了。`, {
          btn: '去做梦',
          onBtn: () => {
            ui().dreamOverlay = {
              text: d.text,
              style: d.style,
              fromName: name,
              at: new Date(d.visible_at || d.created_at).getTime(),
              id: d.id,
            };
            void api.markDreamRead(d.id);
          },
          ms: 8000,
        });
      }
    }

    for (const j of res.new_join_requests ?? []) {
      if (knownJoinIds.value.has(j.id)) continue;
      knownJoinIds.value.add(j.id);
      if (!primed.value) continue;
      const name = j.from_tomb?.name || '有人';
      ui().toast(`${name} 给你递了一张结伴帖`, {
        btn: '看看',
        onBtn: () => ui().openModal('inbox'),
      });
    }

    for (const p of res.new_phases ?? []) {
      if (!primed.value) continue;
      ui().toast(`${p.label || p.zone_name + '二期'}开盘了`);
    }

    if (res.viewing_tomb) {
      const lk = res.viewing_tomb.last_knock_at;
      if (lk && lk !== lastViewKnockAt.value) {
        if (lastViewKnockAt.value != null) {
          ui().shakeStone = true;
          setTimeout(() => {
            ui().shakeStone = false;
          }, 500);
          ui().toast('棺材里传来“咚、咚、咚”的声音……');
          window.dispatchEvent(new CustomEvent('afterme:knock-sound'));
        }
        lastViewKnockAt.value = lk;
      }
    } else {
      lastViewKnockAt.value = null;
    }

    handleDayNightShift(res);
    primed.value = true;
  }

  let prevNight: boolean | null = null;
  let prevGhostOut: boolean | null = null;

  function handleDayNightShift(res: PulseResponse) {
    const s = session();
    if (!s.tomb) {
      prevNight = res.is_night;
      prevGhostOut = res.ghost_out;
      return;
    }
    if (prevGhostOut === true && !res.ghost_out) {
      ui().toast(
        prevNight === true ? '天亮了，回棺材躺着吧。' : '阳气太重，你被晒回了棺材。',
      );
      ui().pref = 'coffin';
    }
    if (prevGhostOut === false && res.ghost_out && res.is_night) {
      ui().toast('天黑了，可以推开棺材板出去了。');
    }
    prevNight = res.is_night;
    prevGhostOut = res.ghost_out;
  }

  function reset() {
    since.value = null;
    primed.value = false;
    knownOfferingIds.value = new Set();
    knownDreamIds.value = new Set();
    knownJoinIds.value = new Set();
    lastViewKnockAt.value = null;
  }

  return {
    since,
    pendingDreamsCount,
    unreadDreamsCount,
    zoneGhosts,
    mode,
    activePolling,
    sendPulse,
    reset,
  };
});
