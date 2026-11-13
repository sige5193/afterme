<script setup lang="ts">
import { computed } from 'vue';
import { STYLES } from '@/config/styles';
import { SPECIAL } from '@/config/specialPlots';
import { COLS, address } from '@/utils/time';
import { short } from '@/utils/text';
import StoneMini from '@/components/tomb/StoneMini.vue';
import StoneBig from '@/components/tomb/StoneBig.vue';
import { useCemeteryStore } from '@/stores/cemetery';

const model = defineModel<{
  name: string;
  birthYear: number;
  portrait: number;
  style: string;
  plot: number;
}>({ required: true });

const emit = defineEmits<{ next: []; back: [] }>();

const cemetery = useCemeteryStore();
const taken = computed(() => cemetery.occupiedPlots);
const tot = computed(() => Math.max(30, cemetery.totalPlots));

function label(i: number) {
  const tk = taken.value.has(i);
  const occ = cemetery.byPlot.get(i);
  const sp = SPECIAL[i];
  if (tk) return short(occ?.name || '占', 4);
  if (sp) return short(sp, 5);
  return `${Math.floor(i / COLS) + 1}-${(i % COLS) + 1}`;
}
</script>

<template>
  <div class="split">
    <div>
      <h2 class="brush" style="font-size: 34px">选碑</h2>
      <div class="stylepick" style="margin-top: 12px">
        <button
          v-for="s in STYLES"
          :key="s.k"
          :class="{ on: model.style === s.k }"
          @click="model.style = s.k"
        >
          <StoneMini :name="model.name || '某某'" :style="s.k" />
          <b style="font-size: 14px">{{ s.name }}</b>
          <small>{{ s.note }}</small>
        </button>
      </div>
      <h2 class="brush" style="font-size: 34px; margin-top: 26px">选墓位</h2>
      <p class="note">
        金色的是好位置。灰色的已经有人住了。当前：{{ address(model.plot)
        }}{{ SPECIAL[model.plot] ? ' · ' + SPECIAL[model.plot] : '' }}
      </p>
      <div class="minigrid" style="margin-top: 10px">
        <button
          v-for="i in tot"
          :key="i - 1"
          :class="{
            taken: taken.has(i - 1),
            sp: !!SPECIAL[i - 1] && !taken.has(i - 1),
            on: model.plot === i - 1,
          }"
          :disabled="taken.has(i - 1)"
          :title="address(i - 1)"
          @click="model.plot = i - 1"
        >
          {{ label(i - 1) }}
        </button>
      </div>
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
