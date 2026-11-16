/**
 * 动作类弹窗：烧纸、托梦、邀请、改碑文、诈尸、还魂、还魂码。
 */

import * as api from '@/api/client';
import type { DreamStyleKey, GroupDetail } from '@/api/types';
import { emit } from '@/core/bus';
import { fetchInbox, itemsRecord, itemsText, offeringOf } from '@/core/offerings';
import { resetPulse } from '@/core/pulse';
import { fetchZones, invalidateGrids } from '@/core/cemetery';
import { patchTomb, resurrectWithCode, setPref, setTomb } from '@/core/session';
import { state } from '@/core/state';
import { closePanel, fx, type PanelKind, sfx, toast } from '@/core/ui';
import { DREAM_STYLES } from '@/config/dreamStyles';
import { EPITAPHS } from '@/config/epitaphs';
import { ITEMS } from '@/config/items';
import { copyText } from '@/utils/copy';
import { formatResurrectCode } from '@/utils/resurrect';
import { choiceRow, note } from '../blocks';
import { badge, bg, button, clip, type FixWidthSizer, flow, inputBox, Label, OverlapSizer, setFrame, type Sizer, tappable, txt, vbox } from '../kit';
import { Panel } from '../Panel';
import { COL } from '../theme';

/* ---------------- 烧纸 ---------------- */

export class BurnPanel extends Panel {
  readonly kind = 'burn' as const;
  private cart: Record<string, number> = {};
  private message = '';
  private fromName: string;
  private target: string | null;
  private submitting = false;

  constructor(scene: Panel['scene'], payload: Record<string, unknown>) {
    super(scene, payload);
    let saved = '';
    try {
      saved = localStorage.getItem('afterme:fromName') || '';
    } catch {
      /* ignore */
    }
    this.fromName = state.tomb ? `${state.tomb.name}（鬼）` : saved;
    this.target = (payload.target as string | undefined) ?? null;
  }

  preferredWidth(): number {
    return 440;
  }

  private get isGroup(): boolean {
    return !!this.payload.groupCode;
  }

  private members(): GroupDetail['members'] {
    return (this.payload.members as GroupDetail['members']) ?? [];
  }

  private targetName(): string {
    const m = this.members().find((x) => x.tomb_code === this.target);
    return m?.name ?? '';
  }

  title(): string {
    const name = String(this.payload.name ?? '');
    if (this.payload.own) return '给自己烧点';
    if (this.isGroup) return this.target ? `给 ${clip(name, 8)} 的 ${clip(this.targetName(), 6)} 烧纸` : `给 ${clip(name, 8)} 烧纸`;
    return `给${clip(name, 8)}烧纸`;
  }

  subtitle(): string {
    const name = String(this.payload.name ?? '');
    if (this.payload.own) return '自力更生，丰衣足食。';
    return `${name}之墓。挑点东西，写句话，点火就送到。`;
  }

  private total(): number {
    return Object.values(this.cart).reduce((a, b) => a + b, 0);
  }

