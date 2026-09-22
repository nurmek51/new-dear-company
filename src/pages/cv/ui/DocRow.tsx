import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useT } from '@/shared/lib/useT';
import { useTheme } from '@/shared/theme';
import { Chip, Txt } from '@/shared/ui';

export interface RowAction {
  label: string;
  onPress: () => void;
  accent?: boolean;
}

interface Props {
  title: string;
  meta: string[];
  selected: boolean;
  busy?: boolean;
  actions: RowAction[];
  onDelete: () => Promise<void>;
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** One resume / cover letter row with select ✓, meta line and chip actions; delete needs an inline confirm. */
export function DocRow({ title, meta, selected, busy, actions, onDelete }: Props) {
  const t = useTheme();
  const tr = useT();
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  return (
    <View style={{ borderWidth: 1, borderColor: t.chip, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'column', gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Txt size={13.5} weight="700" numberOfLines={1} style={{ flex: 1 }}>{title}</Txt>
        {selected && <Chip label={`${tr('selected')} ✓`} bg={t.greenbg} color={t.green} weight="700" size={11} px={9} py={3} />}
        {busy && <ActivityIndicator size="small" color={t.mut} />}
      </View>
      <Txt size={12.5} color={t.mut} lh={1.5}>{meta.filter(Boolean).join(' · ')}</Txt>
      {confirm ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Txt size={12.5} weight="600">{tr('delete this file? this cannot be undone.')}</Txt>
          <Chip
            label={deleting ? tr('deleting…') : tr('yes, delete')}
            bg="#FDE2E2"
            color="#b91c1c"
            weight="700"
            size={12}
            px={11}
            py={5}
            onPress={
              deleting
                ? undefined
                : () => {
                    setDeleting(true);
                    void onDelete().finally(() => {
                      setDeleting(false);
                      setConfirm(false);
                    });
                  }
            }
          />
          <Chip label={tr('keep it')} size={12} px={11} py={5} onPress={() => setConfirm(false)} />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {actions.map((a) => (
            <Chip
              key={a.label}
              label={a.label}
              size={12}
              px={11}
              py={5}
              weight="600"
              bg={a.accent ? '#141519' : undefined}
              color={a.accent ? '#F6F4EE' : undefined}
              onPress={busy ? undefined : a.onPress}
            />
          ))}
          <Pressable accessibilityRole="button" onPress={busy ? undefined : () => setConfirm(true)} style={{ paddingVertical: 5, paddingHorizontal: 6 }}>
            <Txt size={12} weight="600" color="#b91c1c">{tr('delete')}</Txt>
          </Pressable>
        </View>
      )}
    </View>
  );
}
