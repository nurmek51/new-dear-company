import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/shared/theme';
import { Txt } from './Txt';

/** Consistent breathing room for empty lists, with optional next-step actions. */
export function EmptyState({ title, description, children }: { title?: string; description?: string; children?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ paddingVertical: 32, paddingHorizontal: 20, alignItems: 'center', gap: 12 }}>
      {title && <Txt size={15} weight="600" align="center">{title}</Txt>}
      {description && <Txt size={13} color={t.mut} lh={1.6} align="center" style={{ maxWidth: 440 }}>{description}</Txt>}
      {children}
    </View>
  );
}
