import { notFound } from 'next/navigation';
import ArtWorkOpen from '@/components/art/ArtWorkOpen';
import { ART_PUBLISHED_CURATIONS, artReadingItem } from '@/lib/artReading';

// 「그림 한 장 읽기」 작품 주소(ART-READ-001) — 기사처럼 공유하기 좋은 고정 주소. 자료 번호가 바뀌어도 이 주소는 그대로다.
// 서버는 카탈로그에서 작품을 확인만 하고, 읽을 장 찾기는 로그인 상태를 아는 클라이언트(RLS)가 한다 — 공개 전 장은 게시한 관리자만 열린다.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { work } = await params;
  const item = artReadingItem(work);
  return item ? { title: item.title.native, description: `그림 한 장 읽기 · ${item.title.ko ?? item.title.native}` } : { title: '그림 한 장 읽기' };
}

export default async function Page({ params }) {
  const { work } = await params;
  const item = artReadingItem(work);
  if (!item) notFound();
  return <ArtWorkOpen workId={item.id} textSha256={item.textSha256} title={item.title.native} curationOrder={[...ART_PUBLISHED_CURATIONS]} />;
}
