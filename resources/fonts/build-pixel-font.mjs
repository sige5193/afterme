/**
 * 把缝合像素字体（Fusion Pixel 12px Proportional SC，OFL-1.1）裁成常用字，输出 afterme-pixel.woff2。
 *
 * 收录：ASCII、GB2312 标点 / 全角符号 / 制表符、GB2312 一级汉字（3755 个常用字），
 * 以及前端源码和后端文案里出现过的所有字符（保证界面上的字一个不缺）。
 * 用户输入的生僻字不在里面时，浏览器会自动回退到系统字体。
 *
 * 用法：npm run font
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const source = join(
    root,
    'node_modules/@fontsource/fusion-pixel-12px-proportional-sc/files/fusion-pixel-12px-proportional-sc-latin-400-normal.woff2',
);
const output = join(here, 'afterme-pixel.woff2');

const chars = new Set();
const addText = (text) => {
    for (const ch of text) {
        chars.add(ch);
    }
};

for (let code = 0x20; code <= 0x7e; code++) {
    chars.add(String.fromCharCode(code));
}

const gbk = new TextDecoder('gbk');
const decode = (row, col) => gbk.decode(new Uint8Array([row, col]));

// GB2312 符号区：A1 标点、A3 全角 ASCII、A9 制表符
for (const row of [0xa1, 0xa3, 0xa9]) {
    for (let col = 0xa1; col <= 0xfe; col++) {
        const ch = decode(row, col);
        if (ch !== '�') {
            chars.add(ch);
        }
    }
}

// GB2312 一级汉字：B0A1–D7F9
for (let row = 0xb0; row <= 0xd7; row++) {
    for (let col = 0xa1; col <= 0xfe; col++) {
        if (row === 0xd7 && col > 0xf9) {
            break;
        }
        chars.add(decode(row, col));
    }
}

const scanned = [];
const walk = (dir, exts) => {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
            walk(path, exts);
        } else if (exts.some((ext) => name.endsWith(ext))) {
            addText(readFileSync(path, 'utf8'));
            scanned.push(relative(root, path));
        }
    }
};
walk(join(root, 'resources/js'), ['.ts']);
walk(join(root, 'resources/views'), ['.php']);
walk(join(root, 'config'), ['afterme.php']);
walk(join(root, 'database/seeders'), ['.php']);
walk(join(root, 'app'), ['.php']);

// 换行、制表这类控制字符不需要字形
for (const ch of [...chars]) {
    if (ch.codePointAt(0) < 0x20) {
        chars.delete(ch);
    }
}

const input = readFileSync(source);
const subset = await subsetFont(input, [...chars].join(''), { targetFormat: 'woff2' });
writeFileSync(output, subset);

console.log(`扫描了 ${scanned.length} 个源文件，收录 ${chars.size} 个字符`);
console.log(`${relative(root, output)}：${(subset.length / 1024).toFixed(1)} KB（原字体 ${(input.length / 1024).toFixed(1)} KB）`);
