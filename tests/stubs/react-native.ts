/** Minimal react-native stub for vitest (Node): only what shared/api touches. */
export const Platform = { OS: 'web' as const, select: <T,>(o: Record<string, T>) => o.web ?? o.default };
