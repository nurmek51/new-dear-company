import { View } from 'react-native';
import { useT } from '@/shared/lib/useT';
import { useTheme } from '@/shared/theme';
import { Chip, Txt } from '@/shared/ui';

interface Props {
  page: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

/** Real DRF page-number paging (replaces the design's decorative "fetching more" line). */
export function Pager({ page, totalPages, hasPrev, hasNext, onPrev, onNext }: Props) {
  const t = useTheme();
  const tr = useT();
  if (totalPages <= 1) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 16 }}>
      <Chip label={tr('← previous')} bg={hasPrev ? t.chip : 'transparent'} color={hasPrev ? t.ink : t.mut2} weight="600" onPress={hasPrev ? onPrev : undefined} />
      <Txt size={13} color={t.mut2}>
        {tr('page')} {page} {tr('of')} {totalPages}
      </Txt>
      <Chip label={tr('next →')} bg={hasNext ? t.chip : 'transparent'} color={hasNext ? t.ink : t.mut2} weight="600" onPress={hasNext ? onNext : undefined} />
    </View>
  );
}
