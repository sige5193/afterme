<script setup lang="ts">
import { CAUSES } from '@/config/causes';
import { FACES } from '@/config/faces';
import Portrait from '@/components/tomb/Portrait.vue';

const model = defineModel<{
  name: string;
  birthYear: string | number;
  cause: string;
  portrait: number;
  lastWords: string;
  regNo: string;
}>({ required: true });

const err = defineModel<string>('err', { default: '' });

const emit = defineEmits<{ next: [] }>();

function pickCause(c: string) {
  model.value.cause = c;
}

function onCustomCause(e: Event) {
  const v = (e.target as HTMLInputElement).value.trim();
  if (v) model.value.cause = v;
}
</script>

<template>
  <div class="paper">
    <div class="stamp">地府<br />户籍科</div>
    <h2>阴间户籍登记表</h2>
    <div class="sub">地府民政局 · 不活了分局 · 编号 {{ model.regNo }}</div>
    <div class="two">
      <div class="field">
        <label for="fname">姓名 / 称呼</label>
        <input
          id="fname"
          v-model="model.name"
          type="text"
          maxlength="8"
          placeholder="会刻在碑上，最多 8 个字"
        />
      </div>
      <div class="field">
        <label for="fyear">出生年份</label>
        <input
          id="fyear"
          v-model="model.birthYear"
          type="number"
          min="1900"
          :max="new Date().getFullYear()"
          placeholder="例如 1996"
        />
      </div>
    </div>
    <div class="field">
      <span class="flabel">死因</span>
      <div class="chips">
        <button
          v-for="c in CAUSES"
          :key="c"
          class="chip"
          :class="{ on: model.cause === c }"
          @click="pickCause(c)"
        >
          {{ c }}
        </button>
      </div>
      <input
        type="text"
        maxlength="12"
        placeholder="都不是？自己写一个"
        :value="CAUSES.includes(model.cause as any) ? '' : model.cause"
        @input="onCustomCause"
      />
    </div>
    <div class="field">
      <span class="flabel">遗像（黑白）</span>
      <div class="faces">
        <button
          v-for="(f, i) in FACES"
          :key="i"
          :class="{ on: model.portrait === i }"
          :aria-label="'遗像 ' + (i + 1)"
          @click="model.portrait = i"
        >
          <Portrait :portrait="i" />
        </button>
      </div>
    </div>
    <div class="field">
      <label for="flast">遗言</label>
      <input
        id="flast"
        v-model="model.lastWords"
        type="text"
        maxlength="40"
        placeholder="葬礼上会念，最多 40 个字"
      />
    </div>
    <div class="err-line">{{ err }}</div>
    <div class="fun-nav">
      <span />
      <button class="btn primary" @click="emit('next')">盖章，下一步</button>
    </div>
  </div>
</template>
