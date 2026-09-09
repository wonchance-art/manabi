'use client';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import MaterialComposer from './MaterialComposer';
const LegacyImport = dynamic(() => import('@/views/MaterialAddPage'), { loading: () => <p role="status">가져오기 도구를 여는 중…</p> });

export default function MaterialEntry() {
  const params = useSearchParams();
  // Existing book/suggestion routes retain their import contracts. A direction hint
  // alone is not a legacy import and never silently turns new writing into a note.
  return params.has('book') || params.has('suggestion') || params.get('advanced') === '1'
    ? <LegacyImport /> : <MaterialComposer />;
}
