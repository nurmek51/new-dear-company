import { forwardRef } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Scrollable form canvas with reachable actions above the keyboard and home indicator. */
export const ScreenScrollView = forwardRef<ScrollView, ScrollViewProps & { safeAreaTop?: boolean }>(function ScreenScrollView(
  { contentContainerStyle, safeAreaTop = false, ...props }, ref,
) {
  const insets = useSafeAreaInsets();
  const contentStyle = StyleSheet.flatten(contentContainerStyle);
  const paddingBottom = Number(contentStyle?.paddingBottom ?? contentStyle?.paddingVertical ?? 24) + insets.bottom;
  const paddingTop = Number(contentStyle?.paddingTop ?? contentStyle?.paddingVertical ?? 0) + insets.top;
  return (
    <KeyboardAvoidingView style={{ flex: 1, minHeight: 0 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        ref={ref}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        {...props}
        contentContainerStyle={[contentContainerStyle, { paddingBottom }, safeAreaTop && { paddingTop }]}
      />
    </KeyboardAvoidingView>
  );
});
