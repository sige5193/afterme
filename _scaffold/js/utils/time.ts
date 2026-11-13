/** 墓址按 6 列编号：第几排第几号 */
export const COLS = 6;

const SHICHEN = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;
const CN = '〇一二三四五六七八九';

export function shichen(d: Date): string {
  return SHICHEN[Math.floor(((d.getHours() + 1) % 24) / 2)] + '时';
}

export function isNightAt(d: Date): boolean {
  const h = d.getHours();
  return h >= 18 || h < 6;
}

export function untilNight(d: Date): number {
  const t = new Date(d);
  t.setHours(18, 0, 0, 0);
  return Math.max(0, t.getTime() - d.getTime());
}

export function hhmm(d: Date): string {
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

export function fmtDur(ms: number): string {
  const m = Math.ceil(ms / 60000);
  const h = Math.floor(m / 60);
  return h ? `${h} 小时 ${m % 60} 分` : `${m} 分钟`;
}

export function mmss(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

export function cnYear(y: number | string): string {
  return String(y)
    .split('')
    .map((c) => CN[+c] ?? c)
    .join('');
}

export function cnN(n: number): string {
  if (n <= 10) return n === 10 ? '十' : CN[n];
  if (n < 20) return '十' + (n % 10 ? CN[n % 10] : '');
  return CN[Math.floor(n / 10)] + '十' + (n % 10 ? CN[n % 10] : '');
}

export function cnDate(ms: number): string {
  const d = new Date(ms);
  return `${cnYear(d.getFullYear())}年${cnN(d.getMonth() + 1)}月${cnN(d.getDate())}日`;
}

export function ymd(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

export function ago(ms: number): string {
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return '刚刚';
  if (s < 3600) return Math.floor(s / 60) + ' 分钟前';
  if (s < 86400) return Math.floor(s / 3600) + ' 小时前';
  if (s < 86400 * 30) return Math.floor(s / 86400) + ' 天前';
  return ymd(ms);
}

export function address(p: number): string {
  return `第 ${Math.floor(p / COLS) + 1} 排第 ${p % COLS + 1} 号`;
}
