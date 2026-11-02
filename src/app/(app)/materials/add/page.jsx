import { Suspense } from 'react';
import Loading from '@/app/(app)/loading';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { hasSupabaseSessionInJar } from '@/lib/authCookie';
import MaterialEntry from '@/components/materials/MaterialEntry';

export const metadata = {
  title: '새 자료',
};

export default async function Page({ searchParams }) {
  const query = await searchParams;
  if (typeof query?.suggestion === 'string') redirect(`/suggestions/${encodeURIComponent(query.suggestion)}`);
  return (
    <Suspense fallback={<Loading />}>
      {/* 세션 쿠키 이름이 없으면 손님 — 로그인 확인을 기다리지 않는다(VOCAB-GUEST-FIRST-001과 같은 판정 · 같은 규칙). */}
      <MaterialEntry sessionHint={hasSupabaseSessionInJar(await cookies())} />
    </Suspense>
  );
}
