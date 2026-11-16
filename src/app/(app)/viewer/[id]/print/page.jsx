import { Suspense } from 'react';
import { Noto_Serif_JP, Noto_Serif_SC } from 'next/font/google';
import { PRIVATE_ROBOTS } from '@/lib/seo';
import ViewerLoading from '@/components/viewer/ViewerLoading';
import DeferredZhFontSheets from '@/components/fonts/DeferredZhFontSheets';
import PrintPage from '@/views/PrintPage';

// 인쇄 학습지(PRINT-SHEET-001) — 본문 명조. 두 패밀리 모두 저장소 글꼴 사본(vendor/google-fonts)에 있는 요청과 같은 굵기다.
// 미리 받지 않는다(preload false) — 인쇄 단추가 글꼴을 기다린 뒤 인쇄 창을 연다(PrintPage print).
const jaSerif = Noto_Serif_JP({ subsets: ['latin'], weight: '400', display: 'swap', variable: '--font-print-ja', preload: false });
const zhSerif = Noto_Serif_SC({ subsets: ['latin'], weight: ['400', '600'], display: 'swap', variable: '--font-print-zh', preload: false });

// 자료마다의 인쇄 화면 — 검색에 싣지 않는다(본문은 뷰어 주소가 정본).
export const metadata = { title: '인쇄', robots: PRIVATE_ROBOTS };

export default async function Page({ params }) {
  const { id } = await params;
  return (
    <div className={`${jaSerif.variable} ${zhSerif.variable}`}>
      {/* 뜻풀이 낱말(Noto Sans SC)이 중국어일 수 있다 — 언어를 모르는 쪽이라 뷰어 기본과 같이 바로 붙인다. */}
      <DeferredZhFontSheets />
      <Suspense fallback={<ViewerLoading />}><PrintPage id={id} /></Suspense>
    </div>
  );
}
