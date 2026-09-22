import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useT } from '@/shared/lib/useT';
import { accent, accentInk, danger, useTheme } from '@/shared/theme';
import { Field, Txt } from '@/shared/ui';

interface Props {
  /** Chip labels for the filters that will be snapshotted (the current /jobs params). */
  currentChips: string[];
  saving: boolean;
  error: string | null;
  onSave: (name: string) => Promise<boolean>;
}

/** "+ new saved search" dashed tile (design lines 1520–1526); expands into a name form. */
export function NewSavedSearchTile({ currentChips, saving, error, onSave }: Props) {
  const t = useTheme();
  const tr = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const nameOk = name.trim().length > 0;
  const hasFilters = currentChips.length > 0;

  const submit = async () => {
    setTouched(true);
    if (!nameOk || !hasFilters || saving) return;
    const ok = await onSave(name.trim());
    if (ok) {
      setName('');
      setTouched(false);
      setOpen(false);
    }
  };

  if (!open) {
    return (
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={tr('new saved search')}
        style={(state) => ({
          borderWidth: 1.5,
          borderStyle: 'dashed' as const,
          borderColor: (state as { hovered?: boolean }).hovered ? t.ink : t.line,
          backgroundColor: (state as { hovered?: boolean }).hovered ? t.card : 'transparent',
          borderRadius: 20,
          paddingVertical: 18,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        })}
      >
        <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center' }}>
          <Txt size={16} weight="700" color={t.ink2}>+</Txt>
        </View>
        <View style={{ gap: 2 }}>
          <Txt size={13.5} weight="700">{tr('new saved search')}</Txt>
          <Txt size={12} color={t.mut2}>{tr('snapshot the filters you have on right now')}</Txt>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={{ borderWidth: 1.5, borderColor: t.ink, backgroundColor: t.card, borderRadius: 20, paddingVertical: 18, paddingHorizontal: 20, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Txt size={13.5} weight="700" style={{ flex: 1 }}>{tr('new saved search')}</Txt>
        <Pressable onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel={tr('close')} style={{ width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
          <Txt size={14} weight="700" color={t.mut}>✕</Txt>
        </Pressable>
      </View>
      <Field value={name} onChangeText={setName} placeholder={tr('name it, e.g. frontend, remote')} bg={t.bg} onSubmitEditing={submit} borderColor={touched && !nameOk ? danger : 'transparent'} />
      {touched && !nameOk && <Txt size={12} color={danger}>{tr('give it a name')}</Txt>}
      <Txt size={12} weight="600" color={t.mut2}>{tr('it will remember these filters')}</Txt>
      {hasFilters ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {currentChips.map((c, i) => (
            <View key={`${c}-${i}`} style={{ paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999, backgroundColor: t.chip }}>
              <Txt size={12} weight="500" color={t.ink2}>{c}</Txt>
            </View>
          ))}
        </View>
      ) : (
        <View style={{ gap: 6 }}>
          <Txt size={12.5} color={t.mut}>{tr('no filters are on right now. set some on the jobs page, then come back.')}</Txt>
          <Pressable onPress={() => router.push('/jobs' as never)} accessibilityRole="link">
            <Txt size={12.5} weight="700" color="#1781FB">{tr('go to jobs →')}</Txt>
          </Pressable>
        </View>
      )}
      {error && <Txt size={12.5} weight="600" color={danger}>{error}</Txt>}
      <Pressable
        onPress={submit}
        disabled={saving || !hasFilters}
        accessibilityRole="button"
        accessibilityLabel={tr('save search')}
        style={{ backgroundColor: saving || !hasFilters ? t.chip : accent, paddingVertical: 10, borderRadius: 10, alignItems: 'center' }}
      >
        <Txt size={12.5} weight="700" color={saving || !hasFilters ? t.mut2 : accentInk}>{saving ? tr('saving…') : tr('save search')}</Txt>
      </Pressable>
    </View>
  );
}
