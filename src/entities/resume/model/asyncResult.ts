/**
 * Pure helpers for the async AI flows (spec §0.2).
 *
 * Verified against the backend tasks: terminal frames arrive as `success`
 * (resume parsing, AI job creation) or `message` (assessment, recommendations,
 * resume/cover-letter generation) and carry `status: success|completed|ready`;
 * `warning` and `status: profile_created` are intermediate; `error` frames and
 * `status: error|failed` are failures. Payload bodies are still narrowed
 * defensively from `unknown`.
 */

export type TaskEvent =
  | { kind: 'progress'; message: string | null }
  | { kind: 'done'; result: unknown }
  | { kind: 'error'; message: string };

const PENDING = new Set([
  'pending', 'processing', 'started', 'in_progress', 'running', 'queued',
  // intermediate frames the resume-parsing task emits before the result
  'profile_created', 'warning',
]);
const FAILED = new Set(['failed', 'failure', 'error']);

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null;
}

/**
 * Classify one SSE frame as progress, final result or failure.
 * `event` is the SSE event name, which the backend varies per flow.
 */
export function classifyTaskEvent(data: unknown, event?: string): TaskEvent {
  if (event === 'error') {
    const message = isRecord(data) ? (str(data.message) ?? str(data.detail)) : str(data);
    return { kind: 'error', message: message ?? 'the task failed' };
  }
  if (event === 'warning') {
    return { kind: 'progress', message: isRecord(data) ? str(data.message) : str(data) };
  }
  if (!isRecord(data)) {
    if (typeof data === 'string') {
      const s = data.trim().toLowerCase();
      if (FAILED.has(s)) return { kind: 'error', message: data };
      if (PENDING.has(s) || s === '' || s === 'keepalive' || s === 'ping') return { kind: 'progress', message: null };
    }
    return { kind: 'done', result: data };
  }
  const status = str(data.status)?.toLowerCase() ?? str(data.state)?.toLowerCase();
  const errMsg = str(data.error) ?? (data.success === false ? str(data.message) : null);
  if (errMsg) return { kind: 'error', message: errMsg };
  if (status && FAILED.has(status)) {
    return { kind: 'error', message: str(data.message) ?? str(data.detail) ?? 'the task failed' };
  }
  if (status && PENDING.has(status)) {
    return { kind: 'progress', message: str(data.message) ?? str(data.progress) ?? null };
  }
  // Unwrap the common envelopes; otherwise the whole object is the result.
  for (const key of ['assessment_results', 'result', 'results', 'data', 'recommendations']) {
    if (key in data && data[key] != null) return { kind: 'done', result: data[key] };
  }
  return { kind: 'done', result: data };
}

/** A generic, renderable view of an opaque AI result. */
export interface ResultBlock {
  key: string;
  title: string;
  /** plain paragraph */
  text?: string;
  /** bullet list */
  items?: string[];
  /** nested blocks (objects / arrays of objects) */
  children?: ResultBlock[];
}

export interface ResultSummary {
  /** first numeric field that looks like a score (0–100) */
  score: number | null;
  /** first short string that looks like a headline */
  headline: string | null;
  blocks: ResultBlock[];
}

const SCORE_KEYS = /score|rating|grade|percent/i;
const HEADLINE_KEYS = /verdict|summary|headline|title|overall/i;

export function humanizeKey(key: string): string {
  return key.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().trim();
}

function scalar(v: unknown): string | null {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return null;
}

function toBlocks(value: unknown, depth: number): ResultBlock[] {
  if (depth > 4 || !isRecord(value)) return [];
  const out: ResultBlock[] = [];
  for (const [key, v] of Object.entries(value)) {
    if (v == null || v === '') continue;
    const title = humanizeKey(key);
    const s = scalar(v);
    if (s != null) {
      out.push({ key, title, text: s });
      continue;
    }
    if (Array.isArray(v)) {
      const strings = v.map(scalar).filter((x): x is string => x != null);
      if (strings.length === v.length) {
        if (strings.length) out.push({ key, title, items: strings });
      } else {
        const children = v.flatMap((item, i) =>
          isRecord(item)
            ? [{ key: `${key}.${i}`, title: str(item.title) ?? str(item.name) ?? str(item.criterion) ?? `${title} ${i + 1}`, children: toBlocks(item, depth + 1) }]
            : [],
        );
        if (children.length) out.push({ key, title, children });
      }
      continue;
    }
    if (isRecord(v)) {
      const children = toBlocks(v, depth + 1);
      if (children.length) out.push({ key, title, children });
    }
  }
  return out;
}

/** Turn an opaque AI result (spec §3.3 `assessment_results`) into labeled blocks. */
export function summarizeResult(result: unknown): ResultSummary {
  if (typeof result === 'string') {
    return { score: null, headline: null, blocks: [{ key: 'text', title: 'result', text: result }] };
  }
  if (!isRecord(result)) return { score: null, headline: null, blocks: [] };
  let score: number | null = null;
  let headline: string | null = null;
  const rest: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(result)) {
    if (score == null && SCORE_KEYS.test(key)) {
      const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
      if (Number.isFinite(n)) {
        score = Math.round(n);
        continue;
      }
    }
    if (headline == null && HEADLINE_KEYS.test(key) && typeof v === 'string' && v.length <= 160) {
      headline = v;
      continue;
    }
    rest[key] = v;
  }
  return { score, headline, blocks: toBlocks(rest, 0) };
}
