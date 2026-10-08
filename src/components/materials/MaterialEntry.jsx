'use client';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import MaterialComposer from './MaterialComposer';
import SuggestionReader from './SuggestionReader';
import { VIEWER_LANGUAGES, textReadingSupported, viewerLanguageInfo } from '@/lib/viewerLanguage';
import { LEVELS, MATERIAL_DIRECTION } from '@/lib/constants';
import '@/components/notes/study-notes.css';
const LegacyImport = dynamic(() => import('@/views/MaterialAddPage'), { loading: () => <p role="status">가져오기 도구를 여는 중…</p> });

export default function MaterialEntry() {
  const params = useSearchParams();
  // Previously saved recommendation URLs open a reading; new writing still offers a private note.
  if (params.has('suggestion')) return <SuggestionReader key={params.get('suggestion')} id={params.get('suggestion')} />;
  const textReadingLanguages = Object.values(VIEWER_LANGUAGES).filter(info => !LEVELS[info.language]
    && textReadingSupported(info));
  const requested = viewerLanguageInfo(params.get('language'));
  const isTextReading = params.get('direction') !== MATERIAL_DIRECTION.WRITE && !params.has('pdf') && !params.has('epub')
    && textReadingLanguages.some(info => info.language === requested?.language);
  return params.has('book') || params.get('advanced') === '1' || isTextReading
    ? <LegacyImport /> : <><nav className="note-composer-switch" aria-label="자료 작성 방식" style={{ gap: 16, flexWrap: 'wrap' }}>
      <Link href="/notes/new">필기 노트로 작성 ↗</Link>
      {params.get('direction') !== MATERIAL_DIRECTION.WRITE && textReadingLanguages.map(info => (
        <Link key={info.code} href={`/materials/add?language=${info.code}`}>{info.labelKo} 텍스트 읽기 ↗</Link>
      ))}
    </nav><MaterialComposer /></>;
}
