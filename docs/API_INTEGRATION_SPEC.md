# Dear Company — Backend API Reference for Frontend Integration

> Ground-truth documentation compiled by reading the actual Django source (urls/views/serializers/models) of both backend
> projects, not from the (partially stale) docs already checked into `dear-hr-tech-backend`. Use this instead of Firebase —
> the current frontend (`new-dear-company`) is wired to a Firebase/Firestore mock backend per
> `EXISTING_BUSINESS_LOGIC_AND_UI_INTEGRATION.md` / `INTEGRATION_REPORT.md`; **this document describes the real, separate
> Django REST backend that the new design should be integrated against instead.**

## 0. Architecture overview

There are **two independent backend codebases**:

1. **`dear-hr-tech-backend`** (`/Users/nurmek51/dear-company/backend/dear-hr-tech-backend`) — Django 5 + DRF, the actual
   product API: auth, jobs, resumes, ATS pipeline, AI matching, coaching, subscriptions, dynamic marketing pages. This is
   what the frontend should call for almost everything.
2. **`dear-company-job-scrapper`** (`/Users/nurmek51/dear-company/backend/dear-company-job-scrapper`) — a separate Django
   app with **no REST API for reading jobs**. It scrapes external sources (Telegram/Indeed/LinkedIn), refines postings with
   an LLM, and **pushes** the result to a webhook. In this system the webhook receiver is `dear-hr-tech-backend`'s own
   `POST /api/v1/jobs/webhook/` (see §6.8) and `POST /api/v1/automation/job-ingest/` (see §9.1) — i.e. jobs enter the main
   product database via server-to-server push, not via anything the frontend calls directly. The only endpoint in the
   scrapper that is reachable with a normal API key is `POST /api/suggest-telegram-channel/`, and the main backend already
   proxies that (`POST /api/v1/accounts/suggest-channel/`, §1.10) — **the frontend never needs to call the scrapper
   directly.**

All endpoint paths below are relative to `dear-hr-tech-backend`'s root unless explicitly marked "(scrapper)".

### 0.1 Auth model (applies to almost every endpoint)

- Hybrid JWT: every login-type endpoint returns `{"access": "...", "refresh": "..."}` in the **JSON body** *and* sets them
  as **cookies** (`hr-tech-auth-cookies` / `hr-tech-refresh-token`, httpOnly, `SameSite=None`, `Secure` in prod). A web
  frontend can rely on the cookies (`credentials: "include"`); a native app should store the JSON tokens and send
  `Authorization: Bearer <access>`.
- `ACCESS_TOKEN_LIFETIME` = 1 day, `REFRESH_TOKEN_LIFETIME` = 5 days, refresh rotates and blacklists the old token.
- Default DRF permission is `IsAuthenticated` — an endpoint is public **only** if explicitly marked `AllowAny` below.
- Two user types drive almost all permission checks: `b2c` (job seeker) and `b2b` (recruiter/company), plus `staff`/
  `unspecified`. `IsB2CUser` / `IsB2BUser` custom permission classes gate most domain endpoints.

### 0.2 Common conventions

- IDs: most domain models use UUID primary keys (`Job`, `Resume`, `CoverLetter`, `JobSeekerApplication`, `CoachingSession`,
  etc.); `User` PK is also a UUID.
- Pagination: `CommonPagination`/`JobPagination` — `PageNumberPagination`, param `page`, page-size override param
  `page_size` (job list max 500, most others max 500 too), standard DRF envelope `{"count","next","previous","results"}`.
- Async AI features (resume parsing, resume/cover-letter generation, AI job creation, job recommendations, resume
  assessment) all follow the **same pattern**: the endpoint validates input, enqueues a Celery task, and immediately
  returns `202`/`201` with `{"task_id", "event_id", "event_url"}` where `event_url` is
  `/api/v1/events/?channel=<event_id>` — a `django-eventstream` Server-Sent-Events channel the frontend must subscribe to
  for the actual result. **The initial HTTP response never contains the AI output itself.**
- File uploads are `multipart/form-data`; the field name differs per endpoint (noted per-endpoint below) and validation is
  inconsistent — some endpoints check file type/size, several don't (flagged below).
- Error shapes are **not uniform** across apps: most DRF views return standard `{"field": ["msg"]}` / `{"detail": "..."}`;
  some custom function-based views return ad-hoc dicts like `{"error": "..."}` or `{"success": false, "message": "..."}`.
  Don't assume one envelope — read the per-endpoint notes below.

---

## 1. Authentication & accounts (`apps/accounts`, `apps/hireflow`)

Mounted at `/api/v1/auth/`, `/api/v1/accounts/`, `/api/v1/hireflow/`.

### 1.1 Register — `POST /api/v1/auth/registration/`
Auth: `AllowAny`.

Request:
```json
{
  "email": "user@example.com",          // email OR phone_number required
  "phone_number": "+15551234567",
  "password1": "string",
  "password2": "string",
  "name": "Jane Doe",                    // required, split into first/last name
  "user_type": "b2c",                    // "b2c" | "b2b" | "staff" | "unspecified" (default unspecified)
  "organization_name": "Acme Inc",       // required only if user_type=b2b
  "designation": "HR Manager",           // required only if user_type=b2b
  "organization_email": "hr@acme.com",   // required only if user_type=b2b
  "resume_file": "<binary, multipart>"   // optional, b2c only — stashed, parsed after email confirm
}
```
Response `201`: dj-rest-auth default (mandatory email verification is on) →
```json
{ "detail": "Verification e-mail sent." }
```
Side effects: creates `User` (+ `B2BProfile`/`Organization` or `B2CProfile` depending on `user_type`), sends a
confirmation email (async via Celery). Validation errors are `400` with field-level messages (`email`, `phone_number`,
`non_field_errors` for duplicate org name or missing email/phone).

### 1.2 Verify email — `POST /api/v1/auth/registration/verify-email/`
Auth: `AllowAny`. Request: `{"key": "<confirmation key from the email link>"}`. Response `200`: `{"detail": "ok"}`.
Side effect: if a resume was stashed at registration, creates the real `Resume` row and kicks off AI parsing.

### 1.3 Resend verification email — `POST /api/v1/auth/registration/resend-email/`
Auth: `AllowAny`. Request: `{"email": "..."}`.

