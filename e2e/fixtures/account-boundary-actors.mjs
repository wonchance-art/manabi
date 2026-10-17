// 계정 경계 e2e(e2e/account-boundary.e2e.mjs) 표식 계정 — 서버 대역(e2e/server-fetch-mock.mjs)과 브라우저 대역이 같은 값을 쓴다.
// 다른 e2e는 이 sub를 쓰지 않는다. A에게만 비공개 표식을 주고, B · 손님에게는 RLS처럼 빈 결과를 준다.
export const BOUNDARY_ACTORS = Object.freeze({ A: '00000000-0000-4000-8000-00000000a0a1', B: '00000000-0000-4000-8000-00000000b0b2' });
export const BOUNDARY_MARKER = 'A계정비공개표식';
export const BOUNDARY_MATERIAL_ID = 94771;
