export type StoneStyle = {
  k: 'qingshi' | 'hanbai' | 'neon' | 'tubao' | 'mupai';
  name: string;
  note: string;
};

export const STYLES: StoneStyle[] = [
  { k: 'qingshi', name: '青石碑', note: '经典款，耐风化' },
  { k: 'hanbai', name: '汉白玉', note: '体面，显得有钱' },
  { k: 'neon', name: '赛博碑', note: '夜里会发光' },
  { k: 'tubao', name: '小土包', note: '朴素，环保' },
  { k: 'mupai', name: '木牌子', note: '随性，三年一换' },
];
