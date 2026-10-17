import { Suspense } from 'react';
import Loading from '@/app/(app)/loading';
import MaterialEditor from '@/components/materials/MaterialEditor';

export const metadata = { title: '자료 수정' };
export default function Page() { return <Suspense fallback={<Loading />}><MaterialEditor /></Suspense>; }
