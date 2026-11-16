/**
 * 界面忙不忙：有面板或特效时，地图上的角色不响应键盘和点击。
 */

import { emit } from '@/core/bus';
import { domLayer } from './dom';

export const uiState = {
  panels: 0,
  fx: false,
  /** 面板关上以后，主场景里的输入框（葬礼表单）重新显示 */
  sceneOwner: 'scene',
};

export function uiBusy(): boolean {
  return uiState.panels > 0 || uiState.fx;
}

export function setPanelCount(n: number, topId: string | null): void {
  uiState.panels = n;
  domLayer.setTopOwner(topId ?? uiState.sceneOwner);
  emit('panel:state', uiBusy());
}

export function setFxActive(on: boolean): void {
  uiState.fx = on;
  domLayer.suspended = on;
  emit('panel:state', uiBusy());
}

/** 键盘事件来自正在打字的输入框时，地图不要动 */
export function typingInField(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}
