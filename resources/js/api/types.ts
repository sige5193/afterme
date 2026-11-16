/** API 字段一律 snake_case，与后端一致 */

export type StoneStyleKey = 'qingshi' | 'hanbai' | 'neon' | 'tubao' | 'mupai';
export type DreamStyleKey = 'plain' | 'warm' | 'scary' | 'mystic';
export type PresenceMode = 'ghost' | 'coffin' | 'living';
export type RelationKey =
  | 'lover'
  | 'bestie'
  | 'roommate'
  | 'family'
  | 'colleague'
  | 'rival'
  | 'foodie';

export interface User {
  id: number;
  timezone: string;
  last_seen_at: string;
  created_at?: string;
  updated_at?: string;
  has_resurrect_code?: boolean;
}

export interface ZoneRef {
  key: string;
  name: string;
}

export interface PhaseRef {
  id: number;
  number: number;
}

export interface GroupSummary {
  code: string;
  name: string;
  relation?: RelationKey;
  relation_label?: string;
  width?: number;
  start_cell?: number;
  member_count?: number;
  disbanded_at?: string | null;
}

export interface PastGroup {
  name_snapshot: string | null;
  left_at: string | null;
}

export interface TombListItem {
  id: number;
  code: string;
  name: string;
  cause: string;
  style: StoneStyleKey;
  portrait: number;
  zone: ZoneRef | null;
  phase: PhaseRef | null;
  cell: number | null;
  address: string | null;
  move_count: number;
  is_npc: boolean;
  is_orphan: boolean;
  hot: boolean;
  group: GroupSummary | null;
}

export interface TombDetail extends TombListItem {
  birth_year: number;
  died_at: string;
  last_words: string | null;
  epitaph: string;
  epitaph_edits: number;
  zhashi_count: number;
  knock_count: number;
  funerals: number;
  item_totals: Record<string, number>;
  offering_count: number;
  last_offering_at: string | null;
  eulogy?: string;
  verdict?: string;
  couplet?: number;
  zhashi_until?: string | null;
  last_knock_at?: string | null;
  npc_key?: string | null;
  past_groups?: PastGroup[];
}

export type Tomb = TombDetail;

export interface ZonePhaseInfo {
  id: number;
  number: number;
  used_cells: number;
  capacity: number;
}

export interface ZoneInfo {
  key: string;
  name: string;
  tagline: string;
  default_style: StoneStyleKey | null;
  is_group_zone: boolean;
  tomb_count: number;
  ghosts_online: number;
  phases: ZonePhaseInfo[];
}

export interface GridTomb {
  code: string;
  name: string;
  cause: string;
  style: StoneStyleKey;
  portrait: number;
  is_npc?: boolean;
  hot?: boolean;
  id?: number;
}

export interface GridGroupMember {
  tomb_code: string;
  name: string;
  cause: string;
  portrait: number;
  style: StoneStyleKey;
  is_founder?: boolean;
}

export interface GridGroup {
  code: string;
  name: string;
  relation: RelationKey;
  relation_label: string;
  width: number;
  start_cell: number;
  member_count: number;
  members: GridGroupMember[];
}

export interface GridCell {
  cell: number;
  type: 'tomb' | 'group' | 'empty';
  tomb?: GridTomb;
  group?: GridGroup;
  special?: string;
}

export interface PhaseGrid {
  phase: {
    id: number;
    number: number;
    capacity: number;
    label: string;
    display_name: string;
  };
  zone: {
    key: string;
    name: string;
    tagline: string;
    default_style: StoneStyleKey | null;
    is_group_zone: boolean;
  };
  cells: GridCell[];
  version: string | null;
}

export interface CemeteryCard {
  kind: 'tomb' | 'group';
  code: string;
  name: string;
  address: string | null;
  style?: StoneStyleKey | null;
  portrait?: number | null;
  cause?: string | null;
  relation_text?: string | null;
  burn_count?: number;
  member_count?: number;
  width?: number;
}

export interface MyCemeteryResponse {
  mine: CemeteryCard[];
  burned_me: CemeteryCard[];
  i_burned: CemeteryCard[];
  neighbors: CemeteryCard[];
}

export interface SearchResponse {
  results: CemeteryCard[];
  redirect?: string;
}