### 1.4 Login — `POST /api/v1/auth/login/`
Auth: `AllowAny`. Accepts email **or** phone number in the `email` field.
Request:
```json
{ "email": "user@example.com or +15551234567", "password": "string" }
```
Response `200`:
```json
{
  "access": "jwt...",
  "refresh": "jwt...",
  "user": { "...": "see §1.9 CustomUserDetailsSerializer" }
}
```
`400 {"non_field_errors": ["Unable to log in with provided credentials."]}` (bad creds), `"User account is disabled."`,
or `"E-mail is not verified."`.

### 1.5 Current user — `GET/PUT/PATCH /api/v1/auth/user/`
Auth: `IsAuthenticated`. GET returns the `CustomUserDetailsSerializer` shape (§1.9). PUT/PATCH can update `name` and
`profile_picture` only (everything else is read-only on this serializer).

### 1.6 Token refresh — `POST /api/v1/auth/token/refresh/`
Auth: `AllowAny`. Body `{"refresh": "..."}` optional if the refresh cookie is present. Response
`{"access", "refresh", "access_expiration", "refresh_expiration"}`; re-sets cookies. Old refresh token is blacklisted.

### 1.7 Token verify — `POST /api/v1/auth/token/verify/`
Body `{"token": "..."}`. `200` empty body if valid; `401 {"detail": "Token is invalid or expired", "code":
"token_not_valid"}` if not.

### 1.8 Logout — `POST /api/v1/auth/logout/`
Blacklists the refresh token and clears both cookies. Response `{"detail": "Successfully logged out."}`.

### 1.9 `CustomUserDetailsSerializer` shape (the canonical "user" object, appears in login/register/social responses)
```json
{
  "pk": "uuid",
  "email": "user@example.com",
  "phone_number": "+15551234567",
  "name": "Jane Doe",
  "user_type": "b2c",
  "profile_picture": "url or null",
  "profile_picture_display": "resolved url",
  "questionnaire_response_status": "not_started | ...",
  "is_profile_initialized": true,
  "profile_initialization_status": "COMPLETED | PENDING | IN_PROGRESS | FAILED",
  "is_owner": false,
  "email_verified": true,
  "phone_verified": false,
  "resume_skip_status": "not_started | skipped | completed | processing | manual",
  "enable_auto_apply": false,
  "subscription": { "...": "UserSubscriptionSerializer or null, see §7.2" }
}
```

### 1.10 Password management
- `POST /api/v1/auth/password/change/` (auth required) — `{"old_password","new_password1","new_password2"}`.
- `POST /api/v1/auth/password/reset/` (`AllowAny`) — `{"email"}` → always `200 {"detail": "Password reset e-mail has
  been sent."}` (enumeration-safe).
- `POST /api/v1/auth/password/reset/token-verify/` (`AllowAny`) — `{"uid","token"}` → `200 {"detail": "Token is
  valid."}` or `400`.
- `POST /api/v1/auth/password/reset/confirm/` or `/…/confirm/<uidb64>/<token>/` (`AllowAny`) — `{"uid","token",
  "new_password1","new_password2"}` → `200 {"detail": "Password has been reset with the new password."}`. **Note: this
  custom confirm view does not run Django's password-strength validators** — enforce strength client-side if you want it.

### 1.11 Email/Phone OTP login (separate from password login)
- `POST /api/v1/auth/email-otp-login/request/` — `{"email"}` → `200 {"success": true, "message": "OTP sent to
  email"}`. Requires the account to exist with a verified email.
- `POST /api/v1/auth/email-otp-login/verify/` — `{"email","otp"}` → `{"access","refresh","user","is_new_user": false}`.
- `POST /api/v1/auth/phone-otp-login/request/` — `{"phone_number"}`. **SMS sending is a TODO stub — no SMS is actually
  sent for this flow**, only logged server-side. Don't build a UI around this until the backend team wires up an SMS
  provider.
- `POST /api/v1/auth/phone-otp-login/verify/` — `{"phone_number","otp"}` → same shape as email verify.
- `POST /api/v1/auth/set-phone/` (auth required) — `{"phone_number"}`, sends OTP (also an SMS TODO stub).
- `POST /api/v1/auth/set-phone/verify/` (auth required) — `{"phone_number","otp"}`.
- `POST /api/v1/accounts/set-email/` (auth required) — `{"email"}`, real email confirmation is sent for this one.

### 1.12 Social login
- `POST /api/v1/auth/social/google/` (`AllowAny`) — `{"access_token": "..."}` OR `{"id_token": "..."}`. Response
  `{"access","refresh","user","is_new_user"}`. Creates a new user + pre-verified email on first login.
- `POST /api/v1/auth/social/linkedin/` (`AllowAny`) — recommended flow `{"code": "...", "redirect_uri": "..."}` (server
  exchanges the code, client secret never touches the frontend); legacy flow `{"access_token": "..."}`. Same response
  shape as Google.
- `POST /api/v1/auth/social/telegram/` (`AllowAny`) — raw Telegram Login Widget payload (`id`, `first_name`,
  `last_name`, `username`, `photo_url`, `hash`, ...). Verifies HMAC signature server-side. Same response shape.
- `POST /api/v1/auth/social/whatsapp/request/` (`AllowAny`) — `{"phone_number"}`, real Twilio WhatsApp/SMS send
  **if Twilio env vars are configured** (otherwise silently no-ops).
- `POST /api/v1/auth/social/whatsapp/verify/` (`AllowAny`) — `{"phone_number","otp"}` → `{"access","refresh","user",
  "is_new_user"}`.
- `GET /api/v1/auth/social/status/` (`AllowAny`) — static discovery payload describing supported providers, cookie
  names, and example request shapes. Good for a config-driven login screen.
- `POST /api/v1/accounts/social/set-user-type/` (auth required) — for a freshly-created social user who has no
  `user_type` yet: `{"user_type","phone_number","organization_name"?,"designation"?,"organization_email"?}` →
  `{"access","refresh","success","message","user"}` (reissues JWT).

### 1.13 Misc account utilities
- `POST /api/v1/accounts/check-email/` (`AllowAny`) — `{"email"}` → `{"exists": true|false}`.
- `POST /api/v1/accounts/check-phone/` (`AllowAny`) — `{"phone"}` → `{"valid": true, "exists": true|false}` or
  `{"valid": false, "error": "Invalid phone number format."}`.
