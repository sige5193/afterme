/**
 * 杂项弹窗：确认框、告示（玩法说明）。
 */

import { navigate } from '@/core/router';
import { state } from '@/core/state';
import { closePanel, openPanel } from '@/core/ui';
import { heading, iconLine, para } from '../blocks';
import { button, type FixWidthSizer, type Sizer } from '../kit';
import { Panel } from '../Panel';
import { COL } from '../theme';

export class ConfirmPanel extends Panel {
  readonly kind = 'confirm' as const;

  title(): string {
    return String(this.payload.title ?? '确定吗');
  }

  buildBody(b: Sizer, w: number): void {
    b.add(para(this.scene, String(this.payload.text ?? ''), w), { align: 'left' });
  }

  buildFooter(f: FixWidthSizer): void {
    f.add(button(this.scene, String(this.payload.cancel ?? '算了'), { kind: 'quiet', onClick: () => this.close() }));
    f.add(
      button(this.scene, String(this.payload.ok ?? '好'), {
        kind: 'primary',
        onClick: () => {
          const cb = this.payload.onOk as (() => void) | undefined;
          this.close();
          cb?.();
        },
      }),
    );
  }
}

export class HelpPanel extends Panel {
  readonly kind = 'help' as const;

  preferredWidth(): number {
    return 420;
  }

  title(): string {
    return '告示';
  }

  subtitle(): string {
    return '地府民政局 · 不活了分局 谨告';
  }

  buildBody(b: Sizer, w: number): void {
    const s = this.scene;
    b.add(heading(s, '怎么玩', w), { expand: true });
    b.add(iconLine(s, 'icon-funeral', '先去户籍科给自己办一场葬礼：登记、选墓、刻碑文，再开一场追悼会。', w), { expand: true });
    b.add(iconLine(s, 'icon-coffin', '白天（06:00–18:00）你躺在棺材里；可以敲棺材板、数家当，也可以诈尸出来十分钟，但会刻在碑上。', w), { expand: true });
    b.add(iconLine(s, 'icon-ghost', '天黑以后推开棺材板出来夜游，能看到别的鬼，改碑文、托梦、递结伴帖都在夜里。', w), { expand: true });
    b.add(iconLine(s, 'icon-flame', '活人和别的鬼都能给任何一座坟烧纸留话；墓主夜里托梦回复，烧纸的人在「我的梦」里看。', w), { expand: true });
    b.add(iconLine(s, 'icon-scroll', '想和朋友埋在一起：先各自下葬，夜里去对方坟前递一张结伴帖，同意后就进合葬区。', w), { expand: true });
    b.add(heading(s, '操作', w), { expand: true });
    b.add(para(s, '电脑：WASD 或方向键走动，按 E 看碑、进门。手机：点地面走过去，点墓碑走到跟前。', w, COL.dim), { align: 'left' });
    b.add(para(s, '换手机或清了浏览器，用下葬时给你的还魂码回来。', w, COL.dim), { align: 'left' });
  }

  buildFooter(f: FixWidthSizer): void {
    if (!state.tomb) {
      f.add(
        button(this.scene, '去办葬礼', {
          kind: 'primary',
          onClick: () => {
            closePanel('help');
            navigate('/funeral');
          },
        }),
      );
    }
    f.add(
      button(this.scene, '我死过，回到我的坟', {
        kind: 'quiet',
        onClick: () => {
          closePanel('help');
          openPanel('resurrect');
        },
      }),
    );
  }
}
