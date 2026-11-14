<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import Modal from '@/components/layout/Modal.vue';
import { SPECIAL } from '@/config/specialPlots';
import * as api from '@/api/client';
import type { ZoneInfo } from '@/api/types';
import { address } from '@/utils/time';
import { useCemeteryStore } from '@/stores/cemetery';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const session = useSessionStore();
const cemetery = useCemeteryStore();

const zones = ref<ZoneInfo[]>([]);
const zoneKey = ref('public');
const phaseId = ref<number | null>(null);
const pickCell = ref<number | null>(null);
const submitting = ref(false);

const zone = computed(() => zones.value.find((z) => z.key === zoneKey.value));
const phases = computed(() => zone.value?.phases ?? []);
const grid = computed(() =>
  phaseId.value ? cemetery.gridByPhaseId[phaseId.value] : null,
);

const taken = computed(() => {
  const set = new Set<number>();
  for (const c of grid.value?.cells ?? []) {
    if (c.type !== 'empty') set.add(c.cell);
  }
  return set;
});

onMounted(async () => {
  zones.value = (await api.listZones()).filter((z) => !z.is_group_zone);
  if (session.tomb?.zone?.key) zoneKey.value = session.tomb.zone.key;
  const ph = phases.value.find((p) => p.used_cells < p.capacity) ?? phases.value[0];
  phaseId.value = ph?.id ?? null;
});

watch(zoneKey, () => {
  const ph = phases.value.find((p) => p.used_cells < p.capacity) ?? phases.value[0];
  phaseId.value = ph?.id ?? null;
  pickCell.value = null;
});

watch(phaseId, async (id) => {
  pickCell.value = null;
  if (id) await cemetery.fetchGrid(id);
});

function labelCell(n: number): string {
  const sp = grid.value?.cells.find((c) => c.cell === n)?.special ?? SPECIAL[n];
  if (taken.value.has(n)) {
    const c = grid.value?.cells.find((x) => x.cell === n);
    const nm = c?.tomb?.name || c?.group?.name || '已占';
    return nm;
  }
  return sp ? `★ ${sp}` : address(n);
}

async function confirm() {
  if (pickCell.value == null || phaseId.value == null || submitting.value) return;
  if (!session.ghostOut) {
    ui.toast('白天扛不动棺材，夜里再迁');
    return;
  }
  submitting.value = true;
  try {
    const res = await api.moveTomb({ zone_phase_id: phaseId.value, cell: pickCell.value });
    if (res.tomb) session.setTomb(res.tomb);
    ui.closeModal();
    ui.toast(res.address ? `迁好了，新家在 ${res.address}` : '迁坟完成。');
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
    <h2>迁坟</h2>
    <p class="sub">迁过去之后，碑上会多一行「迁过 N 次坟」。</p>
    <div class="field">
      <label for="mt-zone">园区</label>
      <select id="mt-zone" v-model="zoneKey">
        <option v-for="z in zones" :key="z.key" :value="z.key">{{ z.name }}</option>
      </select>
    </div>
    <div class="field">
      <label for="mt-phase">期</label>
      <select id="mt-phase" v-model="phaseId">
        <option v-for="p in phases" :key="p.id" :value="p.id">第 {{ p.number }} 期</option>
      </select>
    </div>
    <div class="minigrid">
      <button
        v-for="n in 60"
        :key="n - 1"
        type="button"
        :class="{
          taken: taken.has(n - 1),
          sp: !!(grid?.cells.find((c) => c.cell === n - 1)?.special ?? SPECIAL[n - 1]),
          on: pickCell === n - 1,
        }"
        :disabled="taken.has(n - 1)"
        @click="pickCell = n - 1"
      >
        {{ labelCell(n - 1) }}
      </button>
    </div>
    <div class="mfoot">
      <button class="btn quiet" type="button" @click="ui.closeModal()">不迁了</button>
      <button
        class="btn primary"
        type="button"
        :disabled="pickCell == null || submitting || !session.ghostOut"
        @click="confirm"
      >
        扛过去
      </button>
    </div>
    <p v-if="!session.ghostOut" class="why">白天扛不动棺材，夜里再迁。</p>
  </Modal>
</template>