import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import { candidatePoolApi, type CandidateProfile, type PoolCandidate } from '@/entities/candidate-pool';
import { Avatar, OutlineBtn, ProfileBody } from '@/pages/recruiter-job';
import { ApiError, pageFromUrl, type Paginated } from '@/shared/api';
import { useBreakpoint } from '@/shared/lib/responsive';
import { useT } from '@/shared/lib/useT';
import { accent, font, link, useTheme } from '@/shared/theme';
import { Txt } from '@/shared/ui';
import { EMPTY_FILTERS, ORDERINGS, toListParams, type Filters } from '../model/params';

type Mode = 'browse' | 'ai';

function salaryOf(c: PoolCandidate): string | null {
  if (c.expected_salary_min == null && c.expected_salary_max == null) return null;
  const a = c.expected_salary_min != null ? String(c.expected_salary_min) : '…';
  const b = c.expected_salary_max != null ? String(c.expected_salary_max) : '…';
  return `${a} – ${b}${c.salary_currency ? ` ${c.salary_currency}` : ''}`;
}

/**
 * All candidates (recruiter.html 508–594). KEEP: h1 + pill switch, search box,
 * filter chips row, card table with 32px avatars, footer strip. ADAPT: the
 * "your pipeline | dear company base" tabs become "browse | ai search" over the
 * one real pool (GET /ats/candidates/, GET /ai-match-engine/ai-search-profiles/);
 * columns are the pool's fields (skills, years, expected salary, location);
 * a row expands to the public profile (candidate-profile-by-profile-id).
 * HIDE: cross-job pipeline table (per-job pipelines live on /recruiter/job/[id]
 * — linked), "invite"/"add to pipeline" (no endpoint), "open to work" badge
 * (no such field), add-candidate + cv-parse modals (no endpoints).
 */
