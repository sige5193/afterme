import { type MaybeRefOrGetter, toValue } from 'vue';

export type UsePollingOptions = {
  /** 实际发 pulse 的异步函数（API 由外部注入） */
  sendPulse: () => Promise<void> | void;
  /**
   * 是否处于「活跃」轮询：打开了墓碑详情，或自己是鬼且在墓园夜游。
   * true → 5s；false → 25s。
   */
  active?: MaybeRefOrGetter<boolean>;
  defaultIntervalMs?: number;
  activeIntervalMs?: number;
  moveDebounceMs?: number;
};

/**
 * Pulse 轮询骨架（REFACTOR §9.3）：
 * - 默认 25s / 活跃 5s
 * - document.hidden 时暂停，恢复可见立刻发一次
 * - 鬼移动后 500ms 防抖立即 pulse
 */
export function usePolling(opts: UsePollingOptions) {
  const defaultMs = opts.defaultIntervalMs ?? 25_000;
  const activeMs = opts.activeIntervalMs ?? 5_000;
  const moveDebounceMs = opts.moveDebounceMs ?? 500;

  let running = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let moveTimer: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false;
  let queued = false;
  let onVis: (() => void) | null = null;

  function intervalMs(): number {
    return toValue(opts.active) ? activeMs : defaultMs;
  }

  function clearTimer() {
    if (timer != null) clearTimeout(timer);
    timer = null;
  }

  function scheduleNext() {
    clearTimer();
    if (!running || document.hidden) return;
    timer = setTimeout(() => {
      void tick();
    }, intervalMs());
  }

  async function tick() {
    if (!running || document.hidden) return;
    if (inFlight) {
      queued = true;
      return;
    }
    inFlight = true;
    try {
      await opts.sendPulse();
    } catch {
      // 调用方自行 toast；骨架不吞也不重抛强依赖
    } finally {
      inFlight = false;
      if (queued) {
        queued = false;
        void tick();
      } else {
        scheduleNext();
      }
    }
  }

  /** 立刻发一次（不等定时器） */
  function pulseNow() {
    if (!running) return;
    clearTimer();
    void tick();
  }

  /**
   * 鬼移动墓位后调用：500ms 防抖后立即 pulse。
   */
  function onGhostMove() {
    if (!running) return;
    if (moveTimer != null) clearTimeout(moveTimer);
    moveTimer = setTimeout(() => {
      moveTimer = null;
      pulseNow();
    }, moveDebounceMs);
  }

  function start() {
    if (running) return;
    running = true;
    onVis = () => {
      if (document.hidden) {
        clearTimer();
      } else {
        pulseNow();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    if (!document.hidden) pulseNow();
  }

  function stop() {
    running = false;
    clearTimer();
    if (moveTimer != null) clearTimeout(moveTimer);
    moveTimer = null;
    queued = false;
    if (onVis) {
      document.removeEventListener('visibilitychange', onVis);
      onVis = null;
    }
  }

  return {
    start,
    stop,
    pulseNow,
    onGhostMove,
    get running() {
      return running;
    },
  };
}
