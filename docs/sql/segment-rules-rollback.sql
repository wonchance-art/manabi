-- AD-R3 PR④ segment-rules.sql 되돌리기(docs/manabi-viewer-v2-ad-r3.md §5.3).
-- 규칙 데이터만 사라진다. 자료의 「이 자료」 경계(processed_json.metadata.viewerBoundaries)와 이미 분석된 자료의 토큰은 그대로다.
-- 실행 전에 두 표를 CSV로 내보내 보관한다(복원 = segment-rules.sql 재적용 + CSV 재삽입).
-- 코드 쪽 안전장치: 표가 없으면(PGRST205/42P01) 분석은 규칙 없이 그대로 진행하고, 화면은 ②③ 선택지를 숨긴다(segmentRules.test.js).
-- 다른 표 · 함수 · 정책은 건드리지 않는다. 두 번 실행해도 안전하다(IF EXISTS).
BEGIN;
SET LOCAL lock_timeout = '5s';
DROP TABLE IF EXISTS public.shared_segment_rules;
DROP TABLE IF EXISTS public.user_segment_rules;
NOTIFY pgrst, 'reload schema';
COMMIT;
