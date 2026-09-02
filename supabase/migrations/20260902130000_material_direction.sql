-- U R3 내 노트(쓰기 자료) — reading_materials에 「방향」 축 1개 (#1077 5503520174).
-- 코드로만 낸다. 운영 DB 적용은 오너 수동(하드리밋). 오너 결정: language='Korean'을 신설하지
-- 않는다(4종 강제 상수가 전역에 퍼져 파급이 크다) — 대신 컬럼 하나. 노트는 reading_materials의
-- 행이다(별도 테이블 금지 — 노션화 방어선). 기존 행은 'read'로 백필된다(DEFAULT).
ALTER TABLE reading_materials
  ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'read'
  CHECK (direction IN ('read', 'write'));

-- 자료실 「내 자료」 조회(owner_id + visibility + direction)를 위한 보조 인덱스 — 노트가 늘어도
-- 목록 필터가 전수 스캔으로 가지 않게.
CREATE INDEX IF NOT EXISTS reading_materials_owner_direction_idx
  ON reading_materials (owner_id, direction);
