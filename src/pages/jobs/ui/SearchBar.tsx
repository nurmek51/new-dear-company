import { Pressable, TextInput, View, type ViewStyle } from 'react-native';
import { useT } from '@/shared/lib/useT';
import { font, link, useTheme } from '@/shared/theme';
import { Txt } from '@/shared/ui';

interface Props {
  value: string;
  onChangeText: (v: string) => void;
  onSubmit: () => void;
  onClear: () => void;
}

/** Design 651–658: card-shaped bar with magnifier, input, clear ✕, dark "search" button. */
export function SearchBar({ value, onChangeText, onSubmit, onClear }: Props) {
  const t = useTheme();
  const tr = useT();
  return (
    <View
      style={
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: t.card,
          borderRadius: 18,
          paddingTop: 8,
          paddingBottom: 8,
          paddingRight: 8,
          paddingLeft: 20,
          maxWidth: 720,
          width: '100%',
          shadowColor: '#141519',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.05,
          shadowRadius: 24,
        } as ViewStyle
      }
    >
      <Magnifier />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        returnKeyType="search"
        placeholder={tr('try “design, remote, kind team, pays rent”')}
        placeholderTextColor={t.mut2}
        accessibilityLabel={tr('search jobs')}
        style={{ flex: 1, minWidth: 0, fontSize: 15, color: t.ink, fontFamily: font.regular, paddingVertical: 8, outlineStyle: 'none' } as never}
      />
      {value.length > 0 && (
        <Pressable onPress={onClear} accessibilityRole="button" accessibilityLabel={tr('clear search')} style={{ padding: 6 }}>
          {(s) => (
            <Txt size={13} weight="600" color={(s as { hovered?: boolean }).hovered ? t.ink : t.mut}>
              {tr('clear ✕')}
            </Txt>
          )}
        </Pressable>
      )}
      <Pressable
        onPress={onSubmit}
        accessibilityRole="button"
        style={(s) => ({
          paddingVertical: 12,
          paddingHorizontal: 26,
          borderRadius: 13,
          backgroundColor: (s as { hovered?: boolean }).hovered ? link : '#141519',
        })}
      >
        <Txt size={14.5} weight="700" color="#F6F4EE">
          {tr('search')}
        </Txt>
      </Pressable>
    </View>
  );
}

/** The design's 19px stroke magnifier, drawn with views (no svg dependency). */
function Magnifier() {
  return (
    <View style={{ width: 19, height: 19 }} accessibilityElementsHidden>
      <View style={{ position: 'absolute', left: 1, top: 1, width: 13, height: 13, borderRadius: 7, borderWidth: 2, borderColor: '#a1a1aa' }} />
      <View style={{ position: 'absolute', left: 12.5, top: 11, width: 2, height: 6, borderRadius: 1, backgroundColor: '#a1a1aa', transform: [{ rotate: '-45deg' }] }} />
    </View>
  );
}
