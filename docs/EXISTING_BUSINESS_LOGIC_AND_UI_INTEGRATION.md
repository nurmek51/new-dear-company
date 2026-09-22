# Dear Company — Standalone Business Logic and Backend Integration Specification

> Version: 1.0  
> Prepared: 2026-07-21  
> Audience: an engineer or LLM code agent implementing a new UI without access to the previous application.

## 1. Purpose

This document is the complete functional contract for integrating the existing Dear Company product into a new web/mobile UI.

It defines:

- Supported user-facing capabilities.
- Features that must be hidden because no production backend exists.
- Authentication, roles, access control, and route behavior.
- Complete domain objects and allowed enum values.
- Firebase Auth, Firestore, Storage, callable-function, and HTTP webhook requests.
- Request payloads, response payloads, queries, mutations, side effects, validation, failures, and UI handling.
- Business calculations, status transitions, filters, and non-transactional behavior.
- A copy-ready prompt for the UI integration agent.

The integrator should not need the old project. Names in this document are API field names and backend contracts, not pointers to old source files.

## 2. Product and integration boundary

Dear Company has two experiences under one user identity.

### 2.1 Job seeker

A seeker can:

- Browse and view vacancies.
- Filter vacancies using the supported filters.
- Mark vacancies viewed automatically.
- Bookmark catalogue vacancies.
- Save named search configurations.
- Maintain a manual wishlist of external jobs.
- Convert a wishlist item into a tracked application.
- Create, edit, filter, and delete tracked applications.
- Receive automatic application updates through a personal forwarding email address.
- Build, save, import, parse, and export a resume.
- Browse public Career Hub content.
- Edit their display name and avatar.
- Switch into recruiter mode.

### 2.2 Recruiter ATS

A recruiter can:

- Create and maintain companies.
- Create draft or published recruiter jobs.
- Maintain a private candidate pool.
- Attach candidates to jobs.
- Move applications through ATS stages.
- View basic dashboard statistics.
- Create team invitations and share invite links.
- Maintain company members.

### 2.3 Backend architecture

There is no REST API for ordinary CRUD. Integration uses:

- Firebase Authentication for sessions and social identity.
- Firestore direct client SDK for documents and queries.
- Firebase Storage for user avatars.
- Firebase callable functions for email OTP and resume parsing.
- One unauthenticated HTTP webhook for inbound forwarded email.
- One HTTP health endpoint.

Use the existing collection names, field names, enum values, and payload shapes exactly. Do not create alternative local schemas.

## 3. Capability decision matrix

| Capability | Backend reality | UI decision |
|---|---|---|
| Google authentication | Supported when provider is configured | Keep |
| Apple authentication | Supported when provider is configured | Keep |
| Email OTP login | Fixed code 123456; no email is sent | Hide in production |
| Demo login | Local demo session, not backend data emulation | Development/demo only |
| Vacancy catalogue | Existing client behavior uses bundled mock data | Show only in explicit demo mode; do not call it live |
| Vacancy details | Supported | Keep |
| Viewed vacancy tracking | Supported for authenticated users | Keep |
| Vacancy bookmarks | Supported for authenticated users | Keep |
| External vacancy application | Opens external URL; no internal submission | Keep with honest wording |
| Supported filters | Partially supported | Show only fields listed as effective |
| Main search using searchQuery | Not connected | Hide or bind to search instead |
| Sort by salary/relevance | Not implemented | Hide |
| Time range selector | Not implemented | Hide |
| Numbered pagination controls | Do not fetch data | Hide |
| Infinite scroll toggle | Does not trigger fetch | Hide |
| “AI vacancy search” | Local keyword rules only | Hide as AI |
| Saved searches | CRUD/apply supported | Keep |
| Saved-search alert delivery | No evaluator or sender | Hide notification controls/promises |
| Application tracker | Supported | Keep |
| Manual external-job wishlist | Supported | Keep |
| Application statistics | Supported | Keep exact formulas |
| Application history | Incomplete | Hide |
| Gamification | Incomplete/non-transactional | Hide unless explicitly accepted |
| Forwarded-email automation | Backend flow exists | Show only after deployment verification |
| Manual resume builder | Supported | Keep |
| PDF/DOCX resume parsing | Callable AI flow supported | Keep after configuration verification |
| DOCX export | Client-side supported | Keep |
| Resume roast | No backend | Hide |
| Subscription billing/restore | No backend | Hide |
| Premium checkout and entitlement purchase | No backend | Hide |
| Notification preference screen | Persistence concept exists but integration was broken | Hide until independently repaired/tested |
| Server push/email notifications | No sender pipeline | Hide all delivery claims |
| Career Hub reads | Supported/public | Keep |
| Career Hub link administration | Supported/admin-only | Keep for admins |
| Career Hub file upload | No implementation | Hide |
| Recruiter company CRUD | Supported | Keep |
| Company email verification | Fixed code 123456; no email | Hide in production |
| Team invitations | Records and acceptance supported | Keep link copy/share only |
| Invitation email delivery | No sender | Never claim an email was sent |
| Recruiter job CRUD | Supported | Keep |
| Recruiter job publication to public board | No synchronization | Never claim this |
| Candidate CRUD/filtering | Supported | Keep |
| Candidate resume upload/parsing | No implementation | Hide |
| ATS application pipeline | Supported | Keep |
| Custom workflow editor | Not reliably complete | Hide unless separately verified |
| Admin vacancy seed/clear | Administrative data utility | Never expose to ordinary users |

## 4. Common data and transport conventions

### 4.1 Dates

Stored backend dates are Firestore Timestamp values unless a contract explicitly says otherwise.

On read:

- Convert Timestamp to a JavaScript Date for UI use.
- If a timestamp is absent in legacy data, existing behavior uses the current date as a fallback in many object mappers.
- Do not send locale-formatted date strings to Firestore.

On create/update:

- Use serverTimestamp() for createdAt and updatedAt unless the contract requires a user-selected date.
- Convert user-selected dates to Timestamp.
- Use null only to intentionally clear an optional stored field.
- Never send undefined to Firestore.

### 4.2 Document IDs

Firestore generates IDs for most collections. User resume and notification settings use the Firebase UID as document ID.

The authenticated identity key is always uid. Never use user.id.

### 4.3 Optional values

- Omit absent optional values on create.
- For update operations, undefined means “do not change.”
- An empty optional string generally means “clear,” written as null for responses, saved jobs, companies, jobs, and candidates where documented.
- Required text must be trimmed before submission.

### 4.4 Error model

Firebase client operations can reject with Firebase errors. Callable functions return Firebase HttpsError codes. The webhook uses HTTP status codes.

UI requirements:

- Convert backend errors into a concise user message.
- Preserve a diagnostic error for logs without exposing secrets.
- Stop loading/submitting in finally blocks.
- Prevent duplicate mutation submissions.
- Handle both thrown failures and null return values.
- Revert optimistic toggles if persistence fails.
- Offer retry for recoverable reads.
- Confirm destructive operations.

### 4.5 Authentication headers

Firestore, Storage, and callable functions use the current Firebase Auth session automatically. Do not manually attach bearer tokens when using Firebase SDKs.

