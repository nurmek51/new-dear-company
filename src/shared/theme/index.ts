import { dark, light, type Palette } from './palette';
import { useThemeStore } from './store';

export { colorOf } from './colorOf';
export { accent, accentInk, danger, link } from './palette';
export type { Palette };
export { useThemeStore } from './store';
export { font } from './typography';

/** Active palette, driven by the persisted dark-mode flag. */
export function useTheme(): Palette {
  const isDark = useThemeStore((s) => s.dark);
  return isDark ? dark : light;
}
