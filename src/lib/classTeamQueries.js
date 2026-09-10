/**
 * 팀 루트·정리본·교재 과 조회 — 오너 화면 3곳(입력판·태블릿 판·팀 페이지 오너 뷰)이 같은 조회를 쓴다.
 * 전부 RLS 아래 내 행 조회(reading_materials)다 — API 라우트를 거치지 않는다(오너 뷰 계약).
 */
import { supabase } from './supabase';

/** 내 팀 루트 자료 한 행(전체 컬럼) — 없으면 null. */
export async function fetchTeamRoot(userId, key) {
  const { data, error } = await supabase
    .from('reading_materials')
    .select('*')
    .eq('owner_id', userId)
    .filter('processed_json->metadata->team->>key', 'eq', key)
    .filter('processed_json->metadata->team->>root', 'eq', 'true')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

/** 그날 정리본(전체 컬럼 — 재분석 RPC가 raw_text·processed_json 전체를 기대값으로 쓴다). 없으면 null. */
export async function fetchDayNote(userId, key, day) {
  const { data, error } = await supabase
    .from('reading_materials')
    .select('*')
    .eq('owner_id', userId)
    .filter('processed_json->metadata->team->>key', 'eq', key)
    .filter('processed_json->metadata->team->>day', 'eq', day)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

/** 팀 정리본: raw_text는 classEntries의 원문 위치·내용 검증에도 필요하다. */
export async function fetchDayNotes(userId, key) {
  const { data, error } = await supabase
    .from('reading_materials')
    .select('id, title, owner_id, created_at, raw_text, processed_json')
    .eq('owner_id', userId)
    .filter('processed_json->metadata->team->>key', 'eq', key)
    .filter('processed_json->metadata->team->>root', 'is', null);
  if (error) throw error;
  return data || [];
}

/** 책 묶음의 과 목록 — 순번 오름차순. 뷰어의 book-chapters 조회와 같은 모양. */
export async function fetchBookChapters(bookKey) {
  if (!bookKey) return [];
  const { data, error } = await supabase
    .from('reading_materials')
    .select('id, title, processed_json->status, processed_json->metadata->book')
    .filter('processed_json->metadata->book->>key', 'eq', bookKey);
  if (error) throw error;
  return (data || [])
    .map((r) => ({ id: r.id, title: r.title, status: r.status, order: Number(r.book?.order) || 0 }))
    .sort((a, b) => a.order - b.order);
}

/** 과 제목에서 책 제목 접두(「교재 — 3과」)를 걷어낸다 — 자료실 책 카드와 같은 규칙. */
export function chapterLabel(title) {
  const t = String(title || '');
  return t.includes(' — ') ? t.split(' — ').slice(1).join(' — ') : t;
}
