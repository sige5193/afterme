/**
 * 轮询 + 心跳（REFACTOR §9 / ADJUST-01 §9.3）：替代原来的 pulse store 和 usePolling。
 * - 默认 25 秒一次；打开了坟的详情、或者自己是鬼在外面夜游时 5 秒一次
 * - 页面不可见时停；恢复可见立刻发一次
 * - 鬼换了格子后 500ms 防抖立即发
 */

import * as api from '@/api/client';
import type { Dream, PresenceMode, PulseResponse } from '@/api/types';
import { emit } from './bus';
import { fetchGrid } from './cemetery';
import { itemsText } from './offerings';
import { applyPref, ghostOut, refreshMe, setPref } from './session';
import { state } from './state';
import { fx, openPanel, sfx, toast } from './ui';

let since: string | null = null;
let primed = false;
let lastViewKnockAt: string | null = null;
let lastViewTombId: number | null = null;
let prevGhostOut: boolean | null = null;
let prevNight: boolean | null = null;
const knownOfferings = new Set<number>();
const knownDreams = new Set<number>();
const knownJoins = new Set<number>();

let running = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let moveTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;
let queued = false;

export function presenceMode(): PresenceMode {
  if (!state.tomb) return 'living';
  if (ghostOut() && state.pref === 'cemetery') return 'ghost';
  return 'coffin';
}

function activePolling(): boolean {
  if (state.detailOpen) return true;
  return presenceMode() === 'ghost';
}

/** 打开一个梦；结伴帖被同意的回音，醒来后再放一次合葬动画 */
export async function openDream(d: Dream, fromName?: string): Promise<void> {
  const name = fromName || d.tomb?.name || d.tomb_name || '某位故人';
  let accepted = false;
  if (d.kind === 'join_result' && d.join_request_id) {
    try {
      const res = await api.myJoinRequests();
      accepted = res.outgoing.some((r) => r.id === d.join_request_id && r.status === 'accepted');
    } catch {
      /* 查不到就不放动画 */
    }
  }
  fx({
    kind: 'dream',
    text: d.text,
    style: d.style,
    fromName: name,
    at: new Date(d.visible_at || d.created_at).getTime(),
    id: d.id,
    onClose: accepted ? () => fx({ kind: 'union' }) : undefined,
  });
  if (!d.read_at) {
    d.read_at = new Date().toISOString();
    try {
      await api.markDreamRead(d.id);
      state.unreadCount = Math.max(0, state.unreadCount - 1);
      emit('counts');
    } catch {
      /* 下次再标 */
    }
  }
}

function handleDayNightShift(res: PulseResponse): void {
  if (!state.tomb) {
    // 还没坟（活人）：不记，免得刚下葬就被当成「天黑了」再提醒一遍
    prevGhostOut = null;
    prevNight = null;
    return;
  }
  if (prevGhostOut === true && !res.ghost_out) {
    toast(prevNight === true ? '天亮了，回棺材躺着吧。' : '阳气太重，你被晒回了棺材。');
    setPref('coffin');
  }
  if (prevGhostOut === false && res.ghost_out && res.is_night) {
    toast('天黑了，可以推开棺材板出去了。', {
      btn: state.pref === 'coffin' ? '出去溜达' : undefined,
      onBtn: () => setPref('cemetery'),
    });
  }
  prevGhostOut = res.ghost_out;
  prevNight = res.is_night;
}

