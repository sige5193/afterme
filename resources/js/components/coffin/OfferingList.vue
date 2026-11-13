<script setup lang="ts">
import { itemsText } from '@/stores/offerings';
import { ago } from '@/utils/time';
import type { InboxItem } from '@/api/types';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';

defineProps<{
  list: InboxItem[];
  muffle?: boolean;
  canReply?: boolean;
}>();

const session = useSessionStore();
const ui = useUiStore();

function invite() {
  ui.openModal('invite');
}

function dreamTo(id: number) {
  ui.openModal('dreamComposer', { offeringId: id });
}

function unmuffle(e: Event) {
  (e.currentTarget as HTMLElement).classList.remove('muffled');
}

function offeringItems(b: InboxItem): Record<string, number> {
  if (Array.isArray(b.items)) {
    const o: Record<string, number> = {};
    for (const i of b.items) o[i.item_key] = i.qty;
    return o;
  }
  return b.items;
}
</script>

<template>
  <div v-if="!list.length" class="empty-note">
    还没人来烧纸。<br />
    <button class="btn sm" style="margin-top: 10px" @click="invite">把墓址发给朋友</button>
  </div>
  <ul v-else class="list">
    <li v-for="b in list" :key="b.id" class="bl">
      <div class="bl-h">
        <b>
          {{ b.from_name || '一位路过的活人'
          }}{{ b.user_id === session.user?.id ? '（你自己）' : '' }}
        </b>
        <time>{{ ago(new Date(b.created_at).getTime()) }}</time>
      </div>
      <div class="bl-items">烧了 {{ itemsText(offeringItems(b)) }}</div>
      <p
        v-if="b.message"
        class="bl-msg"
        :class="{ muffled }"
        :title="muffle ? '贴着棺材板听' : undefined"
        @click="muffle ? unmuffle($event) : undefined"
      >
        {{ b.message }}
      </p>
      <div v-if="b.dream?.text" class="reply-quote">你托的梦：{{ b.dream.text }}</div>
      <div class="bl-f">
        <span>
          <span v-if="b.dream || b.has_dream" class="ok">已托梦</span>
          <span v-else>待托梦</span>
        </span>
        <button
          v-if="!b.dream && !b.has_dream && canReply"
          class="btn sm primary"
          @click="dreamTo(b.id)"
        >
          托梦
        </button>
      </div>
    </li>
  </ul>
</template>
