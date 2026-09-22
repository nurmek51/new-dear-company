import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, View } from 'react-native';
import { atsReportApi, type PostedJob } from '@/entities/ats-report';
import { ApiError, pageFromUrl, type Paginated } from '@/shared/api';
import { useBreakpoint } from '@/shared/lib/responsive';
import { useT } from '@/shared/lib/useT';
import { accent, link, useTheme } from '@/shared/theme';
import { Txt } from '@/shared/ui';

/**
 * Recruiter job list (recruiter.html "open jobs" card, lines 251–283, in the
 * overview's styling). Data: GET /api/v1/ats/b2b-posted-jobs/ — title, the
 * server's applicants text (verbatim) and applicant avatars. The design's
 * funnel bars live on the overview; "repost · 30 d", drafts and the plan
 * upsell have no endpoint and are omitted. Archive (closed jobs) is omitted:
 * posted-job rows carry no validity date to derive it from.
 */
export function RecruiterJobsPage() {
  const t = useTheme();
  const tr = useT();
  const bp = useBreakpoint();
  const router = useRouter();
  const gutter = bp.isMobile ? 12 : 26;

  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<PostedJob> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      setData(await atsReportApi.listPostedJobs(p));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : tr('could not load your jobs. check your connection and retry.'));
    } finally {
      setLoading(false);
    }
  }, [tr]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await load(page);
    })();
    return () => { cancelled = true; };
  }, [load, page]);

  const rows = data?.results ?? [];
  const nextPage = pageFromUrl(data?.next ?? null);
  const prevPage = data?.previous ? pageFromUrl(data.previous) ?? 1 : null;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 26 }}>
      <View style={{ paddingTop: 26, paddingHorizontal: gutter, flexDirection: 'row', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <View style={{ flex: 1, minWidth: 200 }}>
          <Txt size={bp.isMobile ? 22 : 24} weight="700" ls={-0.03}>{tr('jobs')}</Txt>
          <Txt size={13} color={t.mut} style={{ marginTop: 4 }}>
            {data ? `${data.count} ${tr(data.count === 1 ? 'posted job' : 'posted jobs')}` : tr('every job your company has posted')}
          </Txt>
        </View>
        <Pressable
          onPress={() => router.push('/recruiter/new-job' as never)}
          accessibilityRole="button"
          style={{ backgroundColor: accent, paddingVertical: 7, paddingHorizontal: 14, borderRadius: 8 }}
        >
          <Txt size={12.5} weight="600" color="#101114">{tr('+ new job')}</Txt>
        </Pressable>
      </View>

      <View style={{ marginTop: 18, marginHorizontal: gutter, backgroundColor: t.card, borderWidth: 1, borderColor: t.l10, borderRadius: 14, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: t.l08 }}>
          <Txt size={13} weight="700">{tr('open jobs')}</Txt>
          {data ? (
            <Txt size={11} weight="700" mono style={{ marginLeft: 8, backgroundColor: t.chip, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 1 }}>
              {String(data.count)}
            </Txt>
          ) : null}
        </View>

        {loading ? (
          <View style={{ padding: 30, alignItems: 'center' }}>
            <ActivityIndicator color={t.mut} />
          </View>
        ) : error ? (
          <View style={{ padding: 22, gap: 10, alignItems: 'flex-start' }}>
            <Txt size={13} color={t.mut}>{error}</Txt>
            <Pressable onPress={() => load(page)} accessibilityRole="button" style={{ borderWidth: 1, borderColor: t.l15, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 }}>
              <Txt size={12.5} weight="600">{tr('retry')}</Txt>
            </Pressable>
          </View>
        ) : rows.length === 0 ? (
          <View style={{ padding: 30, alignItems: 'center', gap: 6 }}>
            <Txt size={13.5} weight="600">{tr('no jobs posted yet')}</Txt>
            <Txt size={12.5} color={t.mut} align="center">{tr('post your first job and applicants will show up here.')}</Txt>
          </View>
        ) : (
          rows.map((j) => <JobRow key={j.id} job={j} onPress={() => router.push(`/recruiter/job/${j.id}` as never)} />)
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 11, paddingHorizontal: 18, backgroundColor: t.hov }}>
          <Txt size={11} color={t.mut}>
            {data ? `${tr('page')} ${page}${data.count ? ` · ${rows.length} ${tr('of')} ${data.count}` : ''}` : ''}
          </Txt>
          <View style={{ marginLeft: 'auto', flexDirection: 'row', gap: 14 }}>
            {prevPage != null ? (
              <Pressable onPress={() => setPage(prevPage)} accessibilityRole="button"><Txt size={12} weight="600" color={link}>{tr('← previous')}</Txt></Pressable>
            ) : null}
            {nextPage != null ? (
              <Pressable onPress={() => setPage(nextPage)} accessibilityRole="button"><Txt size={12} weight="600" color={link}>{tr('next →')}</Txt></Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function JobRow({ job, onPress }: { job: PostedJob; onPress: () => void }) {
  const t = useTheme();
  const tr = useT();
  const avatars = (job.images ?? []).filter((u): u is string => typeof u === 'string' && u.length > 0).slice(0, 5);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={job.title}
      style={(s) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 13,
        paddingHorizontal: 18,
        borderBottomWidth: 1,
        borderBottomColor: t.l06,
        backgroundColor: (s as { hovered?: boolean }).hovered ? t.hov : 'transparent',
      })}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt size={13.5} weight="600">{job.title}</Txt>
        <Txt size={11.5} color={t.mut} style={{ marginTop: 2 }}>{job.text}</Txt>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {avatars.map((u, i) => (
          <Image
            key={`${u}-${i}`}
            source={{ uri: u }}
            accessibilityIgnoresInvertColors
            style={{ width: 24, height: 24, borderRadius: 12, marginLeft: i === 0 ? 0 : -6, borderWidth: 2, borderColor: t.card, backgroundColor: t.chip }}
          />
        ))}
      </View>
      <Txt size={12.5} weight="600" color={link}>{tr('open →')}</Txt>
    </Pressable>
  );
}
