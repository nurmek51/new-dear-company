import { type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

/** Dimmed backdrop + scrollable, keyboard-aware card. */
export function Overlay({ visible, onClose, width = 420, padding = 24, radius = 22, align = 'center', style, children }: OverlayProps) {
  const t = useTheme();
  const bp = useBreakpoint();
  const insets = useSafeAreaInsets();
  if (!visible) return null;
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: 'rgba(20,21,25,0.45)' }}
      >
        <Pressable onPress={onClose} accessibilityLabel="Close dialog" accessibilityRole="button" style={{ position: 'absolute', inset: 0 }} />
        <View
          pointerEvents="box-none"
          style={{ flex: 1, alignItems: 'center', justifyContent: align === 'center' ? 'center' : 'flex-start', paddingHorizontal: bp.isMobile ? 12 : 24, paddingTop: Math.max(insets.top + 12, align === 'top' && !bp.isMobile ? 90 : 24), paddingBottom: insets.bottom + 24 }}
        >
          <View
            accessibilityViewIsModal
            role="dialog"
            style={[{ width: '100%', maxWidth: width, maxHeight: '100%', backgroundColor: t.card, borderRadius: radius, overflow: 'hidden', flexShrink: 1 }, style]}
          >
            <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ padding: bp.isMobile ? Math.min(padding, 20) : padding }}>
              {children}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
