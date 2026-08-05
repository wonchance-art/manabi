import { redirect } from 'next/navigation';

// 일본어 레퍼런스는 강의 페이지(일본어 탭)로 통합 — 구 링크 호환용 리다이렉트
export default function Page() {
  redirect('/lessons?lang=Japanese');
}
