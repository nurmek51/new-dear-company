# Dear Company — UI ↔ Django REST Backend Integration (phase 3)

> Design sources: "HR Tech Prototype" (seeker) and "Recruiter ATS Prototype" (recruiter) Claude Design files.
> Backend contract: `API_INTEGRATION_SPEC.md`. Supersedes the Firebase-era report (Firebase removed entirely).
> Date: 2026-09-18. Gates: `npm run typecheck`, `npm test` (51), `npx expo export --platform web`, live-HTTP browser pass.
> Section 0 records the production hardening pass that removed the demo data layer entirely.

## 0. Production hardening (2026-09-18) — no mock data anywhere

The demo/offline data layer is **deleted**, not disabled: `src/shared/api/demo.ts`, `demoJobs.ts`, every
`isDemoMode` branch in all nine entity API modules, the demo session in the auth store, the demo banners and
every "not available in demo mode" message. The production bundle contains no seeded rows (verified by grepping
`dist/`). Each screen now shows API data, a spinner, an honest empty state, or an error with a retry control.

- **Configuration is explicit.** `EXPO_PUBLIC_API_BASE_URL` is required (`/` means same-origin behind a proxy).
  When it is missing the app renders a configuration screen (`src/widgets/app-status`) instead of guessing a host
  or inventing content. `.env.example` documents every variable.
- **Transport hardening.** `request()` gained per-request timeouts (30s default, 120s for uploads/AI tickets),
  transport-failure classification (`ApiError.isNetworkError`, status 0) so the UI can say "could not reach the
  server" instead of a generic failure, and `setUnauthorizedHandler()` so one failed refresh ends the session
  app-wide exactly once.
- **False empty states fixed.** Recruiter overview and reports used to render "nothing yet" after a *failed*
  load; they now separate "loaded, and it is empty" from "could not load".
- **Truncated totals are disclosed.** The pipeline walk is capped (25 pages); when the cap is hit the page says
  the totals cover only the most recent jobs instead of silently under-reporting.

### Verified against the Django source (not just the spec) and fixed
| Finding (source) | Fix |
|---|---|
| SSE terminal frames use **different event names per flow** — `success` for resume parsing and AI job creation, `message` for assessment/recommendations/generation — and `warning` frames are intermediate | `subscribeEvents` now listens to `message`/`success`/`warning`/`error` on web and parses `event:` lines on native; the classifiers treat `warning` and `status: profile_created` as progress. **Without this, resume parsing and AI job drafting never delivered a result.** |
| `POST /jobs/saved-jobs/` returns 201 even for a duplicate/missing job and never returns the row (`perform_create` returns a Response DRF ignores) | Writes go through `POST /jobs/saved-jobs/toggle/`; the feed keeps a set of saved job ids instead of row ids |
| `GET /jobs/saved-jobs/` returns a **bare array** and nests only `{id,title,slug,text}` of the job | Normalized with `toPage()`; the saved page fetches each full job so cards show company, salary and location |
| `DELETE /jobs/saved-jobs/{id}/` takes the **saved-row id**, not the job id | Unchanged behavior, now documented in the type |
| Profile-picture field is `profile_picture`; the serializer caps at **5MB** while the view says 10MB | Field name confirmed; client validates at the stricter 5MB |
| `logout` reads the refresh token from a cookie, which native does not have | The stored refresh token is sent in the body |
| `/jobs/search/` has **no `ordering` param**; `salary` and `match` are preformatted strings | No sort control is offered; both are rendered as strings |
| `/ats/candidates/` is `AllowAny` | Called anonymously, nothing cached |
| Expo web's port 8081 is not in the backend's default `CORS_ALLOWED_ORIGINS` | Noted below as a deployment prerequisite |

## 1. Transport & architecture
- `src/shared/api`: `request()` — JWT Bearer from stored pair + `credentials:'include'` on web (spec §0.1 hybrid cookies),
  single-flight refresh on 401 (§1.6), `ApiError` with `errorMessageFrom()` reducing the non-uniform error shapes (§0.2);
  `subscribeEvents()` SSE client (web `EventSource`; native fetch-stream; `unsupported` → manual refresh) for every
  async AI ticket `{task_id,event_id,event_url}`; DRF `Paginated<T>` + `pageFromUrl`; exact enums (14 ATS statuses…).
- Demo mode when `EXPO_PUBLIC_API_BASE_URL` is absent or `EXPO_PUBLIC_DEMO_AUTH` is truthy: every API function
  branches to an in-memory `demoCollection`; AI/Stripe flows resolve with an honest "not available in demo" message;
  a banner states nothing is sent to a server. Demo sessions exist for b2c and b2b.
