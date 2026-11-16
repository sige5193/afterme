/**
 * 坟的详情抽屉（个人坟、合葬墓）。
 */

import * as api from '@/api/client';
import type { GroupDetail, TombDetail } from '@/api/types';
import { pulseNow } from '@/core/pulse';
import { navigate } from '@/core/router';
import { ghostOut, isOwnTomb, regenerateCode } from '@/core/session';
import { state } from '@/core/state';
import { openPanel, toast } from '@/core/ui';
import { ago, ymd } from '@/utils/time';
import { buttonRow, card, facts, heading, itemTotals, marks, note, para } from '../blocks';
import { button, clip, type FixWidthSizer, hbox, image, type OverlapSizer, type Sizer, tappable, txt } from '../kit';
import { Panel } from '../Panel';
import { bigStoneView, groupStoneView } from '../stones';
import { COL } from '../theme';

export class TombPanel extends Panel {
  readonly kind = 'tomb' as const;
  private t: TombDetail | null;
  private stone: OverlapSizer | null = null;

  constructor(scene: Panel['scene'], payload: Record<string, unknown>) {
    super(scene, payload);
    this.t = (payload.tomb as TombDetail) ?? null;
  }

  layout() {
    return 'drawer' as const;
  }

  private get code(): string {
    return String(this.payload.code ?? this.t?.code ?? '');
  }

  private own(): boolean {
    return !!this.t && isOwnTomb(this.t.code);
  }

  onOpen(): void {
    state.detailOpen = true;
    state.viewingTombId = this.t?.id ?? null;
    pulseNow();
    this.subs
      .on('knock', () => this.shake())
      .on('session', () => {
        if (this.own() && state.tomb) this.t = { ...this.t!, ...state.tomb };
        this.rerender();
      })
      .on('changed', (code) => {
        if (code === this.code) void this.reload();
      });
    if (!this.t) void this.reload();
  }

  onClose(): void {
    state.detailOpen = false;
    state.viewingTombId = null;
  }

  private async reload(): Promise<void> {
    try {
      this.t = await api.getTomb(this.code);
      state.viewingTombId = this.t.id;
      this.rerender();
    } catch {
      toast(api.DEFAULT_ERROR, { err: true });
    }
  }

  private shake(): void {
    const s = this.stone;
    if (!s) return;
    const x = s.x;
    this.scene.tweens.add({ targets: s, x: x + 2, duration: 50, yoyo: true, repeat: 4, onComplete: () => s.setX(x) });
  }

  title(): string {
    if (!this.t) return '墓碑';
    return this.t.is_npc ? '原住民' : this.own() ? '我的坟' : '新坟';
  }

  subtitle(): string | null {
    return this.t?.address ?? null;
  }