export async function sendPulse(): Promise<void> {
  if (!state.ready || !api.getToken()) return;

  const mode = presenceMode();
  let res: PulseResponse;
  try {
    res = await api.pulse({
      since,
      mode,
      zone_phase_id: state.viewingPhaseId,
      cell: mode === 'ghost' ? state.ghostCell : null,
      viewing_tomb_id: state.viewingTombId,
    });
  } catch {
    return;
  }

  since = res.now;
  const sessionChanged = state.isNightServer !== res.is_night || state.ghostOutServer !== res.ghost_out;
  state.isNightServer = res.is_night;
  state.ghostOutServer = res.ghost_out;

  state.pendingCount = res.pending_dreams_count;
  state.unreadCount = res.unread_dreams_count;
  state.zoneGhosts = res.zone_ghosts ?? {};
  state.ghosts = res.ghosts ?? [];
  state.livingCount = res.living_count;
  emit('counts');
  emit('presence');

  const phaseId = state.viewingPhaseId;
  if (phaseId && res.phase_version) {
    const known = state.phaseVersions.get(phaseId);
    if (known !== undefined && known !== res.phase_version) {
      state.phaseVersions.set(phaseId, res.phase_version);
      void fetchGrid(phaseId, true);
    }
  }

  for (const o of res.new_offerings ?? []) {
    if (knownOfferings.has(o.id)) continue;
    knownOfferings.add(o.id);
    if (!primed) continue;
    const prefix = state.pref === 'coffin' ? '头顶传来烧纸声……' : '';
    toast(`${prefix}${o.from_name || '有人'}给你烧了 ${itemsText(o.items)}`, {
      btn: '看看',
      onBtn: () => openPanel('inbox'),
    });
  }

  let shouldRefreshMe = false;
  for (const d of res.new_dreams ?? []) {
    if (knownDreams.has(d.id)) continue;
    knownDreams.add(d.id);
    if (!primed) continue;
    if (d.kind === 'join_result') {
      shouldRefreshMe = true;
      toast(`${d.tomb?.name || '有人'} 回了你的结伴帖`, {
        btn: '去做梦',
        onBtn: () => void openDream(d),
        ms: 8000,
      });
      continue;
    }
    if (d.kind === 'system') {
      shouldRefreshMe = true;
      toast(d.text, { ms: 8000 });
      void api.markDreamRead(d.id).catch(() => undefined);
      continue;
    }
    // 托给自己的梦不弹
    if (state.tomb && d.tomb_id === state.tomb.id) continue;
    const name = d.tomb_name || d.tomb?.name || '某位故人';
    toast(`${name}给你托梦了。`, {
      btn: '去做梦',
      onBtn: () => void openDream(d, name),
      ms: 8000,
    });
  }
  if (shouldRefreshMe) void refreshMe();

  for (const j of res.new_join_requests ?? []) {
    if (knownJoins.has(j.id)) continue;
    knownJoins.add(j.id);
    if (!primed) continue;
    toast(`${j.from_tomb?.name || '有人'} 给你递了一张结伴帖`, {
      btn: '看看',
      onBtn: () => openPanel('inbox'),
    });
  }

  if (primed) {
    for (const p of res.new_phases ?? []) toast(`${p.label || p.zone_name}开盘了`);
  }

  if (res.viewing_tomb && res.viewing_tomb.id === lastViewTombId) {
    // 第一次看到这座坟时只记下时间（else 分支），之后时间变了就是有人在敲
    const lk = res.viewing_tomb.last_knock_at;
    if (lk && lk !== lastViewKnockAt) {
      toast('棺材里传来“咚、咚、咚”的声音……');
      sfx('knock');
      emit('knock');
      lastViewKnockAt = lk;
    }
  } else {
    lastViewTombId = res.viewing_tomb?.id ?? null;
    lastViewKnockAt = res.viewing_tomb?.last_knock_at ?? null;
  }

  handleDayNightShift(res);
  if (sessionChanged) emit('session');
  primed = true;
}

function intervalMs(): number {
  return activePolling() ? 5_000 : 25_000;
}

function clearTimer(): void {
  if (timer != null) clearTimeout(timer);
  timer = null;
}

function scheduleNext(): void {
  clearTimer();
  if (!running || document.hidden) return;
  timer = setTimeout(() => void tick(), intervalMs());
}

async function tick(): Promise<void> {
  if (!running || document.hidden) return;
  if (inFlight) {
    queued = true;
    return;
  }
  inFlight = true;
  try {
    await sendPulse();
  } finally {
    inFlight = false;
    if (queued) {
      queued = false;
      void tick();
    } else {
      scheduleNext();
    }
  }
}

/** 立刻发一次（不等定时器） */
export function pulseNow(): void {
  if (!running) return;
  clearTimer();
  void tick();
}

/** 鬼换了格子：500ms 防抖后立即发 */
export function onGhostMove(): void {
  if (!running) return;
  if (moveTimer != null) clearTimeout(moveTimer);
  moveTimer = setTimeout(() => {
    moveTimer = null;
    pulseNow();
  }, 500);
}

/** 换了身份（还魂）后从头开始 */
export function resetPulse(): void {
  since = null;
  primed = false;
  lastViewKnockAt = null;
  lastViewTombId = null;
  prevGhostOut = null;
  prevNight = null;
  knownOfferings.clear();
  knownDreams.clear();
  knownJoins.clear();
}

export function startPolling(): void {
  if (running) return;
  running = true;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimer();
    else pulseNow();
  });
  pulseNow();
}

/** 首次加载后如果服务器说白天，躺回棺材 */
export function syncPrefFromServer(): void {
  if (state.tomb && !ghostOut()) applyPref();
}
