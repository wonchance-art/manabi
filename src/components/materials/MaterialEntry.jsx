'use client';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import MaterialComposer from './MaterialComposer';
import SuggestionReader from './SuggestionReader';
import { VIEWER_LANGUAGES, textReadingSupported, viewerLanguageInfo } from '@/lib/viewerLanguage';
import { LEVELS, MATERIAL_DIRECTION } from '@/lib/constants';
import { useStudyLanguages } from '@/lib/useStudyLanguages';
import '@/components/notes/study-notes.css';
const LegacyImport = dynamic(() => import('@/views/MaterialAddPage'), { loading: () => <p aria-busy="true">가져오기 도구를 여는 중…</p> });

export default function MaterialEntry({ sessionHint = null } = {}) {
  const params = useSearchParams();
  // 한국어 텍스트 읽기 입구는 작성기 언어 칩과 같은 기준 — 계정 배포 계약이 확인됐을 때만(FLOW-ADD-B9).
  const { languages: studyLanguageList } = useStudyLanguages();
  // Previously saved recommendation URLs open a reading; new writing still offers a private note.
  if (params.has('suggestion')) return <SuggestionReader key={params.get('suggestion')} id={params.get('suggestion')} from={params.get('from')} />;
  const textReadingLanguages = Object.values(VIEWER_LANGUAGES).filter(info => !LEVELS[info.language] && textReadingSupported(info));
  // 링크만 계정 배포 계약을 따른다(FLOW-ADD-B9). 주소(?language=ko)로 온 길은 계약 확인과 상관없이 같은 화면을 연다 —
  // 확인은 화면이 열릴 때마다 다시 돌아(staleTime 0) 그동안 길을 바꾸면 작성기 ↔ 가져오기가 끝없이 갈린다(e2e 실측).
  // 계약이 없는 계정은 가져오기 화면이 확인을 마친 뒤 한국어 선택을 거둔다.
  const textReadingLinks = textReadingLanguages.filter(info => studyLanguageList.includes(info.language));
  const requested = viewerLanguageInfo(params.get('language'));
  const isTextReading = params.get('direction') !== MATERIAL_DIRECTION.WRITE && !params.has('pdf') && !params.has('epub')
    && textReadingLanguages.some(info => info.language === requested?.language);
  return params.has('book') || params.get('advanced') === '1' || isTextReading
    ? <LegacyImport sessionHint={sessionHint} /> : <><nav className="note-composer-switch" aria-label="자료 작성 방식" style={{ gap: 16, flexWrap: 'wrap' }}>
      <Link href="/notes/new">필기 노트로 작성 ↗</Link>
      {/* 대화 모드 v2-Z Z-R2 — 자료 없이 AI 튜터와 목표어로 대화(대화도 내 비공개 자료로 남는다). */}
      <Link href="/conversation/new">자료 없이 대화하기 ↗</Link>
      {params.get('direction') !== MATERIAL_DIRECTION.WRITE && textReadingLinks.map(info => (
        <Link key={info.code} href={`/materials/add?language=${info.code}`}>{info.labelKo} 텍스트 읽기 ↗</Link>
      ))}
    </nav><MaterialComposer sessionHint={sessionHint} /></>;
}
