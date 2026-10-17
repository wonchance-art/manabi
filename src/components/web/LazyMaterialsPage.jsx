'use client';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import Spinner from '@/components/Spinner';
import { useRestoreScroll } from '@/lib/useRestoreScroll';

// 자료 목록 화면(MaterialsPage)은 「함께 읽는 글」(/discover?view=reading)과 서재 도구(?tools=1 · ?sort=fit)에서만 그린다.
// 정적 import면 산책 · 서재 기본 화면에도 정본 대조표 · 자료 목록 청크가 실렸다(운영 약 119KB 전송, 2026-10-17 KST 실측).
const MaterialsPage = dynamic(() => import('@/views/MaterialsPage'), {
  loading: () => <Spinner message="자료 목록 불러오는 중…" />,
});

export default function LazyMaterialsPage(props) {
  const params = useSearchParams();
  // 함께 읽는 글은 뷰어 「← 발견」(readerReturnHref)이 남긴 restoreY로 목록 위치를 되찾는다. 서재 도구 화면은 LibraryPage가 한다.
  useRestoreScroll(props.libraryView === 'public' ? params.get('restoreY') : null);
  return <MaterialsPage {...props} />;
}
