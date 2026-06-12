import { supabase } from './supabase';

/**
 * 레퍼런스 학습 진행 동기화 (user_ref_progress)
 * - 비로그인: localStorage 단독 (기존 동작 그대로)
 * - 로그인: 쓰기 시 서버 upsert + 목록 진입 시 양방향 병합(pull)
 * 읽음 키(ja_read_chapters 등)의 접두사로 언어를 판별한다.
 */
const PREFIX_LANG = { ja: 'Japanese', en: 'English', fr: 'French' };

export function langFromReadKey(readKey) {
  return PREFIX_LANG[String(readKey || '').slice(0, 2)] || null;
}

/** 읽음 기록 서버 반영 — 실패해도 조용히 무시 (localStorage가 원본) */
export function syncReadRemote(userId, lang, slug) {
  if (!userId || !lang || !slug) return;
  supabase
    .from('user_ref_progress')
    .upsert(
      { user_id: userId, lang, slug, read: true, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,lang,slug' }
    )
    .then(() => {}, () => {});
}

/** 패턴 체크 결과 서버 반영 */
export function syncCheckRemote(userId, lang, slug, result) {
  if (!userId || !lang || !slug || !result?.total) return;
  supabase
    .from('user_ref_progress')
    .upsert(
      {
        user_id: userId,
        lang,
        slug,
        check_right: result.right,
        check_total: result.total,
        passed: !!result.passed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,lang,slug' }
    )
    .then(() => {}, () => {});
}

const PULL_THROTTLE_KEY = 'ref_pull_at';
const PULL_THROTTLE_MS = 5 * 60 * 1000;

/**
 * 서버 ↔ localStorage 양방향 병합.
 * readKeys: { Japanese: 'ja_read_chapters', ... }
 * 반환: localStorage가 갱신됐으면 true (호출부가 상태 재로딩).
 */
export async function pullProgress(userId, readKeys, { force = false } = {}) {
  if (!userId || typeof window === 'undefined') return false;
  try {
    if (!force) {
      const last = Number(sessionStorage.getItem(PULL_THROTTLE_KEY) || 0);
      if (Date.now() - last < PULL_THROTTLE_MS) return false;
    }
    sessionStorage.setItem(PULL_THROTTLE_KEY, String(Date.now()));

    const { data, error } = await supabase
      .from('user_ref_progress')
      .select('lang, slug, read, check_right, check_total, passed, updated_at')
      .eq('user_id', userId);
    if (error) return false;

    const byLang = {};
    (data || []).forEach(r => { (byLang[r.lang] ||= new Map()).set(r.slug, r); });

    let changed = false;
    const toPush = [];

    for (const [lang, readKey] of Object.entries(readKeys)) {
      const remote = byLang[lang] || new Map();
      const checkKey = `${readKey}_check`;

      // 읽음 — 합집합 (서버→로컬 추가, 로컬 전용은 서버로)
      let localRead;
      try { localRead = new Set(JSON.parse(localStorage.getItem(readKey) || '[]')); }
      catch { localRead = new Set(); }
      const before = localRead.size;
      for (const [slug, r] of remote) if (r.read) localRead.add(slug);
      if (localRead.size !== before) {
        localStorage.setItem(readKey, JSON.stringify([...localRead]));
        changed = true;
      }
      for (const slug of localRead) {
        if (!remote.get(slug)?.read) {
          toPush.push({ user_id: userId, lang, slug, read: true });
        }
      }

      // 패턴 체크 — 더 최신 기록 우선
      let localCheck;
      try { localCheck = JSON.parse(localStorage.getItem(checkKey) || '{}'); }
      catch { localCheck = {}; }
      let checkChanged = false;
      for (const [slug, r] of remote) {
        if (!r.check_total) continue;
        const remoteAt = new Date(r.updated_at).getTime() || 0;
        const loc = localCheck[slug];
        if (!loc || remoteAt > (loc.at || 0)) {
          localCheck[slug] = { right: r.check_right, total: r.check_total, passed: r.passed, at: remoteAt };
          checkChanged = true;
        }
      }
      for (const [slug, loc] of Object.entries(localCheck)) {
        const r = remote.get(slug);
        const remoteAt = r ? (new Date(r.updated_at).getTime() || 0) : 0;
        if (!r?.check_total || (loc.at || 0) > remoteAt) {
          toPush.push({
            user_id: userId, lang, slug,
            check_right: loc.right, check_total: loc.total, passed: !!loc.passed,
            updated_at: new Date(loc.at || Date.now()).toISOString(),
          });
        }
      }
      if (checkChanged) {
        localStorage.setItem(checkKey, JSON.stringify(localCheck));
        changed = true;
      }
    }

    if (toPush.length > 0) {
      await supabase.from('user_ref_progress').upsert(toPush, { onConflict: 'user_id,lang,slug' });
    }
    return changed;
  } catch {
    return false;
  }
}
