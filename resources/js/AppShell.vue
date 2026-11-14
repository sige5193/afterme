<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import TopBar from '@/components/layout/TopBar.vue';
import ToastStack from '@/components/layout/ToastStack.vue';
import ZoneDirectory from '@/components/cemetery/ZoneDirectory.vue';
import ZoneView from '@/components/cemetery/ZoneView.vue';
import Hero from '@/components/cemetery/Hero.vue';
import TombDrawer from '@/components/tomb/TombDrawer.vue';
import GroupDrawer from '@/components/tomb/GroupDrawer.vue';
import CoffinView from '@/components/coffin/CoffinView.vue';
import MyCemetery from '@/views/MyCemetery.vue';
import SearchView from '@/views/SearchView.vue';
import FuneralOverlay from '@/components/funeral/FuneralOverlay.vue';
import BurnModal from '@/components/modals/BurnModal.vue';
import DreamComposer from '@/components/modals/DreamComposer.vue';
import InboxModal from '@/components/modals/InboxModal.vue';
import DreamsModal from '@/components/modals/DreamsModal.vue';
import InviteModal from '@/components/modals/InviteModal.vue';
import WealthModal from '@/components/modals/WealthModal.vue';
import EpitaphModal from '@/components/modals/EpitaphModal.vue';
import ZhashiModal from '@/components/modals/ZhashiModal.vue';
import ResurrectModal from '@/components/modals/ResurrectModal.vue';
import ResurrectCodeModal from '@/components/modals/ResurrectCodeModal.vue';
import JoinRequestModal from '@/components/modals/JoinRequestModal.vue';
import JoinRespondModal from '@/components/modals/JoinRespondModal.vue';
import MoveTombModal from '@/components/modals/MoveTombModal.vue';
import LeaveGroupModal from '@/components/modals/LeaveGroupModal.vue';
import GroupSettingsModal from '@/components/modals/GroupSettingsModal.vue';
import GroupMoveModal from '@/components/modals/GroupMoveModal.vue';
import BurnOverlay from '@/components/effects/BurnOverlay.vue';
import DreamOverlay from '@/components/effects/DreamOverlay.vue';
import UnionOverlay from '@/components/effects/UnionOverlay.vue';
import JossCanvas from '@/components/effects/JossCanvas.vue';
import { usePolling } from '@/composables/usePolling';
import { useSound } from '@/composables/useSound';
import { useCemeteryStore } from '@/stores/cemetery';
import { useClockStore } from '@/stores/clock';
import { usePulseStore } from '@/stores/pulse';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const cemetery = useCemeteryStore();
const clock = useClockStore();
const pulse = usePulseStore();
const ui = useUiStore();

const sound = useSound(() => ui.sound);

const page = computed(() => {
  if (session.tomb && ui.pref === 'coffin') return 'coffin';
  const name = String(route.name || '');
  if (name === 'mine') return 'mine';
  if (name === 'zones' || name === 'home') return session.tomb ? 'mine' : 'zones';
  if (name === 'zone' || name === 'tomb' || name === 'group') return 'zone';
  if (name === 'search') return 'search';
  return 'zones';
});

const polling = usePolling({
  sendPulse: () => pulse.sendPulse(),
  active: () => pulse.activePolling,
});

function wireSoundEvents() {
  const map: Record<string, () => void> = {
    'afterme:knock-sound': () => sound.knock(),
    'afterme:gong': () => sound.gong(),
    'afterme:muyu': () => sound.muyu(),
    'afterme:bell': () => sound.bell(),
    'afterme:whoosh': () => sound.whoosh(),
    'afterme:dirge': () => sound.dirge(),
    'afterme:stop-sound': () => sound.stop(),
  };
  const crackle = (e: Event) => sound.crackle((e as CustomEvent).detail ?? 3);
  for (const [k, fn] of Object.entries(map)) addEventListener(k, fn);
  addEventListener('afterme:crackle', crackle);
  return () => {
    for (const [k, fn] of Object.entries(map)) removeEventListener(k, fn);
    removeEventListener('afterme:crackle', crackle);
  };
}

