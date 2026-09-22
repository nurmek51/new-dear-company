import type { Resume } from './types';

/**
 * Some list endpoints return a bare array instead of the DRF envelope.
 * Re-exported from `@/shared/api` so there is a single implementation.
 */
export { toPage } from '@/shared/api';

export function fileNameFromUrl(url: string): string {
  try {
    const clean = url.split('?')[0];
    return decodeURIComponent(clean.slice(clean.lastIndexOf('/') + 1)) || url;
  } catch {
    return url;
  }
}

export function resumeTitle(r: Pick<Resume, 'title' | 'file'>): string {
  return r.title?.trim() || fileNameFromUrl(r.file);
}
