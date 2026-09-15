'use client';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import MaterialComposer from './MaterialComposer';
import Link from 'next/link';
import '@/components/notes/study-notes.css';
const LegacyImport = dynamic(() => import('@/views/MaterialAddPage'), { loading: () => <p role="status">가져오기 도구를 여는 중…</p> });

export default function MaterialEntry() {
  const params = useSearchParams();
  // Existing book/suggestion routes retain their import contracts. A direction hint
  // alone is not a legacy import and never silently turns new writing into a note.
  return params.has('book') || params.has('suggestion') || params.get('advanced') === '1'
    ? <LegacyImport /> : <><nav className="note-composer-switch" aria-label="자료 작성 방식"><Link href="/notes/new">필기 노트로 작성 ↗</Link></nav><MaterialComposer /></>;
}
