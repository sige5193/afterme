/**
 * 合葬和迁坟：递结伴帖、回结伴帖、迁坟、迁出合葬墓、墓长设置、整体迁墓。
 * 用词一律是合葬、结伴、入伙、迁出、请出。
 */

import * as api from '@/api/client';
import type { DreamStyleKey, GroupDetail, JoinRequest, PhaseGrid, RelationKey, ZoneInfo } from '@/api/types';
import { emit } from '@/core/bus';
import { earliestOpenPhase, fetchGrid, fetchZones, invalidateGrids, occupancy } from '@/core/cemetery';
import { fetchInbox, isApplyRequest } from '@/core/offerings';
import { navigate } from '@/core/router';
import { ghostOut, refreshMe, setTomb } from '@/core/session';
import { state } from '@/core/state';
import { closePanel, fx, toast } from '@/core/ui';
import { DREAM_STYLES } from '@/config/dreamStyles';
import { SPECIAL } from '@/config/specialPlots';
import { RELATIONS } from '@/config/zones';
import { pick } from '@/utils/text';
import { address } from '@/utils/time';
import { choiceRow, note, para } from '../blocks';
import { cellGrid, type CellInfo } from '../cellGrid';
import { button, chip, clip, type FixWidthSizer, flow, hbox, inputBox, type Sizer, txt } from '../kit';
import { cnPhaseLabel } from '../format';
import { Panel } from '../Panel';
import { COL } from '../theme';

/* ---------------- 递结伴帖 / 申请入伙 ---------------- */

export class JoinRequestPanel extends Panel {
  readonly kind = 'joinRequest' as const;
  private message = '';
  private groupName = '';
  private relation: RelationKey = 'roommate';
  private submitting = false;

  private get apply(): boolean {
    return !!this.payload.apply;
  }

  private get inGroup(): boolean {
    return !!(state.group?.code ?? state.tomb?.group?.code);
  }

  title(): string {
    return this.apply ? '申请入伙' : '递结伴帖';
  }

  subtitle(): string {
    return `烧一张纸扎结伴帖给 ${clip(String(this.payload.name ?? ''), 12)}。对方夜里才能回音。`;
  }

  buildBody(b: Sizer, w: number): void {
    const scene = this.scene;
    if (!this.inGroup && !this.apply) {
      b.add(txt(scene, '合葬墓名', { color: COL.dim }), { align: 'left' });
      b.add(inputBox(scene, { owner: this.id, width: w, maxLength: 12, value: this.groupName, placeholder: '302 宿舍', onInput: (v) => (this.groupName = v) }).box, { align: 'left' });
      b.add(txt(scene, '关系', { color: COL.dim }), { align: 'left' });
      b.add(
        choiceRow(scene, w, RELATIONS.map((r) => ({ value: r.key, label: r.label })), this.relation, (v) => {
          this.relation = v;
          this.rerender();
        }),
        { align: 'left' },
      );
    } else if (this.inGroup && !this.apply) {
      b.add(note(scene, `会邀请 TA 加入你们的 ${state.group?.name ?? state.tomb?.group?.name ?? '合葬墓'}。`, w), { align: 'left' });
    }
    b.add(txt(scene, '留言', { color: COL.dim }), { align: 'left' });
    b.add(
      inputBox(scene, { owner: this.id, width: w, multiline: true, rows: 3, maxLength: 120, value: this.message, placeholder: '一起躺吗？', onInput: (v) => (this.message = v) }).box,
      { align: 'left' },
    );
  }

  buildFooter(f: FixWidthSizer): void {
    f.add(button(this.scene, '算了', { kind: 'quiet', onClick: () => this.close() }));
    f.add(button(this.scene, '点火', { kind: 'primary', icon: 'scroll', disabled: this.submitting, onClick: () => void this.send() }));
  }

