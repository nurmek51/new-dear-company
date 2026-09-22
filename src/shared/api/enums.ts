/** Backend enums — exact persisted values from API_INTEGRATION_SPEC.md. */
export type WorkFormat = 'onsite' | 'remote' | 'hybrid';
export const WORK_FORMATS: WorkFormat[] = ['remote', 'hybrid', 'onsite'];

export type EmploymentType =
  | 'full_time' | 'part_time' | 'contract' | 'internship' | 'freelance'
  | 'temporary' | 'shift_based' | 'volunteer' | 'apprenticeship' | 'project_based';
export const EMPLOYMENT_TYPES: EmploymentType[] = [
  'full_time', 'part_time', 'contract', 'internship', 'freelance',
  'temporary', 'shift_based', 'volunteer', 'apprenticeship', 'project_based',
];

export type Grade = 'intern' | 'junior' | 'middle' | 'senior' | 'lead' | 'head' | 'director' | 'clevel';
export const GRADES: Grade[] = ['intern', 'junior', 'middle', 'senior', 'lead', 'head', 'director', 'clevel'];

export type EnglishLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export const ENGLISH_LEVELS: EnglishLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export type CompanyType = 'startup' | 'corporation' | 'product' | 'outsource';
export const COMPANY_TYPES: CompanyType[] = ['startup', 'corporation', 'product', 'outsource'];

export type UserType = 'b2c' | 'b2b' | 'staff' | 'unspecified';

/** ATS ApplicationStatus (spec §4). */
export type ApplicationStatus =
  | 'applied' | 'screened' | 'reviewed' | 'shortlisted' | 'interview-scheduled' | 'interview'
  | 'interview-completed' | 'offer-pending' | 'offer' | 'offer-accepted' | 'offer-rejected'
  | 'rejected' | 'hired' | 'withdrawn';
export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'applied', 'screened', 'reviewed', 'shortlisted', 'interview-scheduled', 'interview',
  'interview-completed', 'offer-pending', 'offer', 'offer-accepted', 'offer-rejected',
  'rejected', 'hired', 'withdrawn',
];

export type BillingCycle = 'monthly' | 'quarterly' | 'biannually' | 'annually';

export type SalaryUnit = 'HOUR' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';

export const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', RUB: '₽', GBP: '£', CAD: 'C$' };
export function currencyLabel(code: string): string {
  return CURRENCY_SYMBOLS[code] ?? code;
}

/** Human labels for enum values (lowercase, design language). */
export function humanize(value: string): string {
  return value.replace(/[_-]+/g, ' ').toLowerCase();
}
