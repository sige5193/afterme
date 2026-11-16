/**
 * 界面上用到的小格式化函数。
 */

const CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

export function cnNumber(n: number): string {
  if (n <= 10) return CN[n] ?? String(n);
  if (n < 20) return '十' + CN[n - 10];
  if (n < 100) return CN[Math.floor(n / 10)] + '十' + (n % 10 ? CN[n % 10] : '');
  return String(n);
}

/** 一期、二期…… */
export function cnPhaseLabel(n: number): string {
  return `${cnNumber(n)}期`;
}
