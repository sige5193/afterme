<script setup lang="ts">
import { computed } from 'vue';
import { STYLES } from '@/config/styles';
import { short } from '@/utils/text';

const props = defineProps<{ name: string; style?: string }>();

const st = computed(() =>
  STYLES.some((s) => s.k === props.style) ? props.style! : 'qingshi',
);
const nm = computed(() =>
  short(props.name, st.value === 'mupai' || st.value === 'tubao' ? 4 : 5),
);
</script>

<template>
  <span v-if="st === 'tubao'" class="stone s-tubao">
    <span class="stake"><span class="vt">{{ nm }}</span></span>
  </span>
  <span v-else class="stone" :class="`s-${st}`">
    <span class="vt">{{ nm }}</span>
  </span>
</template>
