import { Suspense } from 'react';
import MaterialEntry from '@/components/materials/MaterialEntry';

export const metadata = {
  title: '새 자료 추가',
};

export default function Page() {
  return (
    <Suspense>
      <MaterialEntry />
    </Suspense>
  );
}
