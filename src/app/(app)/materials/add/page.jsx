import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import MaterialEntry from '@/components/materials/MaterialEntry';

export const metadata = {
  title: '새 자료 추가',
};

export default async function Page({ searchParams }) {
  const query = await searchParams;
  if (typeof query?.suggestion === 'string') redirect(`/suggestions/${encodeURIComponent(query.suggestion)}`);
  return (
    <Suspense>
      <MaterialEntry />
    </Suspense>
  );
}