  private async send(): Promise<void> {
    if (this.submitting) return;
    if (!this.inGroup && !this.apply && !this.groupName.trim()) {
      toast('给合葬墓起个名字。');
      return;
    }
    this.submitting = true;
    const name = String(this.payload.name ?? '');
    try {
      const body: Record<string, string | null> = { message: this.message.trim() || null };
      if (!this.inGroup && !this.apply) {
        body.group_name = this.groupName.trim();
        body.relation = this.relation;
      }
      if (this.apply) await api.applyJoin(String(this.payload.groupCode ?? this.payload.code), body);
      else await api.inviteJoin(String(this.payload.code), body);
      this.close();
      fx({ kind: 'burn', items: { __scroll: 1 }, name, label: '纸扎结伴帖×1', onDone: () => toast('结伴帖已送出。') });
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : api.DEFAULT_ERROR, { err: true });
    } finally {
      this.submitting = false;
    }
  }
}

/* ---------------- 回结伴帖 ---------------- */

export class JoinRespondPanel extends Panel {
  readonly kind = 'joinRespond' as const;
  private reply = '';
  private style: DreamStyleKey = 'warm';
  private block = false;
  private submitting = false;

  private get req(): (Omit<JoinRequest, 'type'> & { type: string }) | undefined {
    return this.payload.request as (Omit<JoinRequest, 'type'> & { type: string }) | undefined;
  }

  title(): string {
    const r = this.req;
    if (!r) return '结伴帖';
    return isApplyRequest(r) ? `${clip(r.from_tomb?.name || '有人', 8)} 申请入伙` : `${clip(r.from_tomb?.name || '有人', 8)} 想和你合葬`;
  }

  subtitle(): string | null {
    const r = this.req;
    if (!r) return null;
    const parts: string[] = [];
    if (r.group_name) parts.push(`墓名：${r.group_name}`);
    if (r.relation_label) parts.push(`关系：${r.relation_label}`);
    if (r.group?.name && isApplyRequest(r)) parts.push(`合葬墓：${r.group.name}`);
    if (r.message) parts.push(`「${r.message}」`);
    return parts.join(' · ') || null;
  }

  buildBody(b: Sizer, w: number): void {
    const scene = this.scene;
    b.add(txt(scene, '回音', { color: COL.dim }), { align: 'left' });
    b.add(
      inputBox(scene, { owner: this.id, width: w, multiline: true, rows: 2, maxLength: 120, value: this.reply, placeholder: '留空就随机挑一句', onInput: (v) => (this.reply = v) }).box,
      { align: 'left' },
    );
    b.add(txt(scene, '拒绝可以挑一句', { color: COL.dim }), { align: 'left' });
    const presets = ['下辈子吧', '八字不合', '我已经有人了（隔壁老王）', '让我再死一会儿想想'];
    b.add(
      choiceRow(scene, w, presets.map((p) => ({ value: p, label: p })), this.reply, (v) => {
        this.reply = v;
        this.style = 'plain';
        this.rerender();
      }),
      { align: 'left' },
    );
    b.add(txt(scene, '托梦气氛', { color: COL.dim }), { align: 'left' });
    b.add(
      choiceRow(scene, w, DREAM_STYLES.map((s) => ({ value: s.k, label: s.name })), this.style, (v) => {
        this.style = v;
        this.rerender();
      }),
      { align: 'left' },
    );
    const row = flow(scene, w, { space: 4 });
    row.add(
      chip(scene, this.block ? '☑ 别再问了' : '☐ 别再问了', {
        on: this.block,
        onClick: () => {
          this.block = !this.block;
          this.rerender();
        },
      }),
    );
    row.add(txt(scene, '（仅拒绝时生效）', { color: COL.dim2 }));
    b.add(row, { align: 'left' });
    if (!ghostOut()) b.add(note(scene, '白天只能看着，夜里再点。', w), { align: 'left' });
  }

