-- 복원(오너 확인 뒤에만) — 20261111040000_zh_erhua_r(ZH-ERHUA 안 A 백필).
-- 사용자 자료가 섞여 있어 적용 뒤 재분석 · 손 보정이 있었을 수 있다 — 통째 되돌리기 대신 **토큰 단위**로, 지금 값이 새 병음(儿 자리 r)인
-- 토큰만 옛 병음으로 돌린다. (processed_json 통째 백업은 backup_private.zh_erhua_r_20261111에 남는다 — 그 사이 변경이 없음을 확인한
-- 경우에만 통째 복원을 쓴다.) 되돌린 자료는 metadata.viewerRevision을 새로 뽑는다. 한 트랜잭션으로 실행한다.
-- ⚠ 새 분석은 토크나이저가 얼화 꼴(r)을 내므로, 토크나이저를 되돌리지 않고 이 SQL만 돌리면 같은 낱말이 자료마다 다른 꼴이 된다.

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $rb$
DECLARE r record; n int;
BEGIN
  FOR r IN SELECT * FROM (VALUES
      (188::bigint, 'id_1_7_1788062733607', 'yì diǎn ér', 'yì diǎn r'),
      (189::bigint, 'id_3_9_1788325545037', 'yì diǎn ér', 'yì diǎn r'),
      (189::bigint, 'id_7_17_1788325545037', 'yì diǎn ér', 'yì diǎn r'),
      (196::bigint, 'id_15_16_1794300050097', 'huà ér', 'huà r'),
      (213::bigint, 'id_4_0_1788641732330', 'dà huǒ ér', 'dà huǒ r'),
      (263::bigint, 'id_11_3_1791252878405', 'xīn yǎn ér', 'xīn yǎn r'),
      (263::bigint, 'id_6_8_1791252878405', 'yì diǎn ér', 'yì diǎn r'),
      (365::bigint, 'id_3_2_1794076432866', 'yǒu diǎn er', 'yǒu diǎn r'),
      (365::bigint, 'id_6_5_1794076432866', 'zǎo diǎn ér', 'zǎo diǎn r'),
      (366::bigint, 'id_2_0_1794076437817', 'nà ér', 'nà r'),
      (366::bigint, 'id_2_2_1794076437817', 'zhè ér', 'zhè r'),
      (366::bigint, 'id_5_1_1794076437817', 'nǎ ér', 'nǎ r'),
      (367::bigint, 'id_8_10_1794076443155', 'yì diǎn ér', 'yì diǎn r'),
      (370::bigint, 'id_6_3_1794076460988', 'yì diǎn ér', 'yì diǎn r')) v(mid, k, old_furi, new_furi) LOOP
    IF NOT EXISTS (SELECT 1 FROM backup_private.zh_erhua_r_20261111 b WHERE b.material_id = r.mid) THEN
      RAISE NOTICE 'zh erhua r rollback: skip % % (no backup row)', r.mid, r.k; CONTINUE;
    END IF;
    UPDATE public.reading_materials m
       SET processed_json = jsonb_set(jsonb_set(m.processed_json, ARRAY['dictionary', r.k, 'furigana'], to_jsonb(r.old_furi)),
                                      '{metadata,viewerRevision}', to_jsonb(gen_random_uuid()::text))
     WHERE m.id = r.mid AND m.processed_json->'dictionary'->r.k->>'furigana' = r.new_furi;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 0 THEN RAISE NOTICE 'zh erhua r rollback: keep % % (not the new value)', r.mid, r.k; END IF;
  END LOOP;
END $rb$;

COMMIT;
