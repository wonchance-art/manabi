'use client';
// 「그림 한 장 읽기」 기사형 목록(ART-READ-001, 2026-10-15 KST 오너 합의 목업) — 발견 화면의 한 절.
//
//   ─ 그림 한 장 읽기 ─────────────
//   [호쿠사이] [히로시게]                 ← 작가 묶음(전체가 기본)
//   [그림]  冨嶽三十六景 神奈川沖浪裏
//           가쓰시카 호쿠사이 · 1830–33년 · N2 상급 · 623자
//
// 카드를 누르면 서재를 거치지 않고 바로 그 장 뷰어로 간다(서재 담기는 뷰어 머리의 선택 버튼).
// 목록 값(제목·그림·작가)은 서버가 카탈로그에서 넘기고, 여기서는 「읽을 장이 있나」만 묻는다 — 없는 작품은 그리지 않는다.
// 공개 전(오너 결정 ⓑ)에는 RLS상 게시한 관리자 본인에게만 비공개 장이 보여 그 사람에게만 목록이 생긴다(「비공개 미리보기」 표시).
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { fetchArtChapterIndex } from '@/lib/artReadingIndex';
import './art-reading.css';

const ALL = 'all';

export default function ArtReadingList({ items, curationOrder }) {
  const { user, loading } = useAuth();
  const [artist, setArtist] = useState(ALL);
  const expected = useMemo(() => new Map(items.map((item) => [item.id, item.textSha256])), [items]);
  const index = useQuery({
    queryKey: ['art-reading-index', user?.id ?? 'guest'],
    enabled: !loading,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchArtChapterIndex(supabase, expected, curationOrder),
  });
  const readable = items.filter((item) => index.data?.has(item.id));
  if (!readable.length) return null;
  const artists = [...new Map(readable.filter((item) => item.artist).map((item) => [item.artist.id, item.artist])).values()];
  const shown = artist === ALL ? readable : readable.filter((item) => item.artist?.id === artist);

  return (
    <section className="art-reading" aria-labelledby="art-reading-title">
      <div className="manabi-section-heading"><h2 id="art-reading-title">그림 한 장 읽기</h2></div>
      {artists.length > 1 && (
        <div className="art-reading__chips" role="group" aria-label="작가로 고르기">
          {[{ id: ALL, ko: '전체' }, ...artists].map((choice) => (
            <button key={choice.id} type="button" aria-pressed={artist === choice.id} onClick={() => setArtist(choice.id)}>{choice.ko}</button>
          ))}
        </div>
      )}
      <ul className="art-reading__list" role="list">
        {shown.map((item) => {
          const chapter = index.data.get(item.id);
          const meta = [item.artist?.ko, item.date, item.level, `${item.chars.toLocaleString()}자`].filter(Boolean);
          return (
            <li key={item.id}>
              <Link className="art-reading__card" href={`/viewer/${chapter.id}`} prefetch={false}>
                {item.image
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img className="art-reading__thumb" src={item.image.url} alt="" width={item.image.width ?? undefined} height={item.image.height ?? undefined} loading="lazy" decoding="async" />
                  : <span className="art-reading__thumb art-reading__thumb--empty" aria-hidden="true" />}
                <span className="art-reading__copy">
                  <strong lang="ja">{item.title.native}</strong>
                  {item.title.ko && <span className="art-reading__ko">{item.title.ko}</span>}
                  <small>{meta.join(' · ')}{chapter.visibility !== 'public' && <span className="art-reading__private"> · 비공개 미리보기</span>}</small>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
