export type Item = {
  k: string;
  icon: string;
  name: string;
  note: string;
  val: number;
};

export const ITEMS: Item[] = [
  { k: 'mingbi', icon: '💴', name: '冥币', note: '天地银行 · 一亿面额', val: 1 },
  { k: 'yuanbao', icon: '💰', name: '金元宝', note: '锡箔折的，很亮', val: 5 },
  { k: 'xiang', icon: '🕯️', name: '香烛', note: '香火不断', val: 0 },
  { k: 'juhua', icon: '🌼', name: '菊花', note: '黄的白的都有', val: 0 },
  { k: 'naicha', icon: '🧋', name: '纸扎奶茶', note: '全糖去冰加珍珠', val: 2 },
  { k: 'phone', icon: '📱', name: '纸扎手机', note: 'Pro Max，阴间 5G', val: 20 },
  { k: 'wifi', icon: '📶', name: '纸扎路由器', note: '地下信号不好', val: 10 },
  { k: 'qiuku', icon: '👖', name: '纸扎秋裤', note: '地下冷', val: 3 },
  { k: 'mao', icon: '🐈', name: '纸扎猫', note: '会自己铲屎', val: 30 },
  { k: 'car', icon: '🏎️', name: '纸扎跑车', note: '奈何桥不限速', val: 200 },
  { k: 'villa', icon: '🏯', name: '纸扎别墅', note: '带院子，学区房', val: 500 },
  { k: 'nianjia', icon: '🏖️', name: '纸扎年假', note: '阳间没休完的', val: 100 },
  { k: 'cizhi', icon: '✉️', name: '纸扎辞职信', note: '已替你交了', val: 50 },
];

export const ITEM: Record<string, Item> = Object.fromEntries(ITEMS.map((i) => [i.k, i]));