export function RecruiterCandidatesPage() {
  const t = useTheme();
  const tr = useT();
  const bp = useBreakpoint();
  const router = useRouter();
  const gutter = bp.isMobile ? 12 : 26;

  const [mode, setMode] = useState<Mode>('browse');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<PoolCandidate> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [aiQ, setAiQ] = useState('');
  const [aiRows, setAiRows] = useState<PoolCandidate[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async (q: string, f: Filters, p: number) => {
    setLoading(true);
    setError(null);
    try {
      setData(await candidatePoolApi.listCandidates(toListParams(q, f, p)));
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.isNetworkError
            ? tr('could not reach the server. check your connection and retry.')
            : e.message
          : tr('could not load candidates. check your connection and retry.'),
      );
    } finally {
      setLoading(false);
    }
  }, [tr]);

  useEffect(() => {
    if (mode === 'browse') void load(query, filters, page);
  }, [mode, query, filters, page, load]);

  const applySearch = () => { setPage(1); setQuery(search.trim()); setOpenId(null); };
  const applyFilters = () => { setPage(1); setFilters(draft); setOpenId(null); };
  const clearAll = () => { setSearch(''); setQuery(''); setDraft(EMPTY_FILTERS); setFilters(EMPTY_FILTERS); setPage(1); setOpenId(null); };

  const runAi = async () => {
    const q = aiQ.trim();
    if (!q || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    setOpenId(null);
    try {
      setAiRows(await candidatePoolApi.aiSearchProfiles(q));
    } catch (e) {
      setAiRows(null);
      setAiError(
        e instanceof ApiError
          ? e.isNetworkError
            ? tr('could not reach the server. check your connection and retry.')
            : e.message
          : e instanceof Error
            ? e.message
            : tr('the ai search failed. retry in a moment.'),
      );
    } finally {
      setAiLoading(false);
    }
  };

  const activeFilterCount = [filters.skills, filters.yearsMin, filters.yearsMax, filters.salaryMin, filters.salaryMax].filter((s) => s.trim()).length + (filters.ordering ? 1 : 0);
  const rows = mode === 'browse' ? data?.results ?? [] : aiRows ?? [];
  const nextPage = pageFromUrl(data?.next ?? null);
  const prevPage = data?.previous ? pageFromUrl(data.previous) ?? 1 : null;
  const listLoading = mode === 'browse' ? loading : aiLoading;
  const listError = mode === 'browse' ? error : aiError;

  const searchBox = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.card, borderWidth: 1, borderColor: t.l12, borderRadius: 9, paddingHorizontal: 12, width: bp.isMobile ? '100%' : 280, height: 36 }}>
      <View style={{ width: 11, height: 11, borderWidth: 1.5, borderColor: '#a1a1aa', borderRadius: 6 }}>
        <View style={{ position: 'absolute', bottom: -4, right: -3, width: 5, height: 1.5, backgroundColor: '#a1a1aa', transform: [{ rotate: '45deg' }] }} />
      </View>
      <TextInput
        value={search}
        onChangeText={setSearch}
        onSubmitEditing={applySearch}
        placeholder={tr('name, email, skills, title…')}
        placeholderTextColor={t.mut2}
        accessibilityLabel={tr('search candidates')}
        style={{ flex: 1, fontSize: 12.5, fontFamily: font.regular, color: t.ink, minWidth: 0, outlineStyle: 'none' } as never}
      />
      {search ? (
        <Pressable onPress={() => { setSearch(''); if (query) { setQuery(''); setPage(1); } }} accessibilityRole="button" accessibilityLabel={tr('clear search')}>
          <Txt size={12} color={t.mut2}>✕</Txt>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 26 }}>
      <View style={{ paddingTop: 24, paddingHorizontal: gutter }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <Txt size={bp.isMobile ? 22 : 24} weight="700" ls={-0.03}>{tr('all candidates')}</Txt>
          <View style={{ flexDirection: 'row', backgroundColor: t.chip, borderRadius: 10, padding: 3 }}>
            {(['browse', 'ai'] as Mode[]).map((m) => {
              const on = mode === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => { setMode(m); setOpenId(null); }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  style={{ paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8, backgroundColor: on ? t.card : 'transparent', ...(on ? { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } } : null) }}
                >
                  <Txt size={12.5} weight="600" color={on ? t.ink : t.mut}>{m === 'browse' ? tr('browse the pool') : tr('ai search ✦')}</Txt>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.card, borderWidth: 1, borderColor: t.l10, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, marginTop: 14 }}>
          <Txt size={15}>✦</Txt>
          <Txt size={12.5} color={t.mut} lh={1.5} style={{ flex: 1 }}>
            {tr('this is dear company\'s public candidate pool — profiles here are visible to anyone, not only to your company. ')}
            <Txt size={12.5} weight="700">{tr('your own applicants')}</Txt>
            {tr(' live on each job\'s pipeline: ')}
            <Txt size={12.5} weight="600" color={link} onPress={() => router.push('/recruiter/jobs' as never)} accessibilityRole="link">{tr('open jobs →')}</Txt>
          </Txt>
        </View>

        {mode === 'browse' ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
              {searchBox}
              <Pressable
                onPress={() => setShowFilters((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ expanded: showFilters }}
                style={{ backgroundColor: activeFilterCount ? '#141519' : t.card, borderWidth: 1, borderColor: activeFilterCount ? '#141519' : t.l12, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 13 }}
              >
                <Txt size={12.5} weight="600" color={activeFilterCount ? '#F6F4EE' : t.ink}>
                  {activeFilterCount ? `${tr('filters')}: ${activeFilterCount} ${showFilters ? '▴' : '▾'}` : `${tr('filters')} ${showFilters ? '▴' : '▾'}`}
                </Txt>
              </Pressable>
              {ORDERINGS.map((o) => {
                const on = filters.ordering === o.key;
                return (
                  <Pressable
                    key={o.key}
                    onPress={() => { const next = on ? null : o.key; setDraft((d) => ({ ...d, ordering: next })); setFilters((f) => ({ ...f, ordering: next })); setPage(1); }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={{ backgroundColor: on ? '#141519' : t.card, borderWidth: 1, borderColor: on ? '#141519' : t.l12, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 13 }}
                  >
                    <Txt size={12.5} weight="600" color={on ? accent : t.ink}>{tr(o.label)}</Txt>
                  </Pressable>
                );
              })}
              {query || activeFilterCount ? (
                <Pressable onPress={clearAll} accessibilityRole="button"><Txt size={12.5} color={t.mut}>{tr('clear all')}</Txt></Pressable>
              ) : null}
            </View>

            {showFilters ? (
              <View style={{ marginTop: 10, backgroundColor: t.card, borderWidth: 1, borderColor: t.l10, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, gap: 12 }}>
                <View style={{ flexDirection: bp.isMobile ? 'column' : 'row', gap: 12 }}>
                  <FilterField label={tr('skills (comma separated)')} value={draft.skills} onChange={(v) => setDraft((d) => ({ ...d, skills: v }))} placeholder={tr('e.g. figma, react')} flex={2} />
                  <FilterRange label={tr('years of experience')} min={draft.yearsMin} max={draft.yearsMax} onMin={(v) => setDraft((d) => ({ ...d, yearsMin: v }))} onMax={(v) => setDraft((d) => ({ ...d, yearsMax: v }))} />
                  <FilterRange label={tr('expected salary')} min={draft.salaryMin} max={draft.salaryMax} onMin={(v) => setDraft((d) => ({ ...d, salaryMin: v }))} onMax={(v) => setDraft((d) => ({ ...d, salaryMax: v }))} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Pressable onPress={applyFilters} accessibilityRole="button" style={{ backgroundColor: '#141519', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 13 }}>
                    <Txt size={12.5} weight="600" color={accent}>{tr('apply filters')}</Txt>
                  </Pressable>
                  <OutlineBtn label={tr('reset')} onPress={() => { setDraft({ ...EMPTY_FILTERS, ordering: filters.ordering }); setFilters((f) => ({ ...EMPTY_FILTERS, ordering: f.ordering })); setPage(1); }} />
                </View>
              </View>
            ) : null}
          </>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.card, borderWidth: 1, borderColor: t.l12, borderRadius: 9, paddingHorizontal: 12, width: bp.isMobile ? '100%' : 460, height: 36 }}>
              <Txt size={13}>✦</Txt>
              <TextInput
                value={aiQ}
                onChangeText={setAiQ}
                onSubmitEditing={() => void runAi()}
                placeholder={tr('describe who you need, e.g. senior backend engineer with go and kubernetes in berlin')}
                placeholderTextColor={t.mut2}
                accessibilityLabel={tr('ai candidate search')}
                style={{ flex: 1, fontSize: 12.5, fontFamily: font.regular, color: t.ink, minWidth: 0, outlineStyle: 'none' } as never}
              />
            </View>
            <Pressable
              onPress={aiLoading || !aiQ.trim() ? undefined : () => void runAi()}
              accessibilityRole="button"
              accessibilityState={{ disabled: aiLoading || !aiQ.trim(), busy: aiLoading }}
              style={{ backgroundColor: '#141519', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 13, opacity: aiLoading || !aiQ.trim() ? 0.5 : 1 }}
            >
              <Txt size={12.5} weight="600" color={accent}>{aiLoading ? tr('searching…') : tr('search')}</Txt>
            </Pressable>
            <Txt size={12} color={t.mut}>{tr('semantic match over the same public pool')}</Txt>
          </View>
        )}
      </View>

      {/* ---- table ---- */}
      <View style={{ marginTop: 16, marginHorizontal: gutter, backgroundColor: t.card, borderWidth: 1, borderColor: t.l10, borderRadius: 14, overflow: 'hidden' }}>
        {rows.length && !listLoading && !listError ? (
          <ScrollView horizontal={bp.isMobile} showsHorizontalScrollIndicator={false}>
            <View style={{ width: bp.isMobile ? 680 : '100%' }}>
              <View style={{ flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: t.l08 }}>
                <Head flex={2}>{tr('candidate')}</Head>
                <Head flex={1.5}>{tr('skills')}</Head>
                <Head flex={0.9}>{tr('experience')}</Head>
                <Head flex={1.2}>{tr('expected salary')}</Head>
                <Head flex={1}>{tr('location')}</Head>
              </View>
              {rows.map((c) => (
                <CandidateRow key={c.id} c={c} open={openId === c.id} onToggle={() => setOpenId(openId === c.id ? null : c.id)} />
              ))}
            </View>
          </ScrollView>
        ) : (
          <View>
            {listLoading ? (
              <View style={{ padding: 30, alignItems: 'center' }}><ActivityIndicator color={t.mut} /></View>
            ) : listError ? (
              <View style={{ padding: 22, gap: 10, alignItems: 'flex-start' }}>
                <Txt size={13} color={t.mut}>{listError}</Txt>
                <OutlineBtn label={tr('retry')} onPress={() => (mode === 'browse' ? void load(query, filters, page) : void runAi())} />
              </View>
            ) : mode === 'ai' && aiRows === null ? (
              <EmptyBlock title={tr('describe the person you are looking for')} sub={tr('the ai ranks public profiles by how well they fit the description.')} />
            ) : (
              <View style={{ paddingVertical: 36, paddingHorizontal: 20, alignItems: 'center' }}>
                <Txt size={13.5} weight="600">{mode === 'ai' ? tr('no profiles matched that description') : query || activeFilterCount ? tr('no candidates match') : tr('the pool is empty right now')}</Txt>
                <Txt size={12.5} color={t.mut} style={{ marginTop: 4 }} align="center">
                  {mode === 'ai' ? tr('try fewer constraints or different wording.') : tr('try a name, a skill or a title — or ')}
                  {mode === 'browse' && (query || activeFilterCount) ? (
                    <Txt size={12.5} color={link} onPress={clearAll} accessibilityRole="button">{tr('clear the search')}</Txt>
                  ) : null}
                </Txt>
              </View>
            )}
          </View>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 20, backgroundColor: t.hov, flexWrap: 'wrap' }}>
          <Txt size={12.5} color={t.mut}>
            {mode === 'ai'
              ? aiRows ? `${aiRows.length} ${tr('semantic matches')} · ${tr('best fit first')}` : tr('results are ranked, not paginated')
              : data ? `${tr('page')} ${page} · ${rows.length} ${tr('of')} ${data.count} ${tr('public profiles')}` : ''}
          </Txt>
          {mode === 'browse' ? (
            <View style={{ marginLeft: 'auto', flexDirection: 'row', gap: 14 }}>
              {prevPage != null ? <Pressable onPress={() => { setPage(prevPage); setOpenId(null); }} accessibilityRole="button"><Txt size={12} weight="600" color={link}>{tr('← previous')}</Txt></Pressable> : null}
              {nextPage != null ? <Pressable onPress={() => { setPage(nextPage); setOpenId(null); }} accessibilityRole="button"><Txt size={12} weight="600" color={link}>{tr('next →')}</Txt></Pressable> : null}
            </View>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}

function Head({ children, flex }: { children: string; flex: number }) {
  const t = useTheme();
  return (
    <View style={{ flex, minWidth: 0, paddingRight: 8 }}>
      <Txt size={11} weight="600" color={t.mut} ls={0.05} style={{ textTransform: 'uppercase' }}>{children}</Txt>
    </View>
  );
}

function EmptyBlock({ title, sub }: { title: string; sub: string }) {
  const t = useTheme();
  return (
    <View style={{ paddingVertical: 36, paddingHorizontal: 20, alignItems: 'center' }}>
      <Txt size={13.5} weight="600" align="center">{title}</Txt>
      <Txt size={12.5} color={t.mut} style={{ marginTop: 4 }} align="center">{sub}</Txt>
    </View>
  );
}

function FilterField({ label, value, onChange, placeholder, flex = 1 }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; flex?: number }) {
  const t = useTheme();
  return (
    <View style={{ flex, gap: 6, minWidth: 0 }}>
      <Txt size={11.5} weight="600" color={t.mut}>{label}</Txt>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={t.mut2}
        accessibilityLabel={label}
        style={{ borderWidth: 1, borderColor: t.l15, borderRadius: 9, paddingVertical: 8, paddingHorizontal: 12, fontSize: 13, backgroundColor: t.hov, fontFamily: font.regular, color: t.ink, outlineStyle: 'none' } as never}
      />
    </View>
  );
}

