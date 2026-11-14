import type { RelationKey, StoneStyleKey } from '@/api/types';

export const ZONE_ORDER = [
  'public',
  'worker',
  'student',
  'cyber',
  'fengshui',
  'group',
] as const;

export type ZoneKey = (typeof ZONE_ORDER)[number];

export type ZoneConfig = {
  key: ZoneKey;
  name: string;
  tagline: string;
  default_style: StoneStyleKey | null;
};

export const ZONES: Record<ZoneKey, ZoneConfig> = {
  public: {
    key: 'public',
    name: '普通公墓',
    tagline: '不挑，有地方躺就行',
    default_style: 'qingshi',
  },
  worker: {
    key: 'worker',
    name: '打工人区',
    tagline: '生前打卡，死后不打卡',
    default_style: 'qingshi',
  },
  student: {
    key: 'student',
    name: '学生区',
    tagline: '终于不用考试了',
    default_style: 'mupai',
  },
  cyber: {
    key: 'cyber',
    name: '赛博陵园',
    tagline: '肉身下线，数据长存',
    default_style: 'neon',
  },
  fengshui: {
    key: 'fengshui',
    name: '风水宝地',
    tagline: '贵，但体面',
    default_style: 'hanbai',
  },
  group: {
    key: 'group',
    name: '合葬区',
    tagline: '一起躺，不孤单',
    default_style: null,
  },
};

export const RELATIONS: { key: RelationKey; label: string }[] = [
  { key: 'lover', label: '情侣' },
  { key: 'bestie', label: '挚友' },
  { key: 'roommate', label: '室友' },
  { key: 'family', label: '家人' },
  { key: 'colleague', label: '同事' },
  { key: 'rival', label: '冤家' },
  { key: 'foodie', label: '饭搭子' },
];

export function relationLabel(key: RelationKey | null | undefined): string {
  if (!key) return '';
  return RELATIONS.find((r) => r.key === key)?.label ?? key;
}