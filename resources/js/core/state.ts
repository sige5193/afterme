/**
 * 全局状态（替代原来的 session / cemetery / pulse / presence / offerings 几个 Pinia store）。
 * 只放数据；改数据的逻辑在同目录的各个模块里，改完负责 emit 对应事件。
 */

import type {
  Dream,
  GroupSummary,
  InboxItem,
  MyDreamItem,
  PhaseGrid,
  PulseGhost,
  Tomb,
  User,
  ZoneInfo,
} from '@/api/types';

export type Pref = 'cemetery' | 'coffin';

export const state = {
  /* 身份 */
  user: null as User | null,
  tomb: null as Tomb | null,
  /** /me 返回的合葬墓概要（带人数、墓块位置） */
  group: null as GroupSummary | null,
  ready: false,
  ghostOutServer: false,
  isNightServer: false,
  /** 有坟的人：在棺材里躺着，还是在外面（夜游 / 诈尸 / 白天魂游） */
  pref: 'cemetery' as Pref,
  /** 自己的鬼在当前这一期站在哪一格（pulse 上报） */
  ghostCell: null as number | null,

  /* 偏好 */
  sound: true,
  /** 棺材里翻身了没有 */
  flipped: false,

  /* 墓园 */
  zones: [] as ZoneInfo[],
  grids: new Map<number, PhaseGrid>(),
  /** 当前在看哪一期（pulse 上报 zone_phase_id） */
  viewingPhaseId: null as number | null,
  phaseVersions: new Map<number, string | null>(),
  /** 当前打开的坟（pulse 上报 viewing_tomb_id，用来感知敲棺材板） */
  viewingTombId: null as number | null,
  /** 打开了坟或合葬墓的详情：轮询加快到 5 秒 */
  detailOpen: false,

  /* 轮询结果 */
  pendingCount: 0,
  unreadCount: 0,
  zoneGhosts: {} as Record<string, number>,
  ghosts: [] as PulseGhost[],
  livingCount: 0,

  /* 香火簿 / 我的梦 */
  inbox: [] as InboxItem[],
  dreams: [] as MyDreamItem[],
  specialDreams: [] as Dream[],
};

try {
  const s = localStorage.getItem('afterme:sound');
  if (s != null) state.sound = s !== '0' && s !== 'false';
} catch {
  /* 隐私模式读不了就算了 */
}
