'use client';

/**
 * 수업 코스 클라이언트 — 학생은 해제 토큰, 선생님은 로그인(Bearer)으로 코스 페이로드를 받는다.
 * 토큰이 낡았으면(401) 로그인으로 한 번 더 시도한다(선생님이 학생 화면으로 시험해 본 기기).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { readUnlock, TOKEN_HEADER } from './classClient';

class CourseError extends Error {
  constructor(status, code) { super(code || `HTTP ${status}`); this.status = status; this.code = code; }
}

async function get(teamKey, headers) {
  const res = await fetch(`/api/class/${encodeURIComponent(teamKey)}/course`, { headers });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new CourseError(res.status, data?.error);
  return data;
}

export async function fetchClassCourse(teamKey) {
  const unlock = readUnlock(teamKey);
  if (unlock) {
    try { return await get(teamKey, { [TOKEN_HEADER]: unlock.token }); }
    catch (err) { if (err.status !== 401) throw err; }
  }
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new CourseError(401, 'unauthorized');
  return get(teamKey, { Authorization: `Bearer ${token}` });
}

export function useClassCourse(teamKey, userId, enabled = true) {
  return useQuery({
    queryKey: ['class-course', teamKey, userId || 'guest'],
    queryFn: () => fetchClassCourse(teamKey),
    enabled: !!teamKey && enabled,
    staleTime: 5 * 60 * 1000,
    retry: (count, err) => count < 1 && ![401, 404].includes(err?.status),
  });
}

/** 화면 문구 — 401은 수업 홈에서 암호부터. */
export function courseErrorText(err) {
  if (err?.status === 401) return '수업 홈에서 암호를 먼저 입력해 주세요.';
  if (err?.status === 404) return '이 수업에는 연결된 코스가 없어요.';
  if (err?.status === 429) return '잠시 후 다시 시도해 주세요.';
  if (err?.status === 503) return '지금은 열 수 없어요 — 설정을 준비 중이에요.';
  return '코스를 불러오지 못했어요.';
}
