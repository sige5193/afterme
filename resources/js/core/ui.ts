/**
 * 界面门面：核心逻辑（轮询、会话）不直接碰 Phaser，只通过这里发事件，
 * 由 UIScene / FxScene 负责真正画出来。
 */

import { emit } from './bus';
import { state } from './state';

export type ToastOptions = {
  btn?: string;
  onBtn?: () => void;
  err?: boolean;
  ms?: number;
};

export type PanelKind =
  | 'tomb'
  | 'group'
  | 'mine'
  | 'search'
  | 'zones'
  | 'burn'
  | 'dreamComposer'
  | 'inbox'
  | 'dreams'
  | 'invite'
  | 'wealth'
  | 'epitaph'
  | 'groupEpitaph'
  | 'zhashi'
  | 'resurrect'
  | 'resurrectCode'
  | 'joinRequest'
  | 'joinRespond'
  | 'moveTomb'
  | 'leaveGroup'
  | 'groupSettings'
  | 'groupMove'
  | 'confirm'
  | 'menu'
  | 'help';

export type PanelRequest = {
  kind: PanelKind;
  payload: Record<string, unknown>;
};

export type FxRequest =
  | { kind: 'joss'; count?: number }
  | { kind: 'burn'; items: Record<string, number>; name: string; label?: string; onDone?: () => void }
  | {
      kind: 'dream';
      text: string;
      style: string;
      fromName: string;
      at: number;
      id: string | number;
      onClose?: () => void;
    }
  | { kind: 'union'; onDone?: () => void }
  | { kind: 'move'; onDone?: () => void }
  | { kind: 'shake' };

export function toast(text: string, opts: ToastOptions = {}): void {
  emit('toast', { text, opts });
}

export function toastError(e: unknown, fallback: string): void {
  const msg = e instanceof Error && e.message ? e.message : fallback;
  toast(msg, { err: true });
}

export function openPanel(kind: PanelKind, payload: Record<string, unknown> = {}): void {
  emit('panel', { kind, payload });
}

/** 关掉最上面的面板；传 kind 只关这种 */
export function closePanel(kind?: PanelKind): void {
  emit('panel:close', kind);
}

export function fx(req: FxRequest): void {
  emit('fx', req);
}

export function sfx(name: SoundName, arg?: number): void {
  if (!state.sound) return;
  soundHandler?.(name, arg);
}

export type SoundName = 'knock' | 'gong' | 'muyu' | 'bell' | 'whoosh' | 'dirge' | 'stop' | 'crackle' | 'click';

let soundHandler: ((name: SoundName, arg?: number) => void) | null = null;

export function setSoundHandler(fn: (name: SoundName, arg?: number) => void): void {
  soundHandler = fn;
}

export function setSound(on: boolean): void {
  state.sound = on;
  try {
    localStorage.setItem('afterme:sound', on ? '1' : '0');
  } catch {
    /* ignore */
  }
  if (!on) soundHandler?.('stop');
  emit('sound', on);
}
