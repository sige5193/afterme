/**
 * 葬礼：阴间户籍登记 → 选园区 / 碑 / 墓位 → 墓志铭 → 追悼会六幕 → 入住新家。
 * 重办葬礼时不换位置，只能改登记信息和碑。
 */

import Phaser from 'phaser';
import * as api from '@/api/client';
import type { PhaseGrid, StoneStyleKey, ZoneInfo } from '@/api/types';
import { Subscriptions } from '@/core/bus';
import { earliestOpenPhase, fetchZones, invalidateGrids, occupancy } from '@/core/cemetery';
import { navigate } from '@/core/router';
import { applyPref, ghostOut, setTomb } from '@/core/session';
import { state } from '@/core/state';
import { fx, openPanel, sfx, toast } from '@/core/ui';
import { CAUSES } from '@/config/causes';
import { EPITAPHS } from '@/config/epitaphs';
import { COUPLETS, makeEulogy, VERDICTS } from '@/config/funeralText';
import { STYLES } from '@/config/styles';
import { ZONES } from '@/config/zones';
import { SPECIAL } from '@/config/specialPlots';
import { pick } from '@/utils/text';
import { cnPhaseLabel } from '../ui/format';
import { address } from '@/utils/time';
import { takeFuneralPrefill } from '../director';
import { buttonRow, choiceRow, heading, note } from '../ui/blocks';
import { cellGrid, type CellInfo } from '../ui/cellGrid';
import { domLayer } from '../ui/dom';
import {
  bg,
  button,
  chip,
  clip,
  clipToScroller,
  flow,
  hbox,
  image,
  inputBox,
  Label,
  revealTxt,
  scroller,
  type ScrollablePanel,
  type Sizer,
  tappable,
  txt,
  vbox,
} from '../ui/kit';
import { bigStoneView } from '../ui/stones';
import { COL } from '../ui/theme';
import { uiState } from '../ui/uiState';
import { live } from './live';

type Form = {
  name: string;
  birthYear: string;
  cause: string;
  portrait: number;
  lastWords: string;
  style: string;
  styleTouched: boolean;
  zoneKey: string;
  zonePhaseId: number | null;
  cell: number;
  epitaph: string;
  eulogy: string;
  verdict: string;
  couplet: number;
  regNo: string;
};

const STEP_NAMES = ['登记', '选墓', '碑文', '出殡'];

export default class FuneralScene extends Phaser.Scene {
  private subs = new Subscriptions();
  private F!: Form;
  private step = 0;
  private err = '';
  private isRefuneral = false;
  private zones: ZoneInfo[] = [];
  private grid: PhaseGrid | null = null;
  private gridLoading = false;
  private root: Phaser.GameObjects.GameObject[] = [];
  private scroll: ScrollablePanel | null = null;
  private keepScroll = 0;
  private ceremony: Ceremony | null = null;

  constructor() {
    super({ key: 'Funeral' });
  }

