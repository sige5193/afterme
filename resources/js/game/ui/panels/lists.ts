/**
 * 列表类面板：我的墓园、搜索、园区列表、香火簿、我的梦、数数家当。
 */

import * as api from '@/api/client';
import type { CemeteryCard, MyCemeteryResponse } from '@/api/types';
import { fetchDreams, fetchInbox, itemsText, itemTotals as totalsOf } from '@/core/offerings';
import { openDream } from '@/core/pulse';
import { navigate, zonePath } from '@/core/router';
import { ghostOut } from '@/core/session';
import { state } from '@/core/state';
import { closePanel, openPanel } from '@/core/ui';
import { ITEMS, ITEM } from '@/config/items';
import { ZONES } from '@/config/zones';
import { ago } from '@/utils/time';
import { card, heading, note, para } from '../blocks';
import { button, clip, type FixWidthSizer, hbox, image, inputBox, type Sizer, txt, vbox } from '../kit';
import { offeringList } from '../offeringList';
import { Panel } from '../Panel';
import { COL } from '../theme';

function cemeteryCard(scene: Panel['scene'], w: number, c: CemeteryCard, sub: string, primary = false): Sizer {
  const box = card(scene, w);
  const row = hbox(scene, { width: w - 12, space: 6 });
  row.add(image(scene, c.kind === 'group' ? 'stone-hanbai' : `stone-${c.style || 'qingshi'}`), { align: 'left-center' });
  const info = vbox(scene, { space: 2 });
  info.add(txt(scene, c.kind === 'group' ? `${clip(c.name, 10)}（合葬）` : clip(c.name, 10), { color: COL.joss }), { align: 'left' });
  info.add(txt(scene, c.address || '墓址待定', { color: COL.dim, wrap: w - 100 }), { align: 'left' });
  if (sub) info.add(txt(scene, sub, { color: COL.dim2, wrap: w - 100 }), { align: 'left' });
  row.add(info, { proportion: 1, align: 'left-center' });
  row.add(button(scene, '去看看', { small: true, kind: primary ? 'primary' : 'normal', onClick: () => navigate(c.kind === 'group' ? `/g/${c.code}` : `/t/${c.code}`) }), { align: 'center' });
  box.add(row, { expand: true });
  return box;
}

export class MinePanel extends Panel {
  readonly kind = 'mine' as const;
  private data: MyCemeteryResponse | null = null;

  layout() {
    return 'drawer' as const;
  }

  title(): string {
    return '我的墓园';
  }

  subtitle(): string {
    return '人越来越多，这里只放跟你有关的坟。想逛逛就去园区。';
  }

  onOpen(): void {
    void api
      .myCemetery()
      .then((d) => {
        this.data = d;
        this.rerender();
      })
      .catch(() => undefined);
    this.subs.on('session', () => this.rerender());
  }

  buildBody(b: Sizer, w: number): void {
    const scene = this.scene;
    if (!this.data) {
      b.add(note(scene, '加载中…', w), { align: 'left' });
      return;
    }
    const sections: Array<{ key: keyof MyCemeteryResponse; title: string }> = [
      { key: 'mine', title: '我的坟' },
      { key: 'burned_me', title: '给我烧过纸的' },
      { key: 'i_burned', title: '我烧过纸的' },
      { key: 'neighbors', title: '邻居' },
    ];
    let any = false;
    for (const s of sections) {
      const list = this.data[s.key];
      if (!list.length) continue;
      any = true;
      b.add(heading(scene, s.title, w), { expand: true });
      for (const c of list) {
        const sub = s.key === 'burned_me' && c.burn_count ? `烧过 ${c.burn_count} 次` : c.relation_text || c.cause || '';
        b.add(cemeteryCard(scene, w, c, sub, s.key === 'mine'), { expand: true });
      }
    }
    if (!any) b.add(note(scene, '这里还空着。', w), { align: 'left' });
  }

  buildFooter(f: FixWidthSizer): void {
    f.add(button(this.scene, '去园区逛逛', { icon: 'zones', onClick: () => navigate('/zones') }));
    f.add(button(this.scene, '搜一个人', { icon: 'search', onClick: () => navigate('/search') }));
  }
}

export class SearchPanel extends Panel {
  readonly kind = 'search' as const;
  private q: string;
  private results: CemeteryCard[] = [];
  private loading = false;
  private searched = false;
  private seq = 0;

  constructor(scene: Panel['scene'], payload: Record<string, unknown>) {
    super(scene, payload);
    this.q = String(payload.q ?? '');
  }

  layout() {
    return 'drawer' as const;
  }

  title(): string {
    return '问土地公';
  }

  subtitle(): string {
    return '搜名字，或者输入 6 位墓址码直接过去。';
  }

  onOpen(): void {
    if (this.q.trim()) void this.run();
  }

