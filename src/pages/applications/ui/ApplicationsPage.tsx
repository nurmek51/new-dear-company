import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import {
  STAGE_LABELS,
  STAGE_ORDER,
  applicationsApi,
  countByStage,
  matchesQuery,
  stageOf,
  type CandidateStatusUpdate,
  type JobSeekerApplication,
  type StageKey,
} from '@/entities/application';
import { ApiError, emptyPage, errorMessageFrom, pageFromUrl, type Paginated } from '@/shared/api';
import { useBreakpoint } from '@/shared/lib/responsive';
import { useT } from '@/shared/lib/useT';
import { accent, accentInk, danger, font, useTheme } from '@/shared/theme';
import { Btn, IconCircle, Txt } from '@/shared/ui';
import { ApplicationCard } from './ApplicationCard';
import { ConfirmActionModal } from './ConfirmActionModal';

const STAGE_NOTES: Record<StageKey, string> = {
  applied: 'sent and sitting in their pipeline. if it needs to come back, withdraw is right here.',
  reading: 'eyes on your letter — that is momentum. phone nearby, not glued to your hand.',
  interview: 'they wrote back! the company sets interview stages on their side; you see each one here.',
  offer: 'the fun stage. do not say yes before the salary check — negotiating is allowed.',
  archived: 'archived, not failed — every no here says nothing about your worth.',
};

