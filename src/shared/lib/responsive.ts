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
  /** 44px page gutters on desktop, 16px on mobile — matches the prototype. */
  gutter: number;
}

export function useBreakpoint(): Breakpoint {
  const { width, height } = useWindowDimensions();
  const isMobile = width < MOBILE_BREAKPOINT;
  return { width, height, isMobile, isDesktop: !isMobile, gutter: isMobile ? 16 : 44 };
}
