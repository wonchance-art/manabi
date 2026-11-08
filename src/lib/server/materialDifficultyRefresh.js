/**
 * 공개 자료 난이도 요약 갱신(MATERIAL-DIFFICULTY-002 · 2026-11-08 KST, 디자인 M2 「공개 카드 난이도 한 줄」).
 * 서버 전용 — 급수 색인(levelListData)을 들이므로 클라이언트에서 부르지 않는다(손님 목록 JS가 수 MB 늘어나는 것을 막는 것이 이 모듈의 이유).
 *
 * 계산은 정본 materialDifficulty(#1743)만 쓴다 — 이 파일은 그 결과를 화면용 요약 한 칸(metadata.difficulty)으로 줄여 RPC
 * material_set_difficulty(20261108040000, service_role 전용)로 쓴다. 그 RPC는 그 한 칸만 바꾸고, 셈하는 사이 재분석이 끼면 쓰지 않는다.
 * 부르는 곳: /api/cron/analysis-jobs tick 끝(02:45 KST 예약 실행) — 첫 실행이 공개 132편 백필, 이후 새 시드 · 재분석분.
 * 재분석(runPreservedReanalysis)은 이 칸을 지운다(내용이 바뀌면 옛 요약이 남지 않게) — 다음 tick이 다시 셈한다.
 */
import { levelMapFromIndex, materialDifficulty } from '../materialDifficulty';

/** 요약 형식이 바뀌면 올린다 — 다른 version의 행은 다시 셈한다. */
export const DIFFICULTY_VERSION = 1;
export const SCALE_BY_LANGUAGE = Object.freeze({ Chinese: 'HSK', Japanese: 'JLPT' });

/** 정본 결과 → 화면용 요약(디자인 세션과 맞춘 이름 — version · scale · medianLevel · p90Level · types · listedShare). */
export function difficultySummary(processedJson, levelMap, language) {
  const d = materialDifficulty(processedJson, levelMap, language);
  const scale = SCALE_BY_LANGUAGE[language] && levelMap ? SCALE_BY_LANGUAGE[language] : null;
  return {
    version: DIFFICULTY_VERSION,
    scale,
    medianLevel: scale ? d.medianLevel : null,
    p90Level: scale ? d.p90Level : null,
    types: d.types,
    listedShare: scale && d.listedShare != null ? Math.round(d.listedShare * 100) / 100 : null,
  };
}

let mapsPromise = null;
/** 언어별 급수 지도(한 인스턴스에 한 번). 일본어는 가나 읽기 키 · 동음이의는 쉬운 급수(N 숫자가 큰 쪽) — #1743 실측과 같은 설정. */
export function levelMaps(loaders) {
  if (!loaders && mapsPromise) return mapsPromise;
  const run = (async () => {
    const { japaneseLevelIndex, chineseLevelIndex } = loaders || await import('../levelListData');
    const [ja, zh] = await Promise.all([japaneseLevelIndex(), chineseLevelIndex()]);
    return {
      Japanese: levelMapFromIndex(ja, { withReadings: true, easier: (a, b) => a > b }),
      Chinese: levelMapFromIndex(zh),
    };
  })();
  if (!loaders) mapsPromise = run;
  return run;
}

/** 한 tick이 셈하는 상한(오케스트레이터 13:35 KST — 시간 · 쿼터를 넘지 않게). 남으면 route가 다음 tick을 부른다. */
export const DIFFICULTY_PER_TICK = 50;

/**
 * difficulty가 없거나 version이 다른 공개 · completed 자료를 셈해 쓴다. 실패는 행마다 삼키고 센다(크론을 멈추지 않는다).
 * @returns {{ candidates:number, written:number, stale:number, failed:number, more:boolean }} more = 상한 밖에 남은 행이 있다
 */
export async function refreshPublicDifficulty(supabase, { limit = DIFFICULTY_PER_TICK, batch = 20, maps, log = (...a) => console.warn('[difficulty]', ...a) } = {}) {
  const { data: rows, error } = await supabase.from('reading_materials')
    .select('id, version:processed_json->metadata->difficulty->>version')
    .eq('visibility', 'public').eq('processed_json->>status', 'completed')
    .order('id', { ascending: true }).limit(2000);
  if (error) throw error;
  const pending = (rows || []).filter((r) => r.version !== String(DIFFICULTY_VERSION));
  const todo = pending.slice(0, limit).map((r) => r.id);
  const out = { candidates: todo.length, written: 0, stale: 0, failed: 0, more: pending.length > todo.length };
  if (!todo.length) return out;
  const byLang = maps || await levelMaps();
  for (let i = 0; i < todo.length; i += batch) {
    const ids = todo.slice(i, i + batch);
    const { data: full, error: readError } = await supabase.from('reading_materials').select('id, processed_json').in('id', ids);
    if (readError) { out.failed += ids.length; log('read failed', readError.code || readError.message); continue; }
    for (const row of full || []) {
      const pj = row.processed_json || {};
      const language = pj.metadata?.language;
      const summary = difficultySummary(pj, byLang[language] || null, language);
      const { data: ok, error: rpcError } = await supabase.rpc('material_set_difficulty', {
        p_id: row.id, p_difficulty: summary, p_expected_updated_at: pj.metadata?.updated_at ?? null,
      });
      if (rpcError) { out.failed += 1; log('write failed', row.id, rpcError.code || rpcError.message); }
      else if (ok) out.written += 1;
      else out.stale += 1;   // 셈하는 사이 재분석 · 공개 범위 변경 — 다음 tick이 다시 본다
    }
  }
  return out;
}
