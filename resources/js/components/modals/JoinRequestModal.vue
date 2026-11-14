<script setup lang="ts">
import { computed, ref } from 'vue';
import Modal from '@/components/layout/Modal.vue';
import { RELATIONS } from '@/config/zones';
import * as api from '@/api/client';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const session = useSessionStore();

const code = computed(() => String(ui.modalPayload.code || ''));
const name = computed(() => String(ui.modalPayload.name || ''));
const inGroup = computed(() => !!session.tomb?.group || !!ui.modalPayload.inGroup);
const isApply = computed(() => !!ui.modalPayload.apply);
const targetGroupCode = computed(() => String(ui.modalPayload.groupCode || ''));

const message = ref('');
const groupName = ref('');
const relation = ref('roommate');
const submitting = ref(false);

async function send() {
  if (!code.value || submitting.value) return;
  if (!session.ghostOut) {
    ui.toast('夜里才能递结伴帖');
    return;
  }
  submitting.value = true;
  try {
    const body: Record<string, string | null> = {
      message: message.value.trim() || null,
    };
    if (!inGroup.value) {
      body.group_name = groupName.value.trim();
      body.relation = relation.value;
    }
    if (isApply.value) {
      await api.applyJoin(targetGroupCode.value || code.value, body);
    } else {
      await api.inviteJoin(code.value, body);
    }
    ui.closeModal();
    ui.toast(`结伴帖已送出。`);
  } catch (e) {
    ui.toast(e instanceof api.ApiError ? e.message : api.DEFAULT_ERROR, { err: true });
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Modal @close="ui.closeModal()">
    <h2>{{ isApply ? '申请入伙' : '递结伴帖' }}</h2>
    <p class="sub">
      烧一张 📜 纸扎结伴帖{{ isApply ? `给 ${name}` : `给 ${name}` }}。对方夜里才能回音。
    </p>
    <div v-if="!inGroup && !isApply" class="field">
      <label for="jg-name">合葬墓名</label>
      <input id="jg-name" v-model="groupName" maxlength="12" placeholder="302 宿舍" />
    </div>
    <div v-if="!inGroup && !isApply" class="field">
      <label for="jg-rel">关系</label>
      <select id="jg-rel" v-model="relation">
        <option v-for="r in RELATIONS" :key="r.key" :value="r.key">{{ r.label }}</option>
      </select>
    </div>
    <div class="field">
      <label for="jg-msg">留言</label>
      <textarea id="jg-msg" v-model="message" maxlength="120" placeholder="一起躺吗？" />
    </div>
    <div class="mfoot">
      <button class="btn quiet" type="button" @click="ui.closeModal()">算了</button>
      <button
        class="btn primary"
        type="button"
        :disabled="submitting || (!inGroup && !isApply && !groupName.trim())"
        @click="send"
      >
        点火
      </button>
    </div>
  </Modal>
</template>