  buildBody(b: Sizer, w: number): void {
    const scene = this.scene;
    if (this.isGroup) {
      const opts = [{ value: '', label: '烧给全墓' }, ...this.members().map((m) => ({ value: m.tomb_code, label: clip(m.name, 6) }))];
      b.add(
        choiceRow(scene, w, opts, this.target ?? '', (v) => {
          this.target = v || null;
          this.rerender();
        }),
        { align: 'left' },
      );
    }
    const cols = w >= 360 ? 4 : 3;
    const cw = Math.floor((w - (cols - 1) * 4) / cols);
    const items = flow(scene, w, { space: 4, line: 4 });
    for (const it of ITEMS) {
      const n = this.cart[it.k] || 0;
      const back = bg(scene, n ? 'cardHi' : 'card');
      const cell = vbox(scene, { width: cw, pad: { left: 2, right: 2, top: 4, bottom: 4 }, space: 2 });
      cell.addBackground(back);
      cell.add(scene.add.image(0, 0, `item-${it.k}`).setScale(2), { align: 'center' });
      cell.add(txt(scene, it.name, { color: n ? COL.joss : COL.bone }), { align: 'center' });
      if (cw >= 90) cell.add(txt(scene, it.note, { color: COL.dim2, wrap: cw - 6, align: 'center' }), { align: 'center' });
      tappable(cell, () => this.add(it.k), {
        onState: (st) => setFrame(back, st === 'hover' || st === 'down' ? 'cardHi' : n ? 'cardHi' : 'card'),
      });
      if (n) {
        const o = new OverlapSizer(scene, { width: cw });
        scene.add.existing(o);
        o.add(cell, { key: 'c', align: 'center', expand: false });
        o.add(badge(scene, n), { key: 'n', align: 'right-top', expand: false, offsetX: -2, offsetY: 2 });
        o.add(button(scene, '−', { small: true, kind: 'quiet', onClick: () => this.sub(it.k) }), { key: 'm', align: 'left-top', expand: false, offsetX: 2, offsetY: 2 });
        items.add(o);
      } else {
        items.add(cell);
      }
    }
    b.add(items, { align: 'left' });
    b.add(txt(scene, '想说的话', { color: COL.dim }), { align: 'left' });
    b.add(
      inputBox(scene, {
        owner: this.id,
        width: w,
        multiline: true,
        rows: 3,
        maxLength: 120,
        value: this.message,
        placeholder: '最近挺好的，就是有点想你。下面 Wi-Fi 怎么样？',
        onInput: (v) => (this.message = v),
      }).box,
      { align: 'left' },
    );
    b.add(txt(scene, '落款', { color: COL.dim }), { align: 'left' });
    b.add(
      inputBox(scene, {
        owner: this.id,
        width: w,
        maxLength: 12,
        value: this.fromName,
        placeholder: '不填就是「一位路过的活人」',
        onInput: (v) => (this.fromName = v),
      }).box,
      { align: 'left' },
    );
  }

  buildFooter(f: FixWidthSizer, w: number): void {
    const t = this.total();
    f.add(txt(this.scene, t ? `共 ${t} 件 · ${clip(itemsText(this.cart), 18)}` : '还没挑东西', { color: COL.dim, wrap: w - 90 }));
    f.add(button(this.scene, '点火', { kind: 'primary', icon: 'flame', disabled: !t || this.submitting, why: '先挑点东西', onClick: () => void this.fire() }));
  }

  private add(k: string): void {
    this.cart[k] = Math.min(99, (this.cart[k] || 0) + 1);
    this.rerender();
  }

  private sub(k: string): void {
    this.cart[k] = Math.max(0, (this.cart[k] || 0) - 1);
    if (!this.cart[k]) delete this.cart[k];
    this.rerender();
  }

  private async fire(): Promise<void> {
    if (!this.total() || this.submitting) return;
    this.submitting = true;
    const items = { ...this.cart };
    const msg = this.message.trim() || null;
    const fromName = this.fromName.trim() || '一位路过的活人';
    const code = String(this.payload.code ?? '');
    const name = this.isGroup && this.target ? this.targetName() : String(this.payload.name ?? '');
    const own = !!this.payload.own;
    if (!state.tomb) {
      try {
        localStorage.setItem('afterme:fromName', this.fromName.trim());
      } catch {
        /* ignore */
      }
    }
    closePanel('burn');
    let result: 'ok' | string = 'pending';
    const done = () => {
      if (result === 'ok') {
        toast(
          own
            ? '烧给自己了。去香火簿里给自己托个梦吧。'
            : `已送达 ${name}。TA 白天躺在棺材里，天黑后会出来看；有回音会托梦给你，留意顶栏的「我的梦」。`,
          { ms: 7000 },
        );
      } else if (result !== 'pending') {
        toast(result, { err: true });
      }
    };
    let animDone = false;
    fx({
      kind: 'burn',
      items,
      name,
      onDone: () => {
        animDone = true;
        done();
      },
    });
    try {
      if (this.isGroup) await api.createGroupOffering(String(this.payload.groupCode), { items, message: msg, from_name: fromName, tomb_code: this.target });
      else await api.createOffering(code, { items, message: msg, from_name: fromName });
      result = 'ok';
      emit('changed', this.isGroup ? String(this.payload.groupCode) : code);
      if (own) void fetchInbox();
    } catch (e) {
      result = e instanceof Error && e.message ? e.message : api.DEFAULT_ERROR;
    }
    if (animDone) done();
  }
}

