import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { PulseGhost } from '@/api/types';

export const usePresenceStore = defineStore('presence', () => {
  const ghosts = ref<PulseGhost[]>([]);
  const livingCount = ref(0);

  function apply(g: PulseGhost[], living: number) {
    ghosts.value = g;
    livingCount.value = living;
  }

  return { ghosts, livingCount, apply };
});