  private async run(): Promise<void> {
    const q = this.q.trim();
    history.replaceState(null, '', q ? `/search?q=${encodeURIComponent(q)}` : '/search');
    if (!q) {
      this.results = [];
      this.searched = false;
      this.rerender(false);
      return;
    }
    const seq = ++this.seq;
    this.loading = true;
    this.rerender(false);
    try {
      const res = await api.search(q);
      if (seq !== this.seq) return;
      if (res.redirect) {
        navigate(res.redirect);
        return;
      }
      this.results = res.results ?? [];
    } catch {
      this.results = [];
    }
    if (seq !== this.seq) return;
    this.loading = false;
    this.searched = true;
    this.rerender(false);
  }

  buildBody(b: Sizer, w: number): void {
    const scene = this.scene;
    const row = hbox(scene, { width: w, space: 4 });
    const { box, input } = inputBox(scene, {
      owner: this.id,
      width: w - 52,
      value: this.q,
      maxLength: 32,
      placeholder: '例如：老王 或 abc123',
      onInput: (v) => (this.q = v),
      onEnter: () => void this.run(),
    });
    row.add(box, { align: 'center' });
    row.add(button(scene, '搜索', { kind: 'primary', onClick: () => void this.run() }), { align: 'center' });
    b.add(row, { expand: true });
    if (!this.q && !this.searched) scene.time.delayedCall(80, () => input.focus());
    if (this.loading) b.add(note(scene, '查找中…', w), { align: 'left' });
    else if (this.searched && !this.results.length) b.add(para(scene, '没找到。可能 TA 还活着。', w, COL.dim), { align: 'left' });
    for (const c of this.results) b.add(cemeteryCard(scene, w, c, c.cause || ''), { expand: true });
  }
}

export class ZonesPanel extends Panel {
  readonly kind = 'zones' as const;

  layout() {
    return 'drawer' as const;
  }

  title(): string {
    return '园区导览';
  }

  onOpen(): void {
    this.subs.on('zones', () => this.rerender()).on('presence', () => this.rerender());
  }

  buildBody(b: Sizer, w: number): void {
    const scene = this.scene;
    for (const z of state.zones) {
      const c = card(scene, w);
      const row = hbox(scene, { width: w - 12, space: 6 });
      row.add(image(scene, z.is_group_zone ? 'stone-hanbai' : `stone-${z.default_style || ZONES[z.key as keyof typeof ZONES]?.default_style || 'qingshi'}`), { align: 'left-center' });
      const info = vbox(scene, { space: 2 });
      info.add(txt(scene, z.name, { color: COL.joss }), { align: 'left' });
      info.add(txt(scene, z.tagline, { color: COL.dim, wrap: w - 100 }), { align: 'left' });
      info.add(txt(scene, `共 ${z.phases.length} 期 · 入住 ${z.tomb_count} 人 · 此刻鬼 ${state.zoneGhosts[z.key] ?? z.ghosts_online} 位`, { color: COL.dim2, wrap: w - 100 }), { align: 'left' });
      row.add(info, { proportion: 1, align: 'left-center' });
      row.add(button(scene, '进去', { small: true, onClick: () => navigate(zonePath(z.key, 1)) }), { align: 'center' });
      c.add(row, { expand: true });
      b.add(c, { expand: true });
    }
  }
}

export class InboxPanel extends Panel {
  readonly kind = 'inbox' as const;
  private revealed = new Set<number>();

  preferredWidth(): number {
    return 420;
  }

  title(): string {
    return '香火簿';
  }

  subtitle(): string {
    const list = state.inbox.filter((b) => b.type !== 'join_request');
    const pending = list.filter((b) => !('dream' in b && b.dream) && !('has_dream' in b && b.has_dream)).length;
    return `${list.length} 次祭拜，${pending} 条等你托梦。${ghostOut() ? '' : '白天只能看，天黑才能托梦。'}`;
  }

  onOpen(): void {
    this.subs.on('inbox', () => this.rerender()).on('session', () => this.rerender());
    void fetchInbox();
  }

  buildBody(b: Sizer, w: number): void {
    b.add(
      offeringList(this.scene, w, state.inbox, {
        muffle: false,
        canReply: ghostOut(),
        revealed: this.revealed,
        onReveal: () => undefined,
      }),
      { expand: true },
    );
  }
}

export class DreamsPanel extends Panel {
  readonly kind = 'dreams' as const;

  preferredWidth(): number {
    return 420;
  }

  title(): string {
    return '我的梦';
  }

  subtitle(): string {
    const replied = state.dreams.reduce((n, d) => n + (d.dreams?.length || (d.dream ? 1 : 0)), 0);
    return `你烧过 ${state.dreams.length} 次纸，收到 ${replied} 个梦。`;
  }

  onOpen(): void {
    this.subs.on('dreams', () => this.rerender());
    void fetchDreams();
  }