async function syncRoute() {
  if (route.name === 'funeral') {
    if (session.ready) ui.funeralOpen = true;
    return;
  }
  if (route.name === 'home' && session.ready && session.tomb) {
    await router.replace('/mine');
    return;
  }
  if (route.name === 'tomb') {
    const code = String(route.params.code || '');
    if (code) {
      ui.pref = 'cemetery';
      await cemetery.openTomb(code);
    }
    return;
  }
  if (route.name === 'group') {
    const code = String(route.params.code || '');
    if (code) {
      ui.pref = 'cemetery';
      await cemetery.openGroup(code);
    }
    return;
  }
  if (cemetery.openCode) cemetery.closeDrawer();
  if (cemetery.openGroupCode && route.name !== 'zone') cemetery.closeGroupDrawer();
}

watch(
  () => [route.fullPath, session.ready] as const,
  () => {
    void syncRoute();
  },
  { immediate: true },
);

watch(
  () => session.ghostOut,
  (out) => {
    if (session.tomb && !out) ui.pref = 'coffin';
  },
);

function onBurnDone() {
  ui.burnOverlay = null;
  const msg = (window as any).__aftermePendingBurnToast as string | undefined;
  if (msg) {
    ui.toast(msg, { ms: 7000 });
    delete (window as any).__aftermePendingBurnToast;
  }
}

let unwire: (() => void) | undefined;

onMounted(async () => {
  clock.start();
  unwire = wireSoundEvents();
  await session.bootstrap();
  await cemetery.fetchZones();
  polling.start();
  void syncRoute();
});

onUnmounted(() => {
  clock.stop();
  polling.stop();
  unwire?.();
  sound.stop();
});
</script>

<template>
  <TopBar />
  <main>
    <template v-if="page === 'coffin'">
      <CoffinView />
    </template>
    <template v-else-if="page === 'mine'">
      <MyCemetery />
    </template>
    <template v-else-if="page === 'search'">
      <SearchView />
    </template>
    <template v-else-if="page === 'zone'">
      <ZoneView />
    </template>
    <template v-else>
      <Hero v-if="!session.tomb" />
      <ZoneDirectory />
    </template>
  </main>
  <TombDrawer />
  <GroupDrawer />
  <ToastStack />
  <JossCanvas />

  <FuneralOverlay v-if="ui.funeralOpen" @close="ui.funeralOpen = false" />

  <BurnModal v-if="ui.modal === 'burn'" />
  <DreamComposer v-if="ui.modal === 'dreamComposer'" />
  <InboxModal v-if="ui.modal === 'inbox'" />
  <DreamsModal v-if="ui.modal === 'dreams'" />
  <InviteModal v-if="ui.modal === 'invite'" />
  <WealthModal v-if="ui.modal === 'wealth'" />
  <EpitaphModal v-if="ui.modal === 'epitaph'" />
  <ZhashiModal v-if="ui.modal === 'zhashi'" />
  <ResurrectModal v-if="ui.modal === 'resurrect'" />
  <ResurrectCodeModal v-if="ui.modal === 'resurrectCode'" />
  <JoinRequestModal v-if="ui.modal === 'joinRequest'" />
  <JoinRespondModal v-if="ui.modal === 'joinRespond'" />
  <MoveTombModal v-if="ui.modal === 'moveTomb'" />
  <LeaveGroupModal v-if="ui.modal === 'leaveGroup'" />
  <GroupSettingsModal v-if="ui.modal === 'groupSettings'" />
  <GroupMoveModal v-if="ui.modal === 'groupMove'" />

  <BurnOverlay
    v-if="ui.burnOverlay"
    :items="ui.burnOverlay.items"
    :name="ui.burnOverlay.name"
    @done="onBurnDone"
  />
  <DreamOverlay
    v-if="ui.dreamOverlay"
    v-bind="ui.dreamOverlay"
    @close="ui.dreamOverlay = null"
  />
  <UnionOverlay v-if="ui.unionOverlay" @done="ui.unionOverlay = false" />
</template>