  buildFooter(f: FixWidthSizer): void {
    f.add(button(this.scene, '再想想', { kind: 'quiet', onClick: () => this.close() }));
    f.add(button(this.scene, '拒绝', { disabled: this.submitting, onClick: () => void this.respond('decline') }));
    f.add(button(this.scene, '同意', { kind: 'primary', disabled: this.submitting, onClick: () => void this.respond('accept') }));
  }

  private async respond(decision: 'accept' | 'decline'): Promise<void> {
    const r = this.req;
    if (!r || this.submitting) return;
    this.submitting = true;
    try {
      const replyText =
        this.reply.trim() || (decision === 'accept' ? pick(['来吧，挤一挤', '早该一起躺了', '棺材板给你留好了']) : pick(['下辈子吧', '八字不合', '让我再死一会儿想想']));
      const res = (await api.respondJoinRequest(r.id, {
        decision,
        reply_text: replyText,
        reply_style: decision === 'decline' && this.style === 'warm' ? 'plain' : this.style,
        block: decision === 'decline' ? this.block : undefined,
      })) as { tomb?: import('@/api/types').Tomb };
      if (res.tomb) setTomb(res.tomb);
      await refreshMe();
      invalidateGrids();
      this.close();
      void fetchInbox();
      if (decision === 'accept') {
        // 合完葬直接带去新家看看
        fx({
          kind: 'union',
          onDone: () => {
            const code = state.tomb?.group?.code;
            if (code) navigate(`/g/${code}`);
          },
        });
      }
      toast(decision === 'accept' ? '答应了。' : '回绝了。');
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : api.DEFAULT_ERROR, { err: true });
    } finally {
      this.submitting = false;
    }
  }
}

/* ---------------- 迁坟 ---------------- */

export class MoveTombPanel extends Panel {
  readonly kind = 'moveTomb' as const;
  private zones: ZoneInfo[] = [];
  private zoneKey: string;
  private phaseId: number | null;
  private cell: number | null;
  private grid: PhaseGrid | null = null;
  private submitting = false;

  constructor(scene: Panel['scene'], payload: Record<string, unknown>) {
    super(scene, payload);
    this.zoneKey = String(payload.zoneKey ?? state.tomb?.zone?.key ?? 'public');
    this.phaseId = (payload.phaseId as number | undefined) ?? null;
    this.cell = (payload.cell as number | undefined) ?? null;
  }

  preferredWidth(): number {
    return 420;
  }

  title(): string {
    return '迁坟';
  }

  subtitle(): string {
    return '迁过去之后，碑上会多一行「迁过 N 次坟」。';
  }

  onOpen(): void {
    void (async () => {
      const list = state.zones.length ? state.zones : await fetchZones();
      this.zones = list.filter((z) => !z.is_group_zone);
      if (!this.phaseId) this.phaseId = earliestOpenPhase(this.zones.find((z) => z.key === this.zoneKey))?.id ?? null;
      await this.loadGrid(this.cell != null);
    })();
  }

  private async loadGrid(keepCell: boolean): Promise<void> {
    if (!this.phaseId) return;
    this.grid = await fetchGrid(this.phaseId, true);
    if (!keepCell) this.cell = null;
    this.rerender();
  }

