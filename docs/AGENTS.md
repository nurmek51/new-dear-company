# dear company — job seeker app

React Native (Expo SDK 57) + expo-router + react-native-web app built pixel-for-pixel from the "HR Tech Prototype"
(seeker) and "Recruiter ATS Prototype" Claude Design files, wired to the real Django REST backend documented in
API_INTEGRATION_SPEC.md (see INTEGRATION_REPORT.md for the KEEP/ADAPT/HIDE mapping).

**There is no mock/offline data source.** Every screen renders what the API returned, or a loading / empty /
error-with-retry state. `EXPO_PUBLIC_API_BASE_URL` is required: when it is missing the app renders a configuration
screen instead of guessing (`src/widgets/app-status`). Copy `.env.example` to `.env` to run against a backend.
Expo docs for this SDK: https://docs.expo.dev/versions/v57.0.0/

## Environment
Required: `EXPO_PUBLIC_API_BASE_URL` (full origin, or `/` for same-origin behind a proxy).
Optional: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (hides the Google button when unset), `EXPO_PUBLIC_WEB_ORIGIN`
(Stripe return URLs on native), `EXPO_PUBLIC_REQUEST_TIMEOUT_MS` (default 30000). See `.env.example`.

## Commands
- `npm run web` — dev server (web)
- `npm run typecheck` — `tsc --noEmit` (must stay clean)
- `npm test` — vitest unit tests for spec-critical pure logic
- `npm start` — Expo dev server for native

## Architecture — Feature-Sliced Design
- `app/` — expo-router routes only; every file is a thin re-export of a page from `src/pages`.
  Routes: root `/sign-in` (`?mode=recruiter` for b2b), `/verify-email?key=`, `/onboarding`; seeker group
  `app/(seeker)`: `/jobs`, `/job/[id]`, `/apply?job=`, `/applications`, `/saved`, `/cv`, `/plus`, `/profile`;
  recruiter `app/recruiter`: `/recruiter` (overview), `/recruiter/jobs`, `/recruiter/job/[id]`,
  `/recruiter/candidates`, `/recruiter/reports`, `/recruiter/pricing`, `/recruiter/new-job`, `/recruiter/onboarding`.
- `src/pages/<name>` — one dir per screen, `index.ts` + `ui/<Name>Page.tsx`.
- `src/widgets` — nav-bar (seeker nav), recruiter-topbar (dark b2b bar), tip-coach, job-filters (search-param panel),
  app-status (loading / API-not-configured / cannot-reach-server screens).
- `src/features` — onboarding (local preference capture), job-feed (active search params), tips, calm-sound.
- `src/entities` — user (JWT auth), job (search/CRUD/saved/search-queries/match), application (seeker ATS),
  resume, cover-letter, subscription, ats-report (b2b aggregates), applicant (recruiter pipeline), candidate-pool.
  Each has typed REST API modules in `api/` (one function per documented endpoint) and stores/pure logic in `model/`.
  `src/shared/api` = `request()` (JWT bearer + cookies, single-flight refresh on 401, per-request timeouts,
  `ApiError` with `isNetworkError`/`isUnauthorized`), token storage, `setUnauthorizedHandler()`,
  `subscribeEvents()` SSE client for async AI tickets, DRF `Paginated<T>` + `toPage()`/`pageFromUrl`, enums.
- `src/shared` — `theme` (light/dark palettes ported from the design, `useTheme()`, `colorOf()`),
  `ui` (Txt, Card, Chip, Btn, Field, Overlay, Toggle, Checkbox, IconCircle, LogoBadge),
  `lib` (`useBreakpoint()` responsive hook, `useT()` i18n hook), `i18n` (968-key en/ru/es/ar/kk dictionary).

Import rule (FSD): shared → entities → features → widgets → pages → app; never import upward.
Path alias: `@/*` → `src/*`.

## Design conventions
- Fonts: Space Grotesk (400/500/600/700) + Space Mono, loaded in `app/_layout.tsx`.
- Colors only via `useTheme()` tokens; `#141519`, `#B3F242` (accent), `#F6F4EE`, `#1781FB` (link) are
  intentionally constant across themes. Mock data stores palette token *names*; resolve with `colorOf(t, name)`.
- Responsive: breakpoint 760px (`useBreakpoint()`); desktop gutters 44px, mobile 16px; desktop h1 46px → mobile 29px;
  multi-column grids collapse to one column on mobile.
- Every user-visible string goes through `useT()`; dictionary keys are the exact lowercase English strings.
- Persisted state (AsyncStorage): JWT pair (`@dear-company/jwt`), theme (`dc-theme`), language (`dc-lang`),
  seeker filter prefs (`dc-seeker-prefs`), onboarding + tips flags.