The inbound-email webhook is currently unauthenticated and does not verify a provider signature.

### 4.6 Backend operation registry

| Operation | Transport | Caller |
|---|---|---|
| Social sign-in/session/sign-out | Firebase Auth SDK | New UI client |
| All ordinary domain CRUD | Firestore client SDK | New UI client |
| Avatar bytes/download URL | Firebase Storage client SDK | New UI client |
| sendEmailOTP | Firebase callable function | Login UI, demo/development only |
| verifyEmailOTP | Firebase callable function | Login UI, demo/development only |
| parseResumeCv | Authenticated Firebase callable function | Resume UI |
| processInboundEmail | HTTP Cloud Function POST | Email provider, never the UI client |
| healthCheck | HTTP Cloud Function | Monitoring |

Callable functions must be invoked by their exact names through the Firebase Functions SDK so auth context and structured HttpsError values are preserved.

HTTP deployment URLs follow the Firebase project/region deployment output, conventionally:

~~~text
https://{region}-{projectId}.cloudfunctions.net/processInboundEmail
https://{region}-{projectId}.cloudfunctions.net/healthCheck
~~~

No non-default region is defined by the business contract. Use the actually deployed region; do not hardcode a guessed region. The new UI does not call processInboundEmail.

## 5. Environment configuration

Required Firebase client values:

- EXPO_PUBLIC_FIREBASE_API_KEY
- EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
- EXPO_PUBLIC_FIREBASE_PROJECT_ID
- EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
- EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
- EXPO_PUBLIC_FIREBASE_APP_ID
- EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID

Additional values:

- EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: Google OAuth client for native.
- EXPO_PUBLIC_PROJECT_ID: Expo project ID for push-token creation.
- EXPO_PUBLIC_FORWARD_EMAIL_DOMAIN: forwarding domain; default forward.dearcompany.app.
- EXPO_PUBLIC_DEMO_AUTH: explicit demo-mode switch.
- OPENAI_API_KEY: server-only key for callable/webhook AI processing.

Never expose OPENAI_API_KEY in a public environment variable or client bundle.

## 6. Complete domain model

### 6.1 Shared enums

~~~ts
type WorkFormat = 'remote' | 'hybrid' | 'onsite';

type EmploymentType = 'fulltime' | 'parttime' | 'project';

type Grade =
  | 'intern' | 'junior' | 'middle' | 'senior'
  | 'lead' | 'head' | 'director' | 'clevel';

type CandidateSeniority =
  | 'intern' | 'junior' | 'middle' | 'senior'
  | 'lead' | 'head' | 'director' | 'c-level';

type CompanyType = 'startup' | 'corporation' | 'product' | 'outsource';

type EnglishLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

type VacancyLanguage = 'ru' | 'en';

type Currency = 'RUB' | 'USD' | 'EUR';
~~~

Note the intentional mismatch: vacancy grade uses clevel, while candidate seniority uses c-level.

The typed write contract supports RUB, USD, and EUR. Some legacy/demo vacancy content may contain other currency strings such as CAD, and display code historically recognized GBP/CAD symbols. Render an unknown incoming currency safely using its code, but do not submit unsupported currency values from new forms.

### 6.2 User

Collection: users. Document ID: uid.

~~~ts
interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  phoneNumber?: string;
  isPremium: boolean;
  premiumUntil?: Date;
  role: 'user' | 'recruiter' | 'admin';
  isRecruiter?: boolean;
  viewedVacancies: string[];
  savedVacancies: string[];
  forwardToken?: string;
  forwardEmail?: string;
  gameStats?: { points: number };
  pushToken?: string;
  pushTokenUpdatedAt?: Date;
  createdAt: Date;
}
~~~

### 6.3 Vacancy and salary

Collection: vacancies.

~~~ts
interface Salary {
  min?: number;
  max?: number;
  currency: Currency;
}

interface Vacancy {
  id: string;
  title: string;
  company: string;
  companyHidden: boolean;
  location: string[];
  country: string[];
  workFormat: WorkFormat;
  employmentType: EmploymentType;
  grade: Grade;
  skills: string[];
  specializations: string[];
  industries: string[];
  salary?: Salary;
  englishLevel?: EnglishLevel;
  language: VacancyLanguage;
  description: string;
  applyUrl: string;
  source: string;
  relocation: boolean;
  companyType?: CompanyType;
  createdAt: Date;
  updatedAt: Date;
}
~~~

### 6.4 Vacancy filter state

~~~ts
interface FilterState {
  search: string;
  searchQuery: string;
  workFormat: WorkFormat[];
  workFormatExclude: boolean;
  employmentType: EmploymentType[];
  employmentTypeExclude: boolean;
  grades: Grade[];
  gradesExclude: boolean;
  skills: string[];
  skillsExclude: boolean;
  skillsMatchAll: boolean;
  specializations: string[];
  specializationsExclude: boolean;
  industries: string[];
  industriesExclude: boolean;
  companyTypes: CompanyType[];
  companyTypesExclude: boolean;
  countries: string[];
  countriesExclude: boolean;
  regions: string[];
  regionsExclude: boolean;
  relocation: boolean | null;
  englishLevels: EnglishLevel[];
  englishLevelsExclude: boolean;
  vacancyLanguage: VacancyLanguage[];
  vacancyLanguageExclude: boolean;
  currency: Currency[];
  currencyExclude: boolean;
  minSalary?: number;
  hideViewed: boolean;
  onlyNew: boolean;
}
~~~

Default: empty strings/arrays, all exclusion flags false, relocation null, minSalary undefined, hideViewed false, onlyNew false.

### 6.5 Saved search

Collection: savedFilters.

~~~ts
interface SavedFilter {
  id: string;
  userId: string;
  name: string;
  filters: FilterState;
  notificationsEnabled: boolean;
  createdAt: Date;
}
~~~

### 6.6 Job-seeker response tracker

Collection: responses.

~~~ts
type ResponseStatus =
  | 'to_apply' | 'applied' | 'round_1' | 'final'
  | 'offer' | 'rejected' | 'no_answer' | 'needs_review';

interface ResponseContact {
  name: string;
  email?: string;
  linkedIn?: string;
}

type ResponseEventType =
  | 'status_change' | 'email_received' | 'note_added' | 'created';

interface ResponseEvent {
  id: string;
  type: ResponseEventType;
  timestamp: Date;
  source: 'manual' | 'email';
  data: {
    previousStatus?: ResponseStatus;
    newStatus?: ResponseStatus;
    emailSubject?: string;
    emailFrom?: string;
    emailMessageId?: string;
    note?: string;
  };
}