- Entities (one function per documented endpoint): user, job, application, resume, cover-letter, subscription,
  ats-report, applicant, candidate-pool. Pages are presentational; stores/pure logic under `model/`.
- Route groups: seeker `app/(seeker)` behind the seeker nav (jobs/job/plus public); recruiter `app/recruiter`
  behind the dark top bar and a `user_type === 'b2b'` guard; root `/sign-in`, `/verify-email`, `/onboarding`.

## 2. Endpoints wired (all paths under `dear-hr-tech-backend`)
Auth §1: registration (b2c + b2b org fields), verify-email, resend-email, login, user GET/PATCH(name),
token/refresh, logout, password/change, password/reset, check-email, social/google (id_token via GIS — only rendered
when `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is set), profile-picture/upload.
Jobs §2: `/jobs/search/` (flat rows + pagination + all server filters), `/jobs/{id}/`, `/jobs/` POST/PATCH/DELETE,
`filters-list`, `ai-job-creation` (+ from-file) via SSE, `saved-jobs` GET/POST/DELETE, `search-queries`
(`preference` type = saved searches), `pages/job-page` suggested searches.
Resumes §3: resumes list/upload(+parsing SSE)/delete, set-resume-selected, selected-resume-cover-letter,
assessment (SSE), recommendations (cached/SSE), ai-resume-generation (SSE), cover-letters CRUD,
set-cover-letter-selected, ai-cover-letter-generation (SSE).
ATS §4: apply-job, jobs/{id}/status, b2c-applied-jobs, update-status-by-candidate (allowed transitions only),
b2c-tracking; recruiter: job/{id}/applicants (+status summary), update-status, b2b-tracking, tracking edit,
b2b-posted-jobs, job-pipeline, hiring-efficiency, hiring-data, candidates pool, candidate-profile-by-profile-id.
AI §5: similar-jobs, match-score/{job_id} (b2c), ai-search-jobs (API only), match-profiles, ai-search-profiles.
Subscriptions §7: packages (b2c/b2b), user-subscriptions/current, create-subscription (Stripe `payment_url`,
never `promo_code`), cancel, payments.

## 3. KEEP / ADAPT / HIDE — seeker design (HR Tech Prototype)
| Surface | Decision | Notes |
|---|---|---|
| Sign in (email+password, google, recruiter link) | KEEP/ADAPT | login + registration toggle (b2c/b2b via `?mode=recruiter`), verification-sent state, reset link; google only with client id; demo footer honest |
| Verify email | ADAPT | `/verify-email?key=` auto-verify or paste key; resend |
| Onboarding (3 steps) | ADAPT | local preference capture → seeds search params (API grades/formats/specializations); mood step hidden |
| Nav bar | ADAPT | notifications bell hidden (no endpoint); plus ✦ kept (Stripe real) |
| Jobs hero + stat pills | KEEP | counts are real `count` values per `date_posted` threshold; pills set the filter |
| Search bar | KEEP | `q`; suggested chips from `pages/job-page` |
| Filter sidebar | ADAPT | only server-backed params (format, employment, grade, english, language, currency, country, company type, skills, specializations, salary min, experience, source); tri-state include/exclude, visa, salary-in-posting, exclude words, save/watch cards → HIDE |
| Mood picker, streak/applied-today, "cat fetching N more" | HIDE | no endpoint / fake; real prev/next pagination instead |
| Feed cards | KEEP | real `match` badge when present; save = saved-jobs; apply → internal flow |
| Suggest telegram card | HIDE | endpoint is B2B-only |
| Report a job, "did you apply?" modal | HIDE | no endpoint |
| Job detail | KEEP/ADAPT | full job object; "why this match" from match-score; similar-jobs rail real; external "view original posting"; word-count cat claims hidden |
| Apply flow (3 steps) | ADAPT | step 1 selected resume, step 2 cover-letter choice (no free-text note field in apply-job), step 3 submit; "covers 5 of 6" / rewrite buttons / employer questions hidden |
| Applications | ADAPT | real b2c-applied-jobs grouped into applied/being read/interview/offer/archived; withdraw / accept / decline per allowed transitions; tracking history real; follow-up composer, notes/contacts, plan chip, interviews card, confetti, drag&drop → HIDE |
| Saved page | ADAPT | saved-jobs + search-queries(preference); all "watching/alerts/digest" copy and watch modals → HIDE |
| My CV | ADAPT | upload+parse (SSE) with the §3.1 profile-overwrite notice; resumes list (select/delete/check/fit/tailor); cover letters (upload/generate/select/delete); manual builder wizard, live preview, DOCX export → HIDE (profile PUT endpoints not itemized) |
| Resume roast modal | ADAPT | now the real assessment ("check it") via SSE; fake score/demo badge removed |
| Plus page | ADAPT | real packages, monthly/annual toggle, Stripe-hosted checkout, current subscription + cancel, payments; in-app card form, promo code, PayPal, invoices → HIDE |
| Referrals, Career Hub, Notifications panel | HIDE | no endpoints |
| Profile | ADAPT | name (PATCH), avatar upload, password change, read-only email/phone/verified, sign out; hidden companies, notification prefs, data export/delete → HIDE |
| Dark mode, i18n, calming sound, tips | KEEP | client-only, honest copy |

## 4. KEEP / ADAPT / HIDE — recruiter design (Recruiter ATS Prototype)
| Surface | Decision | Notes |
|---|---|---|
| Sign in | ADAPT | shared `/sign-in?mode=recruiter` |
| Verify (6-digit boxes) | ADAPT | link-based verification; code boxes hidden |
| Recruiter onboarding | ADAPT | b2b registration fields per §1.1; team size / first role / skip → HIDE |
| Top bar | ADAPT | overview/jobs/candidates/reports + new job + plan; schedule (§11.1 broken), team (invitations not itemized), archive, admin console → HIDE |
| Overview | ADAPT | b2b-posted-jobs + job-pipeline sums; needs-attention/upcoming interviews/activity → HIDE |
| Job pipeline board | ADAPT | applicants grouped by real statuses; "move to" status menu + reject modal (notes) instead of drag&drop; detail panel = candidate profile + b2b-tracking timeline + notes via update-status; scorecards, email modal, book interview, stages editor, cv-parse add candidate → HIDE |
| New job | ADAPT | POST/PATCH `/jobs/` fields + AI draft (prompt/file via SSE, review before submit); salary & structured location (need pre-existing `salary_id`/`job_location_ids`), custom stages → HIDE |
| All candidates | ADAPT | public candidate pool with filters/search/ordering + ai-search-profiles; invite/add-to-pipeline/email → HIDE; public-data notice |
| Archive | HIDE | no closed-jobs endpoint |
| Schedule + book interview | HIDE | §11.1 hardcoded calendar account |
| Pricing | ADAPT | real b2b packages, Stripe checkout, cancel; promo/PayPal/pay-now/seats/invoices → HIDE |
| Reports | ADAPT | pipeline funnel, efficiency table, hiring-data public aggregate; csv export, date pickers, per-recruiter report → HIDE |
| Team, admin console | HIDE | not itemized / no endpoints |
| Public job page | KEEP | the seeker `/job/[id]` |

## 5. Validation
- `npx tsc --noEmit` clean; `npm test` green — 51 vitest cases ( query building, error shapes, pagination, demo job adapter,
  application stage grouping/transitions, job-feed formatting, resume async-result parsing, pipeline grouping, recruiter job-form payload + AI event parsing).
- `npx expo export --platform web` production build.
- Browser pass over **real HTTP** against a stub serving the documented payload shapes: the feed rendered live
  rows (company, `87% Match`, `Negotiable`), stat-pill counts, `filters-list` chips and `job-page` suggestions;
  the detail page rendered the full job, company card and similar-jobs rail. With the API stopped the feed showed
  "could not reach the server" + retry and the filters fell back to defaults; with the env var blank the app
  showed the configuration screen. No placeholder data in any state.

## 6. Deployment prerequisites / still unverified
- `EXPO_PUBLIC_API_BASE_URL` must point at the Django API (the repo defines **no** deployed URL; dev runs on
  `http://localhost:8000`). Expo web's origin (`:8081`) is not in the backend's default `CORS_ALLOWED_ORIGINS`,
  so set `CORS_ALLOW_ALL_ORIGINS=True` in dev or add the origin.
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (the Google button stays hidden without it) and `EXPO_PUBLIC_WEB_ORIGIN`
  (Stripe rejects `exp://` return URLs on native).
- Not verifiable from source: the exact `logout` body requirement (dj-rest-auth 7.0.1 is not vendored — we send
  the refresh token, which works with and without the cookie) and the live AI payloads, which are parsed
  defensively and covered by contract tests.

## 7. Deliberate deviations
Apply step 1 requires a selected resume (apply-job allows none); applications stage counts are per loaded page;
`date_posted` sent as a date-only ISO string; b2c profile merge (§3.2) not built (needs profile PUT endpoints).
