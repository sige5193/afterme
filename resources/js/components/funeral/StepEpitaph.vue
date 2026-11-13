<script setup lang="ts">
import { EPITAPHS } from '@/config/epitaphs';
import StoneBig from '@/components/tomb/StoneBig.vue';

const model = defineModel<{
  name: string;
  birthYear: number;
  portrait: number;
  style: string;
  epitaph: string;
}>({ required: true });

const emit = defineEmits<{ next: []; back: [] }>();
</script>

<template>
  <div class="split">
    <div>
      <h2 class="brush" style="font-size: 34px">墓志铭</h2>
      <p class="note">刻在碑上给路人看的一句话，最多 40 个字。以后每天晚上都能出来改。</p>
      <div class="field dark-field">
        <textarea
          v-model="model.epitaph"
          maxlength="40"
          placeholder="终于不用上班了"
        />
      </div>
      <div class="field dark-field">
        <span class="flabel">没灵感就抄一句</span>
        <div class="chips">
          <button
            v-for="e in EPITAPHS"
            :key="e"
            class="chip"
            @click="model.epitaph = e"
          >
            {{ e }}
          </button>
        </div>
      </div>
      <div class="fun-nav">
        <button class="btn" @click="emit('back')">上一步</button>
        <button class="btn primary" @click="emit('next')">开追悼会</button>
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
      <p class="ep-text" style="margin-top: 22px; font-size: 16px">
        {{ model.epitaph || '终于不用上班了' }}
      </p>
    </div>
  </div>
</template>
