import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { jobsApi, type MatchResult } from '@/entities/job';
import { humanize } from '@/shared/api';
import { useT } from '@/shared/lib/useT';
import { accent, useTheme } from '@/shared/theme';
import { Card, Chip, Txt } from '@/shared/ui';

interface Props {
  jobId: string;
  /** Lets the header show the score badge once it is known. */
  onScore?: (score: number | null) => void;
}

type State = { kind: 'loading' } | { kind: 'hidden' } | { kind: 'ready'; match: MatchResult };

/**
 * "why this match" (spec §5 match-score/{job_id}/, B2C own profile). Rendered
 * only for a signed-in seeker; any 4xx (no profile yet, blocked) hides it.
 */
export function MatchPanel({ jobId, onScore }: Props) {
  const t = useTheme();
  const tr = useT();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let alive = true;
    setState({ kind: 'loading' });
    jobsApi
      .myMatchScore(jobId)
      .then((m) => {
        if (!alive) return;
        if (typeof m.score !== 'number') {
          setState({ kind: 'hidden' });
          return;
        }
        setState({ kind: 'ready', match: m });
        onScore?.(m.score);
      })
      .catch(() => alive && setState({ kind: 'hidden' }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  if (state.kind === 'hidden') return null;
  if (state.kind === 'loading') {
    return (
      <Card radius={20} padding={22} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <ActivityIndicator color={t.mut} />
        <Txt size={13} color={t.mut2}>
          {tr('scoring this job against your profile…')}
        </Txt>
      </Card>
    );
  }

  const m = state.match;
  const list = (title: string, items: { criterion: string; why: string }[]) =>
    items.length > 0 && (
      <View style={{ gap: 6 }}>
        <Txt size={13} weight="700">
          {title}
        </Txt>
        {items.map((it, i) => (
          <View key={`${it.criterion}-${i}`} style={{ flexDirection: 'row', gap: 8 }}>
            <Txt size={13.5} weight="600" color={t.ink2} style={{ minWidth: 96 }}>
              {humanize(String(it.criterion))}
            </Txt>
            <Txt size={13.5} color={t.ink2} lh={1.55} style={{ flex: 1 }}>
              {String(it.why)}
            </Txt>
          </View>
        ))}
      </View>
    );

  return (
    <Card radius={20} padding={26} gap={14}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <View style={{ backgroundColor: '#141519', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 14 }}>
          <Txt size={22} weight="700" color={accent} style={{ fontVariant: ['tabular-nums'] }}>
            {Math.round(m.score)}%
          </Txt>
        </View>
        <View style={{ gap: 2, flex: 1, minWidth: 160 }}>
          <Txt size={15} weight="700">
            {tr('why this match')}
          </Txt>
          <Txt size={12.5} color={t.mut}>
            {m.blocked ? tr('a hard requirement is not met — see below') : tr('scored against the profile on your cv')}
          </Txt>
        </View>
      </View>
      {m.blocked && Array.isArray(m.block_reasons) && m.block_reasons.length > 0 && (
        <Txt size={13.5} color={t.ink2} lh={1.6}>
          {m.block_reasons.map(String).join(' · ')}
        </Txt>
      )}
      {list(tr('where you are strong'), Array.isArray(m.top_strengths) ? m.top_strengths : [])}
      {list(tr('where the gap is'), Array.isArray(m.top_gaps) ? m.top_gaps : [])}
      {Array.isArray(m.skill_matches) && m.skill_matches.length > 0 && (
        <View style={{ gap: 8 }}>
          <Txt size={13} weight="700">
            {tr('skills you already have')}
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {m.skill_matches.map((s) => (
              <Chip key={s} label={String(s).toLowerCase()} bg={t.greenbg} color={t.green} weight="600" size={12.5} px={12} py={6} />
            ))}
          </View>
        </View>
      )}
      {Array.isArray(m.skill_gaps) && m.skill_gaps.length > 0 && (
        <View style={{ gap: 8 }}>
          <Txt size={13} weight="700">
            {tr('skills they list that you don’t')}
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {m.skill_gaps.map((s) => (
              <Chip key={s} label={String(s).toLowerCase()} bg={t.chip} color={t.mut} weight="600" size={12.5} px={12} py={6} />
            ))}
          </View>
        </View>
      )}
    </Card>
  );
}
