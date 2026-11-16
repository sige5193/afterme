/**
 * 界面主题：像素字体、颜色、尺寸。所有尺寸都是游戏像素（画布放大前的像素）。
 */

export const FONT_FAMILY = 'AftermePixel';
export const FONT = `'${FONT_FAMILY}', 'PingFang SC', 'Microsoft YaHei', sans-serif`;

/** 像素字体的设计尺寸；放大只能用整数倍才清楚 */
export const FONT_SIZE = 12;
export const LINE_SPACING = 4;
export const LINE_HEIGHT = FONT_SIZE + LINE_SPACING;

export const COL = {
  bone: '#ece6d6',
  dim: '#a6a192',
  dim2: '#6f6a5c',
  joss: '#e8c46a',
  jossD: '#9c7424',
  seal: '#e0685a',
  sealD: '#c4453a',
  wisp: '#9fe8d4',
  dark: '#17120a',
  paperInk: '#2b2016',
  paperDim: '#7a6a4c',
  paperRed: '#a3302a',
  green: '#8fd4a4',
} as const;

export const HEX = {
  ink0: 0x07080c,
  ink1: 0x0f1117,
  ink2: 0x181b24,
  ink3: 0x232733,
  line: 0x3a3d4a,
  joss: 0xe0b85a,
  seal: 0xc4453a,
  wisp: 0x9fe8d4,
  bone: 0xece6d6,
  black: 0x000000,
  paper: 0xe8dcc0,
} as const;

export const SPACE = {
  xs: 2,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
} as const;

export const BTN_H = 20;
export const BTN_H_SM = 18;
export const INPUT_H = 20;
export const HUD_H = 22;
