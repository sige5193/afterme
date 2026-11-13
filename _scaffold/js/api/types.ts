/** API 字段一律 snake_case，与后端一致 */

export type StoneStyleKey = 'qingshi' | 'hanbai' | 'neon' | 'tubao' | 'mupai';
export type DreamStyleKey = 'plain' | 'warm' | 'scary' | 'mystic';
export type PresenceMode = 'ghost' | 'coffin' | 'living';

export interface User {
  id: number;
  timezone: string;
  last_seen_at: string;
  created_at?: string;
  updated_at?: string;
}

/** 墓园列表项 GET /tombs */
export interface TombListItem {
  id: number;
  code: string;
  name: string;
  cause: string;
  style: StoneStyleKey;
  portrait: number;
  plot: number;
  is_npc: boolean;
  is_orphan: boolean;
  /** 24 小时内有人烧纸 */
  hot: boolean;
}

/** 坟详情 GET /tombs/{code} */
export interface TombDetail extends TombListItem {
  birth_year: number;
  died_at: string;
  last_words: string | null;
  epitaph: string;
  epitaph_edits: number;
  zhashi_count: number;
  knock_count: number;
  funerals: number;
  /** 各物品总数 key → qty */
  item_totals: Record<string, number>;
  offering_count: number;
  last_offering_at: string | null;
  /** 可选：自己的坟可能多带这些 */
  eulogy?: string;
  verdict?: string;
  couplet?: number;
  zhashi_until?: string | null;
  last_knock_at?: string | null;
  npc_key?: string | null;
}

/** 自己的坟（/me 等）通常有完整字段 */
export type Tomb = TombDetail;

export interface OfferingItem {
  item_key: string;
  qty: number;
}

export interface Offering {
  id: number;
  tomb_id: number;
  user_id: number;
  from_name: string;
  /** 仅墓主与烧纸人可见 */
  message?: string | null;
  items: Record<string, number> | OfferingItem[];
  created_at: string;
  /** 香火簿：是否已托梦 */
  dream?: Dream | null;
  has_dream?: boolean;
}

export interface Dream {
  id: number;
  offering_id: number;
  tomb_id: number;
  to_user_id: number;
  text: string;
  style: DreamStyleKey;
  visible_at: string;
  read_at: string | null;
  created_at: string;
  /** 列表展示用：对方坟 / 烧纸信息 */
  from_name?: string;
  tomb_name?: string;
  tomb_code?: string;
  offering?: Offering;
}

export interface PulseGhost {
  tomb_id: number;
  name: string;
  plot: number;
}

export interface PulseViewingTomb {
  id: number;
  last_knock_at: string | null;
  knock_count: number;
}

export interface PulseRequest {
  /** 上次 pulse 返回的 now；首次可为 null */
  since: string | null;
  mode: PresenceMode;
  plot: number | null;
  viewing_tomb_id: number | null;
}

export interface PulseResponse {
  now: string;
  is_night: boolean;
  ghost_out: boolean;
  tombs_version: string;
  new_offerings: Offering[];
  new_dreams: Dream[];
  pending_dreams_count: number;
  unread_dreams_count: number;
  viewing_tomb: PulseViewingTomb | null;
  ghosts: PulseGhost[];
  living_count: number;
}

export interface EnterRequest {
  timezone: string;
}

export interface EnterResponse {
  token: string;
  user: User;
}

export interface MeResponse {
  user: User;
  tomb: Tomb | null;
  is_night: boolean;
  ghost_out: boolean;
}

export interface ResurrectRequest {
  code: string;
}

export interface ResurrectResponse {
  token: string;
  user: User;
}

export interface SaveTombRequest {
  name: string;
  birth_year: number;
  cause: string;
  portrait: number;
  last_words: string | null;
  style: StoneStyleKey;
  plot: number;
  epitaph: string;
  eulogy: string;
  verdict: string;
  couplet: number;
}

export interface SaveTombResponse {
  tomb: Tomb;
  /** 首次下葬时返回明文还魂码 */
  resurrect_code?: string;
}

export interface PatchEpitaphRequest {
  epitaph: string;
}

export interface ZhashiResponse {
  zhashi_count: number;
  zhashi_until: string;
}

export interface KnockRequest {
  count: number;
}

export interface KnockResponse {
  knock_count: number;
  last_knock_at: string;
}

export interface ResurrectCodeResponse {
  resurrect_code: string;
}

export interface CreateOfferingRequest {
  items: Record<string, number>;
  message?: string | null;
  from_name?: string | null;
}

export interface CreateDreamRequest {
  text: string;
  style: DreamStyleKey;
}

/** 香火簿：烧给我的纸 */
export type InboxItem = Offering;

/** 我的梦：我烧过的纸 + 对方托梦 */
export interface MyDreamItem {
  offering: Offering;
  dream: Dream | null;
}

export interface ApiErrorBody {
  message?: string;
  error?: string;
}
