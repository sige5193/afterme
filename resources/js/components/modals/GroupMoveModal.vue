<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import Modal from '@/components/layout/Modal.vue';
import { address, COLS } from '@/utils/time';
import * as api from '@/api/client';
import { useCemeteryStore } from '@/stores/cemetery';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const session = useSessionStore();
const cemetery = useCemeteryStore();

const code = computed(() => cemetery.groupDetail?.code || String(ui.modalPayload.code || ''));
const width = computed(() => cemetery.groupDetail?.width ?? 2);

const phaseId = ref<number | null>(null);
const startCell = ref<number | null>(null);
const submitting = ref(false);

const groupZone = computed(() => cemetery.zonesList.find((z) => z.is_group_zone));
const phases = computed(() => groupZone.value?.phases ?? []);
const grid = computed(() => (phaseId.value ? cemetery.gridByPhaseId[phaseId.value] : null));

function occupiedAt(cell: number): boolean {
  for (const c of grid.value?.cells ?? []) {
    if (c.type === 'empty') continue;
    if (c.type === 'tomb') {
      if (c.cell === cell) return true;
      continue;
    }
    if (c.group) {
      const s = c.group.start_cell;
      const w = c.group.width;
      if (cell >= s && cell < s + w) return true;
    }
  }
  return false;
}

function canPlace(cell: number): boolean {
  const w = width.value;
  if (cell % 2 !== 0) return false;
  if (cell % COLS + w > COLS) return false;
  for (let i = 0; i < w; i++) {
    if (occupiedAt(cell + i)) return false;
  }
  return true;
}

onMounted(async () => {
  if (!cemetery.zonesList.length) await cemetery.fetchZones();
  const ph = phases.value.find((p) => p.used_cells < p.capacity) ?? phases.value[0];
  phaseId.value = ph?.id ?? null;
});

watch(phaseId, async (id) => {
  startCell.value = null;
  if (id) await cemetery.fetchGrid(id);
});

async function confirm() {
  if (startCell.value == null || phaseId.value == null || !code.value || submitting.value) return;
  if (!session.ghostOut) {
    ui.toast('夜里才能整体迁墓');
    return;
  }
  submitting.value = true;
  try {
    const res = await api.moveGroup(code.value, {
      zone_phase_id: phaseId.value,
      start_cell: startCell.value,
    });
    cemetery.groupDetail = res.group;
    ui.closeModal();
    ui.toast('合葬墓迁好了。');
  } catch (e) {
    ui.toast(e instanceof api.ApiError ? e.message : api.DEFAULT_ERROR, { err: true });
    if (phaseId.value) await cemetery.fetchGrid(phaseId.value, true);
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Modal @close="ui.closeModal()">
    <h2>整体迁墓</h2>
    <p class="sub">墓块宽 {{ width }} 格，起始列须为偶数且整段连续为空。</p>
    <div class="field">
      <label for="gm-phase">合葬区 · 期</label>
      <select id="gm-phase" v-model="phaseId">
        <option v-for="p in phases" :key="p.id" :value="p.id">第 {{ p.number }} 期</option>
      </select>
    </div>
    <div class="minigrid">
      <button
        v-for="n in 60"
        :key="n - 1"
        type="button"
        :class="{ on: startCell === n - 1, taken: !canPlace(n - 1) }"
        :disabled="!canPlace(n - 1)"
        @click="startCell = n - 1"
      >
        {{ address(n - 1) }}
      </button>
    </div>
    <div class="mfoot">
      <button class="btn quiet" type="button" @click="ui.closeModal()">取消</button>
      <button
        class="btn primary"
        type="button"
        :disabled="startCell == null || submitting || !session.ghostOut"
        @click="confirm"
      >
        确认
      </button>
    </div>
  </Modal>
</template>