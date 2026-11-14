<script setup lang="ts">
import { itemsText } from '@/stores/offerings';
import { ago } from '@/utils/time';
import type { InboxItem, JoinRequest } from '@/api/types';
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
  return (b.items as Record<string, number>) || {};
}

function isJoin(b: InboxItem): b is InboxItem & JoinRequest {
  return b.type === 'join_request';
}

function openJoin(b: InboxItem) {
  ui.openModal('joinRespond', { request: b });
}
</script>

<template>
  <div v-if="!list.length" class="empty-note">
    还没人来烧纸。<br />
    <button class="btn sm" style="margin-top: 10px" @click="invite">把墓址发给朋友</button>
  </div>
  <ul v-else class="list">
    <li
      v-for="b in list"
      :key="(b.type || 'offering') + '-' + b.id"
      class="bl"
      :class="{ 'join-card': isJoin(b) }"
      :style="isJoin(b) ? 'border:1px solid var(--seal);border-radius:8px;padding:10px' : undefined"
    >
      <template v-if="isJoin(b)">
        <div class="bl-h">
          <b>{{ (b as any).from_tomb?.name || '有人' }} 给你烧了一张纸扎结伴帖</b>
          <time>{{ ago(new Date(b.created_at).getTime()) }}</time>
        </div>
        <div class="bl-items">
          {{
            (b as any).type === 'apply'
              ? `申请入伙 ${(b as any).group?.name || ''}`
              : `想和你合葬${(b as any).relation_label ? '，关系：' + (b as any).relation_label : ''}${(b as any).group_name ? '，墓名：' + (b as any).group_name : ''}`
          }}
        </div>
        <p v-if="(b as any).message" class="bl-msg">{{ (b as any).message }}</p>
        <div class="bl-f">
          <button class="btn sm primary" :disabled="!canReply" @click="openJoin(b)">看看</button>
          <span v-if="!canReply" class="note">夜里才能回结伴帖</span>
        </div>
      </template>
      <template v-else>
        <div class="bl-h">
          <b>
            {{ b.from_name || '一位路过的活人'
            }}{{ b.user_id === session.user?.id ? '（你自己）' : '' }}
            <span v-if="b.type === 'group_offering'" class="mark">烧给全墓</span>
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
      </template>
    </li>
  </ul>
</template>
