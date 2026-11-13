<script setup lang="ts">
import { onMounted } from 'vue';
import Modal from '@/components/layout/Modal.vue';
import OfferingList from '@/components/coffin/OfferingList.vue';
import { useOfferingsStore } from '@/stores/offerings';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const session = useSessionStore();
const offerings = useOfferingsStore();

onMounted(() => {
  void offerings.fetchInbox();
});
</script>

<template>
  <Modal @close="ui.closeModal()">
    <h2>香火簿</h2>
    <p class="sub">
      {{ offerings.inbox.length }} 次祭拜，{{
        offerings.inbox.filter((b) => !b.dream && !b.has_dream).length
      }}
      条等你托梦。{{ session.ghostOut ? '' : '白天只能看，天黑才能托梦。' }}
    </p>
    <OfferingList
      :list="offerings.inbox"
      :muffle="false"
      :can-reply="session.ghostOut"
    />
  </Modal>
</template>
