import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import {
  allowedCandidateTransitions,
  applicationsApi,
  stageOf,
  type CandidateStatusUpdate,
  type JobSeekerApplication,
  type StageKey,
  type TrackingRow,
} from '@/entities/application';
import { errorMessageFrom, humanize } from '@/shared/api';
import { useBreakpoint } from '@/shared/lib/responsive';
import { useT } from '@/shared/lib/useT';
import { accent, accentInk, danger, link, useTheme, type Palette } from '@/shared/theme';
import { LogoBadge, Txt } from '@/shared/ui';

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }).toLowerCase();
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`.toLowerCase();
}

const LOGO_TONES: (keyof Palette)[][] = [
  ['oc1bg', 'oc1'],
  ['oc2bg', 'oc2'],
  ['oc3bg', 'oc3'],
  ['oc4bg', 'oc4'],
  ['oc5bg', 'oc5'],
];

export function badgeColors(t: Palette, stage: StageKey): { bg: string; color: string } {
  switch (stage) {
    case 'applied':
      return { bg: t.chip, color: t.ink2 };
    case 'reading':
      return { bg: t.oc2bg, color: t.oc2 };
    case 'interview':
      return { bg: t.greenbg, color: t.green };
    case 'offer':
      return { bg: accent, color: accentInk };
    default:
      return { bg: t.chip, color: t.mut };
  }
}

function docTitle(v: string | { title: string } | null, fallback: string): string | null {
  if (!v) return null;
  return typeof v === 'string' ? fallback : v.title;
}

export interface ApplicationCardProps {
  row: JobSeekerApplication;
  onAction: (row: JobSeekerApplication, status: CandidateStatusUpdate) => void;
  busy: boolean;
}

/** Applications card (seeker.html 950–1013), reduced to what the ATS endpoints provide. */
export function ApplicationCard({ row, onAction, busy }: ApplicationCardProps) {
  const t = useTheme();
  const tr = useT();
  const { isMobile } = useBreakpoint();
  const [histOpen, setHistOpen] = useState(false);
  const [hist, setHist] = useState<TrackingRow[] | null>(null);
  const [histLoading, setHistLoading] = useState(false);
  const [histError, setHistError] = useState<string | null>(null);

  const stage = stageOf(row.status);
  const badge = badgeColors(t, stage);
  const company = row.job.organization?.name ?? tr('unknown company');
  const letter = (company.trim()[0] ?? '?').toUpperCase();
  const tone = LOGO_TONES[letter.charCodeAt(0) % LOGO_TONES.length];
  const loc = row.job.job_locations[0];
  const meta = [company, loc?.locality ?? loc?.country ?? null, row.job.work_format ? humanize(String(row.job.work_format)) : null]
    .filter(Boolean)
    .join(' · ');
  const cv = docTitle(row.resume, tr('cv attached'));
  const cover = docTitle(row.cover_letter, tr('cover letter attached'));
  const docsLine = [cv ? `${tr('cv')}: ${cv}` : tr('no cv attached'), cover ? `${tr('letter')}: ${cover}` : tr('no cover letter')].join(' · ');
  const transitions = allowedCandidateTransitions(row.status);

  const loadHistory = async () => {
    setHistLoading(true);
    setHistError(null);
    try {
      setHist(await applicationsApi.getMyTracking(row.id));
    } catch (e) {
      setHistError(errorMessageFrom((e as { payload?: unknown }).payload, (e as Error).message));
    } finally {
      setHistLoading(false);
    }
  };
  const toggleHistory = () => {
    const open = !histOpen;
    setHistOpen(open);
    if (open && hist === null && !histLoading) void loadHistory();
  };

  const actionLabel: Record<CandidateStatusUpdate, string> = {
    withdrawn: tr('withdraw'),
    'offer-accepted': tr('accept offer'),
    'offer-rejected': tr('decline offer'),
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        columnGap: 20,
        rowGap: 14,
        paddingVertical: 20,
        paddingHorizontal: 24,
        backgroundColor: t.card,
        borderRadius: 20,
        marginBottom: 10,
        shadowColor: '#141519',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
      }}
    >
      <LogoBadge letter={letter} bg={t[tone[0]]} color={t[tone[1]]} size={46} radius={14} fontSize={17} />
      <View style={{ flex: 1, minWidth: 240, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Txt size={18} weight="700" ls={-0.02}>
            {row.job.title}
          </Txt>
          <View style={{ backgroundColor: badge.bg, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999 }}>
            <Txt size={12} weight="700" color={badge.color}>
              {tr(humanize(row.status))}
            </Txt>
          </View>
          <Txt size={12} color={t.mut2}>
            {tr('applied')} {fmtDate(row.applied_at)}
          </Txt>
        </View>
        <Txt size={13.5} color={t.mut}>
          {meta}
        </Txt>
        <Txt size={12.5} weight="600" color={t.ink2}>
          {docsLine}
        </Txt>
        {row.withdrawn_count > 0 && (
          <Txt size={12} color={t.mut2}>
            {tr('withdrawn before')}: {row.withdrawn_count}/2
          </Txt>
        )}
      </View>
      <View style={{ alignItems: 'center', gap: 5, ...(isMobile ? { width: '100%', flexDirection: 'row', justifyContent: 'space-between' } : null) }}>
        <Pressable onPress={toggleHistory} accessibilityRole="button" accessibilityLabel={tr('history')}>
          {(s) => (
            <Txt size={12} weight="600" color={(s as { hovered?: boolean }).hovered ? t.ink : t.mut}>
              {histOpen ? tr('hide history') : tr('history ↓')}
            </Txt>
          )}
        </Pressable>
        {transitions.length > 0 ? (
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            {busy ? <ActivityIndicator color={t.ink} /> : null}
            {transitions.map((tx) => {
              const dark = tx === 'offer-accepted';
              const destructive = tx !== 'offer-accepted';
              return (
                <Pressable
                  key={tx}
                  onPress={() => onAction(row, tx)}
                  disabled={busy}
                  accessibilityRole="button"
                  style={(s) => ({
                    paddingVertical: 10,
                    paddingHorizontal: 22,
                    borderRadius: 12,
                    backgroundColor: (s as { hovered?: boolean }).hovered ? (destructive ? danger : link) : dark ? '#141519' : t.chip,
                    opacity: busy ? 0.5 : 1,
                  })}
                >
                  {(s) => (
                    <Txt size={13.5} weight="700" color={(s as { hovered?: boolean }).hovered ? '#F6F4EE' : dark ? '#F6F4EE' : t.ink2}>
                      {actionLabel[tx]}
                    </Txt>
                  )}
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Txt size={11} color={t.mut2}>
            {stage === 'archived' ? tr('nothing to do here') : tr('waiting on them')}
          </Txt>
        )}
      </View>

      {histOpen && (
        <View style={{ width: '100%', backgroundColor: t.bg, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 20, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
            <Txt size={13} weight="700">
              {tr('what happened so far')}
            </Txt>
            <Txt size={11} color={t.mut2}>
              {tr('every change is kept — yours and theirs')}
            </Txt>
            {hist !== null && !histLoading ? (
              <Pressable onPress={() => void loadHistory()} style={{ marginLeft: 'auto' }}>
                <Txt size={12} weight="700" color={link}>
                  {tr('refresh')}
                </Txt>
              </Pressable>
            ) : null}
          </View>
          {histLoading && <ActivityIndicator color={t.ink} />}
          {histError && (
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <Txt size={12.5} color={danger}>
                {histError}
              </Txt>
              <Pressable onPress={() => void loadHistory()}>
                <Txt size={12} weight="700" color={link}>
                  {tr('try again')}
                </Txt>
              </Pressable>
            </View>
          )}
          {!histLoading && !histError && hist !== null && hist.length === 0 && (
            <Txt size={12.5} color={t.mut}>
              {tr('no history yet — the log starts when the company touches it.')}
            </Txt>
          )}
          {!histLoading && hist && hist.length > 0 && (
            <View style={{ gap: 10 }}>
              {hist.map((ev) => {
                const evStage = stageOf(ev.status);
                const dot = badgeColors(t, evStage);
                return (
                  <View key={ev.id} style={{ flexDirection: 'row', gap: 11, alignItems: 'flex-start' }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: dot.bg, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                      <Txt size={10} color={dot.color}>
                        {evStage === 'offer' ? '★' : evStage === 'archived' ? '■' : '●'}
                      </Txt>
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Txt size={12.5} weight="600">
                        {tr(humanize(String(ev.status)))}
                        {ev.action ? ` — ${ev.action}` : ''}
                      </Txt>
                      {ev.notes ? (
                        <Txt size={12} color={t.ink2} lh={1.45}>
                          {ev.notes}
                        </Txt>
                      ) : null}
                      <Txt size={11} color={t.mut2} mono>
                        {fmtDateTime(ev.created_at)}
                      </Txt>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