  buildBody(b: Sizer, w: number): void {
    const t = this.t;
    const scene = this.scene;
    if (!t) {
      b.add(note(scene, '加载中…', w), { align: 'left' });
      return;
    }
    const stone = bigStoneView(scene, { name: t.name, style: t.style, birthYear: t.birth_year, diedAt: t.died_at, portrait: t.portrait });
    this.stone = stone;
    b.add(stone, { align: 'center' });
    const age = new Date(t.died_at).getFullYear() - (t.birth_year || 2000);
    const rows: Array<[string, string]> = [
      ['死因', t.cause || '不详'],
      ['享年', `${age} 岁`],
      ['下葬', ymd(new Date(t.died_at).getTime())],
    ];
    if (t.last_words) rows.push(['遗言', `“${t.last_words}”`]);
    b.add(facts(scene, rows, w), { expand: true });

    b.add(heading(scene, '墓志铭', w), { expand: true });
    b.add(para(scene, t.epitaph || '（空白）', w), { align: 'left' });
    if (t.epitaph_edits) b.add(note(scene, `碑文半夜改过 ${t.epitaph_edits} 次`, w), { align: 'left' });

    b.add(heading(scene, '香火', w), { expand: true });
    const chips = itemTotals(scene, t.item_totals, w);
    if (chips) b.add(chips, { align: 'left' });
    else b.add(note(scene, '还没人来烧过纸。', w), { align: 'left' });
    if (t.offering_count) {
      b.add(note(scene, `${t.offering_count} 次祭拜${t.last_offering_at ? ' · 最近一次 ' + ago(new Date(t.last_offering_at).getTime()) : ''}`, w), { align: 'left' });
    }

    const m: string[] = [];
    if (t.zhashi_count) m.push(`该鬼曾白天诈尸 ${t.zhashi_count} 次`);
    if (t.move_count) m.push(`迁过 ${t.move_count} 次坟`);
    if (t.knock_count) m.push(`棺材板被敲响 ${t.knock_count} 次`);
    if (t.funerals > 1) m.push(`办过 ${t.funerals} 次葬礼`);
    if (t.is_orphan) m.push('孤坟');
    for (const g of t.past_groups ?? []) if (g.name_snapshot) m.push(`曾与 ${g.name_snapshot} 合葬`);
    const mk = marks(scene, m, w);
    if (mk) b.add(mk, { align: 'left' });

    if (this.own()) {
      const out = ghostOut();
      b.add(heading(scene, '自己的坟', w), { expand: true });
      const inGroup = !!state.tomb?.group;
      b.add(
        buttonRow(scene, w, [
          ['改碑文', { disabled: !out, why: '白天出不去，改碑文要等天黑（或者诈尸）。', onClick: () => openPanel('epitaph') }],
          [inGroup ? '迁出合葬墓' : '迁坟', inGroup ? { onClick: () => openPanel('leaveGroup', { name: state.tomb?.group?.name }) } : { disabled: !out, why: '白天扛不动棺材，夜里再迁', onClick: () => openPanel('moveTomb') }],
          ['重办葬礼', { kind: 'quiet', onClick: () => navigate('/funeral') }],
          [
            '重新生成还魂码',
            {
              kind: 'quiet',
              onClick: () => {
                void regenerateCode()
                  .then((code) => openPanel('resurrectCode', { code }))
                  .catch((e) => toast(e instanceof Error ? e.message : api.DEFAULT_ERROR, { err: true }));
              },
            },
          ],
        ]),
        { expand: true },
      );
      if (!out) b.add(note(scene, '白天出不去，改碑文要等天黑（或者诈尸）。', w), { align: 'left' });
    }
  }

  buildFooter(f: FixWidthSizer, w: number): void {
    const t = this.t;
    if (!t) return;
    const scene = this.scene;
    if (this.own()) {
      f.add(button(scene, `香火簿 · ${t.offering_count}`, { kind: 'primary', icon: 'inbox', onClick: () => openPanel('inbox') }));
      f.add(button(scene, '给自己烧点', { icon: 'flame', onClick: () => openPanel('burn', { code: t.code, name: t.name, own: true }) }));
      f.add(button(scene, '邀请烧纸', { icon: 'invite', onClick: () => openPanel('invite') }));
      return;
    }
    f.add(button(scene, state.tomb ? '串门 · 烧纸' : '烧纸', { kind: 'primary', icon: 'flame', onClick: () => openPanel('burn', { code: t.code, name: t.name }) }));
    if (state.tomb) {
      const why = !ghostOut()
        ? '夜里才能递结伴帖'
        : t.group
          ? 'TA 已经和别人合葬了，得先迁出来'
          : (state.group?.member_count ?? 0) >= 6
            ? '满员了'
            : '';
      f.add(
        button(scene, '求合葬', {
          icon: 'scroll',
          disabled: !!why,
          why,
          onClick: () => openPanel('joinRequest', { code: t.code, name: t.name }),
        }),
      );
    }
    void w;
  }
}

export class GroupPanel extends Panel {
  readonly kind = 'group' as const;
  private g: GroupDetail | null;
  private expanded = new Set<string>();