  create(): void {
    const prev = state.tomb;
    const pre = takeFuneralPrefill();
    this.isRefuneral = !!prev;
    this.step = 0;
    this.err = '';
    this.grid = null;
    this.gridLoading = false;
    this.zones = [];
    this.keepScroll = 0;
    // 上一次办葬礼留下的对象已经随场景销毁
    this.root = [];
    this.scroll = null;
    this.ceremony = null;
    this.F = {
      name: prev?.name || '',
      birthYear: prev?.birth_year ? String(prev.birth_year) : '',
      cause: prev?.cause || '',
      portrait: prev?.portrait ?? 0,
      lastWords: prev?.last_words || '',
      style: prev?.style || ZONES[(pre.zoneKey as keyof typeof ZONES) ?? 'public']?.default_style || 'qingshi',
      styleTouched: !!prev,
      zoneKey: pre.zoneKey || prev?.zone?.key || 'public',
      zonePhaseId: pre.zonePhaseId ?? null,
      cell: pre.cell ?? 0,
      epitaph: prev?.epitaph || '',
      eulogy: '',
      verdict: '',
      couplet: Math.floor(Math.random() * COUPLETS.length),
      regNo: Math.random().toString().slice(2, 8),
    };
    this.cameras.main.setBackgroundColor('#0d0b09');
    this.cameras.main.fadeIn(260, 0, 0, 0);
    uiState.sceneOwner = 'scene';
    domLayer.setTopOwner('scene');
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.subs.clear();
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.ceremony?.destroy();
      this.ceremony = null;
      // 这时场景里的对象已经被 Phaser 销毁了：只清引用，别再去读滚动位置
      this.root = [];
      this.scroll = null;
      sfx('stop');
    });
    this.render();
    if (!this.isRefuneral) void this.loadZones(pre.zonePhaseId != null);
  }

  private onResize(): void {
    if (this.step === 3) this.ceremony?.layout();
    else this.render(true);
  }

  private async loadZones(keepPrefill: boolean): Promise<void> {
    const list = state.zones.length ? state.zones : await fetchZones();
    this.zones = list.filter((z) => !z.is_group_zone);
    if (!this.zones.some((z) => z.key === this.F.zoneKey)) this.F.zoneKey = 'public';
    if (keepPrefill && this.F.zonePhaseId) await this.loadPhase(this.F.zonePhaseId, true);
    else await this.selectZone(this.F.zoneKey, false);
  }

  private async selectZone(key: string, resetStyle: boolean): Promise<void> {
    this.F.zoneKey = key;
    const z = this.zones.find((x) => x.key === key);
    if (!z) return;
    if (resetStyle && !this.F.styleTouched && z.default_style) this.F.style = z.default_style;
    const ph = earliestOpenPhase(z);
    if (ph) await this.loadPhase(ph.id, false);
    else this.render(true);
  }

  private async loadPhase(id: number, keepCell: boolean): Promise<void> {
    this.F.zonePhaseId = id;
    this.gridLoading = true;
    this.render(true);
    try {
      this.grid = await api.getPhaseGrid(id);
    } catch {
      toast(api.DEFAULT_ERROR, { err: true });
    }
    this.gridLoading = false;
    const occ = occupancy(this.grid);
    if (!keepCell || occ.has(this.F.cell)) {
      let next = 0;
      while (occ.has(next) && next < 60) next++;
      this.F.cell = next < 60 ? next : 0;
    }
    this.render(true);
  }

  private clear(): void {
    if (this.scroll && live(this)) this.keepScroll = this.scroll.t;
    for (const o of this.root) o.destroy();
    this.root = [];
    this.scroll = null;
  }

  /* ---------------- 顶栏 + 步骤 ---------------- */

  private render(keep = false): void {
    if (!live(this)) return;
    if (this.step === 3) return;
    const prevScroll = keep && this.scroll ? this.scroll.t : 0;
    this.clear();
    const W = this.scale.width;
    const H = this.scale.height;
    const top = this.topBar();
    const contentW = Math.min(W - 12, this.step === 0 ? 460 : 620);
    // 先建外框（背景要排在最底下），再往里放内容
    const wrap = vbox(this, { width: contentW + 8, pad: 4, bg: this.step === 0 ? 'paper' : 'panel' });
    const body = vbox(this, { width: contentW - 10, space: 8 });
    if (this.step === 0) this.stepRegister(body, contentW - 10);
    else if (this.step === 1) this.stepPick(body, contentW - 10);
    else this.stepEpitaph(body, contentW - 10);
    body.layout();
    const nav = this.navRow(contentW);
    nav.layout();
    const availH = H - top - 8 - nav.height - 12;
    const sc = scroller(this, body, { width: contentW, height: Math.max(80, Math.min(availH, body.height + 8)) });
    wrap.add(sc, { expand: true });
    wrap.add(nav, { expand: true, padding: { top: 4 } });
    wrap.setOrigin(0.5, 0);
    wrap.layout();
    wrap.setPosition(Math.round(W / 2), top + 2);
    clipToScroller(sc);
    if (prevScroll) sc.t = prevScroll;
    this.scroll = sc;
    this.root.push(wrap);
  }

  private topBar(): number {
    const W = this.scale.width;
    const bar = hbox(this, { width: W, pad: { left: 6, right: 4, top: 2, bottom: 3 }, space: 6, bg: 'hud' });
    bar.setOrigin(0, 0);
    bar.add(txt(this, this.step < 3 ? '葬礼筹备' : '追悼会', { color: COL.joss, scale: W >= 420 ? 2 : 1 }), { align: 'center' });
    const steps = hbox(this, { space: W >= 420 ? 6 : 3 });
    STEP_NAMES.forEach((n, i) => {
      const color = i === this.step ? COL.joss : i < this.step ? COL.dim : COL.dim2;
      steps.add(txt(this, W >= 360 ? `${i + 1} ${n}` : `${i + 1}`, { color }), { align: 'center' });
    });
    bar.add(steps, { proportion: 1, align: 'center' });
    bar.add(button(this, '', { icon: 'close', kind: 'quiet', small: true, onClick: () => this.cancel() }), { align: 'center' });
    bar.layout();
    bar.setPosition(0, 0);
    bar.setDepth(50);
    this.root.push(bar);
    return bar.height;
  }

  private cancel(): void {
    sfx('stop');
    domLayer.blurAll();
    if (history.length > 1 && document.referrer.startsWith(location.origin)) history.back();
    else navigate('/', { replace: true });
  }

  /** 底部固定的翻页按钮，不跟着内容滚走 */
  private navRow(w: number): Sizer {
    const list: Array<[string, Parameters<typeof button>[2]]> =
      this.step === 0
        ? [['盖章，下一步', { kind: 'seal', onClick: () => this.next() }]]
        : this.step === 1
          ? [
              ['上一步', { onClick: () => this.back() }],
              ['就这儿了', { kind: 'primary', onClick: () => this.next() }],
            ]
          : [
              ['上一步', { onClick: () => this.back() }],
              ['开追悼会', { kind: 'primary', onClick: () => this.next() }],
            ];
    return buttonRow(this, w, list as Array<[string, NonNullable<Parameters<typeof button>[2]>]>, 'right');
  }

  /* ---------------- 第一步：登记 ---------------- */

  private stepRegister(b: Sizer, w: number): void {
    const F = this.F;
    const ink = COL.paperInk;
    const headRow = hbox(this, { width: w, space: 6 });
    const titles = vbox(this, { space: 2 });
    titles.add(txt(this, '阴间户籍登记表', { color: ink, scale: w >= 300 ? 2 : 1 }), { align: 'left' });
    titles.add(txt(this, `地府民政局 · 不活了分局 · 编号 ${F.regNo}`, { color: COL.paperDim, wrap: w - 60 }), { align: 'left' });
    headRow.add(titles, { proportion: 1, align: 'left-top' });
    const stamp = new Label(this, {
      background: bg(this, 'chipPaperOn'),
      text: txt(this, '地府\n户籍科', { color: COL.paperRed, align: 'center', lineSpacing: 1 }),
      space: { left: 4, right: 4, top: 3, bottom: 4 },
    });
    this.add.existing(stamp);
    stamp.setAngle(-6);
    headRow.add(stamp, { align: 'right-top' });
    b.add(headRow, { expand: true });

    const field = (label: string) => b.add(txt(this, label, { color: COL.paperDim }), { align: 'left' });

    const two = w >= 320;
    if (two) {
      const row = hbox(this, { width: w, space: 8 });
      const c1 = vbox(this, { space: 3 });
      c1.add(txt(this, '姓名 / 称呼', { color: COL.paperDim }), { align: 'left' });
      c1.add(this.field({ width: Math.floor(w * 0.58), value: F.name, maxLength: 8, placeholder: '会刻在碑上，最多 8 个字', onInput: (v) => (F.name = v) }), { align: 'left' });
      const c2 = vbox(this, { space: 3 });
      c2.add(txt(this, '出生年份', { color: COL.paperDim }), { align: 'left' });
      c2.add(this.field({ width: w - Math.floor(w * 0.58) - 8, value: F.birthYear, maxLength: 4, numeric: true, placeholder: '例如 1996', onInput: (v) => (F.birthYear = v) }), { align: 'left' });
      row.add(c1, { align: 'left-top' });
      row.add(c2, { align: 'left-top' });
      b.add(row, { expand: true });
    } else {
      field('姓名 / 称呼');
      b.add(this.field({ width: w, value: F.name, maxLength: 8, placeholder: '会刻在碑上，最多 8 个字', onInput: (v) => (F.name = v) }), { align: 'left' });
      field('出生年份');
      b.add(this.field({ width: w, value: F.birthYear, maxLength: 4, numeric: true, placeholder: '例如 1996', onInput: (v) => (F.birthYear = v) }), { align: 'left' });
    }

    field('死因');
    b.add(
      choiceRow(this, w, CAUSES.map((c) => ({ value: c, label: c })), F.cause, (c) => {
        F.cause = c;
        this.render(true);
      }, { paper: true }),
      { align: 'left' },
    );
    b.add(
      this.field({
        width: w,
        value: CAUSES.includes(F.cause) ? '' : F.cause,
        maxLength: 12,
        placeholder: '都不是？自己写一个',
        onInput: (v) => {
          if (v.trim()) F.cause = v.trim();
        },
      }),
      { align: 'left' },
    );

    field('遗像（黑白）');
    const faces = flow(this, w, { space: 4 });
    for (let i = 0; i < 6; i++) {
      const on = F.portrait === i;
      const l = new Label(this, {
        background: bg(this, on ? 'chipPaperOn' : 'chipPaper'),
        icon: image(this, `portrait-${i}`),
        space: { left: 3, right: 3, top: 3, bottom: 3 },
      });
      this.add.existing(l);
      tappable(l, () => {
        F.portrait = i;
        this.render(true);
      });
      faces.add(l);
    }
    b.add(faces, { align: 'left' });

    field('遗言');
    b.add(this.field({ width: w, value: F.lastWords, maxLength: 40, placeholder: '葬礼上会念，最多 40 个字', onInput: (v) => (F.lastWords = v) }), { align: 'left' });
    if (this.err) b.add(txt(this, this.err, { color: COL.paperRed, wrap: w }), { align: 'left' });
  }

  private field(o: { width: number; value: string; maxLength: number; placeholder: string; numeric?: boolean; multiline?: boolean; rows?: number; onInput: (v: string) => void }) {
    const { box } = inputBox(this, {
      owner: 'scene',
      width: o.width,
      value: o.value,
      maxLength: o.maxLength,
      placeholder: o.placeholder,
      numeric: o.numeric,
      multiline: o.multiline,
      rows: o.rows,
      paper: this.step === 0,
      onInput: o.onInput,
      onEnter: () => this.next(),
    });
    return box;
  }

  /* ---------------- 第二步：选墓 ---------------- */

  private stepPick(b: Sizer, w: number): void {
    const F = this.F;
    const wide = w >= 560;
    const formW = wide ? w - 150 : w;
    const row = hbox(this, { width: w, space: 10 });
    const form = vbox(this, { width: formW, space: 8 });

    if (!this.isRefuneral) {
      form.add(heading(this, '选园区', formW), { expand: true });
      if (!this.zones.length) form.add(note(this, '加载园区…', formW), { align: 'left' });
      const zg = flow(this, formW, { space: 4, line: 4 });
      for (const z of this.zones) {
        const on = F.zoneKey === z.key;
        const card = vbox(this, { width: wide ? 142 : Math.floor((formW - 8) / 2), pad: 4, space: 2, bg: on ? 'cardHi' : 'card' });
        const top = hbox(this, { space: 4 });
        top.add(image(this, `stone-${z.default_style || 'qingshi'}`), { align: 'left-top' });
        const tx = vbox(this, { space: 1 });
        tx.add(txt(this, z.name, { color: on ? COL.joss : COL.bone }), { align: 'left' });
        tx.add(txt(this, `已住 ${z.tomb_count} 人`, { color: COL.dim2 }), { align: 'left' });
        top.add(tx, { align: 'left-top' });
        card.add(top, { align: 'left' });
        card.add(txt(this, z.tagline, { color: COL.dim, wrap: (wide ? 142 : Math.floor((formW - 8) / 2)) - 8 }), { align: 'left' });
        tappable(card, () => void this.selectZone(z.key, true));
        zg.add(card);
      }
      form.add(zg, { align: 'left' });
    }

    form.add(heading(this, '选碑', formW), { expand: true });
    const sg = flow(this, formW, { space: 4, line: 4 });
    for (const s of STYLES) {
      const on = F.style === s.k;
      const cw = wide ? 84 : Math.floor((formW - 8) / 3);
      const card = vbox(this, { width: cw, pad: 4, space: 2, bg: on ? 'cardHi' : 'card' });
      card.add(image(this, `stone-${s.k}`, 2), { align: 'center' });
      card.add(txt(this, s.name, { color: on ? COL.joss : COL.bone }), { align: 'center' });
      card.add(txt(this, s.note, { color: COL.dim2, wrap: cw - 8, align: 'center' }), { align: 'center' });
      tappable(card, () => {
        F.style = s.k;
        F.styleTouched = true;
        this.render(true);
      });
      sg.add(card);
    }
    form.add(sg, { align: 'left' });

    if (!this.isRefuneral) {
      form.add(heading(this, '选墓位', formW), { expand: true });
      const sp = this.grid?.cells.find((c) => c.cell === F.cell)?.special ?? SPECIAL[F.cell];
      form.add(note(this, `金色的是好位置，灰色的已经有人住了。当前：${address(F.cell)}${sp ? ' · ' + sp : ''}`, formW), { align: 'left' });
      const z = this.zones.find((x) => x.key === F.zoneKey);
      if (z && z.phases.length > 1) {
        const tabs = flow(this, formW, { space: 3 });
        for (const p of [...z.phases].sort((a, c) => a.number - c.number)) {
          tabs.add(chip(this, cnPhaseLabel(p.number), { on: F.zonePhaseId === p.id, onClick: () => void this.loadPhase(p.id, false) }));
        }
        form.add(tabs, { align: 'left' });
      }
      if (this.gridLoading || !this.grid) form.add(note(this, '加载墓位…', formW), { align: 'left' });
      else form.add(cellGrid(this, formW, this.cells(), F.cell, (c) => {
        F.cell = c;
        this.render(true);
      }), { align: 'left' });
      form.add(note(this, '想和朋友埋在一起？先各自下葬，夜里去对方坟前递一张结伴帖。', formW), { align: 'left' });
    } else {
      form.add(note(this, '重办葬礼不换位置，只更新你的登记信息。', formW), { align: 'left' });
    }


    row.add(form, { align: 'left-top' });
    if (wide) row.add(this.preview(140), { align: 'center-top' });
    b.add(row, { expand: true });
    if (!wide) b.add(this.preview(w), { align: 'center' });
  }

  private cells(): CellInfo[] {
    const occ = occupancy(this.grid);
    const list: CellInfo[] = [];
    for (let i = 0; i < 60; i++) {
      const c = occ.get(i);
      if (c) {
        const nm = c.tomb?.name ?? c.group?.name ?? '占';
        list.push({ cell: i, state: 'taken', label: clip(nm, 2).replace('…', ''), why: `${address(i)}已经有人住了：${nm}` });
        continue;
      }
      const sp = this.grid?.cells.find((x) => x.cell === i)?.special ?? SPECIAL[i];
      list.push({ cell: i, state: sp ? 'special' : 'free', label: sp ? '★' : `${Math.floor(i / 6) + 1}-${(i % 6) + 1}` });
    }
    return list;
  }

  private preview(w: number): Sizer {
    const box = vbox(this, { width: w, space: 4 });
    box.add(txt(this, '预览', { color: COL.dim }), { align: 'center' });
    box.add(
      bigStoneView(
        this,
        {
          name: this.F.name || '某某',
          style: this.F.style,
          birthYear: Number(this.F.birthYear) || 2000,
          diedAt: Date.now(),
          portrait: this.F.portrait,
        },
        w,
      ),
      { align: 'center' },
    );
    if (this.step === 2) box.add(txt(this, this.F.epitaph || '终于不用上班了', { color: COL.bone, wrap: w, align: 'center' }), { align: 'center' });
    return box;
  }

  /* ---------------- 第三步：墓志铭 ---------------- */

  private stepEpitaph(b: Sizer, w: number): void {
    const F = this.F;
    const wide = w >= 560;
    const formW = wide ? w - 150 : w;
    const row = hbox(this, { width: w, space: 10 });
    const form = vbox(this, { width: formW, space: 8 });
    form.add(heading(this, '墓志铭', formW), { expand: true });
    form.add(note(this, '刻在碑上给路人看的一句话，最多 40 个字。以后每天晚上都能出来改。', formW), { align: 'left' });
    form.add(this.field({ width: formW, value: F.epitaph, maxLength: 40, multiline: true, rows: 2, placeholder: '终于不用上班了', onInput: (v) => (F.epitaph = v) }), { align: 'left' });
    form.add(txt(this, '没灵感就抄一句', { color: COL.dim }), { align: 'left' });
    form.add(
      choiceRow(this, formW, EPITAPHS.map((e) => ({ value: e, label: e })), F.epitaph, (e) => {
        F.epitaph = e;
        this.render(true);
      }),
      { align: 'left' },
    );
    row.add(form, { align: 'left-top' });
    if (wide) row.add(this.preview(140), { align: 'center-top' });
    b.add(row, { expand: true });
    if (!wide) b.add(this.preview(w), { align: 'center' });
  }

  /* ---------------- 翻页 ---------------- */

  private validateRegister(): boolean {
    const F = this.F;
    const y = Number(F.birthYear);
    const now = new Date().getFullYear();
    this.err = !F.name.trim()
      ? '先写上名字，碑上要刻的。'
      : !(y >= 1900 && y <= now)
        ? `出生年份要在 1900 到 ${now} 之间。`
        : !F.cause.trim()
          ? '选一个死因，或者自己写一个。'
          : '';
    if (this.err) return false;
    F.name = F.name.trim();
    return true;
  }

  private next(): void {
    domLayer.blurAll();
    if (this.step === 0 && !this.validateRegister()) {
      this.render(true);
      return;
    }
    if (this.step === 1 && !this.isRefuneral && (!this.F.zonePhaseId || occupancy(this.grid).has(this.F.cell))) {
      toast('先挑一块空着的墓位。');
      return;
    }
    if (this.step === 2 && !this.F.epitaph.trim()) this.F.epitaph = '终于不用上班了';
    this.step++;
    if (this.step === 3) {
      this.F.eulogy = makeEulogy({ name: this.F.name, birthYear: Number(this.F.birthYear), cause: this.F.cause, lastWords: this.F.lastWords });
      this.F.verdict = pick(VERDICTS);
      this.clear();
      this.ceremony = new Ceremony(this, this.F, () => void this.save(), () => this.cancel());
      return;
    }
    this.render();
  }

  private back(): void {
    domLayer.blurAll();
    if (this.step > 0) this.step--;
    this.render();
  }

  /* ---------------- 入住新家 ---------------- */

  private async save(): Promise<void> {
    const F = this.F;
    const cer = this.ceremony;
    cer?.setSaving(true);
    try {
      const payload: Parameters<typeof api.saveTomb>[0] = {
        name: F.name,
        birth_year: Number(F.birthYear),
        cause: F.cause,
        portrait: F.portrait,
        last_words: F.lastWords.trim() || null,
        style: F.style as StoneStyleKey,
        epitaph: F.epitaph,
        eulogy: F.eulogy,
        verdict: F.verdict,
        couplet: F.couplet,
      };
      if (!this.isRefuneral) {
        if (!F.zonePhaseId) throw new Error('请选择墓位');
        payload.zone_phase_id = F.zonePhaseId;
        payload.cell = F.cell;
      }
      const res = await api.saveTomb(payload);
      invalidateGrids();
      setTomb(res.tomb);
      await fetchZones();
      const finish = () => {
        applyPref();
        const out = ghostOut();
        toast(out ? '下葬完成。天已经黑了，出去转转吧。' : '下葬完成。现在是白天，先在棺材里躺着，18:00 天黑后可以出来。', {
          btn: '邀请烧纸',
          onBtn: () => openPanel('invite'),
          ms: 7000,
        });
        navigate('/', { replace: true });
      };
      if (res.resurrect_code) openPanel('resurrectCode', { code: res.resurrect_code, onClose: finish });
      else finish();
    } catch (e) {
      if (e instanceof api.ApiError && e.status === 409) {
        cer?.setSaving(false);
        this.ceremony?.destroy();
        this.ceremony = null;
        toast(e.message || '这块刚被人占了', { err: true });
        this.step = 1;
        if (F.zonePhaseId) await this.loadPhase(F.zonePhaseId, false);
        else this.render();
        return;
      }
      cer?.setSaveError(e instanceof Error && e.message ? e.message : api.DEFAULT_ERROR);
    }
  }
}

