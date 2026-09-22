/** Per-screen coach-marks — client-only UX; copy claims only supported behavior. */
export const tipDefs: Record<string, { n: number; title: string; text: string }> = {
  jobs: {
    n: 1,
    title: 'a feed that respects you',
    text: 'filter by format, level, skills, salary and language — only filters that actually work are shown. search looks through title, company, description and skills.',
  },
  applications: {
    n: 2,
    title: 'letters, not spreadsheets',
    text: 'track every application by status, add notes and a follow-up date. nothing updates automatically — this is your own calm ledger.',
  },
  filters: {
    n: 3,
    title: 'shortcuts, not alarms',
    text: 'save a search and apply it later with one tap, and keep a wishlist of jobs you found elsewhere. no alerts are sent — you stay in charge.',
  },
  cv: {
    n: 4,
    title: 'one cv, everywhere',
    text: 'build it once or import a pdf/docx and check every prefilled field. export a .docx whenever you need it.',
  },
  hub: {
    n: 5,
    title: 'no infinite catalog',
    text: 'hand-picked collections — tests, skills, mental support, salaries, strategy. everything waits for you; nothing guilts you back.',
  },
};
