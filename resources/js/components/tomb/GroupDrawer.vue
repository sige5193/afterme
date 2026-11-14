<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import StoneGroup from './StoneGroup.vue';
import * as api from '@/api/client';
import { ago } from '@/utils/time';
import type { GridGroupMember } from '@/api/types';
import { useCemeteryStore } from '@/stores/cemetery';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';

const cemetery = useCemeteryStore();
const session = useSessionStore();
const ui = useUiStore();
const router = useRouter();

const g = computed(() => cemetery.groupDetail);
const open = computed(() => !!cemetery.openGroupCode && !!g.value);

const myMember = computed(() =>
  g.value?.members.find((m) => m.tomb_code === session.tomb?.code) ?? null,
);
const isMember = computed(() => !!myMember.value);
const isFounder = computed(() => !!myMember.value?.is_founder);

const membersForStone = computed((): GridGroupMember[] =>
  (g.value?.members ?? []).map((m) => ({
    tomb_code: m.tomb_code,
    name: m.name,
    cause: m.cause,
    portrait: m.portrait,
    style: m.style,
    is_founder: m.is_founder,
  })),
);

async function editEpitaph() {
  if (!g.value || !session.ghostOut) {
    ui.toast('夜里才能改合葬碑文');
    return;
  }
  const next = window.prompt('合葬碑文（40 字）', g.value.epitaph || '');
  if (next == null) return;
  const v = next.trim();
  if (!v || v === g.value.epitaph) return;
  try {
    const res = await api.patchGroupEpitaph(g.value.code, v);
    cemetery.groupDetail = res.group;
    ui.toast('刻好了。');
  } catch (e) {
    ui.toast(e instanceof api.ApiError ? e.message : api.DEFAULT_ERROR, { err: true });
  }
}

function close() {
  cemetery.closeGroupDrawer();
  if (router.currentRoute.value.name === 'group') router.push('/mine');
}

function burn(target?: { code: string; name: string }) {
  if (!g.value) return;
  ui.openModal('burn', {
    code: target?.code || g.value.code,
    name: target?.name || g.value.name,
    own: false,
    groupCode: g.value.code,
  });
}
</script>

<template>
  <aside class="drawer" :class="{ open }" aria-label="合葬墓详情">
    <template v-if="g">
      <div class="dr-head">
        <span>合葬墓 · {{ g.address || g.name }}</span>
        <button class="x" aria-label="关闭" @click="close">✕</button>
      </div>
      <div v-if="g.disbanded_at" class="note">这座合葬墓已经拆了。</div>
      <StoneGroup
        :name="g.name"
        :relation-label="g.relation_label"
        :members="membersForStone"
      />
      <dl class="facts">
        <dt>墓长</dt>
        <dd>{{ g.founder_name || '—' }}</dd>
        <dt>关系</dt>
        <dd>{{ g.relation_label }}</dd>
      </dl>
      <div class="block">
        <div class="lbl">合葬碑文</div>
        <p class="ep-text">{{ g.epitaph || '（空白）' }}</p>
        <div v-if="g.epitaph_edits" class="note">合葬碑文改过 {{ g.epitaph_edits }} 次</div>
      </div>
      <div class="block">
        <div class="lbl">成员</div>
        <ul class="note memb">
          <li v-for="m in g.members" :key="m.tomb_code">
            <button type="button" class="linkish" @click="router.push(`/t/${m.tomb_code}`)">
              {{ m.name }}
            </button>
            <span v-if="m.is_founder">（墓长）</span>
            · {{ m.cause }}
          </li>
        </ul>
      </div>
      <div class="block">
        <div class="lbl">全墓香火</div>
        <div v-if="g.offering_count" class="note">
          {{ g.offering_count }} 次祭拜
          <template v-if="g.last_offering_at">
            · 最近一次 {{ ago(new Date(g.last_offering_at).getTime()) }}
          </template>
        </div>
        <div v-else class="note">还没人来烧过纸。</div>
      </div>
      <div v-if="g.past_member_names?.length" class="block">
        <div class="lbl">曾有同葬</div>
        <p class="note">曾有 {{ g.past_member_names.join('、') }} 同葬</p>
      </div>
      <div class="dr-acts">
        <button class="btn primary" @click="burn()">
          {{ session.tomb ? '烧纸' : '给全墓烧点' }}
        </button>
        <button v-if="isMember" class="btn" @click="ui.openModal('inbox')">香火簿</button>
        <button
          v-if="isMember"
          class="btn"
          :disabled="!session.ghostOut"
          @click="editEpitaph"
        >
          改合葬碑文
        </button>
        <button v-if="isMember" class="btn" @click="ui.openModal('invite')">邀请</button>
        <button v-if="isMember" class="btn quiet" @click="ui.openModal('leaveGroup', { name: g.name })">
          迁出合葬墓
        </button>
        <button v-if="isFounder" class="btn" @click="ui.openModal('groupSettings')">墓长设置</button>
        <button
          v-if="isFounder"
          class="btn"
          :disabled="!session.ghostOut"
          @click="ui.openModal('groupMove')"
        >
          整体迁墓
        </button>
        <button
          v-if="!isMember && session.tomb && session.ghostOut"
          class="btn"
          @click="ui.openModal('joinRequest', { code: g.code, name: g.name, apply: true, groupCode: g.code })"
        >
          申请入伙
        </button>
      </div>
    </template>
  </aside>
</template>

<style scoped>
.memb {
  list-style: none;
  padding: 0;
  margin: 0;
}
.memb li {
  margin: 6px 0;
}
.linkish {
  border: 0;
  background: none;
  color: var(--joss);
  cursor: pointer;
  padding: 0;
  font: inherit;
}
</style>