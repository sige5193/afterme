<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import StoneBig from './StoneBig.vue';
import { ITEM } from '@/config/items';
import { address, ago, ymd } from '@/utils/time';
import { useCemeteryStore } from '@/stores/cemetery';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';

const cemetery = useCemeteryStore();
const session = useSessionStore();
const ui = useUiStore();
const router = useRouter();

const t = computed(() => cemetery.detail);
const own = computed(() => !!t.value && !!session.tomb && t.value.id === session.tomb.id);
const open = computed(() => !!cemetery.openCode && !!t.value);

const age = computed(() => {
  if (!t.value) return 0;
  return new Date(t.value.died_at).getFullYear() - (t.value.birth_year || 2000);
});

const chips = computed(() => {
  const tot = t.value?.item_totals || {};
  return Object.entries(tot)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => ({ k, n, icon: ITEM[k]?.icon || '', name: ITEM[k]?.name || k }));
});

const marks = computed(() => {
  const m: string[] = [];
  if (!t.value) return m;
  if (t.value.zhashi_count) m.push(`该鬼曾白天诈尸 ${t.value.zhashi_count} 次`);
  if (t.value.knock_count) m.push(`棺材板被敲响 ${t.value.knock_count} 次`);
  if (t.value.funerals > 1) m.push(`办过 ${t.value.funerals} 次葬礼`);
  if (t.value.is_orphan) m.push('孤坟');
  return m;
});

function close() {
  cemetery.closeDrawer();
  if (router.currentRoute.value.name === 'tomb') router.push('/');
}

function burn() {
  if (!t.value) return;
  ui.openModal('burn', { code: t.value.code, name: t.value.name, own: own.value });
}

function openInbox() {
  ui.openModal('inbox');
}

function openEpitaph() {
  ui.openModal('epitaph');
}

function invite() {
  ui.openModal('invite');
}

function refuneral() {
  ui.funeralOpen = true;
  router.push('/funeral');
}

watch(
  () => ui.shakeStone,
  (v) => {
    /* class bound below */
  },
);
</script>

<template>
  <aside class="drawer" :class="{ open }" aria-label="墓碑详情">
    <template v-if="t">
      <div class="dr-head">
        <span>
          {{ t.is_npc ? '原住民' : own ? '我的坟' : '新坟' }} · {{ address(t.plot) }}
        </span>
        <button class="x" aria-label="关闭" @click="close">✕</button>
      </div>
      <StoneBig
        :name="t.name"
        :style="t.style"
        :birth-year="t.birth_year"
        :died-at="t.died_at"
        :portrait="t.portrait"
        :shake="ui.shakeStone"
      />
      <dl class="facts">
        <dt>死因</dt>
        <dd>{{ t.cause || '不详' }}</dd>
        <dt>享年</dt>
        <dd>{{ age }} 岁</dd>
        <dt>下葬</dt>
        <dd>{{ ymd(new Date(t.died_at).getTime()) }}</dd>
        <template v-if="t.last_words">
          <dt>遗言</dt>
          <dd>“{{ t.last_words }}”</dd>
        </template>
      </dl>
      <div class="block">
        <div class="lbl">墓志铭</div>
        <p class="ep-text">{{ t.epitaph || '（空白）' }}</p>
        <div v-if="t.epitaph_edits" class="note">碑文半夜改过 {{ t.epitaph_edits }} 次</div>
      </div>
      <div class="block">
        <div class="lbl">香火</div>
        <div v-if="chips.length" class="offer-chips">
          <span v-for="c in chips" :key="c.k" class="oc">{{ c.icon }} {{ c.name }} ×{{ c.n }}</span>
        </div>
        <div v-else class="note">还没人来烧过纸。</div>
        <div v-if="t.offering_count" class="note">
          {{ t.offering_count }} 次祭拜
          <template v-if="t.last_offering_at">
            · 最近一次 {{ ago(new Date(t.last_offering_at).getTime()) }}
          </template>
        </div>
      </div>
      <div v-if="marks.length" class="marks">
        <span v-for="(m, i) in marks" :key="i" class="mark">{{ m }}</span>
      </div>
      <div class="dr-acts">
        <template v-if="own">
          <button class="btn primary" @click="openInbox">
            香火簿 · {{ t.offering_count }} 次
          </button>
          <button class="btn" :disabled="!session.ghostOut" @click="openEpitaph">改碑文</button>
          <button class="btn" @click="burn">给自己烧点</button>
          <button class="btn" @click="invite">邀请烧纸</button>
          <button class="btn quiet" @click="refuneral">重办葬礼</button>
          <button
            class="btn quiet"
            @click="
              async () => {
                const code = await session.regenerateCode();
                ui.openModal('resurrectCode', { code });
              }
            "
          >
            重新生成还魂码
          </button>
        </template>
        <template v-else>
          <button class="btn primary" @click="burn">
            {{ session.tomb ? '串门 · 烧纸' : '烧纸' }}
          </button>
        </template>
      </div>
      <div v-if="own && !session.ghostOut" class="why">
        白天出不去，改碑文要等天黑（或者诈尸）。
      </div>
    </template>
  </aside>
</template>
