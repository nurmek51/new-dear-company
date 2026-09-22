import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';
import { jobsApi, type JobFiltersList, type JobSearchParams } from '@/entities/job';
import { GRADES, WORK_FORMATS, EMPLOYMENT_TYPES, ENGLISH_LEVELS, currencyLabel, humanize } from '@/shared/api';
import { useT } from '@/shared/lib/useT';
import { accent, accentInk, font, useTheme } from '@/shared/theme';
import { Card, Chip, Txt } from '@/shared/ui';

export interface JobFilterPanelProps {
  value: JobSearchParams;
  onChange: (next: JobSearchParams) => void;
}

type ArrayKey =
  | 'work_format'
  | 'grade'
  | 'employment_type'
  | 'english_level'
  | 'vacancy_languages'
  | 'currency'
  | 'country'
  | 'company_types'
  | 'specializations'
  | 'skills_required';

const COLLAPSED_MAX = 12;

let filtersCache: JobFiltersList | null = null;
let filtersInFlight: Promise<JobFiltersList> | null = null;
function loadFilters(): Promise<JobFiltersList> {
  if (filtersCache) return Promise.resolve(filtersCache);
  if (!filtersInFlight) {
    filtersInFlight = jobsApi
      .getFiltersList()
      .then((f) => {
        filtersCache = f;
        return f;
      })
      .finally(() => {
        filtersInFlight = null;
      });
  }
  return filtersInFlight;
}

/** Options for a group: server list first, enum fallback while loading / if the API omits it. */
function optionsFor(list: JobFiltersList | null, key: keyof JobFiltersList, fallback: string[] = []): string[] {
  const fromApi = list?.[key];
  return fromApi && fromApi.length > 0 ? fromApi : fallback;
}

/**
 * Sidebar filters (design 656–745), server-backed only: every control maps to
 * a `/jobs/search/` query param (spec §2.3) and its options come from
 * `/jobs/filters-list/` (§2.4). Include/exclude tri-state, must-haves, exclude
 * words and save/watch actions are omitted (no such API).
 */
