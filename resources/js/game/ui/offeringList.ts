/**
 * 香火簿 / 棺材里「上面的动静」的列表：烧纸记录、烧给全墓的、纸扎结伴帖。
 */

import type Phaser from 'phaser';
import type { InboxItem, Offering } from '@/api/types';
import { isApplyRequest, isJoinItem, itemsRecord } from '@/core/offerings';
import { state } from '@/core/state';
import { openPanel } from '@/core/ui';
import { ago } from '@/utils/time';
import { card, note } from './blocks';
import { bg, button, clip, flow, hbox, image, Label, tappable, txt, type Sizer, vbox } from './kit';
import { COL } from './theme';

export type OfferingListOpts = {
  muffle: boolean;
  canReply: boolean;
  revealed: Set<number>;
  onReveal: (id: number) => void;
};

function itemsLine(scene: Phaser.Scene, items: Offering['items'], w: number): Sizer {
  const f = flow(scene, w, { space: 3, line: 2 });
  f.add(txt(scene, '烧了', { color: COL.dim }));
  for (const [k, n] of Object.entries(itemsRecord(items))) {
    if (n <= 0) continue;
    const l = new Label(scene, {
      icon: image(scene, `item-${k}`),
      text: txt(scene, `×${n}`, { color: COL.bone }),
      space: { icon: 1, right: 2 },
    });
    scene.add.existing(l);
    f.add(l);
  }
  return f as unknown as Sizer;
}

export function offeringList(scene: Phaser.Scene, w: number, list: InboxItem[], o: OfferingListOpts): Sizer {
  const box = vbox(scene, { width: w, space: 5 });
  if (!list.length) {
    box.add(note(scene, '还没人来烧纸。', w), { align: 'left' });
    box.add(button(scene, '把墓址发给朋友', { small: true, icon: 'invite', onClick: () => openPanel('invite') }), { align: 'left' });
    return box;
  }
  const innerW = w - 12;
  for (const b of list) {
    if (isJoinItem(b)) {
      const j = b;
      const c = card(scene, w, 'cardSeal');
      const head = hbox(scene, { width: innerW, space: 4 });
      head.add(image(scene, 'icon-scroll'), { align: 'left-top' });
      head.add(txt(scene, `${clip(j.from_tomb?.name || '有人', 8)} 给你烧了一张纸扎结伴帖`, { color: COL.seal, wrap: innerW - 60 }), { proportion: 1, align: 'left-center' });
      head.add(txt(scene, ago(new Date(j.created_at).getTime()), { color: COL.dim2 }), { align: 'right-top' });
      c.add(head, { expand: true });
      const detail =
        isApplyRequest(j)
          ? `申请入伙 ${j.group?.name || ''}`
          : `想和你合葬${j.relation_label ? '，关系：' + j.relation_label : ''}${j.group_name ? '，墓名：' + j.group_name : ''}`;
      c.add(txt(scene, detail, { wrap: innerW }), { align: 'left' });
      if (j.message) c.add(txt(scene, `“${j.message}”`, { wrap: innerW, color: COL.bone }), { align: 'left' });
      const foot = hbox(scene, { width: innerW, space: 6 });
      foot.add(
        button(scene, '看看', {
          small: true,
          kind: 'primary',
          disabled: !o.canReply,
          why: '夜里才能回结伴帖',
          onClick: () => openPanel('joinRespond', { request: j }),
        }),
        { align: 'left' },
      );
      if (!o.canReply) foot.add(txt(scene, '夜里才能回结伴帖', { color: COL.dim2 }), { align: 'center' });
      c.add(foot, { expand: true });
      box.add(c, { expand: true });
      continue;
    }
    const off = b as Offering;
    const c = card(scene, w);
    const head = hbox(scene, { width: innerW, space: 4 });
    const self = off.user_id === state.user?.id;
    head.add(txt(scene, `${clip(off.from_name || '一位路过的活人', 12)}${self ? '（你自己）' : ''}`, { color: COL.joss, wrap: innerW - 60 }), { proportion: 1, align: 'left-top' });
    if (off.type === 'group_offering') {
      const tag = new Label(scene, { background: bg(scene, 'chipOn'), text: txt(scene, '烧给全墓', { color: COL.joss }), space: { left: 3, right: 3, top: 0, bottom: 1 } });
      scene.add.existing(tag);
      head.add(tag, { align: 'left-top' });
    }
    head.add(txt(scene, ago(new Date(off.created_at).getTime()), { color: COL.dim2 }), { align: 'right-top' });
    c.add(head, { expand: true });
    c.add(itemsLine(scene, off.items, innerW), { align: 'left' });
    if (off.message) {
      const muffled = o.muffle && !o.revealed.has(off.id);
      const msg = txt(scene, muffled ? `“${off.message}”` : `“${off.message}”`, { wrap: innerW, color: muffled ? '#4c4a44' : COL.bone });
      c.add(msg, { align: 'left' });
      if (muffled) {
        c.add(txt(scene, '（隔着棺材板听不清，点一下贴着板子听）', { color: COL.dim2, wrap: innerW }), { align: 'left' });
        tappable(msg, () => o.onReveal(off.id), { silent: true });
      }
    }
    const dream = off.dream;
    if (dream?.text) c.add(txt(scene, `你托的梦：${dream.text}`, { color: COL.wisp, wrap: innerW }), { align: 'left' });
    const foot = hbox(scene, { width: innerW, space: 6 });
    const done = !!(off.dream || off.has_dream);
    foot.add(txt(scene, done ? '已托梦' : '待托梦', { color: done ? COL.green : COL.dim }), { align: 'center' });
    foot.addSpace(1);
    if (!done && o.canReply) {
      foot.add(button(scene, '托梦', { small: true, kind: 'primary', icon: 'dreams', onClick: () => openPanel('dreamComposer', { offeringId: off.id }) }), { align: 'center' });
    }
    c.add(foot, { expand: true });
    box.add(c, { expand: true });
  }
  return box;
}
