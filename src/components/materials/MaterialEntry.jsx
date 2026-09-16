'use client';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import MaterialComposer from './MaterialComposer';
import SuggestionReader from './SuggestionReader';
import '@/components/notes/study-notes.css';
const LegacyImport = dynamic(() => import('@/views/MaterialAddPage'), { loading: () => <p role="status">가져오기 도구를 여는 중…</p> });

export default function MaterialEntry() {
  const params = useSearchParams();
  // Previously saved recommendation URLs open a reading; new writing still offers a private note.
  if (params.has('suggestion')) return <SuggestionReader key={params.get('suggestion')} id={params.get('suggestion')} />;
  return params.has('book') || params.get('advanced') === '1'
    ? <LegacyImport /> : <><nav className="note-composer-switch" aria-label="자료 작성 방식"><Link href="/notes/new">필기 노트로 작성 ↗</Link></nav><MaterialComposer /></>;
}
