'use client';

/**
 * 재독 되부름 (#1077-12) — 완독 후 14일 지난 자료를 조용히 되부른다.
 * 후보 없음·게스트·조회 실패는 렌더 생략(무해성). 선정은 rereadSchedule 엔진.
 *
 * 표시는 '교재 이어서 학습'과 **같은 부품**(.lessons-continue)이다(오너 지시 2026-08-24).
 * 둘 다 "하던 걸 이어서" 한 줄이라 서로 다른 카드 형태를 쓰면 홈이 두 문법으로 말한다 —
 * 전용 카드를 따로 만들지 않고 같은 클래스를 쓰므로 여백·높이·hover가 자동으로 붙는다.
 * 기록은 남기지 않는다(오너 확정: 읽은 횟수 무기록 — reading_progress에 카운트 없음).
 */
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { pickRereadCandidates } from '../lib/rereadSchedule';

async function fetchCompletedRows(userId) {
  const { data, error } = await supabase
    .from('reading_progress')
    .select('material_id, is_completed, completed_at, reading_materials(title)')
    .eq('user_id', userId)
    .eq('is_completed', true)
    .order('completed_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data || [];
}

export default function RereadCard() {
  const { user } = useAuth();
  const { data: rows } = useQuery({
    queryKey: ['reread-candidate', user?.id],
    queryFn: () => fetchCompletedRows(user.id),
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
  });
  if (!user || !rows) return null;

  const candidate = pickRereadCandidates({ progressRows: rows })[0];
  if (!candidate) return null;
  const title = rows.find((r) => r.material_id === candidate.material_id)?.reading_materials?.title;
  if (!title) return null;

  return (
    <Link href={`/viewer/${candidate.material_id}`} className="lessons-continue">
      <span className="lessons-continue__body">
        <span className="lessons-continue__kicker">다시 읽기 · 두 번째는 훨씬 빨라요</span>
        <span className="lessons-continue__title">{title}</span>
      </span>
      <span className="lessons-continue__meta">{candidate.daysSince}일 만에 →</span>
    </Link>
  );
}