- Profile picture (auth required):
  - `GET/POST/PUT/DELETE /api/v1/accounts/profile-picture/`
  - `POST /api/v1/accounts/profile-picture/upload/` — multipart field name unspecified in serializer but view expects
    an uploaded image file; max 10MB, `image/jpeg|jpg|png|webp` only; server resizes to 400×400 JPEG.
  - `POST /api/v1/accounts/profile-picture/from-url/` — `{"picture_url","source"?}`; **only applies if the user has no
    already-uploaded picture** (returns `{"updated": false}` otherwise).
- `POST /api/v1/accounts/suggest-channel/` (auth required, `IsB2BUser`) — `{"channel_username","channel_name"}`,
  proxies to the scrapper's `suggest-telegram-channel` endpoint server-side. Response `{"detail": "Success"}` or the
  upstream error/502.
- B2B/B2C profile CRUD (dashboards, org members, education/work-experience/certifications/languages, invitations) is
  routed under `/api/v1/accounts/` too (`b2b-dashboard/`, `b2c-dashboard/`, `b2b-profiles/`, `b2c-profiles/`,
  `educations/`, `work-experiences/`, `certifications/`, `languages-proficiency/`, `organizations/`,
  `organization-users/`, `b2b-invitations/` + `verify/`/`accept/`, `b2c-skills-recommendations/`) — these are standard
  `ModelViewSet`s scoped to the requesting user's profile; not itemized field-by-field here since the research pass
  focused on core auth, but they exist and follow the same DRF conventions as everything else in this document.

### 1.14 Interview scheduling — `apps/hireflow` (`/api/v1/hireflow/`)
- `GET/POST /api/v1/hireflow/interviews/`, `GET/PUT/PATCH/DELETE /api/v1/hireflow/interviews/{id}/` — `ModelViewSet`,
  auth required. B2B users see interviews where they're a recruiter, B2C users see interviews where they're the
  candidate. Only B2B users can create.
  ```json
  {
    "recruiters": ["uuid"], "candidate": "uuid (read-only, set from job_application)",
    "job_application": "uuid (required)", "title": "string", "description": "string",
    "interview_type": "Technical", "status": "scheduled",
    "start_time": "iso-datetime", "end_time": "iso-datetime", "timezone": "UTC",
    "meeting_url": "read-only", "location": "string", "calendar_provider": "google",
    "calendar_event_id": "read-only", "cancellation_reason": "string"
  }
  ```
  ⚠️ **Do not build against this yet**: interview creation currently looks up a **hardcoded** Google Calendar account
  (a literal email address in the source) instead of the requesting recruiter's own connected calendar — it will fail
  with a 400 for any real recruiter until the backend fixes this. Flag it to the backend team before wiring up an
  "Schedule interview" UI.
- `GET /api/v1/hireflow/calendar/google/init/` (auth required) → `{"auth_url": "..."}` (Google OAuth consent URL).
- `GET /api/v1/hireflow/calendar/google/callback/?code=...` (auth required) → `{"message","email","account_id"}` on
  success, `400`/`500` on failure.

---

## 2. Jobs (`apps/jobs`, `/api/v1/jobs/`)

### 2.1 Job model (the object returned by CRUD/list endpoints)
```json
{
  "id": "uuid", "title": "string", "department": "string",
  "description_text": "string", "description_html": "string", "responsibilities": "string",
  "employment_type": "full_time | part_time | contract | internship | freelance | temporary | shift_based | volunteer | apprenticeship | project_based",
  "remote_option": true,
  "skills_required": ["STRING", "..."],
  "experience_required": 3.5,
  "qualifications": ["string"], "highlights": ["string"], "auto_screening_questions": ["string"],
  "date_posted": "iso-datetime", "date_validthrough": "iso-datetime|null",
  "job_url": "url|null", "source": "internal|telegram|indeed|linkedin", "source_type": "string|null", "source_domain": "string|null",
  "organization": { "id":"...", "name":"...", "url":"...", "url_domain":"...", "logo":"url", "logo_display":"absolute url", "size":"...", "industry":"...", "type":"startup|corporation|product|outsource", "headquarters":"...", "description":"...", "is_verified": false },
  "salary": { "id":"...", "currency":"USD|RUB|EUR|...", "min_value": 80000, "max_value": 120000, "unit_text":"HOUR|DAY|WEEK|MONTH|YEAR" },
  "job_locations": [ { "id":"...", "country":"...", "region":"...", "locality":"...", "street_address":"...", "postal_code":"...", "timezone":"...", "country_iso":"US" } ],
  "published_at": "iso-datetime|null",
  "english_level": "A1..C2|null", "vacancy_languages": "EN|RU|...", "work_format": "onsite|remote|hybrid",
  "grade": "intern|junior|middle|senior|lead|head|director|clevel", "geo_regions": ["..."], "relocation_countries": ["..."],
  "specializations": ["STRING"], "certifications": ["..."], "is_authorization_needed_to_work": false
}
```
Write-only convenience fields on create/update: `assigned_hr_id`, `salary_id`, `job_location_ids` (attach existing
records by id instead of nesting a full object).

