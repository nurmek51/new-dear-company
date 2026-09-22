import { type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useBreakpoint } from '@/shared/lib/responsive';
import { useTheme } from '@/shared/theme';

export interface OverlayProps {
  visible: boolean;
  onClose: () => void;
  /** max width of the sheet card (design modals are 380–560px) */
  width?: number;
  padding?: number;
  radius?: number;
  align?: 'center' | 'top';
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/** Dimmed backdrop + centered card, the design's modal pattern. */
export function Overlay({
  visible,
  onClose,
  width = 420,
  padding = 24,
  radius = 22,
  align = 'center',
  style,
  children,
}: OverlayProps) {
  const t = useTheme();
  const bp = useBreakpoint();
  if (!visible) return null;
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(20,21,25,0.45)',
          justifyContent: align === 'center' ? 'center' : 'flex-start',
          alignItems: 'center',
          padding: bp.isMobile ? 16 : 24,
          ...(align === 'top' ? { paddingTop: 90 } : null),
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[
            {
              width: '100%',
              maxWidth: width,
              maxHeight: '92%',
              backgroundColor: t.card,
              borderRadius: radius,
            },
            style,
          ]}
        >
          <ScrollView contentContainerStyle={{ padding }} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