/* ---------------- 托梦 ---------------- */

export class DreamComposerPanel extends Panel {
  readonly kind = 'dreamComposer' as const;
  private text = '';
  private style: DreamStyleKey = 'plain';
  private submitting = false;

  title(): string {
    return '托梦';
  }

  subtitle(): string | null {
    const id = Number(this.payload.offeringId);
    const item = state.inbox.find((b) => b.id === id && b.type !== 'join_request');
    const o = item ? offeringOf(item) : null;
    if (!o) return null;
    return `回给「${o.from_name || '一位路过的活人'}」：TA 烧了 ${itemsText(itemsRecord(o.items))}${o.message ? `，说：“${o.message}”` : '。'}`;
  }

  buildBody(b: Sizer, w: number): void {
    const scene = this.scene;
    b.add(txt(scene, '梦里说什么', { color: COL.dim }), { align: 'left' });
    b.add(
      inputBox(scene, {
        owner: this.id,
        width: w,
        multiline: true,
        rows: 3,
        maxLength: 120,
        value: this.text,
        placeholder: '收到了，谢谢。这边挺好的，就是 Wi-Fi 不太行。',
        onInput: (v) => (this.text = v),
      }).box,
      { align: 'left' },
    );
    b.add(txt(scene, '梦的气氛', { color: COL.dim }), { align: 'left' });
    b.add(
      choiceRow(scene, w, DREAM_STYLES.map((s) => ({ value: s.k, label: s.name })), this.style, (v) => {
        this.style = v;
        this.rerender();
      }),
      { align: 'left' },
    );
    if (this.style === 'mystic') b.add(note(scene, '玄学梦里会出现一串彩票号码。', w), { align: 'left' });
  }

  buildFooter(f: FixWidthSizer): void {
    f.add(button(this.scene, '入梦', { kind: 'primary', icon: 'dreams', disabled: this.submitting, onClick: () => void this.send() }));
  }

  private async send(): Promise<void> {
    const t = this.text.trim();
    if (!t) {
      toast('梦里总得说点什么。');
      return;
    }
    if (this.submitting) return;
    this.submitting = true;
    try {
      await api.createDream(Number(this.payload.offeringId), { text: t, style: this.style });
      closePanel('dreamComposer');
      sfx('bell');
      toast('梦已托出。对方入睡后就能梦到。');
      await fetchInbox();
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : api.DEFAULT_ERROR, { err: true });
    } finally {
      this.submitting = false;
    }
  }
}

/* ---------------- 邀请 ---------------- */

export class InvitePanel extends Panel {
  readonly kind = 'invite' as const;

  title(): string {
    return '邀请烧纸';
  }

  subtitle(): string {
    return '让朋友找到你的坟。';
  }

  private text(): string {
    const t = state.tomb;
    if (!t) return '';
    const addr = t.address || '某处';
    const g = state.group ?? t.group;
    if (g?.code) return `我们 ${g.name} 在「不活了」合葬了，在 ${addr}，来给我们烧点：https://afterme.space/g/${g.code}`;
    return `我在「不活了」提前死了一下，坟在 ${addr}，死因「${t.cause}」。来给我烧点纸：https://afterme.space/t/${t.code} ，我晚上会托梦回你。`;
  }

