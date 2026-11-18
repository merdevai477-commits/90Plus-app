/**
 * Light and dark surfaces for خماسي الهدافين. Follows the app appearance switch.
 */

export type TsfColors = {
  bg: string;
  card: string;
  text: string;
  muted: string;
  border: string;
  purple: string;
  row: string;
  sheet: string;
  field: string;
  positive: string;
  zero: string;
  dot: string;
  dotActive: string;
  onPurple: string;
  statusBar: 'light' | 'dark';
};

export const TSF_THEME: { light: TsfColors; dark: TsfColors } = {
  light: {
    bg: '#F4F6FB',
    card: '#FFFFFF',
    text: '#16161C',
    muted: '#6B7280',
    border: '#E6E8F0',
    purple: '#6C4DFF',
    row: '#FFFFFF',
    sheet: '#FFFFFF',
    field: '#F3F4F8',
    positive: '#16A34A',
    zero: '#E11D48',
    dot: '#D9D6E3',
    dotActive: '#6C4DFF',
    onPurple: '#FFFFFF',
    statusBar: 'dark',
  },
  dark: {
    bg: '#0E0E12',
    card: '#16161C',
    text: '#FFFFFF',
    muted: '#A1A1AA',
    border: '#2A2A32',
    purple: '#7C5CFF',
    row: '#1C1C24',
    sheet: '#16161C',
    field: '#121218',
    positive: '#22C55E',
    zero: '#F43F5E',
    dot: '#3F3F46',
    dotActive: '#FFFFFF',
    onPurple: '#FFFFFF',
    statusBar: 'light',
  },
};
