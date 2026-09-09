'use client';

/**
 * 태블릿 판 `/class/[team]/board` (v2-AB R1 §5, #1077 5603827169) — 오너 계정·**읽기 전용**.
 *
 * 테이블 가운데 놓인 태블릿이 화이트보드를 대신한다. 폰 입력판의 Broadcast 신호를 받으면 정리본을
 * 다시 읽고, 신호가 끊겨도 15초 폴링(BOARD_POLL_MS)으로 최신이 된다 — 판은 멈추지 않는다.
 * 이 화면은 쓰기 0(계약): 정리본은 입력판이 만들고, 여기서는 읽기만 한다.
 */
import { useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../lib/AuthContext';
import { getTeam, todayKey, dayLabel, noteEntries, BOARD_POLL_MS } from '../lib/classBoard';
import { fetchTeamRoot, fetchDayNote, fetchBookChapters, chapterLabel } from '../lib/classTeamQueries';
import { openClassChannel } from '../lib/classRealtime';

export default function ClassBoardPage() {
  const { team: key } = useParams();
  const { user, loading } = useAuth();
  const day = todayKey();

  const { data: root, isLoading: rootLoading } = useQuery({
    queryKey: ['class-root', user?.id, key],
    queryFn: () => fetchTeamRoot(user.id, key),
    enabled: !!user?.id && !!key,
    refetchInterval: BOARD_POLL_MS,
  });
  const team = getTeam(root?.processed_json?.metadata);
  const owned = !!user && !!root && root.owner_id === user.id;

  const { data: note, refetch } = useQuery({
    queryKey: ['class-note', user?.id, key, day],
    queryFn: () => fetchDayNote(user.id, key, day),
    enabled: owned,
    refetchInterval: BOARD_POLL_MS,
  });
  const { data: chapters = [] } = useQuery({
    queryKey: ['book-chapters', team?.bookKey],
    queryFn: () => fetchBookChapters(team.bookKey),
    enabled: !!team?.bookKey,
    staleTime: 1000 * 60,
  });
  const currentChapter = chapters.find((c) => String(c.id) === (team?.chapterId || '')) || null;

  // Broadcast = 「다시 읽어라」 신호. 내용은 그리지 않는다(RLS 조회가 정본).
  useEffect(() => {
    if (!owned) return undefined;
    const ch = openClassChannel(key, { onEntry: () => { refetch(); } });
    return () => ch.close();
  }, [owned, key, refetch]);

  const entries = useMemo(() => (note ? noteEntries(note) : []), [note]);
  const lastRef = useRef(null);
  const countRef = useRef(0);
  useEffect(() => {
    if (entries.length > countRef.current) lastRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    countRef.current = entries.length;
  }, [entries.length]);

  if (loading || rootLoading) return null;
  if (!user || !owned) {
    return (
      <div className="page-container" style={{ maxWidth: 560, textAlign: 'center', paddingTop: 60 }}>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>태블릿 판은 이 팀의 선생님 계정으로 열어요</h1>
        {!user
          ? <Link href={`/auth?from=${encodeURIComponent(`/class/${key}/board`)}`} className="btn btn--primary btn--md">로그인 →</Link>
          : <Link href={`/class/${key}`} className="btn btn--secondary btn--md">팀 페이지로 →</Link>}
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: 1100 }}>
      <div className="page-header page-header--row">
        <div>
          <h1 className="page-header__title">{team.name} · {dayLabel(day)} 수업</h1>
          {currentChapter && (
            <p className="page-header__subtitle">
              {currentChapter.order}. {chapterLabel(currentChapter.title)} · <Link href={`/viewer/${currentChapter.id}`} style={{ color: 'var(--accent-text)' }}>교재 본문 →</Link>
            </p>
          )}
        </div>
        <Link href={`/class/${key}/live`} className="viewer-back-link">📱 입력판</Link>
      </div>

      <div className="class-board" aria-live="polite">
        {entries.length === 0 && (
          <div className="class-board__empty">아직 항목이 없어요 — 폰 입력판에서 첫 단어를 적으면 여기 떠요.</div>
        )}
        {entries.map((e, i) => (
          <div
            key={e.idx}
            ref={i === entries.length - 1 ? lastRef : null}
            className={`class-board__row${i === entries.length - 1 ? ' class-board__row--new' : ''}`}
          >
            <span className="class-board__word" lang={team.lang === 'Japanese' ? 'ja' : team.lang === 'Chinese' ? 'zh' : team.lang === 'French' ? 'fr' : 'en'}>{e.text}</span>
            <span className="class-board__reading">{e.reading}</span>
            <span className="class-board__meaning">{e.analyzed ? e.meaning : ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
