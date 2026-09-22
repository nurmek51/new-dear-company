import { Pressable, ScrollView, View } from 'react-native';
import { CLOSED_STAGE, PIPELINE_STAGES, stageOf, type Applicant, type PipelineStage } from '@/entities/applicant';
import { humanize } from '@/shared/api';
import { useBreakpoint } from '@/shared/lib/responsive';
import { useT } from '@/shared/lib/useT';
import { accent, useTheme } from '@/shared/theme';
import { Txt } from '@/shared/ui';
import { fmtDate } from './pipelineUi';

/**
 * Board view (recruiter.html 484–505). Drag-and-drop is HIDDEN — there is no
 * reorder endpoint and a drop would have to become a status POST; cards open
 * the detail where "move to ▾" does that explicitly. Counts are per-column
 * for the loaded page; the header chips carry the whole-job totals.
 */
export function Board({
  rows,
  activeStage,
  onOpen,
}: {
  rows: Applicant[];
  activeStage: PipelineStage | null;
  onOpen: (a: Applicant) => void;
}) {
  const t = useTheme();
  const tr = useT();
  const bp = useBreakpoint();
  const gutter = bp.isMobile ? 12 : 26;
  const columns: PipelineStage[] = [...PIPELINE_STAGES, CLOSED_STAGE];
  return (
    <ScrollView horizontal={bp.isMobile} contentContainerStyle={{ flexGrow: 1 }} showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', gap: 12, paddingTop: 18, paddingHorizontal: gutter, paddingBottom: 26, flex: 1, alignItems: 'flex-start' }}>
        {columns.map((st) => {
          const cards = rows.filter((r) => stageOf(r.status) === st);
          const hired = st === 'hired';
          return (
            <View key={st} style={{ flex: bp.isMobile ? undefined : 1, minWidth: bp.isMobile ? 168 : 0, gap: 8, minHeight: 260 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}>
                <Txt size={12.5} weight="700">{tr(st === 'closed' ? 'rejected / withdrawn' : st)}</Txt>
                <View style={{ backgroundColor: st === activeStage ? accent : '#ECE9E0', borderRadius: 99, paddingVertical: 1, paddingHorizontal: 8 }}>
                  <Txt size={11} weight="700" mono color="#101114">{String(cards.length)}</Txt>
                </View>
              </View>
              {cards.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => onOpen(c)}
                  accessibilityRole="button"
                  accessibilityLabel={c.name}
                  style={(s) => ({
                    backgroundColor: hired ? '#141519' : t.card,
                    borderWidth: 1,
                    borderColor: t.l10,
                    borderLeftWidth: 3,
                    borderLeftColor: st === 'closed' ? '#dc2626' : 'transparent',
                    borderRadius: 12,
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    ...((s as { hovered?: boolean }).hovered
                      ? { shadowColor: '#141519', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 }
                      : null),
                  })}
                >
                  <Txt size={13.5} weight="600" color={hired ? '#F6F4EE' : t.ink}>{c.name || tr('candidate')}</Txt>
                  <Txt size={11.5} color={hired ? accent : t.mut} style={{ marginTop: 2 }}>
                    {[c.match_score != null ? `${Math.round(c.match_score)}% ${tr('match')}` : null, humanize(String(c.status)), c.applied_at ? fmtDate(c.applied_at) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </Txt>
                </Pressable>
              ))}
              {cards.length === 0 ? (
                <View style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.l25, borderRadius: 12, padding: 14 }}>
                  <Txt size={12} color={t.mut} align="center">{tr('nobody here on this page')}</Txt>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
