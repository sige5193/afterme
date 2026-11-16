/**
 * 面板种类 → 面板类。
 */

import type { PanelKind } from '@/core/ui';
import type { Panel, PanelHost } from '../Panel';
import {
  BurnPanel,
  DreamComposerPanel,
  EpitaphPanel,
  GroupEpitaphPanel,
  InvitePanel,
  ResurrectCodePanel,
  ResurrectPanel,
  ZhashiPanel,
} from './actions';
import { GroupMovePanel, GroupSettingsPanel, JoinRequestPanel, JoinRespondPanel, LeaveGroupPanel, MoveTombPanel } from './group';
import { DreamsPanel, InboxPanel, MinePanel, SearchPanel, WealthPanel, ZonesPanel } from './lists';
import { ConfirmPanel, HelpPanel } from './misc';
import { GroupPanel, TombPanel } from './tomb';

type PanelCtor = new (scene: PanelHost, payload: Record<string, unknown>) => Panel;

export const PANELS: Partial<Record<PanelKind, PanelCtor>> = {
  tomb: TombPanel,
  group: GroupPanel,
  mine: MinePanel,
  search: SearchPanel,
  zones: ZonesPanel,
  burn: BurnPanel,
  dreamComposer: DreamComposerPanel,
  inbox: InboxPanel,
  dreams: DreamsPanel,
  invite: InvitePanel,
  wealth: WealthPanel,
  epitaph: EpitaphPanel,
  groupEpitaph: GroupEpitaphPanel,
  zhashi: ZhashiPanel,
  resurrect: ResurrectPanel,
  resurrectCode: ResurrectCodePanel,
  joinRequest: JoinRequestPanel,
  joinRespond: JoinRespondPanel,
  moveTomb: MoveTombPanel,
  leaveGroup: LeaveGroupPanel,
  groupSettings: GroupSettingsPanel,
  groupMove: GroupMovePanel,
  confirm: ConfirmPanel,
  help: HelpPanel,
};