### 2.2 `GET/POST /api/v1/jobs/` and `GET/PUT/PATCH/DELETE /api/v1/jobs/{id}/`
- List/retrieve: `AllowAny`. Create/update/delete: `IsB2BUser`.
- Retrieve response adds `show_profile_matches: bool` (true only for an authenticated B2B user from the job's own org).
- On create, `recruiter`/`organization` are forced server-side from the requester; organization cannot be changed via
  update. Once a job is published, `published_at` can no longer be edited (validation error).

### 2.3 `GET /api/v1/jobs/search/` — the actual browse/search endpoint
Auth: `AllowAny`. Paginated (`JobPagination`). **Returns a different, flatter shape than the CRUD serializer** — this is
the one to use for a job-feed/list UI:
```json
{
  "id": "uuid", "slug": "job-<id>", "compImage": "org logo absolute url",
  "company": "organization.name", "designation": "title",
  "salary": "$50K - $80K / month  (or 'Negotiable')",
  "time": "employment_type", "type": "work_format",
  "match": "82% Match | null (only if authenticated b2c user with a profile)",
  "postedTime": "date", "deadline": "date|null",
  "job_locations": [ { "country","region","locality","street_address","timezone","postal_code" } ],
  "source": "...", "grade": "...", "job_url": "url"
}
```
Query params:
- `q` — free-text, matches title/org name/location/employment type.
- `skills_required`, `specializations`, `geo_regions`, `relocation_countries` — comma-separated, array-contains-any.
- `employment_type`, `work_format`, `english_level`, `vacancy_languages`, `grade` — comma-separated exact match.
- `company_domains`, `company_types`, `currency`, `country` — comma-separated exact match on related fields.
- `organization__name`, `job_locations__region`, `job_locations__locality`, `organization__industry`,
  `organization__type` — icontains.
- `salary__min_value` (gte), `salary__max_value` (lte), `date_posted` (gte), `date_validthrough` (lte),
  `experience_required` (gte), `source` (exact).
- Only currently-published (`published_at` past-or-null AND `date_validthrough` future-or-null) and `is_active` jobs
  are returned. If the caller is an authenticated B2C user with skills on their profile, results are additionally
  boosted by skill-overlap count.

### 2.4 `GET /api/v1/jobs/filters-list/`
Auth: `AllowAny`. Returns cached unique values for every filterable field (skills, specializations, grades, employment
types, work formats, english levels, languages, company types/domains, currencies, countries, sources) — use this to
populate filter-chip UIs. Query param `type` (comma-separated) to fetch a subset.

### 2.5 `GET /api/v1/jobs/organization-unique-check/`
Auth: `AllowAny`. Query params `organization_name` (required), `organization_url` (optional). → `{"exists": bool}`.

### 2.6 AI job creation (B2B, "post a job with AI")
- `POST /api/v1/jobs/ai-job-creation/` (`IsB2BUser`) — `{"user_prompt": "free text describing the role"}` → `202
  {"task_id","event_id","event_url"}`.
- `POST /api/v1/jobs/ai-job-creation-from-file/` (`IsB2BUser`) — multipart field `file` → same async pattern.

### 2.7 Saved jobs — `GET/POST/DELETE /api/v1/jobs/saved-jobs/` (+`/{id}/`)
Standard bookmarking; implemented in the accounts app but routed here.

### 2.8 Search history — `GET/POST/DELETE /api/v1/jobs/search-queries/`
Functionally scoped to the authenticated user (empty for anonymous). `filterset_fields`: `search_type`
(`url|query|preference`), `source_page`. `search_fields`: `data`. Body:
```json
{ "search_type": "query", "data": "backend engineer", "preference_data": {"grades":["senior"]}, "source_page": "jobs" }
```
Duplicate `(user, "query", data)` returns the existing row instead of creating a new one.

### 2.9 Address dataset (for location pickers) — `AllowAny`
- `GET /api/v1/jobs/address/regions/` → `[{"name": "Africa"}, ...]`
- `GET /api/v1/jobs/address/countries/{region}/` → `[{"name","iso2"}, ...]`
- `GET /api/v1/jobs/address/cities/{country_iso2}/` → `[{"name"}, ...]`

### 2.10 `POST /api/v1/jobs/webhook/` — server-to-server job ingestion (not for the frontend)
Auth: header `X-Webhook-Signature` must equal env `DEAR_JS_WEBHOOK_SECRET`. This is how the scrapper (§9 below) or any
authorized system pushes new jobs into the product database. Documented for completeness, but the frontend never calls
this.

---

## 3. Resumes & Cover Letters (`apps/resumes`)

Mounted at `/api/v1/resumes/` and `/api/v1/cover-letters/`.

### 3.1 `GET/POST/DELETE /api/v1/resumes/` (+`/{id}/`) — upload & list resumes
Auth: `IsAuthenticated`. Scoped to the caller's own resumes. No PUT/PATCH.

Create — multipart, field `file` (validated: must end `.pdf/.doc/.docx/.txt`, max 5MB) + optional `parsing_enabled`
(bool). **`parsing_enabled` defaults to `true` only for the user's first-ever resume** — subsequent uploads default to
no auto-parse unless you explicitly pass `parsing_enabled: true`.

Response `201` (parsing enabled):
```json
{ "resume": { "id":"uuid","file":"url","title":"string","ai_parsed_data":null,"ai_suggestions":null,"parsing_status":"pending","created_at":"...","updated_at":"..." }, "task_id":"...", "event_url":"/api/v1/events/?channel=resume_parsing_<task_id>", "event_id":"..." }
```
Response `201` (parsing disabled): `{ "resume": {...}, "message": "Resume created successfully without parsing." }`.

Side effects when parsing runs: extracts a headshot for the profile picture if the user has none; AI-parses the resume
into `ai_parsed_data`/`ai_suggestions`; **auto-fills/overwrites the user's B2CProfile** (bio, skills, experience,
education, work history, certifications, languages) from the parsed data — worth surfacing to the user as "we'll update
your profile from this resume" rather than a silent side effect.

### 3.2 `POST /api/v1/resumes/parse-resume-merge/` — parse + merge into existing profile without saving
Auth: `IsAuthenticated, IsB2CUser`. Multipart field `resume_file` (no type/size validator — validate client-side).
Optional `parsing_enabled` (default true). Response `201 {"resume_id","task_id","event_id","event_url"}`. The merged
JSON arrives over SSE on channel `resume_parse_update_json_<task_id>` for the **frontend to review and PUT back
itself** — it is not auto-saved. If the user has no profile at all, the task result is
`{"status": "no_profile", "message": "You don't have any profile yet. Please create a profile first."}`.

### 3.3 `POST /api/v1/resumes/assessment/` — AI resume critique
Auth: `AllowAny`. Body: exactly one of `resume_id` (uuid) or `resume_file` (multipart, unvalidated). Response `202
{"task_id","event_id","event_url"}`, result arrives on `ai_resume_assessment_<task_id>` as opaque
`assessment_results` JSON.

### 3.4 `GET /api/v1/resumes/recommendations/{job_id}/{resume_id}/` — "how well do I fit this job"
Auth: `IsAuthenticated`. If a cached result exists: `200 {"cached": true, "recommendations": {...}}` immediately. Else
requires the resume to already be parsed (`400 {"detail": "Resume is still being parsed or failed."}` otherwise), then
`202 {"cached": false, "task_id","event_id","event_url"}`. Result shape on
`ai_recommendation_<task_id>`:
```json
{ "job_fit_summary":"...", "skills_to_improve":[...], "experience_gaps":[...], "resume_improvement_tips":[...], "application_advice":"..." }
```