  constructor(scene: Panel['scene'], payload: Record<string, unknown>) {
    super(scene, payload);
    this.g = (payload.group as GroupDetail) ?? null;
    const h = payload.highlight as string | null | undefined;
    if (h) this.expanded.add(h);
  }

  layout() {
    return 'drawer' as const;
  }

  private get code(): string {
    return String(this.payload.code ?? this.g?.code ?? '');
  }

  private me() {
    return this.g?.members.find((m) => m.tomb_code === state.tomb?.code) ?? null;
  }

  onOpen(): void {
    state.detailOpen = true;
    pulseNow();
    this.subs
      .on('session', () => this.rerender())
      .on('changed', (code) => {
        if (code === this.code) void this.reload();
      });
    if (!this.g) void this.reload();
  }

  onClose(): void {
    state.detailOpen = false;
  }

  async reload(): Promise<void> {
    try {
      this.g = await api.getGroup(this.code);
      this.rerender();
    } catch (e) {
      toast(e instanceof Error ? e.message : api.DEFAULT_ERROR, { err: true });
    }
  }

  title(): string {
    return '合葬墓';
  }

  subtitle(): string | null {
    return this.g?.address || this.g?.name || null;
  }

  buildBody(b: Sizer, w: number): void {
    const g = this.g;
    const scene = this.scene;
    if (!g) {
      b.add(note(scene, '加载中…', w), { align: 'left' });
      return;
    }
    if (g.disbanded_at) {
      b.add(para(scene, '这座合葬墓已经拆了。', w, COL.seal), { align: 'left' });
      if (g.past_member_names.length) b.add(note(scene, `曾有 ${g.past_member_names.join('、')} 同葬`, w), { align: 'left' });
      return;
    }
    b.add(
      groupStoneView(scene, {
        name: g.name,
        relationLabel: g.relation_label,
        members: g.members.map((m) => ({ tomb_code: m.tomb_code, name: m.name, cause: m.cause, portrait: m.portrait, style: m.style, is_founder: m.is_founder })),
      }, w),
      { align: 'center' },
    );
    b.add(facts(scene, [
      ['墓长', g.founder_name || '—'],
      ['关系', g.relation_label],
    ], w), { expand: true });

    b.add(heading(scene, '合葬碑文', w), { expand: true });
    b.add(para(scene, g.epitaph || '（空白）', w), { align: 'left' });
    if (g.epitaph_edits) b.add(note(scene, `合葬碑文改过 ${g.epitaph_edits} 次`, w), { align: 'left' });

    b.add(heading(scene, `成员 · ${g.members.length} 人`, w), { expand: true });
    for (const m of g.members) {
      const open = this.expanded.has(m.tomb_code);
      const c = card(scene, w, open ? 'cardHi' : 'card');
      const head = hbox(scene, { width: w - 12, space: 5 });
      head.add(image(scene, `face-${m.portrait ?? 0}`), { align: 'left-center' });
      head.add(txt(scene, clip(m.name, 8), { color: open ? COL.joss : COL.bone }), { align: 'center' });
      if (m.is_founder) head.add(txt(scene, '墓长', { color: COL.seal }), { align: 'center' });
      head.add(txt(scene, `· ${m.cause}`, { color: COL.dim, wrap: w - 120 }), { proportion: 1, align: 'left-center' });
      head.add(txt(scene, open ? '收起' : '展开', { color: COL.dim2 }), { align: 'center' });
      c.add(head, { expand: true });
      if (open) {
        const iw = w - 12;
        c.add(txt(scene, `入伙：${ymd(new Date(m.joined_at).getTime())}`, { color: COL.dim }), { align: 'left' });
        if (m.last_words) c.add(txt(scene, `遗言：“${m.last_words}”`, { wrap: iw }), { align: 'left' });
        c.add(txt(scene, `墓志铭：${m.epitaph || '（空白）'}`, { wrap: iw }), { align: 'left' });
        const chips = itemTotals(scene, m.item_totals, iw);
        if (chips) c.add(chips, { align: 'left' });
        else c.add(txt(scene, '个人香火：还没有', { color: COL.dim2 }), { align: 'left' });
        if (m.offering_count) c.add(txt(scene, `个人祭拜 ${m.offering_count} 次${m.last_offering_at ? ' · 最近 ' + ago(new Date(m.last_offering_at).getTime()) : ''}`, { color: COL.dim }), { align: 'left' });
        const past = (m.past_groups ?? []).filter((x) => x.name_snapshot).map((x) => `曾与 ${x.name_snapshot} 合葬`);
        const mk = marks(scene, past, iw);
        if (mk) c.add(mk, { align: 'left' });
        c.add(
          button(scene, `给 ${clip(m.name, 6)} 烧纸`, {
            small: true,
            icon: 'flame',
            onClick: () => openPanel('burn', { code: g.code, name: g.name, groupCode: g.code, members: g.members, target: m.tomb_code }),
          }),
          { align: 'left' },
        );
      }
      tappable(head, () => {
        if (open) this.expanded.delete(m.tomb_code);
        else this.expanded.add(m.tomb_code);
        this.rerender();
      }, { silent: true });
      b.add(c, { expand: true });
    }

    b.add(heading(scene, '全墓香火', w), { expand: true });
    b.add(note(scene, g.offering_count ? `${g.offering_count} 次祭拜${g.last_offering_at ? ' · 最近一次 ' + ago(new Date(g.last_offering_at).getTime()) : ''}` : '还没人来烧过纸。', w), { align: 'left' });
    if (g.past_member_names?.length) {
      b.add(heading(scene, '曾有同葬', w), { expand: true });
      b.add(note(scene, `曾有 ${g.past_member_names.join('、')} 同葬`, w), { align: 'left' });
    }

    const me = this.me();
    if (me) {
      const out = ghostOut();
      b.add(heading(scene, me.is_founder ? '墓长' : '成员', w), { expand: true });
      const list: Array<[string, Parameters<typeof button>[2]]> = [
        ['改合葬碑文', { disabled: !out, why: '夜里才能改合葬碑文', onClick: () => openPanel('groupEpitaph', { code: g.code, epitaph: g.epitaph }) }],
        [
          '邀请',
          {
            onClick: () => {
              toast('去对方坟前递结伴帖就行。先搜到 TA。');
              navigate('/search');
            },
          },
        ],
        ['迁出合葬墓', { kind: 'quiet', onClick: () => openPanel('leaveGroup', { name: g.name }) }],
      ];
      if (me.is_founder) {
        list.push(['墓长设置', { onClick: () => openPanel('groupSettings', { group: g }) }]);
        list.push(['整体迁墓', { disabled: !out, why: '白天扛不动棺材，夜里再迁', onClick: () => openPanel('groupMove', { group: g }) }]);
      }
      b.add(buttonRow(scene, w, list as Array<[string, NonNullable<Parameters<typeof button>[2]>]>), { expand: true });
    }
  }

  buildFooter(f: FixWidthSizer): void {
    const g = this.g;
    if (!g || g.disbanded_at) return;
    const scene = this.scene;
    const me = this.me();
    f.add(
      button(scene, me ? '烧纸' : state.tomb ? '串门 · 烧纸' : '给全墓烧点', {
        kind: 'primary',
        icon: 'flame',
        onClick: () => openPanel('burn', { code: g.code, name: g.name, groupCode: g.code, members: g.members }),
      }),
    );
    if (me) {
      f.add(button(scene, '香火簿', { icon: 'inbox', onClick: () => openPanel('inbox') }));
    } else if (state.tomb) {
      const why = !ghostOut() ? '夜里才能递结伴帖' : state.tomb.group ? '你已经在合葬墓里了' : g.members.length >= 6 ? '满员了' : '';
      f.add(
        button(scene, '申请入伙', {
          icon: 'scroll',
          disabled: !!why,
          why,
          onClick: () => openPanel('joinRequest', { code: g.code, name: g.name, apply: true, groupCode: g.code }),
        }),
      );
    }
  }
}

