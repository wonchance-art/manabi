import { Suspense } from 'react';
import MaterialEditor from '@/components/materials/MaterialEditor';

export const metadata = { title: '자료 수정' };
export default function Page() { return <Suspense><MaterialEditor /></Suspense>; }
