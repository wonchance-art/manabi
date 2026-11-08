/**
 * 공개 영어 자료의 빈 뜻 토큰을 공유 사전으로 채운다(SEED-QA-002 C · 2026-11-08 KST, 오케스트레이터 20:32 승인).
 * 서버 전용 — RPC material_fill_empty_meanings(20261108060000, service_role 전용)를 부른다. 규칙은 SQL 한 곳에만 있다
 * (analyzeCore 응답 조립과 같은 값: 사전 pos · 첫 뜻, 출처 표식 meaning_src 'dictionary'). 이 파일은 상한과 실패 처리만 맡는다.
 *
 * 왜: analyzeCore는 뜻 조회 실패 · 상한 초과분을 빈 뜻으로 넘기고 「다음 요청에서 백필」하는데, 시드는 저장 뒤 다시 분석되지 않아
 *   빈 뜻이 영영 남았다(공개 영어 33편 · 50토큰 실측). 사전에 뜻이 생기면 이 단계가 그 토큰을 채운다. LLM 호출 없음.
 * 부르는 곳: /api/cron/analysis-jobs 사슬 끝 tick(02:45 KST 예약 실행) — 난이도 갱신 앞. 실행 줄 detail.meaningFill(OPS-HEALTH-001).
 * 상한: 사슬 끝 tick마다 자료 MEANING_FILL_PER_TICK편. 사슬 끝 tick은 하루 예약 실행 1번 + 난이도가 남았을 때의 이어 부르기(132편 기준 3번)뿐이고,
 *   이미 채운 토큰은 다시 고르지 않으므로(멱등) 반복 호출은 0건으로 끝난다.
 * 실패해도 throw하지 않는다(크론 본체 · 난이도 단계를 깨지 않는다). 함수가 아직 없는 배포 순간(PGRST202)은 「건너뜀」.
 */
export const MEANING_FILL_PER_TICK = 50;

export async function fillPublicEmptyMeanings(supabase, { limit = MEANING_FILL_PER_TICK } = {}) {
  try {
    const { data, error } = await supabase.rpc('material_fill_empty_meanings', { p_limit: limit });
    if (error) {
      if (error.code === 'PGRST202') return { skipped: 'rpc-missing' };
      return { error: String(error.message || error.code || 'rpc failed').slice(0, 200) };
    }
    return {
      materials: Number(data?.materials) || 0,
      tokens: Number(data?.tokens) || 0,
      remaining: Number(data?.remaining) || 0,
      unfillable: Number(data?.unfillable) || 0,
      more: Boolean(data?.more),
    };
  } catch (error) {
    return { error: String(error?.message || error).slice(0, 200) };
  }
}
