import { Suspense } from 'react';
import SuggestionReader from '@/components/materials/SuggestionReader';

export const metadata = { title: '추천 읽을거리' };

export default async function Page({ params }) {
  const { id } = await params;
  return <Suspense><SuggestionReader key={id} id={id} /></Suspense>;
}