/** /applications — design 843–1021 on GET /ats/b2c-applied-jobs/ (paginated). */
export function ApplicationsPage() {
  const t = useTheme();
  const tr = useT();
  const { isMobile, gutter } = useBreakpoint();

  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<JobSeekerApplication>>(emptyPage());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<StageKey>('applied');
  const [query, setQuery] = useState('');
  const [searchFocus, setSearchFocus] = useState(false);
  const [target, setTarget] = useState<{ row: JobSeekerApplication; status: CandidateStatusUpdate } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const alive = useRef(true);

  const failMsg = useCallback(
    (e: unknown): string =>
      e instanceof ApiError && e.isNetworkError
        ? tr('could not reach the server. check your connection and try again.')
        : errorMessageFrom((e as { payload?: unknown }).payload, (e as Error).message),
    [tr],
  );

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await applicationsApi.listMyApplications({ page: p });
      if (alive.current) setData(res);
    } catch (e) {
      if (alive.current) setError(failMsg(e));
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [failMsg]);

  useEffect(() => {
    alive.current = true;
    void load(page);
    return () => {
      alive.current = false;
    };
  }, [load, page]);

  const rows = data.results;
  const counts = countByStage(rows);
  const q = query.trim();
  const visible = q ? rows.filter((r) => matchesQuery(r, q)) : rows.filter((r) => stageOf(r.status) === stage);
  const partialCounts = data.count > rows.length;
  const nextPage = pageFromUrl(data.next);
  const prevPage = pageFromUrl(data.previous);

  const confirmAction = async (notes: string) => {
    if (!target || actionBusy) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await applicationsApi.updateStatusByCandidate(target.row.id, { status: target.status, notes });
      if (!alive.current) return;
      setTarget(null);
      await load(page);
    } catch (e) {
      if (alive.current) setActionError(failMsg(e));
    } finally {
      if (alive.current) setActionBusy(false);
    }
  };

  const h1 = isMobile ? 29 : 46;

  return (
    <ScrollView>
      <View style={{ paddingTop: 36, paddingBottom: 8, paddingHorizontal: gutter, gap: 14 }}>
        <View>
          <Txt size={h1} weight="700" lh={1.05} ls={-0.04}>
            {tr('your letters,')}
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
            <Txt size={h1} weight="700" lh={1.05} ls={-0.04}>
              {tr('all in one')}{' '}
            </Txt>
            <View style={{ backgroundColor: accent, borderRadius: 10, paddingHorizontal: 14, transform: [{ rotate: '-1.2deg' }] }}>
              <Txt size={h1} weight="700" lh={1.05} ls={-0.04} color={accentInk}>
                {tr('calm place')}
              </Txt>
            </View>
          </View>
        </View>
        <Txt size={isMobile ? 14 : 15.5} color={t.mut}>
          {loading && rows.length === 0
            ? tr('counting your letters…')
            : `${data.count} ${data.count === 1 ? tr('letter') : tr('letters')} ${tr("out in the world. tap a stage to see what's happening.")}`}
        </Txt>
      </View>

      {/* stage tabs + search */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 18, paddingBottom: 6, paddingHorizontal: gutter, flexWrap: 'wrap' }}>
        {STAGE_ORDER.map((key) => {
          const active = key === stage && !q;
          return (
            <Pressable
              key={key}
              onPress={() => {
                setStage(key);
                setQuery('');
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={(s) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingVertical: 10,
                paddingHorizontal: 18,
                borderRadius: 999,
                backgroundColor: active ? '#141519' : t.chip,
                opacity: (s as { hovered?: boolean }).hovered ? 0.9 : 1,
              })}
            >
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: active ? accent : t.mut2 }} />
              <Txt size={13.5} weight="600" color={active ? '#F6F4EE' : t.ink2}>
                {tr(STAGE_LABELS[key])}
              </Txt>
              <Txt size={13.5} weight="600" color={active ? '#F6F4EE' : t.ink2} style={{ opacity: 0.55 }}>
                {counts[key]}
              </Txt>
            </Pressable>
          );
        })}
        <View
          style={{
            marginLeft: isMobile ? 0 : 'auto',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: t.card,
            borderWidth: 1.5,
            borderColor: searchFocus ? '#141519' : t.chip,
            borderRadius: 999,
            paddingLeft: 16,
            paddingRight: 8,
            height: 42,
            minWidth: 250,
            ...(isMobile ? { width: '100%' } : null),
          }}
        >
          <Txt size={14} style={{ opacity: 0.5 }}>
            ⌕
          </Txt>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onFocus={() => setSearchFocus(true)}
            onBlur={() => setSearchFocus(false)}
            placeholder={tr('search by job or company…')}
            placeholderTextColor={t.mut2}
            accessibilityLabel={tr('search by job or company…')}
            style={{ flex: 1, minWidth: 120, fontSize: 13.5, fontFamily: font.regular, color: t.ink, outlineStyle: 'none' } as never}
          />
          {q ? <IconCircle icon="✕" size={26} fontSize={11} onPress={() => setQuery('')} /> : null}
        </View>
      </View>

      {/* stage note */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 12, paddingBottom: 14, paddingHorizontal: gutter + 4 }}>
        <View style={{ width: 20, height: 17 }}>
          <View style={{ position: 'absolute', bottom: 0, width: 20, height: 13, backgroundColor: t.ink, borderTopLeftRadius: 6, borderTopRightRadius: 6, borderBottomLeftRadius: 7, borderBottomRightRadius: 7 }} />
          <View style={{ position: 'absolute', top: 0, left: 1, width: 0, height: 0, borderLeftWidth: 4, borderRightWidth: 4, borderBottomWidth: 6, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: t.ink }} />
          <View style={{ position: 'absolute', top: 0, right: 1, width: 0, height: 0, borderLeftWidth: 4, borderRightWidth: 4, borderBottomWidth: 6, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: t.ink }} />
          <View style={{ position: 'absolute', bottom: 4.5, left: 5.5, width: 2.5, height: 2.5, borderRadius: 1.25, backgroundColor: accent }} />
          <View style={{ position: 'absolute', bottom: 4.5, right: 5.5, width: 2.5, height: 2.5, borderRadius: 1.25, backgroundColor: accent }} />
        </View>
        <Txt size={13.5} color={t.mut} style={{ flex: 1 }}>
          {q
            ? `${tr('searching this page by job or company')} — ${visible.length} ${tr('found')}`
            : `${tr(STAGE_NOTES[stage])}${partialCounts ? ` ${tr('(stage counts are for this page only)')}` : ''}`}
        </Txt>
      </View>

      {/* list */}
      <View style={{ paddingTop: 4, paddingBottom: 44, paddingHorizontal: gutter }}>
        {loading && (
          <View style={{ paddingVertical: 40, alignItems: 'center', gap: 10 }}>
            <ActivityIndicator color={t.ink} />
            <Txt size={13} color={t.mut}>
              {tr('fetching your applications…')}
            </Txt>
          </View>
        )}
        {!loading && error && (
          <View style={{ backgroundColor: t.card, borderRadius: 20, padding: 24, gap: 12 }}>
            <Txt size={14} color={danger}>
              {error}
            </Txt>
            <View style={{ flexDirection: 'row' }}>
              <Btn label={tr('try again')} variant="accent" onPress={() => void load(page)} />
            </View>
          </View>
        )}
        {!loading && !error && rows.length === 0 && (
          <View style={{ backgroundColor: t.card, borderRadius: 20, padding: 24, gap: 6 }}>
            <Txt size={16} weight="700">
              {tr('no letters out yet.')}
            </Txt>
            <Txt size={13.5} color={t.mut} lh={1.5}>
              {tr('apply to a job from the feed and it shows up here, with every status the company sets.')}
            </Txt>
          </View>
        )}
        {!loading && !error && rows.length > 0 && visible.length === 0 && (
          <View style={{ backgroundColor: t.card, borderRadius: 20, padding: 24 }}>
            <Txt size={13.5} color={t.mut}>
              {q ? tr('nothing on this page matches that.') : tr('nothing in this stage on this page.')}
            </Txt>
          </View>
        )}
        {!loading && !error && visible.map((row) => (
          <ApplicationCard
            key={row.id}
            row={row}
            busy={actionBusy && target?.row.id === row.id}
            onAction={(r, status) => {
              setActionError(null);
              setTarget({ row: r, status });
            }}
          />
        ))}

        {/* pagination */}
        {!loading && !error && (prevPage !== null || nextPage !== null) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 14 }}>
            <Btn label={tr('← previous page')} variant="muted" color={t.ink2} size={13} disabled={prevPage === null} style={{ opacity: prevPage === null ? 0.4 : 1 }} onPress={() => prevPage !== null && setPage(prevPage)} />
            <Txt size={12.5} color={t.mut2} mono>
              {tr('page')} {page}
            </Txt>
            <Btn label={tr('next page →')} variant="muted" color={t.ink2} size={13} disabled={nextPage === null} style={{ opacity: nextPage === null ? 0.4 : 1 }} onPress={() => nextPage !== null && setPage(nextPage)} />
          </View>
        )}
        {!loading && !error && rows.length > 0 && nextPage === null && (
          <View style={{ alignItems: 'center', paddingTop: 14 }}>
            <Txt size={13} color={t.mut2} align="center">
              {tr("that's everything here. no hidden pile, no black holes.")}
            </Txt>
          </View>
        )}
      </View>

      <ConfirmActionModal
        key={target ? `${target.row.id}-${target.status}` : 'none'}
        target={target}
        busy={actionBusy}
        error={actionError}
        onCancel={() => {
          if (!actionBusy) setTarget(null);
        }}
        onConfirm={(notes) => void confirmAction(notes)}
      />
    </ScrollView>
  );
}
