<script setup lang="ts">
import { FACES } from '@/config/faces';

const props = withDefaults(
  defineProps<{ portrait?: number; big?: boolean }>(),
  { portrait: 0, big: false },
);
</script>

<template>
  <span class="portrait" :class="{ big }">
    <span class="face">{{ FACES[portrait] || FACES[0] }}</span>
  </span>
</template>
