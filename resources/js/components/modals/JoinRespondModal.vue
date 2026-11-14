<script setup lang="ts">
import { computed, ref } from 'vue';
import Modal from '@/components/layout/Modal.vue';
import type { JoinRequest } from '@/api/types';
import { DREAM_STYLES } from '@/config/dreamStyles';
import * as api from '@/api/client';
import { pick } from '@/utils/text';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const session = useSessionStore();

const req = computed(() => ui.modalPayload.request as JoinRequest | undefined);

const reply = ref('');
const style = ref<'plain' | 'warm' | 'scary' | 'mystic'>('warm');
const block = ref(false);
const submitting = ref(false);

const title = computed(() => {
  const r = req.value;
  if (!r) return '结伴帖';
  if (r.type === 'apply') return `${r.from_tomb?.name || '有人'} 申请入伙`;
  return `${r.from_tomb?.name || '有人'} 想和你合葬`;
});

const detail = computed(() => {
  const r = req.value;
  if (!r) return '';
  const parts: string[] = [];
  if (r.group_name) parts.push(`墓名：${r.group_name}`);
  if (r.relation_label) parts.push(`关系：${r.relation_label}`);
  if (r.group?.name) parts.push(`合葬墓：${r.group.name}`);
  if (r.message) parts.push(`「${r.message}」`);
  return parts.join(' · ');
});

async function respond(decision: 'accept' | 'decline') {
  const r = req.value;
  if (!r || submitting.value) return;
  if (!session.ghostOut) {
    ui.toast('夜里才能回结伴帖');
    return;
  }
  submitting.value = true;
  try {
    const replyText =
      decision === 'accept'
        ? reply.value.trim() || pick(['来吧，挤一挤', '早该一起躺了', '棺材板给你留好了'])
        : reply.value.trim() || pick(['下辈子吧', '八字不合', '让我再死一会儿想想']);
    const res = await api.respondJoinRequest(r.id, {
      decision,
      reply_text: replyText,
      reply_style: style.value,
      block: decision === 'decline' ? block.value : undefined,
    }) as { tomb?: import('@/api/types').Tomb };
    if (res.tomb) session.setTomb(res.tomb);
    else {
      const me = await api.me();
      session.setFromMe(me);
    }
    ui.closeModal();
    if (decision === 'accept') ui.unionOverlay = true;
    ui.toast(decision === 'accept' ? '答应了。' : '回绝了。');
  } catch (e) {
    ui.toast(e instanceof api.ApiError ? e.message : api.DEFAULT_ERROR, { err: true });
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Modal @close="ui.closeModal()">
    <h2>{{ title }}</h2>
    <p v-if="detail" class="sub">{{ detail }}</p>
    <div class="field">
      <label for="jr-reply">回音</label>
      <textarea id="jr-reply" v-model="reply" maxlength="120" placeholder="留空用随机回音" />
    </div>
    <div class="field">
      <label for="jr-style">托梦气氛</label>
      <select id="jr-style" v-model="style">
        <option v-for="s in DREAM_STYLES" :key="s.k" :value="s.k">{{ s.name }}</option>
      </select>
    </div>
    <label class="note block">
      <input v-model="block" type="checkbox" />
      别再问了（仅拒绝时生效）
    </label>
    <div class="mfoot">
      <button class="btn quiet" type="button" @click="ui.closeModal()">再想想</button>
      <button class="btn" type="button" :disabled="submitting || !session.ghostOut" @click="respond('decline')">
        拒绝
      </button>
      <button class="btn primary" type="button" :disabled="submitting || !session.ghostOut" @click="respond('accept')">
        同意
      </button>
    </div>
    <p v-if="!session.ghostOut" class="why">白天只能看着，夜里再点。</p>
  </Modal>
</template>