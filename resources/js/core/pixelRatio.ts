/**
 * 每个 CSS 像素实际占几个屏幕像素。
 *
 * Chrome / Edge / Firefox 的 devicePixelRatio 已经算上了页面缩放；
 * Safari 不算（WebKit bug 124862），也不支持 devicePixelContentBoxSize，
 * 开了页面缩放（比如默认 125%）时按 devicePixelRatio 算出来的整数倍就不是整数倍了，像素会一粗一细。
 * 这里用 outerWidth / innerWidth 估 Safari 的页面缩放，只认它自带的那几档，
 * 对不上（开着侧边栏、停靠的检查器）就不动。
 */

const SAFARI_ZOOM_STEPS = [0.5, 0.75, 0.85, 1.15, 1.25, 1.5, 1.75, 2, 2.5, 3];

/** 浏览器自己的 devicePixelRatio 是否已经可信（支持按屏幕像素量尺寸的都把缩放算进去了） */
function dprIncludesZoom(): boolean {
  return typeof ResizeObserverEntry === 'undefined' || 'devicePixelContentBoxSize' in ResizeObserverEntry.prototype;
}

/** Safari 的页面缩放倍数；估不出来就当 1 */
export function safariPageZoom(): number {
  if (dprIncludesZoom()) return 1;
  // 双指放大是另一回事，不管
  const vv = window.visualViewport;
  if (vv && Math.abs(vv.scale - 1) > 0.01) return 1;
  const outer = window.outerWidth;
  const inner = window.innerWidth;
  if (!outer || !inner) return 1;
  const ratio = outer / inner;
  let best = 1;
  for (const step of SAFARI_ZOOM_STEPS) {
    if (Math.abs(step - ratio) < Math.abs(best - ratio)) best = step;
  }
  return Math.abs(best - ratio) / best < 0.006 ? best : 1;
}

export function pixelRatio(): number {
  return (window.devicePixelRatio || 1) * safariPageZoom();
}
