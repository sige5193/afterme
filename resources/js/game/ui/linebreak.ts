/**
 * 中文断行：rex 的 mix 模式逐字断行，句号逗号会掉到行首。
 * 这里先按同一字体量好宽度，自己插换行：
 * - 行首不放 。，、！？）」 这类标点（把上一个字一起挪下去）
 * - 行尾不放 （「“ 这类开括号
 * - 英文、数字连在一起的一串不拆开（除非一行放不下）
 * - 断在空格处就把空格换成换行
 * 支持 BBCode：标签不占宽度，[raw]…[/raw] 里的内容按原文算。
 */

import { FONT, FONT_SIZE } from './theme';

const NO_START = new Set([...'。，、；：！？）」』”’》〉】〕…—～·,.;:!?)]}%']);
const NO_END = new Set([...'（「『“‘《〈【〔([{']);
const TAG_RE = /^\[\/?[a-z]+(=[^\]]*)?\]/i;

type Unit = { start: number; end: number; w: number; first: string; last: string; space: boolean; nl: boolean };
type Break = { at: number; replace: boolean };

let ctx: CanvasRenderingContext2D | null = null;
const widths = new Map<string, number>();

function charWidth(ch: string): number {
  const hit = widths.get(ch);
  if (hit != null) return hit;
  ctx ??= document.createElement('canvas').getContext('2d');
  const font = `${FONT_SIZE}px ${FONT}`;
  if (!ctx) return ch.charCodeAt(0) < 0x2000 ? FONT_SIZE / 2 : FONT_SIZE;
  ctx.font = font;
  const w = ctx.measureText(ch).width;
  // 字体还没到就先不记，免得记错一辈子
  if (document.fonts?.check(font)) widths.set(ch, w);
  return w;
}

function units(str: string, markup: boolean): Unit[] {
  const out: Unit[] = [];
  let word: Unit | null = null;
  let inRaw = false;
  let i = 0;
  const flush = () => {
    if (word) out.push(word);
    word = null;
  };
  while (i < str.length) {
    if (markup) {
      if (inRaw) {
        if (str.startsWith('[/raw]', i)) {
          flush();
          inRaw = false;
          i += 6;
          continue;
        }
      } else if (str[i] === '[') {
        if (str.startsWith('[raw]', i)) {
          flush();
          inRaw = true;
          i += 5;
          continue;
        }
        const m = TAG_RE.exec(str.slice(i, i + 48));
        if (m) {
          flush();
          i += m[0].length;
          continue;
        }
      }
    }
    const cp = str.codePointAt(i) ?? 0;
    const ch = String.fromCodePoint(cp);
    if (ch === '\n') {
      flush();
      out.push({ start: i, end: i + 1, w: 0, first: ch, last: ch, space: false, nl: true });
      i += 1;
      continue;
    }
    const w = charWidth(ch);
    if (ch === ' ') {
      flush();
      out.push({ start: i, end: i + 1, w, first: ch, last: ch, space: true, nl: false });
      i += 1;
      continue;
    }
    if (cp < 0x80) {
      if (word) {
        word.end = i + ch.length;
        word.w += w;
        word.last = ch;
      } else {
        word = { start: i, end: i + ch.length, w, first: ch, last: ch, space: false, nl: false };
      }
      i += ch.length;
      continue;
    }
    flush();
    out.push({ start: i, end: i + ch.length, w, first: ch, last: ch, space: false, nl: false });
    i += ch.length;
  }
  flush();
  return out;
}

/** 一行放不下的长英文串拆成单个字母 */
function splitLong(str: string, list: Unit[], width: number): Unit[] {
  const out: Unit[] = [];
  for (const u of list) {
    if (u.w <= width || u.end - u.start <= 1 || u.space || u.nl) {
      out.push(u);
      continue;
    }
    for (let i = u.start; i < u.end; i++) {
      const ch = str[i];
      out.push({ start: i, end: i + 1, w: charWidth(ch), first: ch, last: ch, space: false, nl: false });
    }
  }
  return out;
}

function breaks(list: Unit[], width: number): Break[] {
  const out: Break[] = [];
  let line: Unit[] = [];
  let w = 0;
  for (const u of list) {
    if (u.nl) {
      line = [];
      w = 0;
      continue;
    }
    if (!line.length || w + u.w <= width) {
      line.push(u);
      w += u.w;
      continue;
    }
    if (u.space) {
      out.push({ at: u.start, replace: true });
      line = [];
      w = 0;
      continue;
    }
    const carry: Unit[] = [u];
    if (NO_START.has(u.first)) {
      while (line.length >= 2) {
        const p = line.pop() as Unit;
        carry.unshift(p);
        if (!NO_START.has(p.first)) break;
      }
    }
    while (line.length >= 2 && NO_END.has(line[line.length - 1].last)) carry.unshift(line.pop() as Unit);
    const last = line[line.length - 1];
    if (last?.space) out.push({ at: last.start, replace: true });
    else out.push({ at: carry[0].start, replace: false });
    line = carry;
    w = carry.reduce((a, c) => a + c.w, 0);
  }
  return out;
}

function apply(str: string, list: Break[]): string {
  if (!list.length) return str;
  let out = '';
  let pos = 0;
  for (const b of list) {
    out += str.slice(pos, b.at) + '\n';
    pos = b.replace ? b.at + 1 : b.at;
  }
  return out + str.slice(pos);
}

/** 给 BBCode 字符串插好换行（width 是没缩放前的像素宽） */
export function wrapMarkup(str: string, width: number): string {
  if (width <= 0 || !str) return str;
  return apply(str, breaks(splitLong(str, units(str, true), width), width));
}

const plainCache = new Map<string, string>();

/** 纯文本版本（打字机效果用），结果会缓存 */
export function wrapPlain(str: string, width: number): string {
  if (width <= 0 || !str) return str;
  const key = `${width}|${str}`;
  let hit = plainCache.get(key);
  if (hit == null) {
    hit = apply(str, breaks(splitLong(str, units(str, false), width), width));
    if (plainCache.size > 64) plainCache.clear();
    plainCache.set(key, hit);
  }
  return hit;
}

/** 原文前 n 个字（UTF-16 下标）对应排好版的字符串里到哪 */
export function wrappedIndex(full: string, wrapped: string, n: number): number {
  let i = 0;
  let j = 0;
  while (i < n && j < wrapped.length) {
    if (wrapped[j] === full[i]) {
      i++;
      j++;
    } else if (wrapped[j] === '\n' && full[i] === ' ') {
      i++;
      j++;
    } else {
      j++;
    }
  }
  return j;
}
