'use client';
// /art/<작품> → 그 작품의 읽을 장 뷰어로 바로 넘긴다(ART-READ-001). 읽을 장이 없으면(공개 전·비로그인) 안내와 발견 링크.
import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { fetchArtChapterIndex } from '@/lib/artReadingIndex';

export default function ArtWorkOpen({ workId, textSha256, title, curationOrder }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const expected = useMemo(() => new Map([[workId, textSha256]]), [workId, textSha256]);
  const index = useQuery({
    queryKey: ['art-work-open', workId, user?.id ?? 'guest'],
    enabled: !loading,
    queryFn: () => fetchArtChapterIndex(supabase, expected, curationOrder),
  });
  const chapter = index.data?.get(workId);
  useEffect(() => { if (chapter) router.replace(`/viewer/${chapter.id}`); }, [chapter, router]);
  const missing = index.isError || (index.isSuccess && !chapter);
  return (
    <div className="manabi-page">
      <h1 lang="ja">{title}</h1>
      {missing
        ? <p className="manabi-inline-state">아직 읽을 수 없는 작품이에요. <Link className="manabi-link" href="/discover">발견에서 다른 그림 보기</Link></p>
        : <p className="manabi-inline-state" role="status">글을 여는 중이에요…</p>}
    </div>
  );
}