  buildBody(b: Sizer, w: number): void {
    const scene = this.scene;
    b.add(txt(scene, '园区', { color: COL.dim }), { align: 'left' });
    b.add(
      choiceRow(scene, w, this.zones.map((z) => ({ value: z.key, label: z.name })), this.zoneKey, (k) => {
        this.zoneKey = k;
        this.phaseId = earliestOpenPhase(this.zones.find((z) => z.key === k))?.id ?? null;
        this.grid = null;
        this.rerender();
        void this.loadGrid(false);
      }),
      { align: 'left' },
    );
    const z = this.zones.find((x) => x.key === this.zoneKey);
    if (z && z.phases.length > 1) {
      b.add(
        choiceRow(scene, w, [...z.phases].sort((a, c) => a.number - c.number).map((p) => ({ value: p.id, label: cnPhaseLabel(p.number) })), this.phaseId, (id) => {
          this.phaseId = id;
          void this.loadGrid(false);
        }),
        { align: 'left' },
      );
    }
    if (!this.grid) {
      b.add(note(scene, '加载墓位…', w), { align: 'left' });
      return;
    }
    const occ = occupancy(this.grid);
    const cells: CellInfo[] = [];
    for (let i = 0; i < 60; i++) {
      const c = occ.get(i);
      if (c) {
        const mine = c.tomb?.code === state.tomb?.code;
        const nm = c.tomb?.name ?? c.group?.name ?? '占';
        cells.push({ cell: i, state: 'taken', label: mine ? '我' : clip(nm, 2).replace('…', ''), why: mine ? '这就是你现在的坟。' : `${address(i)}已经有人住了：${nm}` });
        continue;
      }
      const sp = this.grid.cells.find((x) => x.cell === i)?.special ?? SPECIAL[i];
      cells.push({ cell: i, state: sp ? 'special' : 'free', label: sp ? '★' : `${Math.floor(i / 6) + 1}-${(i % 6) + 1}` });
    }
    b.add(
      cellGrid(scene, w, cells, this.cell, (c) => {
        this.cell = c;
        this.rerender();
      }),
      { align: 'left' },
    );
    if (this.cell != null) {
      const sp = this.grid.cells.find((x) => x.cell === this.cell)?.special ?? SPECIAL[this.cell];
      b.add(note(scene, `新家：${this.grid.phase.display_name} ${address(this.cell)}${sp ? ' · ' + sp : ''}`, w), { align: 'left' });
    }
  }

  buildFooter(f: FixWidthSizer): void {
    f.add(button(this.scene, '不迁了', { kind: 'quiet', onClick: () => this.close() }));
    f.add(button(this.scene, '扛过去', { kind: 'primary', disabled: this.cell == null || this.submitting, why: '先挑一块空地', onClick: () => void this.confirm() }));
  }

  private async confirm(): Promise<void> {
    if (this.cell == null || this.phaseId == null || this.submitting) return;
    this.submitting = true;
    try {
      const res = await api.moveTomb({ zone_phase_id: this.phaseId, cell: this.cell });
      invalidateGrids();
      if (res.tomb) setTomb(res.tomb);
      void fetchZones();
      closePanel('tomb');
      this.close();
      fx({
        kind: 'move',
        onDone: () => {
          toast(res.address ? `迁好了，新家在 ${res.address}` : '迁坟完成。');
          if (res.tomb) navigate(`/t/${res.tomb.code}`);
        },
      });
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : api.DEFAULT_ERROR, { err: true });
      await this.loadGrid(false);
    } finally {
      this.submitting = false;
    }
  }
}

/* ---------------- 迁出合葬墓 ---------------- */

export class LeaveGroupPanel extends Panel {
  readonly kind = 'leaveGroup' as const;
  private submitting = false;

  title(): string {
    return '迁出合葬墓';
  }

  buildBody(b: Sizer, w: number): void {
    const name = String(this.payload.name ?? state.group?.name ?? '这座合葬墓');
    b.add(para(this.scene, `迁出后，你的碑上会刻下「曾与 ${name} 合葬」，这座合葬墓的碑上也会留下你的名字。`, w), { align: 'left' });
  }

  buildFooter(f: FixWidthSizer): void {
    f.add(button(this.scene, '再躺会儿', { kind: 'quiet', onClick: () => this.close() }));
    f.add(button(this.scene, '确认迁出', { kind: 'primary', disabled: this.submitting, onClick: () => void this.confirm() }));
  }

  private async confirm(): Promise<void> {
    if (this.submitting) return;
    this.submitting = true;
    try {
      const res = await api.leaveGroup();
      invalidateGrids();
      if (res.tomb) setTomb(res.tomb);
      await refreshMe();
      void fetchZones();
      closePanel('group');
      this.close();
      toast(res.address ? `你回到了 ${res.address}，夜里可以迁坟换个地方。` : '已迁出合葬墓。');
      if (res.tomb) navigate(`/t/${res.tomb.code}`);
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : api.DEFAULT_ERROR, { err: true });
    } finally {
      this.submitting = false;
    }
  }
}

