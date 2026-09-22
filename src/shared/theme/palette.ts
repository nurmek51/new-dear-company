/**
 * Design tokens ported 1:1 from the "HR Tech Prototype" Claude Design file.
 * Light values are the CSS var() fallbacks, dark values come from `body.dark`.
 */
export const accent = '#B3F242';
export const accentInk = '#141519';
export const link = '#1781FB';
export const danger = '#b91c1c';

export interface Palette {
  bg: string;
  card: string;
  card2: string;
  chip: string;
  ink: string;
  ink2: string;
  mut: string;
  mut2: string;
  green: string;
  greenbg: string;
  oc1: string;
  oc1bg: string;
  oc2: string;
  oc2bg: string;
  oc3: string;
  oc3bg: string;
  oc4: string;
  oc4bg: string;
  oc5: string;
  oc5bg: string;
  line: string;
  lineSoft: string;
  navbg: string;
  /** recruiter surface tokens */
  hov: string;
  ink3: string;
  l06: string;
  l08: string;
  l09: string;
  l10: string;
  l12: string;
  l13: string;
  l15: string;
  l25: string;
}

export const light: Palette = {
  bg: '#F6F4EE',
  card: '#FFFFFF',
  card2: '#FDFCFA',
  chip: '#ECE9E0',
  ink: '#141519',
  ink2: '#3f3f46',
  mut: '#71717a',
  mut2: '#a1a1aa',
  green: '#17734a',
  greenbg: '#DCF2E3',
  oc1: '#b04c17',
  oc1bg: '#FCE8DC',
  oc2: '#1a5fd0',
  oc2bg: '#DBE7FC',
  oc3: '#6d28d9',
  oc3bg: '#EFE3FB',
  oc4: '#be185d',
  oc4bg: '#FBE1EA',
  oc5: '#0e7490',
  oc5bg: '#DBF3F7',
  line: '#d4d4d8',
  lineSoft: 'rgba(20,21,25,0.3)',
  navbg: 'rgba(246,244,238,0.92)',
  hov: '#FAF9F5',
  ink3: '#52525b',
  l06: 'rgba(20,21,25,0.06)',
  l08: 'rgba(20,21,25,0.08)',
  l09: 'rgba(20,21,25,0.09)',
  l10: 'rgba(20,21,25,0.1)',
  l12: 'rgba(20,21,25,0.12)',
  l13: 'rgba(20,21,25,0.13)',
  l15: 'rgba(20,21,25,0.15)',
  l25: 'rgba(20,21,25,0.25)',
};

export const dark: Palette = {
  bg: '#17181C',
  card: '#23252B',
  card2: '#1E2025',
  chip: '#33353D',
  ink: '#F1EFE8',
  ink2: '#C9C7BE',
  mut: '#9C9B93',
  mut2: '#84838B',
  green: '#7ED9A8',
  greenbg: '#20302A',
  oc1: '#E59B63',
  oc1bg: '#37281E',
  oc2: '#84ABF2',
  oc2bg: '#1F2A3E',
  oc3: '#BB93EE',
  oc3bg: '#2C2338',
  oc4: '#EE85B2',
  oc4bg: '#38222C',
  oc5: '#0e7490',
  oc5bg: '#1E3238',
  line: '#4A4C55',
  lineSoft: '#4A4C55',
  navbg: 'rgba(23,24,28,0.92)',
  hov: '#24252c',
  ink3: '#b9bac1',
  l06: 'rgba(246,244,238,0.07)',
  l08: 'rgba(246,244,238,0.09)',
  l09: 'rgba(246,244,238,0.1)',
  l10: 'rgba(246,244,238,0.12)',
  l12: 'rgba(246,244,238,0.14)',
  l13: 'rgba(246,244,238,0.15)',
  l15: 'rgba(246,244,238,0.18)',
  l25: 'rgba(246,244,238,0.3)',
};
