import { useCallback } from 'react';
import { ScrollView, View } from 'react-native';
import { resumeApi, type Resume } from '@/entities/resume';
import { useBreakpoint } from '@/shared/lib/responsive';
import { useT } from '@/shared/lib/useT';
import { accent, useTheme } from '@/shared/theme';
import { Txt } from '@/shared/ui';
import { usePagedList } from '../lib/usePagedList';
import { CoverLettersCard } from './CoverLettersCard';
import { ResumesCard } from './ResumesCard';
import { UploadCard } from './UploadCard';

/** My CV (seeker.html 1022–1061), adapted: upload card + real resume/cover-letter lists (spec §3). */
export function CvPage() {
  const t = useTheme();
  const tr = useT();
  const bp = useBreakpoint();
  const fetchPage = useCallback((page: number) => resumeApi.listResumes(page), []);
  const resumes = usePagedList<Resume>(fetchPage);
  const h1 = bp.isMobile ? 29 : 46;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 44 }}>
      <View style={{ paddingTop: 38, paddingHorizontal: bp.gutter, paddingBottom: 8, flexDirection: 'column', gap: 12, alignItems: 'center' }}>
        <Txt size={h1} weight="700" lh={1.05} ls={-0.04} align="center">{tr('first, your side')}</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Txt size={h1} weight="700" lh={1.05} ls={-0.04}>{tr('of the')}</Txt>
          <View style={{ backgroundColor: accent, borderRadius: 10, paddingHorizontal: 14, transform: [{ rotate: '-1.2deg' }] }}>
            <Txt size={h1} weight="700" lh={1.05} ls={-0.04} color="#141519">{tr('story')}</Txt>
          </View>
        </View>
        <Txt size={bp.isMobile ? 14 : 15.5} color={t.mut} lh={1.6} align="center" style={{ maxWidth: 520 }}>
          {tr("your cv is just the intro letter — not a performance review of your whole life. we'll help you here")}
        </Txt>
      </View>

      <View
        style={{
          flexDirection: bp.isMobile ? 'column' : 'row',
          justifyContent: 'center',
          gap: 16,
          paddingTop: 30,
          paddingHorizontal: bp.gutter,
          paddingBottom: 10,
          alignItems: bp.isMobile ? 'center' : 'stretch',
        }}
      >
        <View style={bp.isMobile ? { width: '100%', maxWidth: 460 } : { width: 380 }}>
          <UploadCard onUploaded={() => void resumes.reload()} />
        </View>
        <View style={bp.isMobile ? { width: '100%', maxWidth: 460 } : { width: 380 }}>
          <ResumesCard
            rows={resumes.rows}
            count={resumes.count}
            loading={resumes.loading}
            loadingMore={resumes.loadingMore}
            error={resumes.error}
            nextPage={resumes.nextPage}
            reload={resumes.reload}
            loadMore={resumes.loadMore}
            setRows={resumes.setRows}
          />
        </View>
      </View>

      <View style={{ maxWidth: 776, width: '100%', alignSelf: 'center', marginTop: 14, paddingHorizontal: bp.gutter }}>
        <CoverLettersCard />
      </View>
    </ScrollView>
  );
}
