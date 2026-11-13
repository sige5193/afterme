import { cnDate } from '../utils/time';
import { pick } from '../utils/text';

export const ADJ = [
  '平凡而又伟大',
  '拖延而又坚持',
  '努力搞钱但钱没搞到',
  '积极发朋友圈',
  '早睡失败',
  '间歇性踌躇满志',
] as const;

export const ADJ2 = [
  '与闹钟斗争',
  '认真生活偶尔摆烂',
  '默默点赞',
  '从不迟到太久',
  '和自己和解又反悔',
  '持续性混吃等死',
] as const;

export const ACHV = [
  '曾连续三天按时起床',
  '收藏了三千篇从没打开过的文章',
  '在群里抢到过 8.88 元红包',
  '坚持健身整整一周',
  '办过一张从没用过的游泳卡',
  '把一盆绿萝养活了两年',
] as const;

export const ACHV2 = [
  '回复过无数个“收到”',
  '给身边的人点过很多次外卖',
  '从未在猜拳中赢过',
  '一直记得朋友的生日（大部分）',
  '是好几个群里最后一个说晚安的人',
  '给很多人带来过快乐，主要靠笑话本人',
] as const;

export const CATEG = [
  '意外中的必然',
  '慢性累积型',
  '工伤（待认定）',
  '可以理解的那种',
  '当代常见病',
] as const;

export const LASTACT = [
  '把购物车清空了',
  '手机还剩 17% 的电',
  '刚点的外卖还没送到',
  '回复了最后一个“好的”',
  '给猫加满了粮',
  '没关电脑上的 38 个标签页',
] as const;

export const EFFECT = [
  '使公司群未读消息减少了 99+',
  '让外卖小哥少了一位老客户',
  '令全部待办事项永久归档',
  '让家里的 Wi-Fi 少了一台设备',
  '使闹钟终于得到了休息',
] as const;

export const WISH = [
  '不用打卡',
  'Wi-Fi 满格',
  '天天睡到自然醒',
  '再也不用回消息',
  '顿顿有人请客',
  '永远不用开会',
] as const;

export const VERDICTS = [
  '此人尚可',
  '已经尽力',
  '情有可原',
  '活得挺好',
  '功过相抵',
  '下辈子早睡',
  '属实不易',
] as const;

export const COUPLETS: readonly [string, string, string][] = [
  ['一生勤恳熬夜', '两眼一闭安息', '提前下班'],
  ['生前待办未了', '死后统一归档', '永不打卡'],
  ['在世时常说忙', '离开后终于闲', '已读不回'],
];

export type EulogyInput = {
  name: string;
  birthYear: number;
  cause: string;
  lastWords?: string | null;
};

/** 前端生成悼词，提交时一并保存到后端 */
export function makeEulogy(input: EulogyInput): string {
  const n = input.name;
  const age = new Date().getFullYear() - input.birthYear;
  return [
    `${n}同志，${input.birthYear}年生人，于${cnDate(Date.now())}在不活了提前逝世，享年${age}岁（阳寿余额充足，随时可以续费）。`,
    `${n}的一生，是${pick(ADJ)}的一生，是${pick(ADJ2)}的一生。`,
    `生前，${n}${pick(ACHV)}，${pick(ACHV2)}。`,
    `经阴间医院鉴定，死因为“${input.cause}”，属于${pick(CATEG)}。`,
    `${n}走得很安详。走之前，${pick(LASTACT)}。`,
    input.lastWords
      ? `遗言只有一句：“${input.lastWords}”`
      : `${n}没有留下遗言，大概是还没想好。`,
    `${n}的离去，${pick(EFFECT)}。愿${n}在那边${pick(WISH)}。`,
  ].join('\n');
}