export function JobFilterPanel({ value, onChange }: JobFilterPanelProps) {
  const t = useTheme();
  const tr = useT();
  const [list, setList] = useState<JobFiltersList | null>(filtersCache);
  const [loadError, setLoadError] = useState(false);
  const [expanded, setExpanded] = useState<Partial<Record<ArrayKey, boolean>>>({});
  const [skillDraft, setSkillDraft] = useState('');

  useEffect(() => {
    let alive = true;
    loadFilters()
      .then((f) => alive && setList(f))
      .catch(() => alive && setLoadError(true));
    return () => {
      alive = false;
    };
  }, []);

  const selected = (key: ArrayKey): string[] => value[key] ?? [];
  const toggle = (key: ArrayKey, item: string) => {
    const cur = selected(key);
    const next = cur.includes(item) ? cur.filter((x) => x !== item) : [...cur, item];
    onChange({ ...value, page: 1, [key]: next.length ? next : undefined });
  };
  const setNumber = (key: 'salary__min_value' | 'experience_required', raw: string) => {
    const n = raw.trim() === '' ? undefined : Number(raw.replace(',', '.'));
    if (n !== undefined && !Number.isFinite(n)) return;
    onChange({ ...value, page: 1, [key]: n });
  };
  const reset = () => onChange({ q: value.q, page: 1 });

  const addSkill = () => {
    const s = skillDraft.trim().toUpperCase();
    if (!s) return;
    if (!selected('skills_required').includes(s)) toggle('skills_required', s);
    setSkillDraft('');
  };

  const chipRow = (key: ArrayKey, options: string[], label?: (v: string) => string) => {
    const sel = selected(key);
    const merged = [...sel.filter((s) => !options.includes(s)), ...options];
    const isLong = merged.length > COLLAPSED_MAX;
    const shown = isLong && !expanded[key] ? merged.slice(0, COLLAPSED_MAX) : merged;
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {shown.map((o) => {
          const on = sel.includes(o);
          return (
            <Chip
              key={o}
              label={label ? label(o) : o}
              bg={on ? accent : t.chip}
              color={on ? accentInk : t.ink2}
              weight={on ? '600' : '500'}
              onPress={() => toggle(key, o)}
            />
          );
        })}
        {isLong && (
          <Chip
            label={expanded[key] ? tr('show less') : `+${merged.length - COLLAPSED_MAX} ${tr('more')}`}
            bg="transparent"
            color={t.mut}
            weight="600"
            onPress={() => setExpanded((e) => ({ ...e, [key]: !e[key] }))}
          />
        )}
      </View>
    );
  };

  const section = (title: string, body: ReactNode) => (
    <View style={{ gap: 9 }}>
      <Txt size={12} weight="600" color={t.mut2}>
        {title}
      </Txt>
      {body}
    </View>
  );

  const numberInput = (key: 'salary__min_value' | 'experience_required', placeholder: string) => (
    <TextInput
      value={value[key] == null ? '' : String(value[key])}
      onChangeText={(v) => setNumber(key, v)}
      placeholder={placeholder}
      placeholderTextColor={t.mut2}
      keyboardType="numeric"
      inputMode="decimal"
      accessibilityLabel={placeholder}
      style={{
        backgroundColor: t.bg,
        borderRadius: 11,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 13,
        fontFamily: font.regular,
        color: t.ink,
        borderWidth: 1.5,
        borderColor: 'transparent',
        outlineStyle: 'none',
      } as never}
    />
  );

  const skillsBody = (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 7 }}>
        <TextInput
          value={skillDraft}
          onChangeText={setSkillDraft}
          onSubmitEditing={addSkill}
          placeholder={tr('e.g. react, sql, figma…')}
          placeholderTextColor={t.mut2}
          accessibilityLabel={tr('skills')}
          style={{
            flex: 1,
            minWidth: 0,
            backgroundColor: t.bg,
            borderRadius: 11,
            paddingHorizontal: 14,
            paddingVertical: 10,
            fontSize: 13,
            fontFamily: font.regular,
            color: t.ink,
            borderWidth: 1.5,
            borderColor: 'transparent',
            outlineStyle: 'none',
          } as never}
        />
        <Chip label={tr('add')} bg="#141519" color="#F6F4EE" weight="700" size={12.5} px={15} py={10} style={{ borderRadius: 11 }} onPress={addSkill} />
      </View>
      {selected('skills_required').length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {selected('skills_required').map((s) => (
            <Chip key={s} label={`${s} ✕`} bg={accent} color={accentInk} weight="600" size={12.5} px={12} py={6} onPress={() => toggle('skills_required', s)} />
          ))}
        </View>
      )}
    </View>
  );

  return (
    <Card radius={20} padding={22} gap={20}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Txt size={15.5} weight="700" ls={-0.01}>
          {tr('what matters to you')}
        </Txt>
        <Txt size={12} weight="600" color={t.mut2} onPress={reset} accessibilityRole="button">
          {tr('reset')}
        </Txt>
      </View>

      {!list && !loadError && <ActivityIndicator color={t.mut} />}
      {loadError && (
        <Txt size={12.5} color={t.mut}>
          {tr('filter options could not be loaded — the basic ones are still available.')}
        </Txt>
      )}

      {section(tr('work format'), chipRow('work_format', optionsFor(list, 'work_formats', WORK_FORMATS), humanize))}
      {section(tr('your level'), chipRow('grade', optionsFor(list, 'grades', GRADES), (g) => (g === 'clevel' ? 'c-level' : humanize(g))))}
      {section(tr('employment type'), chipRow('employment_type', optionsFor(list, 'employment_types', EMPLOYMENT_TYPES), humanize))}
      {section(tr('salary from — know your worth, don’t undersell'), (
        <View style={{ gap: 8 }}>
          {numberInput('salary__min_value', tr('minimum, e.g. 60000'))}
          {optionsFor(list, 'currencies').length > 0 && chipRow('currency', optionsFor(list, 'currencies'), (c) => `${currencyLabel(c)} ${c}`)}
        </View>
      ))}
      {section(tr('experience, years from'), numberInput('experience_required', tr('e.g. 3')))}
      {section(tr('english level'), chipRow('english_level', optionsFor(list, 'english_levels', ENGLISH_LEVELS)))}
      {optionsFor(list, 'languages').length > 0 && section(tr('language'), chipRow('vacancy_languages', optionsFor(list, 'languages')))}
      {section(tr('skills'), skillsBody)}
      {optionsFor(list, 'specializations').length > 0 && section(tr('specialization'), chipRow('specializations', optionsFor(list, 'specializations'), humanize))}
      {optionsFor(list, 'countries').length > 0 && section(tr('country'), chipRow('country', optionsFor(list, 'countries')))}
      {optionsFor(list, 'company_types').length > 0 && section(tr('company type'), chipRow('company_types', optionsFor(list, 'company_types'), humanize))}
      {optionsFor(list, 'sources').length > 0 &&
        section(
          tr('source'),
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {optionsFor(list, 'sources').map((s) => {
              const on = value.source === s;
              return (
                <Chip
                  key={s}
                  label={humanize(s)}
                  bg={on ? accent : t.chip}
                  color={on ? accentInk : t.ink2}
                  weight={on ? '600' : '500'}
                  onPress={() => onChange({ ...value, page: 1, source: on ? undefined : s })}
                />
              );
            })}
          </View>,
        )}
    </Card>
  );
}
