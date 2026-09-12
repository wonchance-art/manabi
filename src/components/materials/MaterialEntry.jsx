'use client';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import MaterialComposer from './MaterialComposer';
import SuggestionReader from './SuggestionReader';
const LegacyImport = dynamic(() => import('@/views/MaterialAddPage'), { loading: () => <p role="status">가져오기 도구를 여는 중…</p> });

export default function MaterialEntry() {
  const params = useSearchParams();
  // Old saved recommendation URLs must also open a finished reading, never an editor.
  if (params.has('suggestion')) return <SuggestionReader key={params.get('suggestion')} id={params.get('suggestion')} />;
  return params.has('book') || params.get('advanced') === '1'
    ? <LegacyImport /> : <MaterialComposer />;
}
