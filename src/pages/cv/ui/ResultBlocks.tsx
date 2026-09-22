import { View } from 'react-native';
import type { ResultBlock } from '@/entities/resume';
import { useTheme } from '@/shared/theme';
import { Txt } from '@/shared/ui';

function Block({ block, depth }: { block: ResultBlock; depth: number }) {
  const t = useTheme();
  const body = (
    <View style={{ flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 }}>
      <Txt size={13} weight="700">{block.title}</Txt>
      {block.text != null && <Txt size={12.5} color={t.mut} lh={1.5}>{block.text}</Txt>}
      {block.items?.map((it, i) => (
        <Txt key={i} size={12.5} color={t.mut} lh={1.5}>{`· ${it}`}</Txt>
      ))}
      {block.children?.map((c) => <Block key={c.key} block={c} depth={depth + 1} />)}
    </View>
  );
  if (depth > 0) return <View style={{ paddingLeft: 10, paddingTop: 4 }}>{body}</View>;
  return (
    <View style={{ flexDirection: 'row', gap: 11, alignItems: 'flex-start', borderWidth: 1, borderColor: t.chip, borderRadius: 13, paddingVertical: 13, paddingHorizontal: 15 }}>
      <Txt size={16} style={{ flexShrink: 0 }}>{'▸'}</Txt>
      {body}
    </View>
  );
}

/** Generic renderer for opaque AI results (labeled blocks per string/array/object field). */
export function ResultBlocks({ blocks }: { blocks: ResultBlock[] }) {
  return (
    <View style={{ flexDirection: 'column', gap: 9 }}>
      {blocks.map((b) => <Block key={b.key} block={b} depth={0} />)}
    </View>
  );
}
