import type { Palette } from './palette';

/**
 * Mock data stores colors either as literal values ('#B3F242') or as palette
 * token names ('greenbg'). Resolve against the active palette.
 */
export function colorOf(p: Palette, c: string): string {
  if (c.startsWith('#') || c.startsWith('rgba')) return c;
  return (p as unknown as Record<string, string>)[c] ?? c;
}
