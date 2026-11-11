-- 복원(오너 확인 뒤에만) — 20261112010000_zh_erhua_dict_cache. 공유 사전이라 그 사이 다른 분석이 같은 행을 고쳤을 수 있다 —
-- 행 단위로, 지금 읽기가 새 값(「… r」)인 행만 백업의 옛 읽기로 돌린다. reading 밖 열은 건드리지 않는다. 한 트랜잭션으로 실행한다.
-- ⚠ 자료 토큰(20261111040000)과 토크나이저는 「… r」 꼴이다 — 이것만 되돌리면 토큰 고치기 창 · 교실 조회에 옛 꼴이 다시 보인다.

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $rb$
DECLARE r record; n int;
BEGIN
  FOR r IN SELECT * FROM (VALUES
      (3127::bigint, 'yì diǎn r'), (7088, 'nǎ r'), (3524, 'dà huǒ r'), (4432, 'xīn yǎn r'), (7069, 'zǎo diǎn r'),
      (7084, 'yǒu diǎn r'), (7285, 'huà r'), (7109, 'zhè r'), (7107, 'nà r')) v(id, new_r) LOOP
    UPDATE public.morpheme_dictionary m SET reading = b.reading
      FROM backup_private.zh_erhua_dict_20261112 b
     WHERE b.id = r.id AND m.id = r.id AND m.reading = r.new_r;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 0 THEN RAISE NOTICE 'zh erhua dict rollback: keep % (no backup row or not the new value)', r.id; END IF;
  END LOOP;
END $rb$;

COMMIT;