  buildBody(b: Sizer, w: number): void {
    b.add(txt(this.scene, '可以直接发的话', { color: COL.dim }), { align: 'left' });
    b.add(inputBox(this.scene, { owner: this.id, width: w, multiline: true, rows: 5, readOnly: true, value: this.text() }).box, { align: 'left' });
  }

  buildFooter(f: FixWidthSizer): void {
    f.add(
      button(this.scene, '复制这段话', {
        kind: 'primary',
        onClick: () =>
          void copyText(this.text()).then((ok) =>
            toast(ok ? '复制好了，去发给朋友吧' : '浏览器不让复制，请手动选中上面的文字复制', { err: !ok }),
          ),
      }),
    );
  }
}

/* ---------------- 改碑文 ---------------- */

export class EpitaphPanel extends Panel {
  readonly kind: PanelKind = 'epitaph';
  protected text: string;
  private submitting = false;

  constructor(scene: Panel['scene'], payload: Record<string, unknown>) {
    super(scene, payload);
    this.text = this.initial();
  }

  protected initial(): string {
    return state.tomb?.epitaph || '';
  }

  title(): string {
    return '改碑文';
  }

  subtitle(): string {
    return '半夜蹲在自己坟前拿指甲刻。最多 40 个字。';
  }

  buildBody(b: Sizer, w: number): void {
    const scene = this.scene;
    b.add(
      inputBox(scene, { owner: this.id, width: w, multiline: true, rows: 2, maxLength: 40, value: this.text, onInput: (v) => (this.text = v) }).box,
      { align: 'left' },
    );
    b.add(txt(scene, '没灵感就抄一句', { color: COL.dim }), { align: 'left' });
    b.add(
      choiceRow(scene, w, EPITAPHS.map((e) => ({ value: e, label: e })), this.text, (v) => {
        this.text = v;
        this.rerender();
      }),
      { align: 'left' },
    );
  }

  buildFooter(f: FixWidthSizer): void {
    f.add(button(this.scene, '刻上去', { kind: 'primary', disabled: this.submitting, onClick: () => void this.save() }));
  }

  protected async commit(v: string): Promise<void> {
    const res = await api.patchEpitaph({ epitaph: v });
    setTomb(res.tomb);
    emit('changed', res.tomb.code);
  }

  private async save(): Promise<void> {
    const v = this.text.trim();
    if (!v || v === this.initial()) {
      this.close();
      return;
    }
    this.submitting = true;
    try {
      await this.commit(v);
      this.close();
      toast('刻好了。');
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : api.DEFAULT_ERROR, { err: true });
    } finally {
      this.submitting = false;
    }
  }
}

export class GroupEpitaphPanel extends EpitaphPanel {
  readonly kind: PanelKind = 'groupEpitaph';

  protected initial(): string {
    return String(this.payload.epitaph ?? '');
  }

  title(): string {
    return '改合葬碑文';
  }

  subtitle(): string {
    return '大家一起刻的那一句，最多 40 个字。';
  }

  protected async commit(v: string): Promise<void> {
    const code = String(this.payload.code ?? '');
    await api.patchGroupEpitaph(code, v);
    emit('changed', code);
  }
}

/* ---------------- 诈尸 ---------------- */

export class ZhashiPanel extends Panel {
  readonly kind = 'zhashi' as const;
  private submitting = false;

  title(): string {
    return '诈尸';
  }

  buildBody(b: Sizer, w: number): void {
    b.add(
      txt(this.scene, `大白天强行出棺，能在墓园里待 10 分钟。阳气会灼烧你，而且[color=${COL.seal}]这次诈尸会被刻在墓碑上[/color]，路过的人都看得见。`, {
        wrap: w,
        markup: true,
      }),
      { align: 'left' },
    );
  }

  buildFooter(f: FixWidthSizer): void {
    f.add(button(this.scene, '算了，接着躺', { onClick: () => this.close() }));
    f.add(button(this.scene, '诈！', { kind: 'seal', disabled: this.submitting, onClick: () => void this.go() }));
  }