  buildBody(b: Sizer, w: number): void {
    const scene = this.scene;
    if (state.specialDreams.length) {
      b.add(heading(scene, '结伴帖的回音', w), { expand: true });
      for (const d of state.specialDreams) {
        const c = card(scene, w, d.kind === 'system' ? 'card' : 'cardSeal');
        const head = hbox(scene, { width: w - 12, space: 4 });
        head.add(txt(scene, d.kind === 'system' ? '系统消息' : d.tomb?.name || '回音', { color: COL.joss }), { proportion: 1, align: 'left' });
        head.add(txt(scene, ago(new Date(d.visible_at || d.created_at).getTime()), { color: COL.dim2 }), { align: 'right' });
        c.add(head, { expand: true });
        c.add(txt(scene, d.text, { wrap: w - 12 }), { align: 'left' });
        c.add(
          button(scene, d.read_at ? '再看一次' : '去做梦', {
            small: true,
            kind: d.read_at ? 'normal' : 'primary',
            onClick: () => {
              closePanel('dreams');
              void openDream(d);
            },
          }),
          { align: 'left' },
        );
        b.add(c, { expand: true });
      }
    }
    if (!state.dreams.length) {
      b.add(note(scene, '还没给谁烧过纸。', w), { align: 'left' });
    }
    for (const row of state.dreams) {
      const o = row.offering;
      const c = card(scene, w);
      const head = hbox(scene, { width: w - 12, space: 4 });
      const target = o.group?.name || o.tomb?.name || row.dream?.tomb_name || '某位故人';
      head.add(txt(scene, `给 ${clip(target, 10)}`, { color: COL.joss }), { proportion: 1, align: 'left' });
      head.add(txt(scene, ago(new Date(o.created_at).getTime()), { color: COL.dim2 }), { align: 'right' });
      c.add(head, { expand: true });
      c.add(txt(scene, `烧了 ${itemsText(o.items)}`, { color: COL.dim, wrap: w - 12 }), { align: 'left' });
      const dreams = row.dreams ?? (row.dream ? [row.dream] : []);
      if (!dreams.length) {
        c.add(txt(scene, '还没回音。鬼白天睡觉，晚上才出来。', { color: COL.dim2, wrap: w - 12 }), { align: 'left' });
      }
      for (const d of dreams) {
        const line = hbox(scene, { width: w - 12, space: 4 });
        const who = d.tomb?.name || d.tomb_name || '有人';
        line.add(txt(scene, `${clip(who, 8)} ${d.read_at ? '托过梦了' : '托梦了'}`, { color: d.read_at ? COL.dim : COL.wisp }), { proportion: 1, align: 'left-center' });
        line.add(
          button(scene, '去做梦', {
            small: true,
            kind: d.read_at ? 'normal' : 'primary',
            onClick: () => {
              closePanel('dreams');
              void openDream(d, who);
            },
          }),
          { align: 'center' },
        );
        c.add(line, { expand: true });
      }
      b.add(c, { expand: true });
    }
    b.add(note(scene, '换设备会丢失你的梦。想留住，就先办一场葬礼拿到还魂码。', w), { align: 'left' });
  }

  buildFooter(f: FixWidthSizer): void {
    f.add(
      button(this.scene, '我死过，回到我的坟', {
        kind: 'quiet',
        onClick: () => {
          closePanel('dreams');
          openPanel('resurrect');
        },
      }),
    );
  }
}

export class WealthPanel extends Panel {
  readonly kind = 'wealth' as const;

  title(): string {
    return '数数家当';
  }

  subtitle(): string {
    return '按天地银行牌价折算。';
  }

  onOpen(): void {
    this.subs.on('inbox', () => this.rerender());
    void fetchInbox();
  }

  buildBody(b: Sizer, w: number): void {
    const scene = this.scene;
    const tot = totalsOf(state.inbox.filter((x) => x.type !== 'join_request') as { items?: Record<string, number> }[]);
    const val = Object.entries(tot).reduce((a, [k, n]) => a + (ITEM[k]?.val || 0) * n, 0);
    b.add(txt(scene, `${val.toLocaleString('zh-CN')} 亿`, { color: COL.joss, scale: 3 }), { align: 'center' });
    b.add(note(scene, `冥币总资产${val > 1000 ? '，在下面算是中产了' : val > 0 ? '，省着点花' : '，目前穷得叮当响'}。`, w), { align: 'center' });
    const rows = ITEMS.filter((i) => tot[i.k]);
    if (!rows.length) {
      b.add(note(scene, '一件都没有。', w), { align: 'center' });
      return;
    }
    for (const i of rows) {
      const r = hbox(scene, { width: w, space: 6 });
      r.add(image(scene, `item-${i.k}`), { align: 'center' });
      r.add(txt(scene, i.name), { proportion: 1, align: 'left-center' });
      r.add(txt(scene, `×${tot[i.k]}`, { color: COL.joss }), { align: 'center' });
      b.add(r, { expand: true });
    }
  }
}