interface JobResponse {
  id: string;
  userId: string;
  company: string;
  position: string;
  jobUrl?: string;
  location?: string;
  industry?: string;
  contact?: ResponseContact;
  status: ResponseStatus;
  notes: string[];
  events?: ResponseEvent[];
  emailThreadIds?: string[];
  followUpDate?: Date;
  appliedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface ResponseFilterState {
  search: string;
  statuses: ResponseStatus[];
  dateFrom?: Date;
  dateTo?: Date;
}
~~~

### 6.7 Manual saved job

Collection: savedJobs. This is not the same as users.savedVacancies.

~~~ts
interface SavedJob {
  id: string;
  userId: string;
  company: string;
  position: string;
  jobUrl?: string;
  location?: string;
  industry?: string;
  notes?: string;
  createdAt: Date;
}
~~~

### 6.8 Resume

Collection: resumes. Document ID: uid.

~~~ts
interface ResumeExperience {
  id: string;
  company: string;
  position: string;
  startDate: string;
  endDate: string;
  description: string;
}

interface ResumeEducation {
  id: string;
  institution: string;
  degree: string;
  field: string;
  startYear: string;
  endYear: string;
}

interface ResumeLanguage {
  id: string;
  language: string;
  level: string;
}

interface Resume {
  mode: 'manual';
  uploadedFileName?: string;
  fullName: string;
  jobTitle: string;
  location: string;
  phone: string;
  email: string;
  linkedIn: string;
  portfolio: string;
  summary: string;
  skills: string[];
  experience: ResumeExperience[];
  education: ResumeEducation[];
  languages: ResumeLanguage[];
  updatedAt?: Date;
}
~~~

### 6.9 Career Hub

Collection: careerHub.

~~~ts
interface CareerHubLink {
  id: string;
  title: string;
  url: string;
  description?: string;
}

interface CareerHubFile {
  id: string;
  title: string;
  url: string;
  fileName: string;
}

interface CareerHubSection {
  id: string;
  title: string;
  description: string;
  icon: string;
  order: number;
  links: CareerHubLink[];
  files: CareerHubFile[];
}
~~~

### 6.10 Recruiter company, member, and invite

Collection: companies. Members subcollection: companies/{companyId}/members. Invite collection: companyInvites.

~~~ts
interface ATSCompany {
  id: string;
  name: string;
  logo?: string;
  description?: string;
  industry?: string;
  size?: 'startup' | 'small' | 'medium' | 'large' | 'enterprise';
  website?: string;
  country?: string;
  recruiterId: string;
  isVerified: boolean;
  verifiedEmail?: string;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface CompanyMember {
  id: string;
  email: string;
  role: 'superadmin' | 'admin' | 'member';
  status: 'pending' | 'active';
  invitedBy: string;
  userId?: string;
  joinedAt?: Date;
  createdAt: Date;
}

interface CompanyInvite {
  id: string;
  companyId: string;
  email: string;
  role: 'admin' | 'member';
  token: string;
  invitedBy: string;
  status: 'pending' | 'accepted' | 'expired';
  createdAt: Date;
}
~~~

Size labels: startup 1-10, small 11-50, medium 51-200, large 201-1000, enterprise 1000+.

### 6.11 Recruiter job

Collection: recruiterVacancies.

~~~ts
interface RecruiterJob {
  id: string;
  companyId: string;
  recruiterId: string;
  title: string;
  description: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: Currency;
  skills: string[];
  seniority?: CandidateSeniority;
  workFormat?: WorkFormat;
  employmentType?: EmploymentType;
  status: 'draft' | 'published' | 'closed';
  applicationsCount: number;
  customStatuses?: string[];
  createdAt: Date;
  updatedAt: Date;
}
~~~

### 6.12 Candidate

Collection: candidates.

~~~ts
interface Candidate {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  linkedIn?: string;
  resumeUrl?: string;
  jobTitle?: string;
  yearsOfExperience?: number;
  country?: string;
  city?: string;
  seniority?: CandidateSeniority;
  salaryExpectation?: number;
  salaryCurrency?: Currency;
  source?: string;
  tags: string[];
  notes?: string;
  addedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface CandidateFilterState {
  search: string;
  jobTitle: string;
  country: string;
  city: string;
  seniority: CandidateSeniority[];
  source: string;
  tags: string[];
  minExperience?: number;
  maxExperience?: number;
  minSalary?: number;
  maxSalary?: number;
}
~~~

### 6.13 ATS application and event

Collections: applications and applicationEvents.

~~~ts
type ATSApplicationStatus =
  | 'applied'
  | 'screening'
  | 'interview_scheduled'
  | 'interview'
  | 'security_check'
  | 'offer'
  | 'offer_accepted'
  | 'rejected';

interface ATSApplication {
  id: string;
  candidateId: string;
  jobId: string;
  status: ATSApplicationStatus;
  notes?: string;
  customStatuses?: string[];
  recruiterId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ATSApplicationEvent {
  id: string;
  applicationId: string;
  type: 'status_change' | 'note_added' | 'created';
  previousStatus?: ATSApplicationStatus | string;
  newStatus?: ATSApplicationStatus | string;
  note?: string;
  performedBy: string;
  timestamp: Date;
}
~~~

### 6.14 Notification preferences

Collection: notificationSettings. Document ID: uid.

~~~ts
interface NotificationSettings {
  newJobsMatching: boolean;
  applicationUpdates: boolean;
  weeklyDigest: boolean;
  savedFilterAlerts: boolean;
  companyUpdates: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  updatedAt?: Date;
}
~~~

These preferences do not cause notifications; no delivery backend consumes them.

## 7. Authentication request handling

### 7.1 Auth initialization

Request: register a Firebase onAuthStateChanged listener.

Handling:

1. Mark authentication initializing.
2. If Firebase user is null, set app user null and initialized true.
3. If Firebase user exists, read users/{uid}.
4. Set raw Firebase user and application User document.
5. If the user document cannot be loaded, show an authentication/profile initialization error; do not invent a user in UI state.
6. Unsubscribe on application teardown.

### 7.2 First-user document creation

After successful social/custom-token sign-in, read users/{uid}. If absent, create:

~~~json
{
  "uid": "firebase-uid",
  "email": "provider email or empty string",
  "displayName": "provider name or email local-part or empty string",
  "isPremium": false,
  "role": "user",
  "viewedVacancies": [],
  "savedVacancies": [],
  "createdAt": "server timestamp"
}
~~~

Include photoURL only when provider supplies it.

### 7.3 Google sign-in

Web request: Firebase signInWithPopup with GoogleAuthProvider.

Native request:

1. Require EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.
2. Build redirect URI with scheme dearcompany and path auth.
3. Request openid, profile, email and ID-token response.
4. Exchange returned id_token through GoogleAuthProvider.credential.
5. Call Firebase signInWithCredential.
6. Load/create user document.

Handle cancel separately from failure.

### 7.4 Apple sign-in

Web: Firebase popup with OAuthProvider apple.com, scopes email and name.

Native:

1. Request FULL_NAME and EMAIL through native Apple sign-in.
2. Require identityToken.
3. Create Apple OAuth credential.
4. Firebase signInWithCredential.
5. Load/create user document.

Treat ERR_REQUEST_CANCELED as user cancellation.

### 7.5 Callable: sendEmailOTP

Authentication: not required.

Request:

~~~json
{ "email": "person@example.com" }
~~~

Validation:

- Required string.
- Trim and lowercase.
- Must match basic non-space local@domain.tld pattern.

Backend effects:

- Code is always 123456.
- Expiry is current epoch milliseconds + 600000.
- Document ID is base64(normalized email) with slash, plus, equals replaced by underscore.
- Overwrite otpCodes/{documentId} with email, code, expiresAt, attempts=0, createdAt server timestamp.
- Log the code.

Success:

~~~json
{ "success": true }
~~~

Errors:

- invalid-argument: missing or invalid email.
- internal/platform error: storage failure.

Production UI: hidden because no email is sent.

### 7.6 Callable: verifyEmailOTP

Authentication: not required.

Request:

~~~json
{ "email": "person@example.com", "code": "123456" }
~~~

Handling:

1. Require email and code.
2. Normalize email and derive document ID.
3. Read OTP.
4. If absent: not-found.
5. If expired: delete OTP; deadline-exceeded.
6. If attempts >=5: delete OTP; resource-exhausted.
7. If mismatch: increment attempts; permission-denied.
8. On match: delete OTP.
9. Find Firebase Auth user by email; create verified-email user if absent.
10. Ensure default Firestore user document exists.
11. Create Firebase custom token.

Success:

~~~json
{
  "token": "firebase-custom-token",
  "isNewUser": true
}
~~~

Client then calls Firebase signInWithCustomToken and loads/creates the application user.

### 7.7 Sign-out

Call Firebase signOut, clear application user/raw Firebase user, and route to login or public home. Always clear submitting state. Demo sign-out removes the local session key instead.

### 7.8 Demo authentication contract

Demo mode is enabled when explicitly configured, or when Firebase API key/project ID are missing and demo mode is not explicitly disabled.

Storage key: @dear-company/demo-auth-session.

Behavior:

- Demo send-code resolves without a backend request.
- Demo verify accepts any value matching exactly six digits.
- Invalid demo code throws “Enter any 6 digits in demo mode.”
- Google/Apple demo actions sign in without provider requests.
- Email is trimmed and lowercased; empty email falls back to demo@dearcompany.app.
- Display name is derived from email local-part, replacing dots, underscores, and hyphens with spaces.
- Sign-out removes the storage key.

Demo user:

~~~json
{
  "uid": "demo-user",
  "email": "selected email",
  "displayName": "derived name or Demo User",
  "isPremium": true,
  "role": "admin",
  "isRecruiter": true,
  "viewedVacancies": [],
  "savedVacancies": [],
  "createdAt": "current client date"
}
~~~

This session does not emulate Firestore, Storage, callable functions, or webhooks. Disable mutation controls or connect a separate demo data adapter; never let the UI imply demo mutations reached production.

## 8. Vacancy API and business rules

### 8.1 Production Firestore list request

Collection: vacancies.

Base query:

- orderBy createdAt descending.
- limit pageSize*2, where default pageSize=20.
- startAfter last document when cursor exists.

Server-side constraints when selected:

- workFormat in selected values, only for include mode.
- employmentType in selected values, only for include mode.
- grade in selected values, only for include mode.
- relocation == selected boolean when non-null.
- language in selected values, only for include mode.

Then apply client-side rules and return at most pageSize records.

Response:

~~~ts
{
  vacancies: Vacancy[];
  lastDoc: FirestoreDocumentSnapshot | null;
  hasMore: boolean;
}
~~~

Caveat: existing semantics calculate hasMore from filtered results and cursor from the raw snapshot. Preserve only if compatibility is essential; do not expose broken paging controls.

### 8.2 Filter algorithm

For each vacancy, reject it when:

1. hideViewed and vacancy ID is in viewed IDs.
2. skills selected and:
   - include: no selected skill is a case-insensitive substring of any vacancy skill;
   - exclude: any selected skill is a substring match.
3. specializations/industries/countries selected and exact membership fails include or matches exclude.
4. company type selected and vacancy has a companyType, then membership fails include or matches exclude.
5. English selected and vacancy has englishLevel, then membership fails include or matches exclude.
6. Currency selected and salary exists, then membership fails include or matches exclude.
7. minSalary is truthy and salary exists, and salary.max or salary.min or 0 is below minimum.
8. search is nonempty and its lowercase substring occurs in none of title, company, description, or skills.
9. work/employment/grade exclusion contains the vacancy value.

Missing company type, English, or salary values pass their filters. skillsMatchAll, regions, onlyNew, and language exclusion have no effect.

### 8.3 Get one vacancy

Request: Firestore getDoc vacancies/{vacancyId}.

Response: mapped Vacancy or null if absent.

Default mapping:

- companyHidden/relocation false.
- array fields [].
- language ru when absent.
- timestamps current date when absent.

### 8.4 Mark viewed

Precondition: authenticated user.

Mutation:

~~~ts
updateDoc(users/{uid}, {
  viewedVacancies: arrayUnion(vacancyId)
})
~~~

After success, update local user state without duplicate IDs. Failure may be logged/non-blocking; detail can still display.

### 8.5 Toggle catalogue bookmark

Precondition: authenticated user.

If saved:

~~~ts
updateDoc(users/{uid}, {
  savedVacancies: arrayRemove(vacancyId)
})
~~~

If not saved:

~~~ts
updateDoc(users/{uid}, {
  savedVacancies: arrayUnion(vacancyId)
})
~~~

Update local user only after success. Unauthenticated action routes to login.

### 8.6 Apply and share

Apply does not write backend data. Open vacancy.applyUrl externally. A source control may open source when it is an HTTP URL, t.me, or tg link; otherwise use applyUrl.

Web share copies title/company/apply URL. Native uses platform share. Show copy/open failure.

## 9. Saved-search requests

### 9.1 List

Query savedFilters where userId == uid. No server ordering.

Response: SavedFilter[] with timestamps converted.

### 9.2 Create

Preconditions: authenticated; nonempty trimmed name.

Request document:

~~~json
{
  "userId": "uid",
  "name": "Remote frontend",
  "filters": "complete FilterState object",
  "notificationsEnabled": false,
  "createdAt": "server timestamp"
}
~~~

Return created object with generated ID. For new UI, force notificationsEnabled=false or omit the alert control because delivery is absent.

### 9.3 Apply

Replace current in-memory FilterState with the stored filters and navigate to vacancy results. Do not mutate backend.

### 9.4 Delete

Delete savedFilters/{filterId}. Confirm first. Firestore rules require stored userId to match current UID.

### 9.5 Update alert preference

A backend mutation exists:

~~~ts
updateDoc(savedFilters/{filterId}, {
  notificationsEnabled: boolean
})
~~~

Do not expose it until an actual delivery system exists.

## 10. Response tracker requests and calculations

### 10.1 List

Query responses:

- where userId == uid.
- orderBy createdAt descending.

Then client-filter:

- search: case-insensitive substring in company or position.
- statuses: include exact status if selection nonempty.
- dateFrom: appliedAt >= dateFrom.
- dateTo: appliedAt <= dateTo.

Response mapping converts dates but intentionally does not expose events/emailThreadIds in current ordinary reads. Therefore history must be hidden.

### 10.2 Create

Preconditions: authenticated; company and position required by UI.

Request fields:

~~~json
{
  "userId": "uid",
  "company": "Example",
  "position": "Engineer",
  "status": "applied",
  "notes": [],
  "appliedAt": "selected Timestamp or server timestamp",
  "createdAt": "server timestamp",
  "updatedAt": "server timestamp",

  "jobUrl": "optional",
  "location": "optional",
  "industry": "optional",
  "contact": {
    "name": "required when contact exists",
    "email": "optional",
    "linkedIn": "optional"
  },
  "followUpDate": "optional Timestamp"
}
~~~

Omit empty optional values and undefined contact properties.

After response creation, attempt:

~~~ts
updateDoc(users/{uid}, {
  'gameStats.points': increment(10)
})
~~~

If nested update fails, attempt to set gameStats={points:10}. This is not transactional and the fallback is not guaranteed to finish before create returns. UI should hide points unless explicitly accepting this limitation.

Response: created JobResponse with generated ID and local current createdAt/updatedAt.

### 10.3 Update

Request: partial mutable fields for responses/{responseId}.

Always set updatedAt=serverTimestamp.

Supported:

- company, position, status, notes.
- jobUrl/location/industry: value or null to clear.
- contact: cleaned object when name exists; null to clear.
- followUpDate: Timestamp or null.
- appliedAt: Timestamp; if explicitly provided as falsey, existing behavior uses server timestamp.

Do not change id, userId, or createdAt.

Manual status update is unrestricted and does not create a history event.

### 10.4 Add note

Read response, obtain notes or [], then update notes=[...existing,note] and updatedAt.

This is a non-transactional read-modify-write and can lose concurrent notes. It does not add a note event.

### 10.5 Delete

Delete responses/{responseId}. Do not subtract points. Confirm first.

### 10.6 Statistics

For all user responses:

~~~text
total = count(all)
applied = count(status != to_apply)
interviews = count(status in round_1, final, offer)
offers = count(status == offer)
rejected = count(status == rejected)
noAnswer = count(status == no_answer)
conversionToInterview = applied ? round(interviews/applied*100, 1 decimal) : 0
conversionToOffer = applied ? round(offers/applied*100, 1 decimal) : 0
~~~

### 10.7 Rank

Points thresholds:

- newbie: 0
- active: 50
- pro: 150
- expert: 300
- legend: 500

Current rank is highest reached threshold. Progress is linear between current and next threshold, capped at 100. Legend returns next=null, progress=100, pointsNeeded=0.

### 10.8 Time flags

Overdue: status applied or round_1 and more than 14 exact days since appliedAt.

Follow-up due: followUpDate exists and followUpDate <= current time.

## 11. Manual saved-job requests

### 11.1 List/get

List query savedJobs where userId==uid, orderBy createdAt descending. Get one by ID returns object or null.

### 11.2 Create

Required: authenticated user, trimmed company, trimmed position.

Document:

~~~json
{
  "userId": "uid",
  "company": "Example",
  "position": "Engineer",
  "jobUrl": "optional",
  "location": "optional",
  "industry": "optional",
  "notes": "optional",
  "createdAt": "server timestamp"
}
~~~

### 11.3 Update/delete/search

Update defined mutable fields. Empty optional strings become null. Delete by ID after confirmation. Search fetches all owner jobs then case-insensitive filters company or position.

### 11.4 Convert to response

1. Read saved job; error “Saved job not found” if absent.
2. Create JobResponse:
   - same user/company/position/jobUrl/location/industry;
   - status to_apply unless caller explicitly supplies another status;
   - notes [saved notes] or [];
   - appliedAt current date.
3. Delete saved job.
4. Refresh response list/statistics/game statistics.

Not transactional. If deletion fails after create, both records remain.

## 12. Forwarding address and inbound email

### 12.1 Get/create forwarding address

Precondition: authenticated and users/{uid} exists.

If forwardToken exists, return it and stored forwardEmail, or derive:

~~~text
forward+{token}@{configured-domain}
~~~

Otherwise generate 12 characters from letters/digits excluding ambiguous characters, save forwardToken and forwardEmail, and return both.

Response:

~~~json
{ "token": "AbC234xYz789", "email": "forward+AbC234xYz789@domain" }
~~~

Regenerate always writes a new token/address. Generation uses Math.random and does not check uniqueness.

An existing-only read operation returns null when the user document is absent, has no forwardToken, or the read fails. Use get/create when the user intentionally opens forwarding setup; use existing-only read when the UI must not create an address as a side effect.

### 12.2 Inbound webhook request

Method: POST only. Authentication/signature: none.

~~~json
{
  "from": "Recruiter <jobs@example.com>",
  "to": "forward+AbC234xYz789@forward.dearcompany.app",
  "subject": "Interview invitation",
  "text": "We would like to schedule...",
  "html": "<p>We would like to schedule...</p>",
  "headers": { "message-id": "<unique@example.com>" },
  "attachments": [{
    "filename": "invite.pdf",
    "content": "base64",
    "contentType": "application/pdf"
  }]
}
~~~

Attachments are ignored.

### 12.3 Processing

1. Reject non-POST with 405.
2. Extract alphanumeric token using forward+TOKEN@.
3. Invalid recipient -> 400.
4. Query users where forwardToken==token, limit 1.
5. No user -> 404.
6. Extract Message-ID from message-id, Message-ID, or Message-Id.
7. If message ID exists, query responses where userId==uid and emailThreadIds array-contains ID, limit 1.
8. Duplicate -> 200 duplicate response.
9. Parse email with OpenAI.
10. Match an existing response.
11. Update or create.

### 12.4 AI parse contract

Prompt asks for:

~~~json
{
  "company": "required",
  "position": "string or null",
  "status": "applied|round_1|final|offer|rejected|no_answer|needs_review",
  "confidence": 0,
  "reasoning": "optional"
}
~~~

Model: gpt-4o-mini, JSON object response, temperature 0.2, max 500 tokens.

Input includes subject, from, and text; if text absent, stripped HTML truncated to 5,000 chars.

Normalization:

- Missing company -> derive first sender-domain label with initial capital, else Unknown Company.
- Invalid status -> needs_review.
- Confidence clamp 0-100; fallback 50 when falsey.
- Parser failure -> derived company, null position, needs_review, confidence 10.

### 12.5 Match algorithm

Fetch all responses for user.

For every response:

1. Normalize company: lowercase, remove common suffix, remove non-alphanumeric.
2. Calculate Levenshtein similarity; containment uses shorter/longer length.
3. If company similarity >0.7, add similarity*50 and set company-domain match type.
4. If position exists and normalized similarity >0.6, add similarity*30 and set company-position type.
5. If sender-domain/company similarity >0.5, add 20.
6. Highest score wins.
7. Score >=50 means existing; otherwise create.

Thread IDs are only used for exact duplicate detection, not matching.

### 12.6 Automatic status rule

Priority:

~~~text
to_apply 0
applied 1
no_answer 2
needs_review 3
round_1 4
final 5
rejected 6
offer 7
~~~

- offer cannot be overwritten.
- rejected may replace any non-offer status.
- Other new statuses replace only when strictly higher.

### 12.7 Existing response update

Append event with generated evt_timestamp_random ID, email metadata, previous/new status, source=email, and current Timestamp.

Always update updatedAt. Append message ID if present.

If status allowed, set status and event type status_change. Otherwise keep status and event type email_received.

Response:

~~~json
{
  "status": "updated",
  "responseId": "id",
  "statusUpdated": true
}
~~~

### 12.8 New response

Create:

~~~json
{
  "userId": "uid",
  "company": "parsed company",
  "position": "parsed position or Unknown Position",
  "status": "parsed status",
  "notes": [],
  "events": ["created email event"],
  "emailThreadIds": ["message ID if present"],
  "appliedAt": "server timestamp",
  "createdAt": "server timestamp",
  "updatedAt": "server timestamp"
}
~~~

No game points.

Response: HTTP 201:

~~~json
{ "status": "created", "responseId": "id" }
~~~

Other responses:

~~~json
{ "status": "duplicate", "message": "Email already processed" }
{ "error": "Invalid recipient address" }
{ "error": "User not found" }
{ "error": "Method not allowed" }
{ "error": "Internal server error" }
~~~

Security limitation: token knowledge is sufficient to trigger processing. Only expose after webhook authentication, domain routing, indexes, and OpenAI key are verified.

## 13. Resume requests

### 13.1 Read/save

Read resumes/{uid}. Missing -> empty default form. Normalize string skills by comma splitting/trimming.

Save with setDoc merge:

~~~ts
setDoc(resumes/{uid}, {
  ...resume,
  updatedAt: serverTimestamp()
}, { merge: true })
~~~

Firestore rules require owner.

### 13.2 Callable: parseResumeCv

Authentication: required.

Request:

~~~json
{
  "fileBase64": "JVBERi0x...",
  "fileName": "resume.pdf"
}
~~~

Validation:

- context.auth required -> unauthenticated.
- fileBase64 required string -> invalid-argument.
- fileName required string -> invalid-argument.
- extension pdf/docx only -> invalid-argument.

Processing:

- Decode base64 to memory.
- PDF via PDF text parser; DOCX via raw-text extraction.
- Extracted trimmed text must be at least 20 characters.
- Truncate to 12,000 characters.
- OpenAI gpt-4o-mini, temperature 0.1, max 4,000 tokens.
- Parse JSON, stripping optional markdown fences.
- Normalize all scalar fields to empty strings and arrays to empty arrays.

Success:

~~~json
{
  "success": true,
  "fileName": "resume.pdf",
  "data": {
    "fullName": "",
    "jobTitle": "",
    "location": "",
    "phone": "",
    "email": "",
    "linkedIn": "",
    "portfolio": "",
    "summary": "",
    "skills": "TypeScript, React",
    "experience": [{
      "company": "",
      "position": "",
      "startDate": "MM/YYYY",
      "endDate": "Current",
      "description": "• achievement"
    }],
    "education": [{
      "institution": "",
      "degree": "",
      "field": "",
      "startYear": "YYYY",
      "endYear": "YYYY"
    }],
    "languages": [{ "language": "", "level": "" }]
  }
}
~~~

Other errors -> internal with message “Failed to parse resume: ...”. Function timeout 120 seconds and memory 512 MB. No explicit file-size limit. It does not upload the original file.

Client handling:

1. Pick PDF/DOCX.
2. Read full file as base64.
3. Call function with 120-second client timeout.
4. Convert skills string to array.
5. Add client IDs to experience/education/languages.
6. Replace current form and immediately save.
7. Highlight missing required fields.
8. On failure, switch to manual form prefilled from user name/email.

### 13.3 DOCX export

Generate client-side from current unsaved/saved form. Web downloads {Full_Name}_CV.docx. Native writes a temporary base64 file and opens share sheet. Handle generation/share failure.

## 14. Career Hub requests

### 14.1 List/detail

List: careerHub ordered by order ascending. Detail: get careerHub/{sectionId}. Missing returns null.

Public UI opens link/file URLs externally and handles failure.

### 14.2 Admin update

Partial update supports title, description, icon, order, complete links array, or complete files array.

Adding/editing/deleting a link is a read/local-array-transform followed by updating the entire links array. Concurrent edits can overwrite each other.

### 14.3 Seed

Known section IDs:

- self-discovery
- development
- mental-support
- salary-insights
- job-search-strategy

For each, create predefined content only if absent. Return count created. File upload does not exist.

Predefined section purpose and order:

| ID | Order | Title | Content purpose |
|---|---:|---|---|
| self-discovery | 0 | Self-Discovery | Personality, strengths, Ikigai, Holland Code, character-strength resources |
| development | 1 | Development | Courses, coding practice, learning roadmaps, free education |
| mental-support | 2 | Mental Support | Therapy, meditation, burnout, and relaxation resources |
| salary-insights | 3 | Salary Insights | Compensation data, salary comparison, and negotiation research |
| job-search-strategy | 4 | Job Search Strategy | LinkedIn, STAR interviews, negotiation, interview preparation, resume feedback |

Seed is idempotent per document ID: it never overwrites an existing section, even if existing content is incomplete.

## 15. Profile, avatar, theme, and notification helpers

### 15.1 Profile update

Input:

~~~ts
{ displayName?: string; photoURL?: string }
~~~

Update users/{uid} defined fields, then update current Firebase Auth profile. If Firestore succeeds and Auth update fails, data can temporarily differ; show failure and reload authoritative data.

### 15.2 Avatar upload

1. Request media-library permission.
2. Pick an image.
3. Fetch local URI as blob.
4. Upload bytes to Firebase Storage path avatars/{uid}.
5. Get download URL.
6. Update user profile photoURL.

Storage authorization must be deployed separately and verified.

### 15.3 Theme

State is boolean isDark. Web persists:

~~~json
{ "state": { "isDark": true } }
~~~

under localStorage key theme-storage. Native persistence is absent.

### 15.4 Push/local notification helper contracts

Available primitives:

- Request device permission.
- Android channel “default,” maximum importance and vibration.
- Get Expo push token using EXPO_PUBLIC_PROJECT_ID.
- Save users/{uid}.pushToken and pushTokenUpdatedAt.
- Schedule a local notification with title/body/data/optional trigger.
- Cancel one/all local notifications.
- Get/set badge count.
- Register received/response listeners.

No server sender uses the token or preferences. Hide delivery UI.

### 15.5 Notification preference persistence

Although the UI must remain hidden, the data contract is:

Default local values:

~~~json
{
  "newJobsMatching": true,
  "applicationUpdates": true,
  "weeklyDigest": true,
  "savedFilterAlerts": true,
  "companyUpdates": false,
  "emailNotifications": true,
  "pushNotifications": true
}
~~~

Read notificationSettings/{uid}. If absent, use defaults. If present, merge stored fields over defaults.

Toggle behavior is optimistic:

1. Flip one boolean locally.
2. setDoc notificationSettings/{uid} with the full new settings plus updatedAt=serverTimestamp and merge=true.
3. On failure, restore the prior settings and report the error.

This only persists preferences. It does not schedule or send anything.

### 15.6 Premium field mutation

An administrative/client helper can update:

~~~ts
updateDoc(users/{uid}, {
  isPremium: boolean,
  premiumUntil: DateOrTimestampOrNull
})
~~~

This is not a purchase or entitlement-verification endpoint. Never call it from a checkout button. Billing, receipts, server verification, renewals, and restore purchase do not exist.

## 16. Recruiter company and invitation requests

### 16.1 Recruiter activation

Precondition: authenticated.

~~~ts
updateDoc(users/{uid}, { isRecruiter: true })
~~~

Update local user and route to company onboarding. Recruiter access is role recruiter/admin or isRecruiter true.

### 16.2 List/get company

List query companies where recruiterId==uid, then sort name locale ascending client-side. Get by ID returns company or null.

### 16.3 Create company

UI minimum:

- name required.
- onboarding also requires website.
- optional description, industry, size, logo URL, country.

Document:

~~~json
{
  "name": "Company",
  "recruiterId": "uid",
  "isVerified": false,
  "description": "optional",
  "industry": "optional",
  "size": "optional enum",
  "website": "optional",
  "country": "optional",
  "logo": "optional URL",
  "createdAt": "server timestamp",
  "updatedAt": "server timestamp"
}
~~~

Return object with generated ID. No logo upload.

### 16.4 Update/delete company

Update defined name/profile fields and updatedAt. Empty optional strings become null. General profile update does not change recruiterId or verification fields.

Delete only companies/{companyId}. No cascade.

### 16.5 Company verification

Hide in production.

Domain validation:

- Add https:// if website lacks scheme.
- Parse hostname and remove www.
- Compare lowercase email domain for exact equality.
- Subdomains do not match parent domains unless identical.

Send mock OTP:

~~~json
{
  "companyId": "id",
  "email": "person@company.com",
  "otpCode": "123456",
  "expiresAt": "Timestamp now+10 minutes",
  "used": false,
  "createdAt": "server timestamp"
}
~~~

Verify queries all verification records for company, client-filters matching lowercase email and used=false, sorts newest, checks expiry and code, sets used=true, then updates company isVerified, verifiedEmail, verifiedAt, updatedAt. No attempt/rate limit and no email.

### 16.6 Members

List all documents in companies/{companyId}/members.

Add creator:

~~~json
{
  "email": "creator email",
  "role": "superadmin",
  "status": "active",
  "invitedBy": "creator uid",
  "userId": "creator uid",
  "joinedAt": "server timestamp",
  "createdAt": "server timestamp"
}
~~~

Remove deletes member. Role update allows admin or member.

### 16.7 Invite

Generate 24-character token excluding ambiguous characters.

Create pending member:

~~~json
{
  "email": "invitee@example.com",
  "role": "admin|member",
  "status": "pending",
  "invitedBy": "uid",
  "createdAt": "server timestamp"
}
~~~

Create companyInvites document:

~~~json
{
  "companyId": "id",
  "email": "invitee@example.com",
  "role": "admin|member",
  "token": "generated",
  "invitedBy": "uid",
  "status": "pending",
  "createdAt": "server timestamp"
}
~~~

Return invite including generated ID. UI builds /recruiter/invite/{token} against its public origin and offers copy/share. Do not claim email delivery.

Lookup query: token==value and status==pending; use first or null.

Accept:

1. Require authenticated user.
2. Update invite status accepted.
3. Query company members where email==provided email and status==pending.
4. Update first match status active, userId, joinedAt.

No enforcement verifies current authenticated email equals invite email. Writes are non-transactional.

## 17. Recruiter job requests

### 17.1 List/get

List recruiter jobs where recruiterId==uid, or where companyId==selected company. Sort createdAt descending client-side. Get by ID returns job or null.

### 17.2 Create

UI requires trimmed title, description, companyId.

Document:

~~~json
{
  "companyId": "id",
  "recruiterId": "uid",
  "title": "Engineer",
  "description": "...",
  "skills": [],
  "status": "draft|published",
  "applicationsCount": 0,
  "customStatuses": [],
  "location": "optional",
  "salaryMin": 100000,
  "salaryMax": 150000,
  "salaryCurrency": "USD",
  "seniority": "optional enum",
  "workFormat": "optional enum",
  "employmentType": "optional enum",
  "createdAt": "server timestamp",
  "updatedAt": "server timestamp"
}
~~~

Salary text is converted with Number. Skills are comma-split/trimmed/nonempty.

### 17.3 Update/status/delete

Update defined fields among title, description, location, salary values/currency, skills, seniority, formats, status, companyId, customStatuses; set updatedAt.

Publish -> status published. Close -> status closed.

Delete only recruiterVacancies/{jobId}; no cascade. Publication never creates/updates a public vacancy.

## 18. Candidate requests and filtering

### 18.1 List

Query candidates where addedBy==uid. Sort createdAt descending client-side.

Filter in order:

- search lower substring in name, email, or jobTitle.
- jobTitle lower substring.
- country lower substring.
- city lower substring.
- seniority exact membership.
- source exact equality.
- tags: include candidate if any selected tag exactly appears.
- yearsOfExperience >= min and <= max; missing value fails an active range.
- salaryExpectation >= min and <= max; missing value fails an active range.

### 18.2 Create

UI requires trimmed name. Document always includes name, tags or [], addedBy=uid, createdAt, updatedAt. Add each optional field only when present; numeric zero is preserved.

Return generated object.

### 18.3 Update/delete

Update defined supported fields and updatedAt. Explicit null clears. Delete candidate only; no linked-application cascade. Candidate resumeUrl is only a URL string.

## 19. ATS application requests and dashboard

### 19.1 Queries

- By job: applications where jobId==id.
- By candidate: applications where candidateId==id.
- By recruiter: applications where recruiterId==uid.

All sort createdAt descending client-side.

### 19.2 Add candidate to job

Document:

~~~json
{
  "candidateId": "id",
  "jobId": "id",
  "status": "provided or applied",
  "recruiterId": "uid",
  "customStatuses": [],
  "notes": "optional",
  "createdAt": "server timestamp",
  "updatedAt": "server timestamp"
}
~~~

After create:

1. Best-effort increment recruiterVacancies/{jobId}.applicationsCount by 1.
2. Create applicationEvents document:
   - applicationId
   - type created
   - newStatus
   - performedBy recruiter UID
   - timestamp server timestamp.

No duplicate candidate/job constraint. Side effects are non-transactional.

### 19.3 Move status

1. Read application; absent -> “Application not found.”
2. Capture previousStatus.
3. Update status to any supplied built-in or custom string and updatedAt.
4. Add status_change event with previous/new/actor/timestamp.

There are no permitted-transition rules.

### 19.4 Notes/delete/events

Notes update writes notes and updatedAt, no event.

Delete application then best-effort decrements job count. It does not delete history and does not protect count from negative values.

Events query applicationEvents where applicationId==id, then sort timestamp descending client-side.

### 19.5 Dashboard formulas

~~~text
totalCandidates = candidates.length
totalJobs = jobs.length
activeJobs = count(job.status == published)
totalApplications = applications.length
inInterview = count(status == interview_scheduled or interview)
offers = count(status == offer)
rejected = count(status == rejected)
offerAccepted = count(status == offer_accepted)
~~~

### 19.6 Administrative vacancy operations

These are admin/developer operations and should not appear in the normal new UI.

Add one vacancy:

- Input: complete Vacancy excluding id.
- Generate Firestore document ID.
- Convert provided createdAt and updatedAt Date values to Timestamp.
- Write to vacancies.
- Return generated document ID.

Seed vacancy array:

1. Start one Firestore write batch.
2. Generate a new document ID for each input vacancy; incoming IDs are not reused.
3. Write normalized fields, defaulting boolean/array fields and writing null for absent salary, English level, or company type.
4. Commit once.
5. Return number written.

The operation does not chunk. A single Firestore batch has platform operation limits, so large arrays fail.

Count vacancies: read the complete vacancies collection and return snapshot size. On error, existing behavior returns 0.

Clear vacancies:

1. Read the complete collection.
2. Add every delete to one batch.
3. Commit once.
4. Return deleted document count.

This does not chunk and is irreversible. Require admin role and an explicit confirmation. These operations affect Firestore vacancies only; they do not alter a bundled demo catalogue.

### 19.7 Health endpoint

The HTTP health endpoint currently accepts any method and returns HTTP 200:

~~~json
{
  "status": "ok",
  "timestamp": "current ISO-8601 timestamp"
}
~~~

Use it only for deployment monitoring. It does not verify Firestore, Auth, Storage, OpenAI, email routing, or downstream readiness.

## 20. Firestore authorization contract

The new UI must add route/navigation guards, but Firestore rules remain the actual security boundary.

| Path | Read | Create/update/delete |
|---|---|---|
| users/{uid} | owner or admin | owner create/update; admin update/delete |
| vacancies/{id} | public | recruiter create/update; admin delete |
| savedFilters/{id} | owner by userId | owner CRUD |
| responses/{id} | owner by userId | owner CRUD |
| savedJobs/{id} | owner by userId | owner CRUD |
| recruiterVacancies/{id} | creating recruiter | recruiter create; creator update/delete |
| companies/{id} | any recruiter | recruiter create; creator update/delete |
| companies/{id}/members/{id} | any recruiter | any recruiter CRUD |
| companyInvites/{id} | any authenticated user | recruiter create; any authenticated update; no delete |
| candidates/{id} | any recruiter | recruiter create; creator update/delete |
| applications/{id} | owner user or any recruiter | authenticated create; owner/any recruiter update; recruiter/admin delete |
| applicationEvents/{id} | any recruiter | any recruiter create; no delete |
| companyVerifications/{id} | any recruiter | any recruiter create/update; no delete |
| resumes/{uid} | owner | owner CRUD |
| careerHub/{id} | public | admin only |
| otpCodes/{id} | denied to clients | server only |
| notificationSettings/{uid} | owner | owner CRUD |

Security limitations the UI must not misrepresent:

- Recruiters have broad cross-company read/write access in multiple collections.
- Vacancy update is not creator-scoped.
- Create rules often do not validate schema or owner fields.
- Applications receive additive permission from overlapping rules.
- Company verification OTP is readable to recruiters.
- Webhook uses Admin privileges and bypasses these rules.

## 21. Required composite indexes

The deployed backend expects these compound indexes:

- responses: userId ascending + createdAt descending.
- responses: userId ascending + emailThreadIds array-contains.
- savedJobs: userId ascending + createdAt descending.
- recruiterVacancies: recruiterId ascending + createdAt descending.
- applications: recruiterId ascending + createdAt descending.
- candidates: addedBy ascending + createdAt descending.
- companies: recruiterId ascending + name ascending.

Some current queries sort client-side, but keep indexes available for compatibility.

## 22. UI route and access behavior

Suggested route mapping may use the new UI framework’s conventions, but behavior must remain:

| Experience | Access |
|---|---|
| Vacancy list/detail, Career Hub | Public |
| Login | Public, redirect authenticated users appropriately |
| Saved searches, responses, resume, profile mutation | Authenticated |
| Forwarding address | Authenticated |
| Recruiter activation | Authenticated |
| Recruiter dashboard/company/job/candidate/application | Recruiter/admin/isRecruiter |
| Invite acceptance | Authenticated; show login before accept |
| Admin tools/Career Hub editor | role admin only |
| Unsupported routes | Do not register or navigate to them |

If a private deep link is opened while logged out, retain the intended destination when practical and resume after authentication.

## 23. Loading, failure, and interaction standards

Every integrated workflow must implement:

- Initial skeleton/spinner without showing false empty state.
- Empty state only after successful empty response.
- Not-found state for missing document.
- Inline validation before network calls.
- Disabled submit during request.
- Safe retry for reads.
- Visible save/error outcome for mutations.
- Confirmation before delete.
- Platform-safe external linking.
- Accessible focus movement for OTP/modals/forms.
- Keyboard-safe mobile forms and safe areas.
- Cleanup for auth/listener/timer subscriptions.
- No sensitive token, OTP, email body, or API key logging in the new client.
- No claim of success until all required writes resolve.
- Honest warning when a known multi-write operation partially completes.

For multi-write non-transactional flows, a refresh is authoritative after failure.

## 24. Features to remove from the new UI

Remove from all navigation, desktop/mobile layouts, overflow menus, cards, modals, empty states, and deep links:

- Subscription purchase, restore, pricing checkout, billing portal, invoices, coupons, trials.
- Resume roast, scoring, rewrite, examples, history.
- AI vacancy search branding.
- Salary/relevance sort and time-range controls.
- Current fake pagination/infinite-scroll controls.
- Disconnected searchQuery search.
- Regions, onlyNew, skills AND, language-exclusion controls.
- Saved-search alert toggles and monitoring promises.
- Notification preference route and all server notification promises.
- Production email OTP and company OTP.
- Career Hub file upload.
- Candidate resume upload/parsing.
- Application history/timeline.
- Invitation-email success copy.
- Public listing claims for recruiter jobs.
- Unverified custom workflow editor.
- Chat, internal messaging, calendar sync, interview scheduling, assessments, automation rules, bulk operations, CSV import/export, recommendations, match scores, or analytics beyond exact documented calculations.

Do not leave clickable “coming soon” controls unless explicitly requested as marketing. Preserve no-backend domain data for future work, but hide the presentation.

## 25. Completion checklist

- Firebase is initialized once with the documented environment.
- Auth restoration and user-document loading work.
- All private routes are guarded.
- Every visible control maps to a documented request.
- Every schema uses exact persisted names/enums.
- No user.id usage exists; use uid.
- Unsupported capabilities are absent at every breakpoint.
- Mock vacancies are visibly demo-only or removed.
- External apply is labeled as external.
- Saved searches make no alert promise.
- Response statistics match formulas.
- Resume parsing request/response and fallback work.
- Recruiter publication remains separate from public vacancies.
- Invite UI copies/shares a link and does not claim email delivery.
- Admin navigation is role-gated.
- Typecheck, lint, tests, and production build pass.
- Critical flows are manually exercised with success, failure, empty, and unauthorized cases.

## 26. Deployment dependencies that must be verified externally

The specification defines behavior but cannot guarantee deployment state. Before production exposure verify:

- Firebase Auth Google/Apple provider configuration.
- Firebase client environment values.
- Firestore rules and compound indexes deployed.
- Storage bucket and avatar authorization.
- Callable functions deployed in the region used by the client.
- OPENAI_API_KEY present server-side.
- Forwarding domain DNS/email-provider routing.
- Inbound webhook URL configured.
- Webhook signature protection added or risk explicitly accepted.
- Demo authentication disabled.
- Mock vacancy catalogue replaced by a verified live source if production vacancies are required.
