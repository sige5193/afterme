/**
 * 全局事件总线：替代原来 Pinia 的响应式。
 * 状态改了就 emit，一个场景或面板关心什么就 on 什么，销毁时调用返回的函数取消订阅。
 */

import type { Route } from './router';
import type { PanelRequest, ToastOptions, FxRequest } from './ui';

export interface BusEvents {
  /** 用户、坟、合葬墓、出棺状态、在棺材里还是在外面 —— 任何一项变了 */
  session: void;
  /** 每秒一次 */
  clock: void;
  /** 本地时钟的昼夜变化 */
  daynight: boolean;
  /** 顶栏角标 */
  counts: void;
  /** 在场的鬼、活人数 */
  presence: void;
  zones: void;
  /** 某一期的网格更新了 */
  grid: number;
  route: Route;
  inbox: void;
  dreams: void;
  /** 正在看的那座坟里有人敲棺材板 */
  knock: void;
  /** 给某座坟（或合葬墓）烧了纸、改了碑文：打开着的详情要刷新 */
  changed: string;
  sound: boolean;
  toast: { text: string; opts: ToastOptions };
  panel: PanelRequest;
  'panel:close': string | undefined;
  /** 面板（含弹窗）开关状态变了，地图要不要暂停操作 */
  'panel:state': boolean;
  fx: FxRequest;
  resize: { width: number; height: number };
}

type Handler<T> = (payload: T) => void;

const handlers = new Map<keyof BusEvents, Set<Handler<unknown>>>();

export function on<K extends keyof BusEvents>(event: K, fn: Handler<BusEvents[K]>): () => void {
  let set = handlers.get(event);
  if (!set) {
    set = new Set();
    handlers.set(event, set);
  }
  set.add(fn as Handler<unknown>);
  return () => {
    set?.delete(fn as Handler<unknown>);
  };
}

export function emit<K extends keyof BusEvents>(
  event: K,
  ...payload: BusEvents[K] extends void ? [] : [BusEvents[K]]
): void {
  const set = handlers.get(event);
  if (!set) return;
  for (const fn of [...set]) {
    try {
      fn(payload[0]);
    } catch (e) {
      console.error(`[bus] ${String(event)} handler failed`, e);
    }
  }
}

/** 收集一组订阅，方便场景关闭时一次性取消 */
export class Subscriptions {
  private list: Array<() => void> = [];

  on<K extends keyof BusEvents>(event: K, fn: Handler<BusEvents[K]>): this {
    this.list.push(on(event, fn));
    return this;
  }

  add(off: () => void): this {
    this.list.push(off);
    return this;
  }

  clear(): void {
    for (const off of this.list.splice(0)) off();
  }
}
