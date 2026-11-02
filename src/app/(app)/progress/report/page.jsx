import { Suspense } from 'react';
import StudyReportPage from '@/views/StudyReportPage';
export const metadata = { title: '학습 진단지', description: '한 주 · 한 달 학습을 한 장으로 — 구성 · 균형 · 기억 · 수준 · 변화 · 다음 조절.' };
export default function Page() {
  return <Suspense fallback={null}><StudyReportPage /></Suspense>;
}