/* ---------------- 墓长设置 ---------------- */

export class GroupSettingsPanel extends Panel {
  readonly kind = 'groupSettings' as const;
  private name: string;
  private relation: RelationKey;
  private confirmRemove: string | null = null;
  private busy = false;

  constructor(scene: Panel['scene'], payload: Record<string, unknown>) {
    super(scene, payload);
    const g = payload.group as GroupDetail;
    this.name = g?.name ?? '';
    this.relation = g?.relation ?? 'roommate';
  }

  private get g(): GroupDetail {
    return this.payload.group as GroupDetail;
  }

  title(): string {
    return '墓长设置';
  }

  buildBody(b: Sizer, w: number): void {
    const scene = this.scene;
    b.add(txt(scene, '墓名', { color: COL.dim }), { align: 'left' });
    b.add(inputBox(scene, { owner: this.id, width: w, maxLength: 12, value: this.name, onInput: (v) => (this.name = v) }).box, { align: 'left' });
    b.add(txt(scene, '关系标签', { color: COL.dim }), { align: 'left' });
    b.add(
      choiceRow(scene, w, RELATIONS.map((r) => ({ value: r.key, label: r.label })), this.relation, (v) => {
        this.relation = v;
        this.rerender();
      }),
      { align: 'left' },
    );
    b.add(txt(scene, '成员', { color: COL.dim }), { align: 'left' });
    for (const m of this.g?.members ?? []) {
      const row = hbox(scene, { width: w, space: 6 });
      row.add(txt(scene, `${clip(m.name, 8)}${m.is_founder ? '（墓长）' : ''}`), { proportion: 1, align: 'left-center' });
      if (!m.is_founder) {
        if (this.confirmRemove === m.tomb_code) {
          row.add(txt(scene, '确定？', { color: COL.seal }), { align: 'center' });
          row.add(button(scene, '请出', { small: true, kind: 'seal', disabled: this.busy, onClick: () => void this.remove(m.tomb_code) }), { align: 'center' });
          row.add(button(scene, '算了', { small: true, kind: 'quiet', onClick: () => ((this.confirmRemove = null), this.rerender()) }), { align: 'center' });
        } else {
          row.add(button(scene, '请出', { small: true, kind: 'quiet', onClick: () => ((this.confirmRemove = m.tomb_code), this.rerender()) }), { align: 'center' });
        }
      }
      b.add(row, { expand: true });
    }
    b.add(note(scene, '被请出的人碑上只会写「曾与…合葬」，跟自己迁出一样。', w), { align: 'left' });
  }

  buildFooter(f: FixWidthSizer): void {
    f.add(button(this.scene, '取消', { kind: 'quiet', onClick: () => this.close() }));
    f.add(button(this.scene, '保存', { kind: 'primary', disabled: this.busy, onClick: () => void this.save() }));
  }

  private async save(): Promise<void> {
    this.busy = true;
    try {
      await api.patchGroup(this.g.code, { name: this.name.trim() || undefined, relation: this.relation });
      emit('changed', this.g.code);
      invalidateGrids();
      void refreshMe();
      this.close();
      toast('改好了。');
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : api.DEFAULT_ERROR, { err: true });
    } finally {
      this.busy = false;
    }
  }

  private async remove(code: string): Promise<void> {
    this.busy = true;
    try {
      await api.removeGroupMember(this.g.code, code);
      emit('changed', this.g.code);
      invalidateGrids();
      const g = await api.getGroup(this.g.code);
      this.payload.group = g;
      this.confirmRemove = null;
      toast('已请出。');
      this.rerender();
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : api.DEFAULT_ERROR, { err: true });
    } finally {
      this.busy = false;
    }
  }
}

