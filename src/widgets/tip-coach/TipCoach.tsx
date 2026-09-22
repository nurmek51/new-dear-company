import { Pressable, View } from 'react-native';
import { tipDefs, useTipsStore } from '@/features/tips';
import { useT } from '@/shared/lib/useT';
import { accent } from '@/shared/theme';
import { Txt } from '@/shared/ui';

/** Fixed bottom-left coach-mark ("tip 1/7") shown once per screen. */
export function TipCoach({ screen }: { screen: string }) {
  const tr = useT();
  const tipsSeen = useTipsStore((s) => s.tipsSeen);
  const markTipSeen = useTipsStore((s) => s.markTipSeen);
  const tip = tipDefs[screen];
  if (!tip || tipsSeen[screen]) return null;
  const dismiss = () => markTipSeen(screen);
  return (
    <View
      style={{
        position: 'absolute',
        left: 20,
        bottom: 20,
        width: 300,
        backgroundColor: '#141519',
        borderRadius: 16,
        paddingVertical: 16,
        paddingHorizontal: 18,
        zIndex: 85,
        gap: 8,
        shadowColor: '#141519',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.35,
        shadowRadius: 40,
        elevation: 16,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ backgroundColor: accent, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 }}>
          <Txt size={10} weight="700" mono color="#101114">
            {tr('tip')} {tip.n}/5
          </Txt>
        </View>
        <Txt size={13.5} weight="700" color="#F6F4EE">
          {tr(tip.title)}
        </Txt>
        <Pressable
          onPress={dismiss}
          style={{ marginLeft: 'auto', width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' }}
        >
          <Txt size={12} color="#a1a1aa">
            ✕
          </Txt>
        </Pressable>
      </View>
      <Txt size={12.5} color="#d4d4d8" lh={1.55}>
        {tr(tip.text)}
      </Txt>
      <Pressable onPress={dismiss} style={{ alignSelf: 'flex-start', paddingVertical: 2 }}>
        <Txt size={12} weight="700" color={accent}>
          {tr('got it ✓')}
        </Txt>
      </Pressable>
    </View>
  );
}
