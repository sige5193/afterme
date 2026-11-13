/** 还魂码字母表：去掉 0 O 1 I L */
export const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** 生成 16 位还魂码（无「黄泉-」前缀与分组） */
export function generateResurrectCode(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < 16; i++) {
    out += alphabet[bytes[i]! % alphabet.length]!;
  }
  return out;
}

/** 显示格式：黄泉-XXXX-XXXX-XXXX-XXXX */
export function formatResurrectCode(code: string): string {
  const raw = normalizeResurrectCode(code);
  const parts = raw.match(/.{1,4}/g) ?? [];
  return '黄泉-' + parts.join('-');
}

/** 去掉「黄泉」前缀、连字符、空格，转大写 */
export function normalizeResurrectCode(code: string): string {
  return String(code ?? '')
    .trim()
    .replace(/^黄泉[-－—\s]*/u, '')
    .replace(/[-－—\s]/g, '')
    .toUpperCase();
}
