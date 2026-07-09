import { supabase } from './supabase';
// rt: 접두 판별의 단일 원천 — 독해 트랙 네임스페이스 규칙은 readingProgress.js 가 소유한다.
import { isReadingSlug } from './readingProgress';

/**
 * 레퍼런스 학습 진행 동기화 (user_ref_progress)
 * - 비로그인: localStorage 단독 (기존 동작 그대로)
 * - 로그인: 쓰기 시 서버 upsert + 목록 진입 시 양방향 병합(pull)
 * 읽음 키(ja_read_chapters 등)의 접두사로 언어를 판별한다.
 * 주의: 같은 테이블에 독해 트랙 행(slug 'rt:' 접두)이 공존한다 — 이 파일은 챕터 행만 다룬다.
 */
const PREFIX_LANG = { ja: 'Japanese', en: 'English', fr: 'French', zh: 'Chinese' };

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
 * 서버 행 → lang별 챕터 행 Map (순수 — pullProgress 병합 재료).
 * slug 가 'rt:' 접두인 행은 독해 트랙 전용 네임스페이스라 여기서 걸러낸다 — 같은
 * user_ref_progress 테이블을 쓰지만 소비자는 readingProgress.js(pullReadingProgress)다.
 * 거르지 않으면 병합 루프가 rt: 행을 챕터 읽음 Set(ja_read_chapters)·체크 기록에 섞어
 * 완주율을 오염시킨다(RT-12 위반).
 */
export function chapterRowsByLang(rows) {
  const byLang = {};
  for (const r of rows || []) {
    if (!r || typeof r.slug !== 'string' || isReadingSlug(r.slug)) continue;
    (byLang[r.lang] ||= new Map()).set(r.slug, r);
  }
  return byLang;
}

/** 챕터 읽음 병합(순수) — 서버 read:true 를 합집합. 입력 Set 은 건드리지 않는다. */
export function mergeChapterRead(localRead, remoteMap) {
  const merged = new Set(localRead);
  for (const [slug, r] of remoteMap) if (r.read) merged.add(slug);
  return merged;
}

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

    // 독해 트랙(rt:) 행은 챕터 병합에서 제외 — readingProgress.js 몫(chapterRowsByLang 주석 참조)
    const byLang = chapterRowsByLang(data);

    let changed = false;
    const toPush = [];

    for (const [lang, readKey] of Object.entries(readKeys)) {
      const remote = byLang[lang] || new Map();
      const checkKey = `${readKey}_check`;

      // 읽음 — 합집합 (서버→로컬 추가, 로컬 전용은 서버로)
      let localRead;
      try { localRead = new Set(JSON.parse(localStorage.getItem(readKey) || '[]')); }
      catch { localRead = new Set(); }
      // 자가 치유 — 과거(필터 이전) 병합이 섞어 넣은 rt: 잔재를 로컬 Set 에서 걷어낸다.
      // 남겨두면 완주율이 계속 부풀고, 아래 push 루프가 rt: 를 챕터 읽음처럼 되밀어 올린다.
      const cleanRead = new Set([...localRead].filter(s => !isReadingSlug(s)));
      const mergedRead = mergeChapterRead(cleanRead, remote);
      if (cleanRead.size !== localRead.size || mergedRead.size !== cleanRead.size) {
        localStorage.setItem(readKey, JSON.stringify([...mergedRead]));
        changed = true;
      }
      for (const slug of mergedRead) {
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