### 3.5 Selection helpers
- `GET /api/v1/resumes/selected-resume-cover-letter/` (`IsB2CUser`) → `{"resume": ResumeDocument|null, "cover_letter":
  CoverLetterDocument|null}` where `ResumeDocument = {"id","file","title","is_selected","created_at"}`.
- `POST /api/v1/resumes/set-resume-selected/{resume_id}/` (`IsB2CUser`) → `{"message": "Resume selected
  successfully."}`.
- `POST /api/v1/resumes/set-cover-letter-selected/{cover_letter_id}/` (`IsB2CUser`) → same pattern.

### 3.6 `POST /api/v1/resumes/ai-resume-generation/` — generate a tailored resume for a job
Auth: `IsAuthenticated`. Body `{"job_id": "uuid"}`. `404` if caller has no B2C profile. Response `202
{"task_id","event_id","event_url"}` (`ai_resume_generation_<task_id>`); creates a new `Resume`
(`is_ai_generated: true`) once done.

### 3.7 Cover letters — `GET/POST/PUT/PATCH/DELETE /api/v1/cover-letters/` (+`/{id}/`)
Auth: `IsAuthenticated, IsB2CUser`. Full `ModelViewSet`. Fields: `id, title, file, is_selected, is_ai_generated, job,
created_at, updated_at`. Upload field `file` — **no type/size validation** on this one, validate client-side.

### 3.8 `POST /api/v1/cover-letters/ai-cover-letter-generation/`
Auth: `IsB2CUser`. Body `{"job_id": "uuid"}`. Same async pattern as resume generation
(`ai_cover_letter_generation_<task_id>`); `404` if no B2C profile.

---

## 4. ATS / Applications (`apps/ats`, `/api/v1/ats/`)

`ApplicationStatus` enum: `applied, screened, reviewed, shortlisted, interview-scheduled, interview,
interview-completed, offer-pending, offer, offer-accepted, offer-rejected, rejected, hired, withdrawn`.

### 4.1 Candidate-side (job seeker)

- **`POST /api/v1/ats/apply-job/`** (`IsB2CUser`) — `{"job": "uuid", "resume": "uuid"?, "cover_letter": "uuid"?,
  "auto_apply": false}`. Rejects if the job is inactive, if already actively applied, or after 2 prior withdrawals from
  the same job. `201 {"detail": "Job application submitted."}`.
- **`GET /api/v1/ats/jobs/{job_id}/status/`** (`IsB2CUser`) → `{"is_applied","is_saved","withdrawn_count",
  "application": {"resume": ResumeDocument|null, "cover_letter": CoverLetterDocument|null} | null}`.
- **`GET /api/v1/ats/b2c-applied-jobs/`** (`IsB2CUser`, paginated, filter `applied_at` gte/lte) — the "My Applications"
  list: `{id, user, job: <full Job object>, resume, cover_letter, status, applied_at, withdrawn_count, auto_apply,
  is_active}`.
- **`POST /api/v1/ats/applications/{application_id}/update-status-by-candidate/`** (`IsB2CUser`) — `{"status",
  "notes"}`. Only these transitions are allowed: `offer-accepted`/`offer-rejected` (only from `offer`), `withdrawn`
  (only from `applied`).
- **`GET /api/v1/ats/applications/{application_id}/b2c-tracking/`** (`IsB2CUser`) — status-history log (owner-only):
  `[{id, application, status, notes, action, created_at}]`.

### 4.2 Recruiter-side (B2B)

- **`GET /api/v1/ats/job/{id}/applicants/`** (`IsB2BUser`, paginated, search `user__name/user__email`, filter
  `status`) — each row: `{id, profile_id, name, email, job_tite [sic], profile_picture, current_job_status,
  resume_used, cover_letter_used, match_score (live-computed %), match_score_obj, status, applied_at}`. Response also
  merges in a status-count summary object (`{applied: N, hired: N, ..., total_applicants: N}` over the whole job).
