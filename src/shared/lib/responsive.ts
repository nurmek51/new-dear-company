import { useWindowDimensions } from 'react-native';

/** The design collapses to the mobile layout at 760px (see the prototype's @media query). */
export const MOBILE_BREAKPOINT = 760;
/** Desktop design canvas width. */
export const DESKTOP_CANVAS = 1280;

export interface Breakpoint {
  width: number;
  height: number;
  isMobile: boolean;
  isDesktop: boolean;
  /** Stack dense columns and navigation before they become cramped. */
  isCompact: boolean;
  /** Prototype gutters: 44px desktop, 16px mobile; 24px on compact desktops. */
  gutter: number;
}

export function useBreakpoint(): Breakpoint {
  const { width, height } = useWindowDimensions();
  const isMobile = width <= MOBILE_BREAKPOINT;
  return { width, height, isMobile, isDesktop: !isMobile, isCompact: width < 1100, gutter: isMobile ? 16 : width < 1100 ? 24 : 44 };
}
