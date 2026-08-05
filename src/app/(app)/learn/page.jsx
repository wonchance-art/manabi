import { redirect } from 'next/navigation';

// 학습 대시보드는 교재 페이지 상단에 통합 — 구 링크 호환용 리다이렉트 (통합: 최적화 R4)
export default function Page() {
  redirect('/lessons');
}
