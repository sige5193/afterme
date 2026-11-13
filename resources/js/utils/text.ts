/** HTML escape（Vue 模板通常不需要；拼 HTML 字符串时用） */
export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

export function pick<T>(a: readonly T[]): T {
  return a[Math.floor(Math.random() * a.length)]!;
}

export function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

/** 按 Unicode 字符截断，超出追加省略号 */
export function short(s: unknown, n: number): string {
  const a = [...String(s || '')];
  return a.length > n ? a.slice(0, n).join('') + '…' : a.join('');
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** 是否开启「减少动态效果」 */
export function prefersReducedMotion(): boolean {
  if (typeof matchMedia !== 'function') return false;
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** 启动时缓存的 REDUCED 标志（与原型一致） */
export const REDUCED =
  typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)').matches : false;
