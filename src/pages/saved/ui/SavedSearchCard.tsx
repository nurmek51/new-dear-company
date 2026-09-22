import { useState } from 'react';
import { Pressable, View } from 'react-native';
import type { SearchQuery } from '@/entities/job';
import { useT } from '@/shared/lib/useT';
import { accent, accentInk, danger, useTheme } from '@/shared/theme';
import { Txt } from '@/shared/ui';
import { paramChips } from './shared';

interface Props {
  query: SearchQuery;
  deleting: boolean;
  onRun: () => void;
  onDelete: () => void;
}

/** Saved-search card (design lines 1467–1519, minus the alert/digest/mute copy — no alert backend). */
export function SavedSearchCard({ query, deleting, onRun, onDelete }: Props) {
  const t = useTheme();
  const tr = useT();
  const [confirm, setConfirm] = useState(false);
  const chips = paramChips(query.preference_data);

  return (
    <View
      style={{
        backgroundColor: t.card,
        borderRadius: 20,
        padding: 20,
        gap: 12,
        shadowColor: '#141519',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
        opacity: deleting ? 0.5 : 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Txt size={15} weight="700" ls={-0.01} style={{ flex: 1 }}>{query.data}</Txt>
        <View style={{ backgroundColor: t.chip, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999 }}>
          <Txt size={11.5} weight="700" color={t.mut}>{`${chips.length} ${tr(chips.length === 1 ? 'filter' : 'filters')}`}</Txt>
        </View>
      </View>
      {chips.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {chips.map((c, i) => (
            <View key={`${c}-${i}`} style={{ paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999, backgroundColor: t.chip }}>
              <Txt size={12} weight="500" color={t.ink2}>{c}</Txt>
            </View>
          ))}
        </View>
      ) : (
        <Txt size={12.5} weight="500" color={t.mut}>{tr('no filters — running it shows the whole feed.')}</Txt>
      )}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', borderTopWidth: 1, borderTopColor: t.bg, paddingTop: 11 }}>
        <Pressable
          onPress={onRun}
          accessibilityRole="button"
          accessibilityLabel={`${tr('run search')} — ${query.data}`}
          style={{ backgroundColor: accent, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10 }}
        >
          <Txt size={12.5} weight="700" color={accentInk}>{tr('run search')}</Txt>
        </Pressable>
        <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {confirm ? (
            <>
              <Txt size={12} color={t.mut2}>{tr('delete?')}</Txt>
              <Pressable onPress={onDelete} disabled={deleting} accessibilityRole="button" accessibilityLabel={tr('yes, delete')}>
                <Txt size={12.5} weight="700" color={danger}>{tr('yes')}</Txt>
              </Pressable>
              <Pressable onPress={() => setConfirm(false)} accessibilityRole="button" accessibilityLabel={tr('keep it')}>
                <Txt size={12.5} weight="600" color={t.mut}>{tr('no')}</Txt>
              </Pressable>
            </>
          ) : (
            <Pressable onPress={() => setConfirm(true)} disabled={deleting} accessibilityRole="button" accessibilityLabel={`${tr('delete')} — ${query.data}`} style={{ paddingVertical: 8, paddingHorizontal: 10 }}>
              <Txt size={12.5} weight="600" color={t.mut2}>{deleting ? tr('deleting…') : tr('delete')}</Txt>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}