export interface OfferingItem {
  item_key: string;
  qty: number;
}

export interface Offering {
  id: number;
  type?: 'offering' | 'group_offering' | 'join_request';
  tomb_id: number | null;
  group_id?: number | null;
  user_id: number;
  from_name: string;
  message?: string | null;
  items: Record<string, number> | OfferingItem[];
  created_at: string;
  dream?: Dream | null;
  dreams?: Dream[];
  has_dream?: boolean;
  group?: GroupSummary | null;
  tomb?: { code: string; name: string; is_npc?: boolean } | null;
}

export interface Dream {
  id: number;
  offering_id: number | null;
  kind?: 'reply' | 'join_result' | 'system';
  join_request_id?: number | null;
  tomb_id: number | null;
  to_user_id: number;
  text: string;
  style: DreamStyleKey;
  visible_at: string;
  read_at: string | null;
  created_at: string;
  from_name?: string;
  tomb_name?: string;
  tomb_code?: string;
  tomb?: { code: string; name: string } | null;
  offering?: Offering;
}

export interface JoinRequest {
  id: number;
  type: 'invite' | 'apply';
  from_tomb: { code: string; name: string } | null;
  to_tomb: { code: string; name: string } | null;
  group: { code: string | null; name: string } | null;
  relation: RelationKey | null;
  relation_label: string | null;
  group_name: string | null;
  message: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  reply_text: string | null;
  reply_style: DreamStyleKey | null;
  expires_at: string;
  responded_at: string | null;
  created_at: string;
}

/** 香火簿里的结伴帖：后端把 type 覆盖成了 join_request，邀请还是申请要看 to_tomb */
export type InboxJoinRequest = Omit<JoinRequest, 'type'> & {
  type: 'join_request';
  from_name?: string;
  items?: never;
  user_id?: number;
  dream?: never;
  has_dream?: never;
};

export type InboxItem = (Offering & { type?: 'offering' | 'group_offering' }) | InboxJoinRequest;

export interface PulseGhost {
  tomb_code: string;
  name: string;
  cell: number | null;
}

export interface PulseViewingTomb {
  id: number;
  last_knock_at: string | null;
  knock_count: number;
}

export interface PulseRequest {
  since: string | null;
  mode: PresenceMode;
  zone_phase_id: number | null;
  cell: number | null;
  viewing_tomb_id: number | null;
}

export interface PulseResponse {
  now: string;
  is_night: boolean;
  ghost_out: boolean;
  phase_version: string | null;
  new_offerings: Offering[];
  new_dreams: Dream[];
  new_join_requests: JoinRequest[];
  new_phases: Array<{ zone_name: string; zone_key: string; number: number; label: string }>;
  pending_dreams_count: number;
  unread_dreams_count: number;
  viewing_tomb: PulseViewingTomb | null;
  ghosts: PulseGhost[];
  zone_ghosts: Record<string, number>;
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
  group: GroupSummary | null;
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
  zone_phase_id?: number;
  cell?: number;
  epitaph: string;
  eulogy: string;
  verdict: string;
  couplet: number;
}

export interface SaveTombResponse {
  tomb: Tomb;
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
  tomb_code?: string | null;
}

export interface CreateDreamRequest {
  text: string;
  style: DreamStyleKey;
}

export interface GroupDetail {
  code: string;
  name: string;
  relation: RelationKey;
  relation_label: string;
  founder_tomb_code: string | null;
  founder_name: string | null;
  zone: ZoneRef | null;
  phase: PhaseRef | null;
  start_cell: number;
  width: number;
  address: string | null;
  epitaph: string | null;
  epitaph_edits: number;
  disbanded_at: string | null;
  members: Array<{
    tomb_code: string;
    name: string;
    cause: string;
    portrait: number;
    style: StoneStyleKey;
    last_words: string | null;
    epitaph: string;
    joined_at: string;
    is_founder: boolean;
    past_groups: PastGroup[];
    item_totals: Record<string, number>;
    offering_count: number;
    last_offering_at: string | null;
  }>;
  past_member_names: string[];
  offering_count: number;
  last_offering_at: string | null;
}

export interface MyDreamItem {
  offering: Offering;
  dream: Dream | null;
  dreams?: Dream[];
}

export interface ApiErrorBody {
  message?: string;
  error?: string;
}
