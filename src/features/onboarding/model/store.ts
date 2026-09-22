import { create } from 'zustand';
import { GRADES, WORK_FORMATS, type Grade, type WorkFormat } from '@/shared/api';

/**
 * Local preference-capture flow (no backend). Choices map to real backend
 * filter enums and are written into `useSeekerPrefs` on finish:
 * role → specializations, grade → grades, format → workFormat.
 */
export const obRoleDefs = ['engineering', 'design', 'product', 'data', 'marketing', 'hr', 'finance', 'r&d'];

/** The 8 API grades with display labels. */
export const obGradeDefs: { key: Grade; label: string }[] = GRADES.map((g) => ({
  key: g,
  label: g === 'clevel' ? 'c-level' : g,
}));

/** Work formats (API values). */
export const obFormatDefs: { key: WorkFormat; label: string }[] = WORK_FORMATS.map((f) => ({
  key: f,
  label: f,
}));

interface OnboardingChoices {
  role: string | null;
  /** free-text "something else" role — wins over the chip when non-empty */
  roleOther: string;
  grade: Grade | null;
  format: Partial<Record<WorkFormat, boolean>>;
}

interface OnboardingState {
  obStep: number;
  obConsent: boolean;
  ob: OnboardingChoices;

  toggleConsent: () => void;
  next: () => void;
  back: () => void;
  pickRole: (role: string) => void;
  setRoleOther: (text: string) => void;
  pickGrade: (grade: Grade) => void;
  toggleFormat: (format: WorkFormat) => void;
  reset: () => void;
}

const initial = (): Pick<OnboardingState, 'obStep' | 'obConsent' | 'ob'> => ({
  obStep: 0,
  obConsent: false,
  ob: { role: null, roleOther: '', grade: 'middle', format: { remote: true } },
});

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initial(),

  toggleConsent: () => set((s) => ({ obConsent: !s.obConsent })),
  next: () => set((s) => ({ obStep: Math.min(s.obStep + 1, 2) })),
  back: () => set((s) => ({ obStep: Math.max(s.obStep - 1, 0) })),
  pickRole: (role) => set((s) => ({ ob: { ...s.ob, role: s.ob.role === role ? null : role, roleOther: '' } })),
  setRoleOther: (text) =>
    set((s) => ({ ob: { ...s.ob, roleOther: text, role: text.trim() ? text.trim() : null } })),
  pickGrade: (grade) => set((s) => ({ ob: { ...s.ob, grade } })),
  toggleFormat: (format) =>
    set((s) => ({ ob: { ...s.ob, format: { ...s.ob.format, [format]: !s.ob.format[format] } } })),
  reset: () => set(initial()),
}));
