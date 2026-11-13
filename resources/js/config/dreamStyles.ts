export type DreamStyle = {
  k: 'plain' | 'warm' | 'scary' | 'mystic';
  name: string;
};

export const DREAM_STYLES: DreamStyle[] = [
  { k: 'plain', name: '平常' },
  { k: 'warm', name: '温柔' },
  { k: 'scary', name: '吓人' },
  { k: 'mystic', name: '玄学' },
];