- **`POST /api/v1/ats/applications/{application_id}/update-status/`** (`IsB2BUser`, must belong to the job's org) —
  `{"status","notes","action"}`. Cannot set `withdrawn` from this side.
- **`GET /api/v1/ats/b2b-posted-jobs/`** (`IsB2BUser`, paginated) — `{id, title, slug, images (applicant avatars),
  text ("N+ Applied Candidates")}`.
- **`GET /api/v1/ats/applications/{application_id}/b2b-tracking/`** (`IsB2BUser`, job's recruiter only) — includes
  `actor`/`actor_name` in the log (candidates don't see who acted).
- **`PUT/PATCH /api/v1/ats/applications/{application_id}/tracking/{tracking_id}/edit/`** (`IsB2BUser`).
- **`GET /api/v1/ats/application/job-pipeline/`** (`IsB2BUser`, paginated) — per-job counts across every
  `ApplicationStatus`: `[{"jobTitle": "...", "applied": 5, "hired": 1, ...}, ...]`.
- **`GET /api/v1/ats/application/hiring-efficiency/`** (`IsB2BUser`, paginated) — `[{job_id, job_title, total_applied,
  total_hired, hiring_efficiency_in_percentage, first_application_date, first_offer_accepted_date,
  time_to_hire_in_days, time_to_fill_in_days}]`.

### 4.3 Candidate pool / public

- **`GET /api/v1/ats/candidates/`** (`AllowAny` — **exposes candidate PII without auth**: name, email, phone, skills,
  salary expectations) — paginated, search (`user__name/email/skills/looking_for_designations/department/address/
  heading`), ordering (`years_of_experience`,`created_at`), filters: `address`, `skills`, `department`, `heading`,
  `looking_for_designations` (all comma-separated icontains), `years_of_experience` / `_gte` / `_lte`,
  `expected_salary_min` / `expected_salary_max`.
- **`GET /api/v1/ats/candidate-profile-by-user-id/{user_id}/`** (`IsAuthenticated`) and
  **`GET /api/v1/ats/candidate-profile-by-profile-id/{profile_id}/`** (`AllowAny`) — full `B2CProfile` (see §1.13/§3
  nested docs), including `resume_docs`, `cover_letter_docs`, `completion_percentage`.
- **`GET /api/v1/ats/organization/{id}/`** (`IsAuthenticated`) — full `Organization` object.
- **`GET /api/v1/ats/application/hiring-data/`** (`AllowAny`) — hired-applications-by-source/department aggregate, for
  a public "trust" stats section if wanted.
- **`GET /api/v1/ats/application/b2c-insights/`** (`AllowAny`) — market-insight widgets: query param `type`
  (comma-separated subset of `trends,salaries,titles,roles`), plus `region`/`country`/`locality` filters for `roles`.
  Good fit for a "job market trends" dashboard/landing widget.

---

## 5. AI Match Engine (`apps/ai_match_engine`, `/api/v1/ai-match-engine/`)

The live matcher is **SmartJobMatcher v3.1** — job requirements are the constraint, candidate profile is scored against
them across 8 weighted criteria (department 50%, skills 25%, experience 15%, education/certs up to 15% if applicable,
english level 10% if applicable, language 10% if applicable, location 5% if applicable, semantic similarity 10%
always). Score is 0–100.

Common match-result shape (`{score}` is the headline 0–100 number):
```json
{
  "job_id","profile_id","blocked": false, "block_reasons": [],
  "department_match": true, "overall_match_percent": 78.4, "score": 78,
  "breakdown": { "skills": {"score": 82.0, "weight": 25, "contribution": 20.5}, "...": {} },
  "criteria_scores": { "skills": 82.0, "...": 0 }, "active_weights": { "skills": 25, "...": 0 },
  "top_strengths": [{"criterion","why"}], "top_gaps": [{"criterion","why"}],
  "semantic_score": 0.71, "skill_matches": ["..."], "skill_gaps": ["..."]
}
```

- `GET /api/v1/ai-match-engine/match-jobs/{profile_id}/?n=10` (`AllowAny`) — top-N job matches for a given B2C profile.
- `GET /api/v1/ai-match-engine/recommend-jobs/?n=100&targeted=false&q=...` (`IsB2CUser`, paginated, `JobFilter`
  supported) — "recommended for you" feed, blending profile-based + recent-search-based + questionnaire-based
  suggestions, each tagged `suggested_type`.
- `GET /api/v1/ai-match-engine/match-profiles/{job_id}/?n=10` (`AllowAny`) — top-N candidate matches for a job
  (recruiter-facing).
- `GET /api/v1/ai-match-engine/ai-search-jobs/?q=...&n=10&use_llm=true` (`AllowAny`, personalized if authenticated with
  a profile) — semantic job search.
- `POST /api/v1/ai-match-engine/ai-search-jobs-by-file/` (`AllowAny`, multipart `file`, max 10MB,
  `.pdf/.doc/.docx/.txt/.jpg/.jpeg/.png`) — "search jobs by uploading your resume."
- `GET /api/v1/ai-match-engine/ai-search-profiles/?q=...` and
  `POST /api/v1/ai-match-engine/ai-search-profiles-by-file/` (`AllowAny`) — recruiter-facing semantic candidate search.
- `GET /api/v1/ai-match-engine/similar-jobs/{job_id}/?n=10` (`AllowAny`) — "similar jobs" rail (logical/content
  matching, not embeddings).
- `GET /api/v1/ai-match-engine/match-score/{profile_id}/{job_id}/` (`AllowAny`) and
  `GET /api/v1/ai-match-engine/match-score/{job_id}/` (`IsB2CUser`, uses caller's own profile) — full match breakdown
  for a "why this match %" detail panel.

### Chatbot (site-content RAG, not a personal career coach)
- `POST /api/v1/ai-match-engine/chatbot/` (`AllowAny`, throttled ~20 req/hr/IP) — **SSE streaming** response.
  Body: `{"current_query","previous_messages": [], "session_id"?, "limit": 5}`.
- `POST /api/v1/ai-match-engine/chatbot/response/` (`AllowAny`, same throttle) — non-streaming version. Response field
  is (verbatim, includes a typo in the backend) `{"respons": "answer text"}`.
- Knowledge-base browsing: `GET /api/v1/ai-match-engine/knowledge/search/?q=...&limit=5` (`AllowAny`),
  `GET /api/v1/ai-match-engine/knowledge/context/?q=...` (`AllowAny`) — internal/debug use, not needed by a normal UI.

---

## 6. Coaching (`apps/coaching`, `/api/v1/coaching/`)

A 1:1 mentoring marketplace (not AI coaching) — job seekers browse "Experts" and book sessions.

- `GET /api/v1/coaching/sessions/` (`AllowAny`, **no pagination**) — list of experts:
  ```json
  { "id","title","description","banner_picture":"url","skills_covered":["Communication","Leadership"],
    "topics":["Career Growth"],"expertise_name":"John","subscription_required": false }
  ```
- `GET /api/v1/coaching/sessions/{id}/` (`AllowAny`) — one expert; `404 {"detail": "Expert not found"}` if missing.
- `GET /api/v1/coaching/bookings/` (`IsAuthenticated`, paginated) — the caller's own bookings, fixed
  `-scheduled_at` ordering, no filters:
  ```json
  { "id","user","expert","session": { "...full expert object..." },
    "scheduled_at","duration_minutes": 30,"video_meeting_link": null,"status": "scheduled" }
  ```
- `POST /api/v1/coaching/bookings/` (`IsAuthenticated`) — `{"expert": "uuid","scheduled_at": "iso-datetime",
  "duration_minutes": 30}`. Rejects a duplicate active booking with the same expert, and a double-booking at the exact
  same timestamp with a different expert. ⚠️ `video_meeting_link` is **never auto-populated** (the Calendly
  integration referenced in the code is dead/unwired) — don't promise a meeting link in the UI yet. `
  subscription_required` on an expert is a **data-only flag, not enforced anywhere** — don't gate booking on it unless
  you add that check yourself.

---

## 7. Subscriptions & Payments (`apps/subscriptions`, `/api/v1/subscriptions/`)

- `GET /api/v1/subscriptions/packages/?user_type=b2c` (`AllowAny`) — plan list:
  ```json
  { "id","name","description","user_type","base_price","discount_percentage","discounted_price",
    "is_featured","is_popular","has_trial","trial_days","included_credits",
    "monthly_price","quarterly_price","biannually_price","annually_price",
    "package_features": [ { "feature": {"id","name","description","code","has_usage_limit","default_limit",
      "credit_cost","is_premium","usages_status": {"usage_count","total_credits_used","last_used"} },
      "usage_limit","effective_limit","is_included","notes" } ] }
  ```
- `GET /api/v1/subscriptions/user-subscriptions/current/` (`IsAuthenticated`) — the caller's active subscription, or
  `404 {"error": "No active subscription found"}`. Shape: `{id, package (nested full package), billing_cycle, status,
  start_date, end_date, trial_end_date, auto_renew, available_credits, is_active, is_trial, days_remaining}`.
- `POST /api/v1/subscriptions/user-subscriptions/create-subscription/` (`IsAuthenticated`) — starts Stripe Checkout:
  ```json
  { "package_id":"int","billing_cycle":"monthly|quarterly|biannually|annually","auto_renew": true,
    "promo_code": "optional", "success_url":"https://...","cancel_url":"https://..." }
  ```
  → `{"session_id","payment_url"}` — redirect the browser to `payment_url` (Stripe-hosted checkout). ⚠️ **Do not wire
  up the `promo_code` field yet** — `PromoCodeService` references model attribute names that don't match the current
  `PromoCode` model and will raise a server error if a promo code is actually submitted.
- `POST /api/v1/subscriptions/user-subscriptions/cancel/` (`IsAuthenticated`) — turns off auto-renew at period end.
  `{"message": "Subscription auto-renewal cancelled"}`.
- `GET /api/v1/subscriptions/payments/` (+`/{id}/`) (`IsAuthenticated`) — the caller's payment history: `{id, amount,
  currency, payment_type, status, billing_cycle, created_at}`.
- `GET /api/v1/subscriptions/feature-usage/history/` (`IsAuthenticated`, paginated) — `{feature_name, usage_cost,
  last_used, reset_period, metadata, created_at}`.
- `POST /api/v1/subscriptions/webhooks/stripe/` — Stripe webhook receiver, not for the frontend.

⚠️ Only Stripe is actually wired up for payment. `Payment.gateway` has a `paypal` choice in the model and a leftover
test file, but there is no live PayPal integration code — **do not build a PayPal option**. There is also no live
endpoint for browsing/purchasing standalone credit packages (`CreditPackageViewSet` is commented out) and no
"check remaining quota" endpoint beyond combining `packages` (`effective_limit`) with `feature-usage/history/`
(actual usage) yourself.

---

## 8. Marketing / dynamic pages (`apps/dynamic_pages`, `apps/general`, `/api/v1/pages/`, `/api/v1/general/`)

CMS-driven content for public marketing pages — useful if the new design has a landing/home page, contact page, or an
onboarding questionnaire backed by the CMS instead of hardcoded copy.

- `GET /api/v1/pages/home/` (`AllowAny`) — full home-page payload: hero copy, top-8 companies by job count, "career
  move" feature blocks, "simple steps" section, "why choose us" reasons, FAQ, and subscription plan teaser cards. All
  image fields are resolved to absolute URLs.
- `GET /api/v1/pages/job-page/` (`AllowAny`) — `{"id","title","job_suggested_search": ["backend developer", ...]}`
  (chips for a jobs-page search bar).
- `GET /api/v1/pages/contact-page/` (`AllowAny`) — contact methods, form field labels/placeholders, FAQ, office
  address/hours/map coordinates.
- `POST /api/v1/pages/contact-form/submit/` (`AllowAny`) — `{"name","email","category","subject","message"}` →
  `201 {"detail": "Submission successful."}`. ⚠️ **No email is actually sent to your team** — the mail-send code is
  present but hardcoded off; the submission is only stored in the DB. Don't promise "we'll get back to you by email"
  copy without checking with the backend team first.
- `GET /api/v1/pages/questionnaire/` (`AllowAny`, or personalized by `user_type` if authenticated) — dynamic onboarding
  questionnaire definition: `{"id","title","description","status","steps": [{"title","order","questions": [{"type":
  "text|email|number|textarea|select|radio|checkbox|date","label","placeholder","required","options": [{"value",
  "label"}], "errorMessage"}]}]}`.
- `GET/POST /api/v1/pages/questionnaire/responses/` (+`/{id}/` GET/PUT/PATCH/DELETE) (`IsAuthenticated`) — submit/edit
  the user's own answers: `{"answers": [{"question_id","answer"}]}`. A response can't be edited once submitted if its
  status reflects completion (⚠️ this code path references a non-existent model attribute and would error if
  triggered — treat "edit after submit" as unsupported for now).
- `GET /api/v1/general/events/{event_id}/` (**auth required despite looking like a public status check** — no
  `permission_classes` set, so it falls back to the project default `IsAuthenticated`) — polls a generic async-task
  status row: `{"event_id","status","created_at","updated_at"}`. This is separate from the per-feature SSE channels
  described throughout this document.

---

## 9. Automation / job ingestion (server-to-server, not for the frontend)

- `POST /api/v1/automation/job-ingest/` — header `X-API-KEY` checked against a DB-stored secret. Accepts a single job
  object or an array. This is one of the two ways jobs enter the system from external automations (Telegram bots,
  n8n, etc.) — documented for completeness; the frontend never calls it.

---

## 10. Job Scraper service (`dear-company-job-scrapper`) — reference only

This is a **separate Django project with no REST API for browsing jobs.** It's an internal admin console
(session-login-gated HTML pages) driving a scrape → LLM-refine → webhook-push pipeline. The only points of contact
relevant to a frontend integration:

1. **`POST /api/suggest-telegram-channel/`** on the scrapper itself — but you don't need to call this directly, use
   `POST /api/v1/accounts/suggest-channel/` (§1.13) on the main backend, which proxies it.
2. The scrapper **pushes** structured job postings to the main backend's ingestion endpoints (§2.10, §9) — this is
   invisible to the frontend; jobs simply appear via the normal `Job` model once ingested.
3. The structured job schema the scrapper produces (for context, in case the pipeline is ever exposed more directly)
   matches the `Job` model fields almost 1:1 — `title, department, description_text, responsibilities,
   employment_type, remote_option, skills_required, experience_required, qualifications, highlights,
   auto_screening_questions, date_posted, date_validthrough, job_url, source, source_type, source_domain,
   english_level, vacancy_languages, work_format, grade, geo_regions, relocation_countries, specializations,
   certifications, is_authorization_needed_to_work, organization {name,url,url_domain,logo}, salary
   {currency,min_value,max_value,unit_text}, job_locations [{country,region,locality,street_address,postal_code,
   timezone}]`.
4. Delivery is at-least-once, not exactly-once — duplicate job postings are possible if a webhook delivery is
   manually retried; there's no stable dedup key exposed in the payload itself.

**Bottom line: the frontend should treat "jobs" purely as `apps/jobs` REST endpoints on `dear-hr-tech-backend` (§2) and
never talk to the scrapper.**

---

## 11. Known backend bugs / incomplete features (do not build UI around these without checking first)

These were found by reading the actual code, not the specs — flag them to the backend team rather than silently
working around them in the frontend:

1. **Interview scheduling** (`POST /api/v1/hireflow/interviews/`) looks up a **hardcoded** Google Calendar account
   instead of the requesting recruiter's own — will fail for any real recruiter today.
2. **Promo codes** on subscription checkout (`create-subscription`) reference model fields that don't exist on
   `PromoCode` — submitting a promo code will likely 500.
3. **PayPal** is a model choice only; no live integration exists — only Stripe works.
4. **Phone OTP SMS** (`phone-otp-login/request`, `set-phone/`) is a logging-only stub — no SMS is actually sent.
5. **Contact form** (`contact-form/submit/`) does not send any email — it only stores the submission.
6. **`pay-now`** subscription action is a no-op (its save logic is commented out).
7. **Questionnaire response "cannot edit after completion"** check references a non-existent model attribute — will
   error if that code path is hit.
8. **Coaching bookings**: `video_meeting_link` is never populated (dead Calendly integration); `subscription_required`
   on experts is not enforced anywhere.
9. Several candidate/profile endpoints are `AllowAny` and expose PII (name, email, phone, salary expectations)
   without authentication — `GET /api/v1/ats/candidates/`, `GET /api/v1/ats/candidate-profile-by-profile-id/{id}/`.
   Treat these as public data when deciding what to render/cache client-side.
10. Feature-usage tracking (`FeatureUsage.usage_cost`) may not accumulate correctly across repeated uses of the same
    feature — don't build a client-side "X of Y uses left" counter purely from raw `usage_cost` math; prefer
    `effective_limit` vs. `usages_status.usage_count` from the packages endpoint (§7).

---

## 12. Prompt for the frontend integration agent

Copy everything below into a fresh session together with the new design's HTML file.

> You are integrating the real Dear Company backend into this repository, replacing the current Firebase/Firestore
> demo-mode data layer described in `EXISTING_BUSINESS_LOGIC_AND_UI_INTEGRATION.md` / `INTEGRATION_REPORT.md`. The
> actual backend contract — every endpoint, auth model, request/response body, and known bug — is documented in
> `API_INTEGRATION_SPEC.md` in this repo. Read it fully before writing any code.
>
> I am also attaching an HTML file of the new visual design. Your job is to rebuild the UI to match that HTML
> pixel-for-pixel (spacing, type, color, layout, breakpoints) while wiring it to the real backend described in
> `API_INTEGRATION_SPEC.md`, following the Feature-Sliced Design architecture and conventions already established in
> `AGENTS.md` (shared → entities → features → widgets → pages → app; `@/*` alias; `useTheme()`/`colorOf()` for color;
> `useT()` for every user-visible string; `useBreakpoint()` at 760px).
>
> Rules for what to build:
> 1. **Only implement UI for functionality that has a real, working backend endpoint** as documented in
>    `API_INTEGRATION_SPEC.md`. If the new HTML design shows a feature with no corresponding endpoint in that spec
>    (or the endpoint exists but is explicitly flagged broken/stubbed in §11 "Known backend bugs"), **skip it
>    entirely** — do not build it against mock data, do not fake it, do not leave a non-functional button. Either omit
>    that section of the design or replace it with a clearly-labeled "coming soon" state if it's structurally load-
>    bearing to the layout.
> 2. Replace every Firebase/Firestore call in the existing entities/features (`src/entities/*/api/*Repo.ts`,
>    `src/features/*`) with calls to the Django REST API using the exact paths, methods, and payload shapes in
>    `API_INTEGRATION_SPEC.md`. Keep the same repo/store layering the codebase already uses — swap the transport, not
>    the architecture.
> 3. Auth: implement JWT login/register/refresh/logout per §1. Store tokens the way appropriate for web vs. native
>    (cookie reliance is fine on web; store the JSON tokens for native/Expo). Wire the existing sign-in screen to
>    real registration + login instead of demo auth, but keep the demo-mode fallback for when the API base URL isn't
>    configured (mirror the existing `EXPO_PUBLIC_DEMO_AUTH` pattern).
> 4. For every async/AI endpoint (resume parsing, resume/cover-letter generation, AI job creation, job
>    recommendations by resume, resume assessment), implement the two-step flow: call the endpoint, then subscribe to
>    the returned `event_url` (Server-Sent Events) and update UI state as events arrive. Handle the SSE connection
>    dropping/erroring gracefully (retry or fall back to a manual refresh action).
> 5. Use the real pagination envelope (`count`/`next`/`previous`/`results`) for every list endpoint instead of any
>    mocked "load more" logic currently in place.
> 6. Never claim something the backend doesn't actually do — e.g., don't add "we emailed you" copy near the contact
>    form (§11.5) or "your interview is on your calendar" copy near coaching bookings (§11.8) since those are not
>    real yet.
> 7. Preserve existing honest-labeling conventions from the current integration report (e.g., external apply flow
>    stays external, no fabricated notification promises) unless the new design and this spec together show the
>    feature is now real.
> 8. Run `npm run typecheck` and `npm test` after integration and keep both clean, matching the validation bar the
>    previous integration pass used.
>
> Deliver a short KEEP/ADAPT/HIDE mapping (same style as the existing `INTEGRATION_REPORT.md`) at the end, listing
> every surface in the new design and whether it was implemented against a real endpoint, adapted, or hidden due to
> missing backend support.