  private async go(): Promise<void> {
    this.submitting = true;
    try {
      const res = await api.zhashi();
      patchTomb({ zhashi_count: res.zhashi_count, zhashi_until: res.zhashi_until });
      state.ghostOutServer = true;
      state.ghostCell = null;
      this.close();
      sfx('whoosh');
      setPref('cemetery');
      toast('你诈尸了。抓紧时间，10 分钟后会被晒回棺材。');
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : api.DEFAULT_ERROR, { err: true });
    } finally {
      this.submitting = false;
    }
  }
}

/* ---------------- 还魂 ---------------- */

export class ResurrectPanel extends Panel {
  readonly kind = 'resurrect' as const;
  private code = '';
  private err = '';
  private submitting = false;

  title(): string {
    return '还魂';
  }

  subtitle(): string {
    return '输入还魂码，回到自己的坟里。前缀「黄泉-」可省略。';
  }

  buildBody(b: Sizer, w: number): void {
    const scene = this.scene;
    const { box, input } = inputBox(scene, {
      owner: this.id,
      width: w,
      value: this.code,
      maxLength: 40,
      placeholder: '黄泉-XXXX-XXXX-XXXX-XXXX',
      onInput: (v) => (this.code = v),
      onEnter: () => void this.submit(),
    });
    b.add(box, { align: 'left' });
    if (this.err) b.add(txt(scene, this.err, { color: COL.seal, wrap: w }), { align: 'left' });
    scene.time.delayedCall(80, () => input.focus());
  }

  buildFooter(f: FixWidthSizer): void {
    f.add(button(this.scene, '还魂', { kind: 'primary', disabled: this.submitting, onClick: () => void this.submit() }));
  }

  private async submit(): Promise<void> {
    if (!this.code.trim() || this.submitting) return;
    this.err = '';
    this.submitting = true;
    try {
      await resurrectWithCode(this.code);
      resetPulse();
      invalidateGrids();
      await fetchZones();
      this.close();
    } catch (e) {
      this.err = e instanceof api.ApiError ? e.message || '这串还魂码对不上' : api.DEFAULT_ERROR;
      this.rerender();
    } finally {
      this.submitting = false;
    }
  }
}

export class ResurrectCodePanel extends Panel {
  readonly kind = 'resurrectCode' as const;

  dismissable(): boolean {
    return false;
  }

  title(): string {
    return '还魂码';
  }

  subtitle(): string {
    return '请抄下你的还魂码，换手机或清了浏览器时用它回到自己的坟里。这串码只展示这一次。';
  }

  private display(): string {
    return formatResurrectCode(String(this.payload.code ?? ''));
  }

  buildBody(b: Sizer, w: number): void {
    const scene = this.scene;
    const box = new Label(scene, {
      width: w,
      background: bg(scene, 'cardHi'),
      text: txt(scene, this.display(), { color: COL.joss, scale: w >= 320 ? 2 : 1 }),
      space: { left: 6, right: 6, top: 6, bottom: 7 },
      align: 'center',
    });
    scene.add.existing(box);
    b.add(box, { expand: true });
    b.add(inputBox(scene, { owner: this.id, width: w, readOnly: true, value: this.display() }).box, { align: 'left' });
    b.add(note(scene, '下面这一行可以长按或者全选复制。', w), { align: 'left' });
  }

  buildFooter(f: FixWidthSizer): void {
    f.add(
      button(this.scene, '复制', {
        onClick: () => void copyText(this.display()).then((ok) => toast(ok ? '已复制还魂码' : '浏览器不让复制，请手动选中上面的文字复制', { err: !ok })),
      }),
    );
    f.add(button(this.scene, '我记下了', { kind: 'primary', onClick: () => this.close() }));
  }

  onClose(): void {
    const cb = this.payload.onClose as (() => void) | undefined;
    cb?.();
  }
}
