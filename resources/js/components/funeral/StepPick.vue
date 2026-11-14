<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { STYLES } from '@/config/styles';
import { SPECIAL } from '@/config/specialPlots';
import { COLS, address } from '@/utils/time';
import { short } from '@/utils/text';
import StoneMini from '@/components/tomb/StoneMini.vue';
import StoneBig from '@/components/tomb/StoneBig.vue';
import * as api from '@/api/client';
import type { ZoneInfo } from '@/api/types';
import { useSessionStore } from '@/stores/session';

const model = defineModel<{
  name: string;
  birthYear: number;
  portrait: number;
  style: string;
  zoneKey: string;
  zonePhaseId: number | null;
  cell: number;
  styleTouched: boolean;
}>({ required: true });

const emit = defineEmits<{ next: []; back: [] }>();
const session = useSessionStore();
const isRefuneral = computed(() => !!session.tomb);

const zones = ref<ZoneInfo[]>([]);
const phaseId = ref<number | null>(model.value.zonePhaseId);
const occupied = ref<Set<number>>(new Set());
const loading = ref(false);

const buryZones = computed(() => zones.value.filter((z) => !z.is_group_zone));

const currentZone = computed(() => buryZones.value.find((z) => z.key === model.value.zoneKey) ?? null);

const phases = computed(() => currentZone.value?.phases ?? []);

async function loadZones() {
  zones.value = await api.listZones();
  if (!model.value.zoneKey) {
    model.value.zoneKey = 'public';
  }
  await selectZone(model.value.zoneKey, false);
}

async function selectZone(key: string, resetStyle: boolean) {
  model.value.zoneKey = key;
  const z = buryZones.value.find((x) => x.key === key);
  if (!z) return;
  if (resetStyle && !model.value.styleTouched && z.default_style) {
    model.value.style = z.default_style;
  }
  const earliest = [...z.phases].sort((a, b) => a.number - b.number).find((p) => p.used_cells < p.capacity)
    ?? z.phases[0];
  if (earliest) await loadPhase(earliest.id);
}

async function loadPhase(id: number) {
  loading.value = true;
  phaseId.value = id;
  model.value.zonePhaseId = id;
  try {
    const grid = await api.getPhaseGrid(id);
    const taken = new Set<number>();
    for (const c of grid.cells) {
      if (c.type !== 'empty') taken.add(c.cell);
      if (c.type === 'group' && c.group) {
        for (let i = 0; i < c.group.width; i++) taken.add(c.start_cell ?? c.cell + i);
      }
    }
    // rebuild properly
    occupied.value = new Set(
      grid.cells.flatMap((c) => {
        if (c.type === 'empty') return [];
        if (c.type === 'group' && c.group) {
          return Array.from({ length: c.group.width }, (_, i) => c.group!.start_cell + i);
        }
        return [c.cell];
      }),
    );
    if (occupied.value.has(model.value.cell)) {
      let next = 0;
      while (occupied.value.has(next) && next < 60) next++;
      model.value.cell = next < 60 ? next : 0;
    }
  } finally {
    loading.value = false;
  }
}

function label(i: number) {
  if (occupied.value.has(i)) return short('占', 4);
  const sp = SPECIAL[i];
  if (sp) return short(sp, 5);
  return `${Math.floor(i / COLS) + 1}-${(i % COLS) + 1}`;
}

function pickStyle(k: string) {
  model.value.style = k;
  model.value.styleTouched = true;
}

onMounted(() => {
  void loadZones();
});

watch(
  () => model.value.zoneKey,
  (k) => {
    if (k) void selectZone(k, true);
  },
);
</script>

<template>
  <div class="split">
    <div>
      <template v-if="!isRefuneral">
        <h2 class="brush" style="font-size: 34px">选园区</h2>
        <div class="stylepick" style="margin-top: 12px">
          <button
            v-for="z in buryZones"
            :key="z.key"
            :class="{ on: model.zoneKey === z.key }"
            @click="selectZone(z.key, true)"
          >
            <StoneMini :name="z.name" :style="z.default_style || 'qingshi'" />
            <b style="font-size: 14px">{{ z.name }}</b>
            <small>{{ z.tagline }}</small>
            <small>已住 {{ z.tomb_count }} 人</small>
          </button>
        </div>
      </template>

      <h2 class="brush" style="font-size: 34px; margin-top: 26px">选碑</h2>
      <div class="stylepick" style="margin-top: 12px">
        <button
          v-for="s in STYLES"
          :key="s.k"
          :class="{ on: model.style === s.k }"
          @click="pickStyle(s.k)"
        >
          <StoneMini :name="model.name || '某某'" :style="s.k" />
          <b style="font-size: 14px">{{ s.name }}</b>
          <small>{{ s.note }}</small>
        </button>
      </div>

      <template v-if="!isRefuneral">
        <h2 class="brush" style="font-size: 34px; margin-top: 26px">选墓位</h2>
        <p class="note">
          金色的是好位置。灰色的已经有人住了。当前：第 {{ Math.floor(model.cell / COLS) + 1 }} 排第
          {{ (model.cell % COLS) + 1 }} 号{{ SPECIAL[model.cell] ? ' · ' + SPECIAL[model.cell] : '' }}
        </p>
        <div v-if="phases.length > 1" class="phase-tabs" style="margin: 8px 0">
          <button
            v-for="p in phases"
            :key="p.id"
            class="btn quiet"
            :class="{ on: phaseId === p.id }"
            @click="loadPhase(p.id)"
          >
            {{ p.number === 1 ? '一期' : p.number + '期' }}
          </button>
        </div>
        <div class="minigrid" style="margin-top: 10px; grid-template-columns: repeat(6, 1fr)">
          <button
            v-for="i in 60"
            :key="i - 1"
            :class="{
              taken: occupied.has(i - 1),
              sp: !!SPECIAL[i - 1] && !occupied.has(i - 1),
              on: model.cell === i - 1,
            }"
            :disabled="occupied.has(i - 1) || loading"
            :title="address(i - 1)"
            @click="model.cell = i - 1"
          >
            {{ label(i - 1) }}
          </button>
        </div>
        <p class="note" style="margin-top: 10px">
          想和朋友埋在一起？先各自下葬，夜里去对方坟前递一张结伴帖。
        </p>
      </template>
      <p v-else class="note" style="margin-top: 16px">重办葬礼不换位置，只更新你的登记信息。</p>

      <div class="fun-nav">
        <button class="btn" @click="emit('back')">上一步</button>
        <button class="btn primary" @click="emit('next')">就这儿了</button>
      </div>
    </div>
    <div class="preview">
      <div class="lbl">预览</div>
      <StoneBig
        :name="model.name || '某某'"
        :style="model.style"
        :birth-year="model.birthYear || 2000"
        :portrait="model.portrait"
        :died-at="Date.now()"
      />
    </div>
  </div>
</template>