/* ======================= 追悼会 ======================= */

class Ceremony {
  private scene: Phaser.Scene;
  private F: Form;
  private onSave: () => void;
  private onCancel: () => void;
  private act = 0;
  private bows = 0;
  private bowing = false;
  private cd = 3;
  private typed = '';
  private typing = false;
  private lidClosed = false;
  private verdictIn = false;
  private buried = 0;
  private saving = false;
  private saveErr = '';
  private objs: Phaser.GameObjects.GameObject[] = [];
  private timers: Phaser.Time.TimerEvent[] = [];
  private eulText: ReturnType<typeof txt> | null = null;
  private stageY = 0;
  private stageH = 0;
  private flames: Phaser.GameObjects.Rectangle[] = [];
  private destroyed = false;

  constructor(scene: Phaser.Scene, F: Form, onSave: () => void, onCancel: () => void) {
    this.scene = scene;
    this.F = F;
    this.onSave = onSave;
    this.onCancel = onCancel;
    this.layout();
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.update, this);
  }

  destroy(): void {
    this.destroyed = true;
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this);
    for (const t of this.timers) t.remove();
    this.timers = [];
    this.clear();
  }

  setSaving(v: boolean): void {
    this.saving = v;
    if (v) this.saveErr = '';
    this.layout();
  }

  setSaveError(msg: string): void {
    this.saveErr = msg;
    this.saving = false;
    this.layout();
  }

  private later(ms: number, fn: () => void): void {
    this.timers.push(this.scene.time.delayedCall(ms, () => !this.destroyed && fn()));
  }

  private clear(): void {
    for (const o of this.objs) o.destroy();
    this.objs = [];
    this.flames = [];
    this.eulText = null;
  }

  private add<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.objs.push(o);
    return o;
  }

  layout(): void {
    if (this.destroyed) return;
    this.clear();
    const s = this.scene;
    const W = s.scale.width;
    const H = s.scale.height;
    const [cr, cl, cb] = COUPLETS[this.F.couplet] ?? COUPLETS[0];

    // 顶栏
    const bar = hbox(s, { width: W, pad: { left: 6, right: 4, top: 2, bottom: 3 }, space: 6, bg: 'hud' });
    bar.setOrigin(0, 0);
    bar.add(txt(s, '追悼会', { color: COL.joss, scale: W >= 420 ? 2 : 1 }), { align: 'center' });
    bar.addSpace(1);
    bar.add(button(s, '', { icon: 'close', kind: 'quiet', small: true, onClick: () => this.onCancel() }), { align: 'center' });
    bar.layout();
    bar.setPosition(0, 0);
    this.add(bar);

    const top = bar.height;
    const hostH = 64;
    this.stageY = top;
    this.stageH = H - top - hostH - 30;
    const sw = Math.min(W, 560);
    const sx = Math.round((W - sw) / 2);
    const g = this.add(s.add.graphics());
    g.fillStyle(0x1a1414, 1);
    g.fillRect(0, top, W, this.stageH);
    g.fillStyle(0x2a1f1a, 1);
    g.fillRect(0, top + this.stageH - 24, W, 24);
    g.fillStyle(0x1f1713, 1);
    for (let x = 0; x < W; x += 12) g.fillRect(x, top + this.stageH - 24, 1, 24);

    // 横批和挽联
    const banner = this.add(txt(s, cb, { color: COL.paperInk, scale: 2 }));
    const bw = banner.displayWidth + 20;
    g.fillStyle(0xefeadf, 1);
    g.fillRect(Math.round(W / 2 - bw / 2), top + 6, bw, banner.displayHeight + 8);
    banner.setOrigin(0.5, 0).setPosition(Math.round(W / 2), top + 10);
    const bannerBottom = top + 6 + banner.displayHeight + 8;
    const vert = (str: string) => [...str].join('\n');
    // 窄屏用小一号的挽联，给中间的悼词留地方
    const coupletScale = this.stageH >= 260 && sw >= 400 ? 2 : 1;
    const coupletInner = 18 * coupletScale + 6 * coupletScale + 4;
    for (const [str, side] of [
      [cr, 1],
      [cl, -1],
    ] as const) {
      const t = this.add(txt(s, vert(str), { color: COL.paperInk, lineSpacing: 1, align: 'center', scale: coupletScale }));
      const cx = side > 0 ? sx + sw - 18 * coupletScale : sx + 18 * coupletScale;
      g.fillStyle(0xefeadf, 1);
      g.fillRect(Math.round(cx - t.displayWidth / 2 - 4), top + 34, Math.round(t.displayWidth + 8), Math.round(t.displayHeight + 12));
      t.setOrigin(0.5, 0).setPosition(Math.round(cx), top + 40);
    }

    const cx = Math.round(W / 2);
    const floor = top + this.stageH - 24;
    if (this.act <= 1 || this.act === 3) this.drawAltar(g, cx, floor);
    if (this.act === 1) {
      const n = this.add(txt(s, String(this.cd), { color: COL.bone, scale: 5 }));
      n.setOrigin(0.5, 0.5).setPosition(cx, Math.round(top + this.stageH * 0.42));
    }
    if (this.act === 3) {
      const label = ['', '一鞠躬', '二鞠躬', '三鞠躬'][this.bows] || '';
      if (label) this.add(txt(s, label, { color: COL.joss, scale: 2 })).setOrigin(0.5, 0).setPosition(cx, top + 40);
    }
    if (this.act === 2) {
      // 悼词纸放在两条挽联中间、横批下面
      const ew = Math.min(sw - 2 * (coupletInner + 6), 440);
      const panel = vbox(s, { width: ew, pad: 8, bg: 'paper' });
      // 先用全文排版定下纸的大小，再换成正在念的那部分
      this.eulText = txt(s, this.F.eulogy, { color: COL.paperInk, wrap: ew - 16 });
      panel.add(this.eulText, { align: 'left-top' });
      panel.setOrigin(0.5, 0);
      panel.layout();
      panel.setPosition(cx, bannerBottom + 6);
      revealTxt(this.eulText, this.F.eulogy, this.typed.length);
      this.add(panel);
    }
    if (this.act === 4) this.drawCoffin(g, cx, floor);
    if (this.act >= 5) this.drawGrave(g, cx, floor);

    // 主持人
    const host = vbox(s, { width: Math.min(W - 12, 520), pad: { left: 8, right: 8, top: 5, bottom: 6 }, space: 2, bg: 'card' });
    host.add(txt(s, this.hostLine(), { color: COL.bone, wrap: Math.min(W - 12, 520) - 16, markup: true }), { align: 'left' });
    if (this.act === 6) host.add(txt(s, this.F.epitaph, { color: COL.dim, wrap: Math.min(W - 12, 520) - 16 }), { align: 'left' });
    host.setOrigin(0.5, 0);
    host.layout();
    host.setPosition(cx, top + this.stageH + 4);
    this.add(host);

    const action = this.actionButton();
    if (action) {
      action.setOrigin(0.5, 1);
      action.layout();
      action.setPosition(cx, H - 6);
      this.add(action);
    }
    if (this.saveErr) {
      const e = this.add(txt(s, this.saveErr, { color: COL.seal, wrap: W - 20, align: 'center' }));
      e.setOrigin(0.5, 1).setPosition(cx, H - 30);
    }
  }

  private hostLine(): string {
    const n = this.F.name;
    const b = `[color=${COL.joss}]主持人：[/color]`;
    const esc = (s: string) => `[raw]${s}[/raw]`;
    switch (this.act) {
      case 0:
        return b + esc(`${n}同志追悼会，现在开始。请全体起立。`);
      case 1:
        return b + '默哀三秒。';
      case 2:
        return b + '下面宣读悼词。';
      case 3:
        return b + '向遗体三鞠躬。';
      case 4:
        return b + (this.verdictIn ? esc(`盖棺定论：${this.F.verdict}。`) : this.lidClosed ? '盖棺。' : '瞻仰遗容。最后看一眼。');
      case 5:
        return b + '入土为安。';
      default:
        return b + esc(`礼成。${n}，一路走好。`);
    }
  }

  private actionButton(): Label | null {
    const s = this.scene;
    switch (this.act) {
      case 0:
        return button(s, '全体起立', { kind: 'primary', onClick: () => this.stand() });
      case 2:
        return button(s, '念完了', { kind: 'primary', onClick: () => this.finishEulogy() });
      case 3:
        return button(s, `鞠躬（${this.bows}/3）`, { kind: 'primary', disabled: this.bowing, onClick: () => this.bow() });
      case 4:
        if (this.lidClosed && !this.verdictIn) return null;
        return button(s, this.verdictIn ? '下葬' : '盖棺', { kind: 'primary', onClick: () => (this.verdictIn ? this.bury() : this.closeLid()) });
      case 6:
        return button(s, this.saving ? '正在登记户口…' : '入住新家', { kind: 'primary', disabled: this.saving, onClick: () => this.onSave() });
      default:
        return null;
    }
  }

  private drawAltar(g: Phaser.GameObjects.Graphics, cx: number, floor: number): void {
    const s = this.scene;
    const scale = this.stageH >= 280 ? 3 : 2;
    // 供桌
    const tw = 120;
    g.fillStyle(0x120a05, 1);
    g.fillRect(cx - tw / 2 - 1, floor - 31, tw + 2, 32);
    g.fillStyle(0x3b2414, 1);
    g.fillRect(cx - tw / 2, floor - 30, tw, 30);
    g.fillStyle(0x5e3a20, 1);
    g.fillRect(cx - tw / 2, floor - 30, tw, 3);
    g.fillStyle(0xc4453a, 1);
    g.fillRect(cx - 30, floor - 27, 60, 12);
    // 遗像
    const pt = this.add(s.add.image(cx, floor - 34, `portrait-${this.F.portrait}`).setOrigin(0.5, 1).setScale(scale));
    const name = this.add(txt(s, this.F.name, { color: COL.bone }));
    name.setOrigin(0.5, 1).setPosition(cx, Math.round(pt.y - pt.displayHeight - 4));
    // 蜡烛
    for (const dx of [-46, 46]) {
      g.fillStyle(0x16131d, 1);
      g.fillRect(cx + dx - 3, floor - 52, 6, 22);
      g.fillStyle(0xefeadf, 1);
      g.fillRect(cx + dx - 2, floor - 51, 4, 21);
      const f = this.add(s.add.rectangle(cx + dx, floor - 56, 3, 5, 0xf39a3a));
      this.flames.push(f);
      this.add(s.add.image(cx + dx, floor - 56, 'glow-warm-28').setBlendMode(Phaser.BlendModes.ADD));
    }
    // 香炉
    g.fillStyle(0x9c7424, 1);
    g.fillRect(cx - 8, floor - 36, 16, 6);
    g.fillStyle(0xe8743b, 1);
    g.fillRect(cx - 3, floor - 42, 1, 6);
    g.fillRect(cx, floor - 44, 1, 8);
    g.fillRect(cx + 3, floor - 42, 1, 6);
  }

  private drawCoffin(g: Phaser.GameObjects.Graphics, cx: number, floor: number): void {
    const s = this.scene;
    const w = 190;
    const h = 56;
    const x = cx - w / 2;
    const y = floor - h - 6;
    g.fillStyle(0x120a05, 1);
    g.fillRect(x - 2, y - 2, w + 4, h + 4);
    g.fillStyle(0x5a1a14, 1);
    g.fillRect(x, y, w, h);
    g.fillStyle(0x7a2a20, 1);
    g.fillRect(x, y, w, 4);
    g.fillStyle(0x2a0f0a, 1);
    g.fillRect(x + 50, y + 10, 70, 30);
    if (!this.lidClosed) {
      this.add(s.add.image(x + 85, y + 25, `face-${this.F.portrait}`).setScale(2));
    }
    if (this.lidClosed) {
      const lid = this.add(s.add.rectangle(cx, y + 1, w + 6, 20, 0x6e221a).setStrokeStyle(2, 0x120a05).setOrigin(0.5, 0));
      void lid;
      this.add(txt(s, '寿', { color: COL.joss, scale: 2 })).setOrigin(0.5, 0).setPosition(cx, y + 2);
    }
    if (this.verdictIn) {
      const v = vbox(s, { pad: 6, space: 2, bg: 'cardSeal' });
      v.add(txt(s, '盖棺定论', { color: COL.seal }), { align: 'center' });
      v.add(txt(s, this.F.verdict, { color: COL.bone, scale: 2 }), { align: 'center' });
      v.setOrigin(0.5, 0.5);
      v.layout();
      v.setPosition(cx, Math.round(y - 50));
      v.setAngle(-4);
      this.add(v);
    }
  }

  private drawGrave(g: Phaser.GameObjects.Graphics, cx: number, floor: number): void {
    const s = this.scene;
    const pitW = 200;
    const pitH = 70;
    const gy = floor - 10;
    g.fillStyle(0x4f7a45, 1);
    g.fillRect(cx - 160, gy - 6, 320, 6);
    g.fillStyle(0x3a2a18, 1);
    g.fillRect(cx - pitW / 2, gy, pitW, pitH);
    g.fillStyle(0x2a1d10, 1);
    g.fillRect(cx - pitW / 2 + 6, gy + 4, pitW - 12, pitH - 8);
    if (this.buried < 2) {
      const coffinY = this.buried >= 1 ? gy + pitH - 30 : gy - 34;
      const c = this.add(s.add.rectangle(cx, coffinY, 160, 26, 0x5a1a14).setStrokeStyle(2, 0x120a05).setOrigin(0.5, 0));
      if (this.buried === 0) {
        this.scene.tweens.add({ targets: c, y: gy + pitH - 30, duration: 1800, ease: 'Stepped', easeParams: [12] });
      }
    }
    if (this.buried >= 1) {
      const dirt = this.add(s.add.rectangle(cx, gy + pitH, pitW - 12, this.buried >= 2 ? pitH - 4 : 0, 0x6f5435).setOrigin(0.5, 1));
      if (this.buried === 1) this.scene.tweens.add({ targets: dirt, height: pitH - 4, duration: 1800, ease: 'Stepped', easeParams: [10] });
    }
    if (this.buried >= 2) {
      const stone = this.add(s.add.image(cx, gy - 6, `stone-${this.F.style}`).setOrigin(0.5, 1).setScale(3));
      const name = this.add(txt(s, clip(this.F.name, 5), { color: COL.bone }));
      name.setOrigin(0.5, 1).setPosition(cx, Math.round(stone.y - stone.displayHeight - 4));
    }
  }

  private update(_t: number, delta: number): void {
    for (const f of this.flames) {
      f.setScale(1, 0.8 + Math.random() * 0.5);
    }
    void delta;
  }

  private stand(): void {
    sfx('gong');
    this.act = 1;
    this.cd = 3;
    this.layout();
    sfx('dirge');
    const tick = () => {
      if (this.act !== 1) return;
      this.cd--;
      if (this.cd <= 0) {
        this.act = 2;
        this.startEulogy();
        return;
      }
      this.layout();
      this.later(1000, tick);
    };
    this.later(1000, tick);
  }

  private startEulogy(): void {
    this.typed = '';
    this.typing = true;
    this.layout();
    const full = this.F.eulogy;
    let i = 0;
    const step = () => {
      if (!this.typing || this.act !== 2) return;
      i += 2;
      this.typed = full.slice(0, i);
      if (this.eulText) revealTxt(this.eulText, full, i);
      if (i >= full.length) {
        this.typing = false;
        return;
      }
      this.later(45, step);
    };
    this.later(45, step);
  }

  private finishEulogy(): void {
    if (this.typing) {
      this.typing = false;
      this.typed = this.F.eulogy;
      this.layout();
      return;
    }
    this.act = 3;
    this.layout();
  }

  private bow(): void {
    if (this.bowing) return;
    sfx('muyu');
    this.bows++;
    this.bowing = true;
    this.layout();
    const cam = this.scene.cameras.main;
    this.scene.tweens.add({ targets: cam, scrollY: -4, duration: 300, yoyo: true, ease: 'Stepped', easeParams: [3] });
    this.later(650, () => {
      this.bowing = false;
      if (this.bows >= 3) this.later(500, () => {
        this.act = 4;
        this.layout();
      });
      else this.layout();
    });
  }

  private closeLid(): void {
    this.lidClosed = true;
    sfx('knock');
    this.layout();
    this.later(1700, () => {
      this.verdictIn = true;
      sfx('muyu');
      this.layout();
    });
  }

  private bury(): void {
    this.act = 5;
    this.buried = 0;
    this.layout();
    sfx('whoosh');
    this.later(2000, () => {
      this.buried = 1;
      this.layout();
      this.later(2000, () => {
        this.buried = 2;
        sfx('stop');
        sfx('gong');
        fx({ kind: 'joss', count: 90 });
        this.act = 6;
        this.layout();
      });
    });
  }
}
