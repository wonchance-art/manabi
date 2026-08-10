import { Suspense } from 'react';
import MaterialAddPage from '@/views/MaterialAddPage';

export const metadata = {
  title: '새 자료 추가',
};

export default function Page() {
  return (
    <Suspense>
      <MaterialAddPage />
    </Suspense>
  );
}
