import { defineStore } from 'pinia';
import { ref } from 'vue';
import * as api from '@/api/client';
import type { InboxItem, MyDreamItem } from '@/api/types';
import { ITEM } from '@/config/items';
import { useUiStore } from './ui';

export function itemsText(items: Record<string, number> | { item_key: string; qty: number }[]): string {
  const entries: [string, number][] = Array.isArray(items)
    ? items.map((i) => [i.item_key, i.qty])
    : Object.entries(items);
  return entries
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${ITEM[k]?.name ?? k}×${n}`)
    .join('、');
}

export function itemTotals(
  list: { items: Record<string, number> | { item_key: string; qty: number }[] }[],
): Record<string, number> {
  const tot: Record<string, number> = {};
  for (const b of list) {
    const entries = Array.isArray(b.items)
      ? b.items.map((i) => [i.item_key, i.qty] as const)
      : Object.entries(b.items);
    for (const [k, n] of entries) tot[k] = (tot[k] || 0) + n;
  }
  return tot;
}

export const useOfferingsStore = defineStore('offerings', () => {
  const inbox = ref<InboxItem[]>([]);
  const dreams = ref<MyDreamItem[]>([]);
  const loadingInbox = ref(false);
  const loadingDreams = ref(false);

  async function fetchInbox() {
    loadingInbox.value = true;
    try {
      inbox.value = await api.inbox();
    } catch {
      useUiStore().toast(api.DEFAULT_ERROR, { err: true });
    } finally {
      loadingInbox.value = false;
    }
  }

  async function fetchDreams() {
    loadingDreams.value = true;
    try {
      dreams.value = await api.myDreams();
    } catch {
      useUiStore().toast(api.DEFAULT_ERROR, { err: true });
    } finally {
      loadingDreams.value = false;
    }
  }

  return {
    inbox,
    dreams,
    loadingInbox,
    loadingDreams,
    fetchInbox,
    fetchDreams,
  };
});