function FilterRange({ label, min, max, onMin, onMax }: { label: string; min: string; max: string; onMin: (v: string) => void; onMax: (v: string) => void }) {
  const t = useTheme();
  const tr = useT();
  const style = { width: 90, borderWidth: 1, borderColor: t.l15, borderRadius: 9, paddingVertical: 8, paddingHorizontal: 12, fontSize: 13, backgroundColor: t.hov, fontFamily: font.regular, color: t.ink, outlineStyle: 'none' } as never;
  return (
    <View style={{ gap: 6 }}>
      <Txt size={11.5} weight="600" color={t.mut}>{label}</Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TextInput value={min} onChangeText={onMin} placeholder={tr('from')} placeholderTextColor={t.mut2} keyboardType="numeric" accessibilityLabel={`${label} ${tr('from')}`} style={style} />
        <Txt color={t.mut2}>—</Txt>
        <TextInput value={max} onChangeText={onMax} placeholder={tr('to')} placeholderTextColor={t.mut2} keyboardType="numeric" accessibilityLabel={`${label} ${tr('to')}`} style={style} />
      </View>
    </View>
  );
}

function CandidateRow({ c, open, onToggle }: { c: PoolCandidate; open: boolean; onToggle: () => void }) {
  const t = useTheme();
  const tr = useT();
  const sub = c.heading ?? (c.looking_for_designations.length ? c.looking_for_designations.join(', ') : c.department);
  const salary = salaryOf(c);
  const shown = c.skills.slice(0, 4);
  const more = c.skills.length - shown.length;
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: t.l06 }}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={c.name || tr('candidate')}
        style={(s) => ({ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 20, backgroundColor: open || (s as { hovered?: boolean }).hovered ? t.hov : 'transparent' })}
      >
        <View style={{ flex: 2, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingRight: 8 }}>
          <Avatar name={c.name || '?'} uri={c.profile_picture} size={32} fontSize={11.5} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt size={13.5} weight="600" numberOfLines={1}>{c.name || tr('unnamed profile')}</Txt>
            <Txt size={11.5} color={t.mut} numberOfLines={1}>{sub ?? tr('no title on the profile')}</Txt>
          </View>
        </View>
        <View style={{ flex: 1.5, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', gap: 4, paddingRight: 8 }}>
          {shown.map((s) => (
            <View key={s} style={{ backgroundColor: t.chip, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10 }}>
              <Txt size={11} weight="600" color={t.ink3}>{s.toLowerCase()}</Txt>
            </View>
          ))}
          {more > 0 ? <Txt size={11} color={t.mut} style={{ alignSelf: 'center' }}>{`+${more}`}</Txt> : null}
          {!shown.length ? <Txt size={12} color={t.mut2}>—</Txt> : null}
        </View>
        <View style={{ flex: 0.9, minWidth: 0, paddingRight: 8 }}>
          <Txt size={13}>{c.years_of_experience != null ? `${c.years_of_experience} ${tr('yrs')}` : '—'}</Txt>
        </View>
        <View style={{ flex: 1.2, minWidth: 0, paddingRight: 8 }}>
          <Txt size={12.5} color={t.mut} numberOfLines={1}>{salary ?? '—'}</Txt>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt size={12.5} color={t.mut} numberOfLines={1}>{c.address ?? '—'}</Txt>
        </View>
      </Pressable>
      {open ? <ProfilePanel profileId={c.profile_id} /> : null}
    </View>
  );
}

