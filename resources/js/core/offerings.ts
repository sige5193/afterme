/**
 * 香火簿、我的梦（替代原来的 offerings store）。
 */

import * as api from '@/api/client';
import type { InboxItem, InboxJoinRequest, JoinRequest, Offering } from '@/api/types';
import { ITEM } from '@/config/items';
import { emit } from './bus';
import { state } from './state';
import { toast } from './ui';

type ItemsShape = Record<string, number> | { item_key: string; qty: number }[] | undefined | null;

export function itemsRecord(items: ItemsShape): Record<string, number> {
  if (!items) return {};
  if (Array.isArray(items)) {
    const o: Record<string, number> = {};
    for (const i of items) o[i.item_key] = (o[i.item_key] || 0) + i.qty;
    return o;
  }
  return items;
}

export function itemsText(items: ItemsShape): string {
  return Object.entries(itemsRecord(items))
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${ITEM[k]?.name ?? k}×${n}`)
    .join('、');
}

export function itemTotals(list: { items?: ItemsShape }[]): Record<string, number> {
  const tot: Record<string, number> = {};
  for (const b of list) {
    for (const [k, n] of Object.entries(itemsRecord(b.items))) tot[k] = (tot[k] || 0) + n;
  }
  return tot;
}

export function isJoinItem(b: InboxItem): b is InboxJoinRequest {
  return b.type === 'join_request';
}

/** 申请入伙（发给墓长）还是邀请合葬（发给我）：香火簿里的 type 被覆盖了，只能看有没有 to_tomb */
export function isApplyRequest(j: Pick<JoinRequest, 'to_tomb' | 'group'> & { type?: string }): boolean {
  if (j.type === 'apply') return true;
  if (j.type === 'invite') return false;
  return !j.to_tomb && !!j.group?.code;
}

export function offeringOf(b: InboxItem): Offering | null {
  return isJoinItem(b) ? null : (b as Offering);
}

export async function fetchInbox(): Promise<void> {
  try {
    state.inbox = await api.inbox();
    emit('inbox');
  } catch {
    toast(api.DEFAULT_ERROR, { err: true });
  }
}

export async function fetchDreams(): Promise<void> {
  try {
    const res = await api.myDreams();
    state.dreams = res.items;
    state.specialDreams = res.special;
    emit('dreams');
  } catch {
    toast(api.DEFAULT_ERROR, { err: true });
  }
}
