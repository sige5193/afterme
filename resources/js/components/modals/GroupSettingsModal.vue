<script setup lang="ts">
import { computed, ref } from 'vue';
import Modal from '@/components/layout/Modal.vue';
import { RELATIONS } from '@/config/zones';
import * as api from '@/api/client';
import { useCemeteryStore } from '@/stores/cemetery';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const cemetery = useCemeteryStore();

const g = computed(() => cemetery.groupDetail);
const code = computed(() => g.value?.code || String(ui.modalPayload.code || ''));

const name = ref(g.value?.name || '');
const relation = ref(g.value?.relation || 'roommate');
const submitting = ref(false);
const removing = ref<string | null>(null);

async function save() {
  if (!code.value || submitting.value) return;
  submitting.value = true;
  try {
    const res = await api.patchGroup(code.value, {
      name: name.value.trim() || undefined,
      relation: relation.value,
    });
    cemetery.groupDetail = res.group;
    ui.closeModal();
    ui.toast('改好了。');
  } catch (e) {
    ui.toast(e instanceof api.ApiError ? e.message : api.DEFAULT_ERROR, { err: true });
  } finally {
    submitting.value = false;
  }
}

async function removeMember(tombCode: string, memberName: string) {
  if (!code.value || !confirm(`请出 ${memberName}？碑上不会写「被请出」。`)) return;
  removing.value = tombCode;
  try {
    await api.removeGroupMember(code.value, tombCode);
    await cemetery.openGroup(code.value);
    ui.toast('已请出。');
  } catch (e) {
    ui.toast(e instanceof api.ApiError ? e.message : api.DEFAULT_ERROR, { err: true });
  } finally {
    removing.value = null;
  }
}
</script>

<template>
  <Modal @close="ui.closeModal()">
    <h2>墓长设置</h2>
    <div class="field">
      <label for="gs-name">墓名</label>
      <input id="gs-name" v-model="name" maxlength="12" />
    </div>
    <div class="field">
      <label for="gs-rel">关系标签</label>
      <select id="gs-rel" v-model="relation">
        <option v-for="r in RELATIONS" :key="r.key" :value="r.key">{{ r.label }}</option>
      </select>
    </div>
    <div v-if="g?.members?.length" class="block">
      <div class="lbl">成员</div>
      <ul class="note memb">
        <li v-for="m in g.members" :key="m.tomb_code">
          {{ m.name }}
          <button
            v-if="!m.is_founder"
            type="button"
            class="btn sm quiet"
            :disabled="removing === m.tomb_code"
            @click="removeMember(m.tomb_code, m.name)"
          >
            请出
          </button>
        </li>
      </ul>
    </div>
    <div class="mfoot">
      <button class="btn quiet" type="button" @click="ui.closeModal()">取消</button>
      <button class="btn primary" type="button" :disabled="submitting" @click="save">保存</button>
    </div>
  </Modal>
</template>

<style scoped>
.memb {
  list-style: none;
  padding: 0;
  margin: 0;
}
.memb li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 6px 0;
}
</style>