-- 복원(오너 확인 뒤에만) — 20261111030000_zh_pinyin_user_fix(ZH-PINYIN-CHECK 2차).
-- 사용자 자료라 적용 뒤 재분석 · 손 보정이 있었을 수 있다 — 통째 되돌리기 대신 **토큰 단위**로, 지금 값이 새 병음인 토큰만 옛 병음으로 돌린다.
-- 뜻을 바꾼 372의 为 두 토큰은 지금 뜻이 새 뜻일 때만 옛 뜻으로 돌린다.
-- (processed_json 통째 백업은 backup_private.zh_pinyin_fix_20261111에 남는다 — 그 사이 변경이 없음을 확인한 경우에만 통째 복원을 쓴다.)
-- 되돌린 자료는 metadata.viewerRevision을 새로 뽑는다(내용이 바뀌었으므로). 한 트랜잭션으로 실행한다.

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $rb$
DECLARE r record; n int;
BEGIN
  FOR r IN SELECT * FROM (VALUES
      (261::bigint, 'id_6_3_1790833758210', 'shù zhuó', 'shǔ zhe', NULL, NULL),
      (263::bigint, 'id_6_5_1791252878405', 'dǎ zhuó', 'dǎ zhe', NULL, NULL),
      (263::bigint, 'id_16_9_1791252878405', 'zé de', 'zé dì', NULL, NULL),
      (284::bigint, 'id_3_215_1791836771641', 'lì liáng', 'lì liàng', NULL, NULL),
      (372::bigint, 'id_5_46_1794377282275', 'wèi', 'wéi', '~를 위하여', '~(으)로'),
      (372::bigint, 'id_21_18_1794377282275', 'wèi', 'wéi', '~를 위하여', '~(이)라고'),
      (372::bigint, 'id_21_27_1794377282275', 'rèn wèi', 'rèn wéi', NULL, NULL)) v(mid, k, old_furi, new_furi, old_mn, new_mn) LOOP
    IF NOT EXISTS (SELECT 1 FROM backup_private.zh_pinyin_fix_20261111 b WHERE b.material_id = r.mid) THEN
      RAISE NOTICE 'zh pinyin fix rollback: skip % % (no backup row)', r.mid, r.k; CONTINUE;
    END IF;
    UPDATE public.reading_materials m
       SET processed_json = jsonb_set(m.processed_json, ARRAY['dictionary', r.k, 'furigana'], to_jsonb(r.old_furi))
     WHERE m.id = r.mid AND m.processed_json->'dictionary'->r.k->>'furigana' = r.new_furi;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 0 THEN RAISE NOTICE 'zh pinyin fix rollback: keep furigana % % (not the new value)', r.mid, r.k; END IF;
    IF r.new_mn IS NOT NULL THEN
      UPDATE public.reading_materials m
         SET processed_json = jsonb_set(m.processed_json, ARRAY['dictionary', r.k, 'meaning'], to_jsonb(r.old_mn))
       WHERE m.id = r.mid AND m.processed_json->'dictionary'->r.k->>'meaning' = r.new_mn;
      GET DIAGNOSTICS n = ROW_COUNT;
      IF n = 0 THEN RAISE NOTICE 'zh pinyin fix rollback: keep meaning % % (not the new value)', r.mid, r.k; END IF;
    END IF;
    UPDATE public.reading_materials m SET processed_json = jsonb_set(m.processed_json, '{metadata,viewerRevision}', to_jsonb(gen_random_uuid()::text)) WHERE m.id = r.mid;
  END LOOP;
END $rb$;

COMMIT;