/* ---------------- 整体迁墓 ---------------- */

export class GroupMovePanel extends Panel {
  readonly kind = 'groupMove' as const;
  private phaseId: number | null = null;
  private start: number | null = null;
  private grid: PhaseGrid | null = null;
  private submitting = false;

  private get g(): GroupDetail {
    return this.payload.group as GroupDetail;
  }

  preferredWidth(): number {
    return 420;
  }

  title(): string {
    return '整体迁墓';
  }

  subtitle(): string {
    return `墓块宽 ${this.g?.width ?? 2} 格，只能从偶数列起，整段都得空着。`;
  }

  onOpen(): void {
    void (async () => {
      if (!state.zones.length) await fetchZones();
      const z = state.zones.find((x) => x.is_group_zone);
      this.phaseId = earliestOpenPhase(z)?.id ?? null;
      await this.load();
    })();
  }

  private async load(): Promise<void> {
    if (!this.phaseId) return;
    this.grid = await fetchGrid(this.phaseId, true);
    this.start = null;
    this.rerender();
  }

  private canPlace(cell: number, occ: Map<number, unknown>): boolean {
    const w = this.g?.width ?? 2;
    if (cell % 2 !== 0 || (cell % 6) + w > 6) return false;
    for (let i = 0; i < w; i++) {
      const o = occ.get(cell + i) as { group?: { code: string } } | undefined;
      if (o && o.group?.code !== this.g.code) return false;
    }
    return true;
  }

  buildBody(b: Sizer, w: number): void {
    const scene = this.scene;
    const z = state.zones.find((x) => x.is_group_zone);
    if (z && z.phases.length > 1) {
      b.add(
        choiceRow(scene, w, [...z.phases].sort((a, c) => a.number - c.number).map((p) => ({ value: p.id, label: cnPhaseLabel(p.number) })), this.phaseId, (id) => {
          this.phaseId = id;
          void this.load();
        }),
        { align: 'left' },
      );
    }
    if (!this.grid) {
      b.add(note(scene, '加载墓位…', w), { align: 'left' });
      return;
    }
    const occ = occupancy(this.grid);
    const cells: CellInfo[] = [];
    for (let i = 0; i < 60; i++) {
      const o = occ.get(i);
      const ours = o?.group?.code === this.g.code;
      const ok = this.canPlace(i, occ);
      cells.push({
        cell: i,
        state: ok ? 'free' : o && !ours ? 'taken' : 'blocked',
        label: ours ? '我们' : o ? clip(o.group?.name ?? o.tomb?.name ?? '占', 2).replace('…', '') : ok ? `${Math.floor(i / 6) + 1}-${(i % 6) + 1}` : '·',
        why: o && !ours ? '这儿有人了' : '墓块放不下：要从偶数列起，整段都空着',
      });
    }
    b.add(
      cellGrid(scene, w, cells, this.start, (c) => {
        this.start = c;
        this.rerender();
      }),
      { align: 'left' },
    );
  }

  buildFooter(f: FixWidthSizer): void {
    f.add(button(this.scene, '取消', { kind: 'quiet', onClick: () => this.close() }));
    f.add(button(this.scene, '确认', { kind: 'primary', disabled: this.start == null || this.submitting, why: '先挑起始格', onClick: () => void this.confirm() }));
  }

  private async confirm(): Promise<void> {
    if (this.start == null || this.phaseId == null || this.submitting) return;
    this.submitting = true;
    try {
      await api.moveGroup(this.g.code, { zone_phase_id: this.phaseId, start_cell: this.start });
      invalidateGrids();
      void refreshMe();
      void fetchZones();
      this.close();
      fx({
        kind: 'move',
        onDone: () => {
          toast('合葬墓迁好了。');
          navigate(`/g/${this.g.code}`);
        },
      });
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : api.DEFAULT_ERROR, { err: true });
      await this.load();
    } finally {
      this.submitting = false;
    }
  }
}

