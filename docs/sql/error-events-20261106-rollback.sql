-- 되돌리기: 20261106180000_error_events.sql(ERROR-OBSERVE-001). 오류 기록 함수 · 스키마를 지운다 — 쌓인 오류 기록만 사라진다(학습 데이터 무관).
-- 앱은 그대로 둬도 된다: 함수가 없으면 /api/client-error · onRequestError의 RPC가 실패하고 조용히 넘어간다(언제나 204 · 요청 무영향).
-- 학습 계약 지문 범위 밖(새 스키마 · 새 함수만 지운다) — 앞뒤 지문 측정은 마이그레이션과 같은 방식으로 SQL 편집기에서 확인한다.
SET LOCAL lock_timeout = '5s';
DROP FUNCTION IF EXISTS public.observe_record_error(text, text, text, text, text, text, text, text);
DROP TABLE IF EXISTS observe.error_events;
DROP SCHEMA IF EXISTS observe;
