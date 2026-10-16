import { Suspense } from 'react';
import Loading from '@/app/(app)/loading';
import { redirect } from 'next/navigation';
import MaterialEntry from '@/components/materials/MaterialEntry';

export const metadata = {
  title: '새 자료',
};

export default async function Page({ searchParams }) {
  const query = await searchParams;
  if (typeof query?.suggestion === 'string') redirect(`/suggestions/${encodeURIComponent(query.suggestion)}`);
  return (
    <Suspense fallback={<Loading />}>
      <MaterialEntry />
    </Suspense>
  );
}