function ProfilePanel({ profileId }: { profileId: string }) {
  const t = useTheme();
  const tr = useT();
  const [profile, setProfile] = useState<CandidateProfile | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setProfile(undefined);
    setError(null);
    try {
      setProfile(await candidatePoolApi.getCandidateProfile(profileId));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : tr('could not load the profile.'));
    }
  }, [profileId, tr]);
  useEffect(() => {
    let cancelled = false;
    void (async () => { if (!cancelled) await load(); })();
    return () => { cancelled = true; };
  }, [load]);
  return (
    <View style={{ paddingVertical: 16, paddingHorizontal: 20, paddingLeft: 64, backgroundColor: t.hov, borderTopWidth: 1, borderTopColor: t.l06 }}>
      {error ? (
        <View style={{ gap: 8, alignItems: 'flex-start' }}>
          <Txt size={12.5} color={t.mut}>{error}</Txt>
          <OutlineBtn label={tr('retry')} onPress={() => void load()} />
        </View>
      ) : profile === undefined ? (
        <ActivityIndicator color={t.mut} style={{ alignSelf: 'flex-start' }} />
      ) : profile === null ? (
        <Txt size={12.5} color={t.mut}>{tr('this profile is no longer public.')}</Txt>
      ) : (
        <ProfileBody profile={profile} />
      )}
    </View>
  );
}
