-- 공개 N5 시드 25편 표기 전환(A-2 자연 표기 + 후리가나) · 표제어 · 오분할 보정(JA-KANJI-A-001 — 오너 11/11 KST A-2 결정,
-- 오케스트레이터 11/11 KST 콘텐츠 판단 · 경계). 적용 경로 = main 병합 → supabase-migrations.yml(db push), 암묵 트랜잭션 하나.
--
-- 정본 = supabase/data/ja-kanji-a2-n5.json(사람이 정한 토큰 고정표). 아래 데이터 칸은 scripts/ja-kanji-a2.mjs가 그 표에서 옮긴다.
-- 경계: N5 문법 #1~#9(11편)는 가나 중심 — 표기 그대로, 표제어 · 분할만. #10~#23(14편)은 본문 표기 전환(머리 「오늘 만나는 한자」 구간 제외).
-- 하는 것:
--   ① 규칙(옛 base_form · 품사 → 새 base_form · 품사): 자기 항목 동급 · 동음이의 · 색인 밖 표제어 고정(わたし → 私 · えいが → 映画 …).
--   ② 오분할 · 오독 보정(합치기 · 나누기): かん/こく/じ/ん → かんこく + じん · た/なか → たなか · 7 + じ → 7じ(7時) … —
--      합치면 첫 key만 남고, 나누면 둘째 조각부터 새 key id_줄_칸s{n}_접미(코드는 줄 번호만 읽는다).
--   ③ 표기 전환(14편 본문): 가나 토큰 → 한자 표기, furigana = 명사류는 원래 가나 · 동사 · 형용사는 기본형 읽기 · 숫자 + 조수사는 통째.
--   ④ raw_text = 바뀐 토큰을 이은 값(토큰 이음 = 원문 유지) · metadata.updated_at · viewerRevision 새로 · difficulty 비움(크론이 다시 센다).
-- 사전 검사: 자료별 규칙 · 전환 · 보정 key 개수가 실측(운영 11/11)과 같다 · 보정 key의 옛 문자열이 같다 · 어간 불일치 0 ·
--   그 자료에 붙은 학습 기록 0(읽기 진행은 바뀌는 첫 자리보다 앞만 허용). 하나라도 어긋나면 아무것도 바꾸지 않고 멈춘다.
-- 사후 검사: 토큰 이음 = 원문 · 대상 밖 자료 md5 · 학습 계약 지문 넷. 이미 적용(백업 있음) · 대상 없는 환경(fixture 사슬)은 무변경.
-- 백업: backup_private.ja_kanji_a2_20261111(raw_text · processed_json 통째). 복원: docs/sql/ja-kanji-a2-20261111-rollback.sql(오너 확인 뒤에만).

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $exists$
BEGIN
  IF to_regclass('public.reading_materials') IS NULL THEN
    RAISE EXCEPTION 'relation public.reading_materials does not exist' USING ERRCODE = '42P01';
  END IF;
END $exists$;

CREATE TEMP TABLE jka_pins (k text PRIMARY KEY, v text) ON COMMIT DROP;
CREATE FUNCTION pg_temp.jka_measure() RETURNS TABLE (k text, v text) LANGUAGE plpgsql AS $m$
DECLARE f record; val text;
BEGIN
  FOR f IN SELECT * FROM (VALUES ('core', 'fsrs_private', 'contract_hash_live'), ('manual', 'fsrs_private', 'manual_contract_hash_live'),
      ('admission', 'fsrs_private', 'admission_contract_hash_live'), ('activity', 'fsrs_private', 'activity_profile_hash_live')) x(k, sch, fn) LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = f.sch AND p.proname = f.fn AND p.pronargs = 0) THEN
      EXECUTE format('SELECT %I.%I()::text', f.sch, f.fn) INTO val;
    ELSE val := NULL; END IF;
    k := f.k; v := val; RETURN NEXT;
  END LOOP;
END $m$;
INSERT INTO pg_temp.jka_pins SELECT * FROM pg_temp.jka_measure();

CREATE SCHEMA IF NOT EXISTS backup_private;
REVOKE ALL ON SCHEMA backup_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS backup_private.ja_kanji_a2_20261111 (
  material_id bigint PRIMARY KEY,
  raw_text text NOT NULL,
  processed_json jsonb NOT NULL,
  backed_up_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE backup_private.ja_kanji_a2_20261111 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON backup_private.ja_kanji_a2_20261111 FROM PUBLIC, anon, authenticated;

CREATE TEMP TABLE jka_rule (ob text, op text, nb text, np text, mn text, PRIMARY KEY (ob, op)) ON COMMIT DROP;
CREATE TEMP TABLE jka_write (b text PRIMARY KEY, t text, r text, ks text, rs text) ON COMMIT DROP;
CREATE TEMP TABLE jka_keep (x text PRIMARY KEY) ON COMMIT DROP;
CREATE TEMP TABLE jka_fix (fx int PRIMARY KEY, mid bigint, keys text[], old text) ON COMMIT DROP;
CREATE TEMP TABLE jka_piece (fx int, idx int, kana text, base text, pos text, meaning text, kanji text, furigana text, PRIMARY KEY (fx, idx)) ON COMMIT DROP;
CREATE TEMP TABLE jka_expect (mid bigint PRIMARY KEY, phase text, rule_hits int, converted int, fix_keys int) ON COMMIT DROP;
CREATE TEMP TABLE jka_na (x text PRIMARY KEY) ON COMMIT DROP;

-- jka-data:begin
INSERT INTO pg_temp.jka_rule (ob, op, nb, np, mn) VALUES
  ('わたし','명사','私','명사',NULL),
  ('せんせい','명사','先生','명사',NULL),
  ('ほん','명사','本','명사',NULL),
  ('とけい','명사','時計','명사',NULL),
  ('げんき','명사','元気','형용동사',NULL),
  ('あした','명사','明日','명사',NULL),
  ('いま','명사','今','명사',NULL),
  ('としょかん','명사','図書館','명사',NULL),
  ('ぎんこう','명사','銀行','명사',NULL),
  ('ひと','명사','人','명사',NULL),
  ('おちゃ','명사','お茶','명사',NULL),
  ('いしゃ','명사','医者','명사',NULL),
  ('かさ','명사','傘','명사',NULL),
  ('かいしゃ','명사','会社','명사',NULL),
  ('ぼく','명사','僕','명사',NULL),
  ('いぬ','명사','犬','명사',NULL),
  ('ねこ','명사','猫','명사',NULL),
  ('きょう','명사','今日','명사',NULL),
  ('きのう','명사','昨日','명사',NULL),
  ('えいが','명사','映画','명사',NULL),
  ('へや','명사','部屋','명사',NULL),
  ('しずか','명사','静か','형용동사',NULL),
  ('まち','명사','町','명사',NULL),
  ('ともだち','명사','友達','명사',NULL),
  ('つくえ','명사','机','명사',NULL),
  ('こうえん','명사','公園','명사',NULL),
  ('こども','명사','子供','명사',NULL),
  ('なか','명사','中','명사',NULL),
  ('べんきょう','명사','勉強','명사',NULL),
  ('あさ','명사','朝','명사',NULL),
  ('あさごはん','명사','朝御飯','명사',NULL),
  ('ひるごはん','명사','昼御飯','명사',NULL),
  ('ごはん','명사','ご飯','명사',NULL),
  ('しゅうまつ','명사','週末','명사',NULL),
  ('やさい','형용사','野菜','명사','채소'),
  ('いもうと','명사','妹','명사',NULL),
  ('かぞく','명사','家族','명사',NULL),
  ('たんじょうび','명사','誕生日','명사',NULL),
  ('りょうり','명사','料理','명사',NULL),
  ('すき','명사','好き','형용동사',NULL),
  ('ひま','명사','暇','형용동사',NULL),
  ('いちど','명사','一度','명사',NULL),
  ('だれ','명사','誰','명사',NULL),
  ('あめ','명사','雨','명사',NULL),
  ('おねがい','명사','お願い','명사',NULL),
  ('たかい','형용사','高い','형용사',NULL),
  ('おおきい','형용사','大きい','형용사',NULL),
  ('ちいさい','형용사','小さい','형용사',NULL),
  ('やすい','형용사','安い','형용사',NULL),
  ('あつい','형용사','暑い','형용사',NULL),
  ('おもしろい','형용사','面白い','형용사',NULL),
  ('いそがしい','형용사','忙しい','형용사',NULL),
  ('あたらしい','형용사','新しい','형용사',NULL),
  ('おおい','형용사','多い','형용사',NULL),
  ('むずかしい','형용사','難しい','형용사',NULL),
  ('ちかい','형용사','近い','형용사',NULL),
  ('ねむい','형용사','眠い','형용사',NULL),
  ('はやい','형용사','早い','형용사',NULL),
  ('おいしい','형용사','美味しい','형용사',NULL),
  ('さむい','형용사','寒い','형용사',NULL),
  ('いたい','형용사','痛い','형용사',NULL),
  ('のむ','동사','飲む','동사',NULL),
  ('たべる','동사','食べる','동사',NULL),
  ('いく','동사','行く','동사',NULL),
  ('みる','동사','見る','동사',NULL),
  ('のる','동사','乗る','동사',NULL),
  ('かく','동사','書く','동사',NULL),
  ('よむ','동사','読む','동사',NULL),
  ('はなす','동사','話す','동사',NULL),
  ('くる','동사','来る','동사',NULL),
  ('かえる','동사','帰る','동사',NULL),
  ('あそぶ','동사','遊ぶ','동사',NULL),
  ('かう','동사','買う','동사',NULL),
  ('まつ','동사','待つ','동사',NULL),
  ('みせる','동사','見せる','동사',NULL),
  ('いう','동사','言う','동사',NULL),
  ('たすける','동사','助ける','동사',NULL),
  ('あける','동사','開ける','동사',NULL),
  ('いそぐ','동사','急ぐ','동사',NULL),
  ('あるく','동사','歩く','동사',NULL),
  ('きく','동사','聞く','동사',NULL),
  ('はたらく','동사','働く','동사',NULL),
  ('すく','동사','空く','동사',NULL),
  ('ふる','동사','降る','동사',NULL),
  ('ねる','동사','寝る','동사',NULL),
  ('あう','동사','会う','동사',NULL),
  ('でかける','동사','出かける','동사',NULL),
  ('はれる','동사','晴れる','동사',NULL),
  ('やすむ','동사','休む','동사',NULL),
  ('ひき','명사','匹','명사',NULL),
  ('いえ','접속사','家','명사','집'),
  ('しゃしん','명사','写真','명사',NULL),
  ('となり','명사','隣','명사',NULL),
  ('なに','명사','何','명사',NULL),
  ('なん','명사','何','명사',NULL),
  ('ほう','명사','方','명사',NULL),
  ('やすみ','명사','休み','명사',NULL),
  ('おなか','명사','お腹','명사',NULL);
INSERT INTO pg_temp.jka_write (b, t, r, ks, rs) VALUES
  ('本','本','ほん','本','ほん'),
  ('勉強','勉強','べんきょう','勉強','べんきょう'),
  ('今日','今日','きょう','今日','きょう'),
  ('映画','映画','えいが','映画','えいが'),
  ('人','人','ひと','人','ひと'),
  ('明日','明日','あした','明日','あした'),
  ('私','私','わたし','私','わたし'),
  ('週末','週末','しゅうまつ','週末','しゅうまつ'),
  ('昨日','昨日','きのう','昨日','きのう'),
  ('何','何','なに','何','なに'),
  ('猫','猫','ねこ','猫','ねこ'),
  ('雨','雨','あめ','雨','あめ'),
  ('公園','公園','こうえん','公園','こうえん'),
  ('友達','友達','ともだち','友達','ともだち'),
  ('お茶','お茶','おちゃ','お茶','おちゃ'),
  ('図書館','図書館','としょかん','図書館','としょかん'),
  ('中','中','なか','中','なか'),
  ('部屋','部屋','へや','部屋','へや'),
  ('方','方','ほう','方','ほう'),
  ('休み','休み','やすみ','休','やす'),
  ('料理','料理','りょうり','料理','りょうり'),
  ('家','家','いえ','家','いえ'),
  ('一度','一度','いちど','一度','いちど'),
  ('一緒','一緒','いっしょ','一緒','いっしょ'),
  ('今','今','いま','今','いま'),
  ('妹','妹','いもうと','妹','いもうと'),
  ('家族','家族','かぞく','家族','かぞく'),
  ('誕生日','誕生日','たんじょうび','誕生日','たんじょうび'),
  ('朝','朝','あさ','朝','あさ'),
  ('野菜','野菜','やさい','野菜','やさい'),
  ('好き','好き','すき','好','す'),
  ('大好き','大好き','だいすき','大好','だいす'),
  ('静か','静か','しずか','静','しず'),
  ('暇','暇','ひま','暇','ひま'),
  ('ご飯','ご飯','ごはん','ご飯','ごはん'),
  ('お願い','お願い','おねがい','お願','おねが'),
  ('先生','先生','せんせい','先生','せんせい'),
  ('学生','学生','がくせい','学生','がくせい'),
  ('元気','元気','げんき','元気','げんき'),
  ('時計','時計','とけい','時計','とけい'),
  ('銀行','銀行','ぎんこう','銀行','ぎんこう'),
  ('医者','医者','いしゃ','医者','いしゃ'),
  ('傘','傘','かさ','傘','かさ'),
  ('会社','会社','かいしゃ','会社','かいしゃ'),
  ('犬','犬','いぬ','犬','いぬ'),
  ('町','町','まち','町','まち'),
  ('机','机','つくえ','机','つくえ'),
  ('子供','子供','こども','子供','こども'),
  ('隣','隣','となり','隣','となり'),
  ('写真','写真','しゃしん','写真','しゃしん'),
  ('駅','駅','えき','駅','えき'),
  ('日本語','日本語','にほんご','日本語','にほんご'),
  ('日本','日本','にほん','日本','にほん'),
  ('音楽','音楽','おんがく','音楽','おんがく'),
  ('仕事','仕事','しごと','仕事','しごと'),
  ('学校','学校','がっこう','学校','がっこう'),
  ('店','店','みせ','店','みせ'),
  ('名前','名前','なまえ','名前','なまえ'),
  ('土曜日','土曜日','どようび','土曜日','どようび'),
  ('手紙','手紙','てがみ','手紙','てがみ'),
  ('新幹線','新幹線','しんかんせん','新幹線','しんかんせん'),
  ('日曜日','日曜日','にちようび','日曜日','にちようび'),
  ('時間','時間','じかん','時間','じかん'),
  ('月曜日','月曜日','げつようび','月曜日','げつようび'),
  ('海','海','うみ','海','うみ'),
  ('温泉','温泉','おんせん','温泉','おんせん'),
  ('窓','窓','まど','窓','まど'),
  ('英語','英語','えいご','英語','えいご'),
  ('親切','親切','しんせつ','親切','しんせつ'),
  ('金曜日','金曜日','きんようび','金曜日','きんようび'),
  ('頭','頭','あたま','頭','あたま'),
  ('食べ物','食べ物','たべもの','食べ物','たべもの'),
  ('紙','紙','かみ','紙','かみ'),
  ('韓国','韓国','かんこく','韓国','かんこく'),
  ('田中','田中','たなか','田中','たなか'),
  ('何時','何時','なんじ','何時','なんじ'),
  ('東京','東京','とうきょう','東京','とうきょう'),
  ('大阪','大阪','おおさか','大阪','おおさか'),
  ('大学','大学','だいがく','大学','だいがく'),
  ('有名','有名','ゆうめい','有名','ゆうめい'),
  ('木','木','き','木','き'),
  ('教室','教室','きょうしつ','教室','きょうしつ'),
  ('建物','建物','たてもの','建物','たてもの'),
  ('食べる','食べる','たべる','食','た'),
  ('行く','行く','いく','行','い'),
  ('飲む','飲む','のむ','飲','の'),
  ('見る','見る','みる','見','み'),
  ('読む','読む','よむ','読','よ'),
  ('来る','来る','くる','来','く'),
  ('帰る','帰る','かえる','帰','かえ'),
  ('書く','書く','かく','書','か'),
  ('降る','降る','ふる','降','ふ'),
  ('見せる','見せる','みせる','見','み'),
  ('会う','会う','あう','会','あ'),
  ('寝る','寝る','ねる','寝','ね'),
  ('働く','働く','はたらく','働','はたら'),
  ('話す','話す','はなす','話','はな'),
  ('晴れる','晴れる','はれる','晴','は'),
  ('待つ','待つ','まつ','待','ま'),
  ('休む','休む','やすむ','休','やす'),
  ('開ける','開ける','あける','開','あ'),
  ('遊ぶ','遊ぶ','あそぶ','遊','あそ'),
  ('歩く','歩く','あるく','歩','ある'),
  ('言う','言う','いう','言','い'),
  ('急ぐ','急ぐ','いそぐ','急','いそ'),
  ('起きる','起きる','おきる','起','お'),
  ('買う','買う','かう','買','か'),
  ('聞く','聞く','きく','聞','き'),
  ('空く','空く','すく','空','す'),
  ('助ける','助ける','たすける','助','たす'),
  ('出かける','出かける','でかける','出','で'),
  ('始める','始める','はじめる','始','はじ'),
  ('着る','着る','きる','着','き'),
  ('閉める','閉める','しめる','閉','し'),
  ('撮る','撮る','とる','撮','と'),
  ('乗る','乗る','のる','乗','の'),
  ('早い','早い','はやい','早','はや'),
  ('難しい','難しい','むずかしい','難','むずか'),
  ('安い','安い','やすい','安','やす'),
  ('眠い','眠い','ねむい','眠','ねむ'),
  ('新しい','新しい','あたらしい','新','あたら'),
  ('暑い','暑い','あつい','暑','あつ'),
  ('忙しい','忙しい','いそがしい','忙','いそが'),
  ('痛い','痛い','いたい','痛','いた'),
  ('多い','多い','おおい','多','おお'),
  ('大きい','大きい','おおきい','大','おお'),
  ('寒い','寒い','さむい','寒','さむ'),
  ('高い','高い','たかい','高','たか'),
  ('近い','近い','ちかい','近','ちか'),
  ('小さい','小さい','ちいさい','小','ちい'),
  ('面白い','面白い','おもしろい','面白','おもしろ'),
  ('朝御飯','朝ご飯','あさごはん','朝ご飯','あさごはん'),
  ('昼御飯','昼ご飯','ひるごはん','昼ご飯','ひるごはん'),
  ('誰','誰','だれ','誰','だれ');
INSERT INTO pg_temp.jka_keep (x) VALUES ('くださる'),('する'),('ある'),('いる'),('できる'),('こと'),('もの'),('はず'),('つもり'),('あの'),('この'),('その'),('どの'),('これ'),('それ'),('あれ'),('どれ'),('ここ'),('そこ'),('あそこ'),('どこ'),('どちら'),('どんな'),('どう'),('どうして'),('いつ'),('あまり'),('もう'),('とても'),('ゆっくり'),('ちょっと'),('たぶん'),('また'),('すみません'),('ありがとう'),('おはよう'),('さようなら'),('はい'),('いいえ'),('いい'),('かばん'),('りんご'),('すし'),('さん'),('うち'),('おなか'),('おいしい'),('美味しい');
INSERT INTO pg_temp.jka_fix (fx, mid, keys, old) VALUES
  (1,45,ARRAY['2_3','2_4','2_5','2_6']::text[],'かんこくじん'),
  (2,45,ARRAY['10_0','10_1','10_2','10_3']::text[],'かんこくじん'),
  (3,45,ARRAY['3_0','3_1']::text[],'たなか'),
  (4,73,ARRAY['7_4','7_5']::text[],'なんじ'),
  (5,47,ARRAY['4_3','4_4']::text[],'たなか'),
  (6,49,ARRAY['5_5','5_6']::text[],'たてものの'),
  (7,48,ARRAY['7_8']::text[],'あに'),
  (8,57,ARRAY['1_0','1_1']::text[],'たなか'),
  (9,57,ARRAY['2_3','2_4']::text[],'ゆうめい'),
  (10,57,ARRAY['4_5','4_6']::text[],'ゆうめい'),
  (11,50,ARRAY['2_3']::text[],'きが'),
  (12,50,ARRAY['5_0','5_1']::text[],'きょうしつ'),
  (13,50,ARRAY['6_5','6_6']::text[],'たなか'),
  (14,54,ARRAY['5_5','5_6']::text[],'7じ'),
  (15,54,ARRAY['5_9']::text[],'おき'),
  (16,53,ARRAY['4_0','4_1']::text[],'7じ'),
  (17,53,ARRAY['4_4']::text[],'おき'),
  (18,58,ARRAY['1_3']::text[],'いき'),
  (19,58,ARRAY['5_3']::text[],'いき'),
  (20,58,ARRAY['7_5']::text[],'いき'),
  (21,58,ARRAY['3_3','3_4']::text[],'のみたい'),
  (22,58,ARRAY['4_5']::text[],'みたい'),
  (23,59,ARRAY['6_3']::text[],'しめて'),
  (24,60,ARRAY['6_3','6_4']::text[],'いつ'),
  (25,62,ARRAY['1_3','1_4']::text[],'にん'),
  (26,62,ARRAY['2_3']::text[],'こ'),
  (27,62,ARRAY['3_3']::text[],'さい'),
  (28,62,ARRAY['7_0']::text[],'かみ'),
  (29,62,ARRAY['7_3','7_4']::text[],'5まい'),
  (30,62,ARRAY['8_3','8_4']::text[],'2ひき'),
  (31,62,ARRAY['10_3','10_4']::text[],'2ほん'),
  (32,62,ARRAY['12_3','12_4','12_5']::text[],'3さつ'),
  (33,62,ARRAY['13_3','13_4']::text[],'2ほん'),
  (34,61,ARRAY['1_3']::text[],'じ'),
  (35,61,ARRAY['2_3','2_4']::text[],'とうきょう'),
  (36,61,ARRAY['3_3']::text[],'おおさか'),
  (37,61,ARRAY['9_6','9_7']::text[],'あるい'),
  (38,61,ARRAY['9_10','9_11']::text[],'5ふん'),
  (39,61,ARRAY['13_0','13_1','13_2']::text[],'4がつ'),
  (40,61,ARRAY['13_8']::text[],'はじめ'),
  (41,63,ARRAY['4_3']::text[],'のみ'),
  (42,63,ARRAY['1_4']::text[],'いっしょ'),
  (43,64,ARRAY['10_8']::text[],'き'),
  (44,65,ARRAY['1_3','1_4']::text[],'かんこく'),
  (45,65,ARRAY['2_3','2_4']::text[],'にほん'),
  (46,65,ARRAY['3_3','3_4']::text[],'だいがく'),
  (47,66,ARRAY['1_3']::text[],'みせ'),
  (48,67,ARRAY['7_2','7_3']::text[],'たなか'),
  (49,67,ARRAY['10_5','10_6']::text[],'がくせい'),
  (50,74,ARRAY['5_6']::text[],'とり');
INSERT INTO pg_temp.jka_piece (fx, idx, kana, base, pos, meaning, kanji, furigana) VALUES
  (1,1,'かんこく','韓国','명사','한국',NULL,NULL),
  (1,2,'じん','人','명사','~인(사람)',NULL,NULL),
  (2,1,'かんこく','韓国','명사','한국',NULL,NULL),
  (2,2,'じん','人','명사','~인(사람)',NULL,NULL),
  (3,1,'たなか','田中','명사','다나카(성)',NULL,NULL),
  (4,1,'なんじ','何時','명사','몇 시',NULL,NULL),
  (5,1,'たなか','田中','명사','다나카(성)',NULL,NULL),
  (6,1,'たてもの','建物','명사','건물',NULL,NULL),
  (6,2,'の','の','조사','~의',NULL,NULL),
  (7,1,'あに','兄','명사','형, 오빠',NULL,NULL),
  (8,1,'たなか','田中','명사','다나카(성)',NULL,NULL),
  (9,1,'ゆうめい','有名','형용동사','유명함',NULL,NULL),
  (10,1,'ゆうめい','有名','형용동사','유명함',NULL,NULL),
  (11,1,'き','木','명사','나무',NULL,NULL),
  (11,2,'が','が','조사','~이/가',NULL,NULL),
  (12,1,'きょうしつ','教室','명사','교실',NULL,NULL),
  (13,1,'たなか','田中','명사','다나카(성)',NULL,NULL),
  (14,1,'7じ','7時','명사','7시','7時','しちじ'),
  (15,1,'おき','起きる','동사','일어나다',NULL,NULL),
  (16,1,'7じ','7時','명사','7시','7時','しちじ'),
  (17,1,'おき','起きる','동사','일어나다','起き','おきる'),
  (18,1,'いき','行く','동사','가다','行き','いく'),
  (19,1,'いき','行く','동사','가다','行き','いく'),
  (20,1,'いき','行く','동사','가다','行き','いく'),
  (21,1,'のみ','飲む','동사','마시다','飲み','のむ'),
  (21,2,'たい','たい','조동사','~하고 싶다',NULL,NULL),
  (22,1,'み','見る','동사','보다','見','みる'),
  (22,2,'たい','たい','조동사','~하고 싶다',NULL,NULL),
  (23,1,'しめ','閉める','동사','닫다','閉め','しめる'),
  (23,2,'て','て','조동사','~하고',NULL,NULL),
  (24,1,'いつ','いつ','명사','언제',NULL,NULL),
  (25,1,'にん','人','명사','~명(사람 수)','人','にん'),
  (26,1,'こ','個','명사','~개',NULL,NULL),
  (27,1,'さい','歳','명사','~살',NULL,NULL),
  (28,1,'かみ','紙','명사','종이','紙','かみ'),
  (29,1,'5まい','5枚','명사','다섯 장','5枚','ごまい'),
  (30,1,'2ひき','2匹','명사','두 마리','2匹','にひき'),
  (31,1,'2ほん','2本','명사','두 자루','2本','にほん'),
  (32,1,'3さつ','3冊','명사','세 권','3冊','さんさつ'),
  (33,1,'2ほん','2本','명사','두 병','2本','にほん'),
  (34,1,'じ','時','명사','~시',NULL,NULL),
  (35,1,'とうきょう','東京','명사','도쿄','東京','とうきょう'),
  (36,1,'おおさか','大阪','명사','오사카','大阪','おおさか'),
  (37,1,'あるい','歩く','동사','걷다','歩い','あるく'),
  (38,1,'5ふん','5分','명사','5분','5分','ごふん'),
  (39,1,'4がつ','4月','명사','4월','4月','しがつ'),
  (40,1,'はじめ','始める','동사','시작하다','始め','はじめる'),
  (41,1,'のみ','飲む','동사','마시다','飲み','のむ'),
  (42,1,'いっしょ','一緒','명사','함께','一緒','いっしょ'),
  (43,1,'き','着る','동사','입다','着','きる'),
  (44,1,'かんこく','韓国','명사','한국','韓国','かんこく'),
  (45,1,'にほん','日本','명사','일본','日本','にほん'),
  (46,1,'だいがく','大学','명사','대학','大学','だいがく'),
  (47,1,'みせ','店','명사','가게','店','みせ'),
  (48,1,'たなか','田中','명사','다나카(성)','田中','たなか'),
  (49,1,'がくせい','学生','명사','학생','学生','がくせい'),
  (50,1,'とり','撮る','동사','(사진을) 찍다',NULL,NULL);
INSERT INTO pg_temp.jka_expect (mid, phase, rule_hits, converted, fix_keys) VALUES
  (45,'kana',5,0,10),
  (46,'kana',10,0,0),
  (47,'kana',8,0,2),
  (48,'kana',11,0,1),
  (49,'kana',5,0,2),
  (50,'kana',8,0,5),
  (51,'convert',12,16,0),
  (52,'convert',11,14,0),
  (53,'convert',12,13,3),
  (54,'kana',13,0,3),
  (55,'convert',16,18,0),
  (56,'kana',16,0,0),
  (57,'kana',12,0,6),
  (58,'convert',7,10,6),
  (59,'convert',9,10,1),
  (60,'convert',8,9,2),
  (61,'convert',5,13,12),
  (62,'convert',8,7,16),
  (63,'convert',11,11,2),
  (64,'convert',18,18,1),
  (65,'convert',15,20,6),
  (66,'convert',7,8,1),
  (67,'convert',10,8,4),
  (73,'kana',7,0,2),
  (74,'kana',7,0,1);
INSERT INTO pg_temp.jka_na (x) VALUES ('あいまい'),('いい加減'),('おおざっぱ'),('きれい'),('さわやか'),('ざんねん'),('しずか'),('すき'),('すてき'),('だめ'),('にぎやか'),('ひつよう'),('まじめ'),('みじめ'),('めちゃくちゃ'),('りっぱ'),('オシャレ'),('タイムリー'),('ビミョー'),('ロマンチック'),('丁寧'),('丈夫'),('上手'),('下手'),('不便'),('不利'),('不可欠'),('不安'),('不審'),('不幸'),('不当'),('不思議'),('不明'),('不正'),('不自由'),('不良'),('不調'),('主要'),('些細'),('便利'),('個人的'),('個別'),('偉大'),('健在'),('傾らか'),('優位'),('優勢'),('優秀'),('元気'),('公平'),('公式'),('公正'),('円滑'),('冷静'),('几帳面'),('切実'),('勇敢'),('勝手'),('半端'),('単純'),('危険'),('厄介'),('厳重'),('可哀想'),('可能'),('同様'),('名誉'),('呑気'),('困難'),('地味'),('壮大'),('変'),('多様'),('夢中'),('大丈夫'),('大事'),('大切'),('大変'),('大好き'),('大幅'),('大胆'),('失礼'),('奇妙'),('好き'),('好調'),('妥当'),('嫌'),('嫌い'),('孤独'),('安全'),('安易'),('完全'),('容易'),('密か'),('寛容'),('巧み'),('巧妙'),('巨大'),('平和'),('平然'),('平等'),('幸せ'),('幸福'),('幼稚'),('強力'),('強引'),('強気'),('強烈'),('強硬'),('当たり前'),('当然'),('得意'),('微妙'),('必死'),('必要'),('快適'),('急'),('急激'),('悲惨'),('意外'),('愚か'),('慎重'),('懸命'),('手軽'),('抜本的'),('新た'),('新鮮'),('早急'),('明らか'),('明白'),('明確'),('普通'),('暇'),('曖昧'),('有利'),('有力'),('有効'),('有名'),('有望'),('有益'),('有能'),('朗らか'),('未定'),('柔軟'),('楽'),('正常'),('正式'),('正当'),('正直'),('正確'),('残念'),('残酷'),('気の毒'),('気軽'),('活発'),('派手'),('消極的'),('深刻'),('温暖'),('滑らか'),('無事'),('無効'),('無口'),('無理'),('無駄'),('熱心'),('物騒'),('特別'),('特殊'),('独特'),('独自'),('猛烈'),('率直'),('生意気'),('異常'),('疑問'),('的確'),('皮肉'),('盛ん'),('盛大'),('真っ暗'),('真っ白'),('真っ赤'),('真っ黒'),('真剣'),('真面目'),('着実'),('知的'),('確か'),('確実'),('稀'),('積極的'),('穏やか'),('簡単'),('素朴'),('素直'),('綺麗'),('緊急'),('緩やか'),('肝心'),('自在'),('自由'),('良好'),('苦手'),('華やか'),('著名'),('複雑'),('見事'),('親切'),('詳細'),('誠実'),('謙虚'),('豊か'),('豊富'),('豪華'),('貴重'),('贅沢'),('身近'),('迅速'),('迷惑'),('透明'),('速やか'),('過剰'),('適度'),('適当'),('邪魔'),('重大'),('重要'),('陽気'),('静か'),('非常'),('面倒'),('順調'),('顕著'),('馬鹿'),('高価'),('高度'),('高等'),('高級'),('鮮やか');
-- jka-data:end

-- 한 자료의 변환 — 사전 검사와 적용이 같은 함수를 쓴다(개수 · 결과가 어긋날 수 없다).
CREATE FUNCTION pg_temp.jka_transform(p_mid bigint, OUT o_seq jsonb, OUT o_dict jsonb, OUT o_raw text, OUT o_rules int,
  OUT o_conv int, OUT o_fixkeys int, OUT o_first int, OUT o_bad text) LANGUAGE plpgsql AS $f$
DECLARE pj jsonb; seq jsonb; dict jsonb; sfx text; hl int; conv boolean; rec record; tok jsonb; sk text; ln int;
  fxr record; pc record; nk text; rl record; w record; ntx text; furi text; got text;
BEGIN
  SELECT processed_json INTO pj FROM public.reading_materials WHERE id = p_mid;
  seq := pj->'sequence'; dict := pj->'dictionary';
  o_seq := '[]'::jsonb; o_dict := dict; o_rules := 0; o_conv := 0; o_fixkeys := 0; o_first := NULL;
  SELECT split_part(k, '_', 4) INTO sfx FROM jsonb_array_elements_text(seq) k WHERE k LIKE 'id\_%' LIMIT 1;
  SELECT coalesce(min(split_part(k, '_', 2)::int), -1) INTO hl FROM jsonb_array_elements_text(seq) k
    WHERE k LIKE 'id\_%' AND dict->k->>'text' = '본문';
  conv := EXISTS (SELECT 1 FROM pg_temp.jka_expect e WHERE e.mid = p_mid AND e.phase = 'convert');
  FOR fxr IN SELECT * FROM pg_temp.jka_fix WHERE mid = p_mid LOOP
    SELECT string_agg(dict->('id_' || u.k || '_' || sfx)->>'text', '' ORDER BY u.ord) INTO got FROM unnest(fxr.keys) WITH ORDINALITY u(k, ord);
    IF got IS DISTINCT FROM fxr.old THEN o_bad := concat_ws(', ', o_bad, 'fix ' || fxr.fx || ' old'); END IF;
    IF (SELECT string_agg(kana, '' ORDER BY idx) FROM pg_temp.jka_piece WHERE fx = fxr.fx) IS DISTINCT FROM fxr.old THEN
      o_bad := concat_ws(', ', o_bad, 'fix ' || fxr.fx || ' pieces');
    END IF;
  END LOOP;
  FOR rec IN SELECT s.k, s.ord FROM jsonb_array_elements_text(seq) WITH ORDINALITY s(k, ord) ORDER BY s.ord LOOP
    IF rec.k NOT LIKE 'id\_%' THEN o_seq := o_seq || to_jsonb(rec.k); CONTINUE; END IF;
    sk := split_part(rec.k, '_', 2) || '_' || split_part(rec.k, '_', 3);
    ln := split_part(rec.k, '_', 2)::int;
    tok := dict->rec.k;
    SELECT * INTO fxr FROM pg_temp.jka_fix WHERE mid = p_mid AND sk = ANY (keys);
    IF FOUND THEN
      o_fixkeys := o_fixkeys + 1;
      o_first := least(coalesce(o_first, rec.ord::int - 1), rec.ord::int - 1);
      o_dict := o_dict - rec.k;
      IF sk = fxr.keys[1] THEN
        FOR pc IN SELECT * FROM pg_temp.jka_piece WHERE fx = fxr.fx ORDER BY idx LOOP
          nk := CASE WHEN pc.idx = 1 THEN rec.k ELSE 'id_' || sk || 's' || pc.idx || '_' || sfx END;
          IF conv AND ln > hl AND pc.kanji IS NOT NULL THEN ntx := pc.kanji; furi := pc.furigana;
          ELSE ntx := pc.kana; furi := NULL; END IF;
          o_dict := o_dict || jsonb_build_object(nk, ((coalesce(tok, '{}'::jsonb) - 'na_stem') || jsonb_build_object(
            'text', ntx, 'base_form', pc.base, 'pos', pc.pos, 'meaning', pc.meaning, 'furigana', furi, 'meaning_src', 'curated')));
          o_seq := o_seq || to_jsonb(nk);
        END LOOP;
      END IF;
      CONTINUE;
    END IF;
    SELECT * INTO rl FROM pg_temp.jka_rule r WHERE r.ob = tok->>'base_form' AND r.op = tok->>'pos';
    IF FOUND THEN
      o_rules := o_rules + 1;
      tok := tok || jsonb_build_object('base_form', rl.nb, 'pos', rl.np, 'meaning_src', 'curated')
                 || CASE WHEN rl.mn IS NOT NULL THEN jsonb_build_object('meaning', rl.mn) ELSE '{}'::jsonb END;
      IF tok ? 'na_stem' AND NOT EXISTS (SELECT 1 FROM pg_temp.jka_na WHERE x = rl.nb) THEN tok := tok - 'na_stem'; END IF;
    END IF;
    IF conv AND ln > hl AND coalesce(tok->>'text', '') ~ '^[ぁ-ゟー]+$'
       AND NOT EXISTS (SELECT 1 FROM pg_temp.jka_keep WHERE x IN (tok->>'base_form', dict->rec.k->>'base_form')) THEN
      SELECT * INTO w FROM pg_temp.jka_write WHERE b = tok->>'base_form';
      IF FOUND THEN
        IF tok->>'pos' IN ('동사', '형용사') THEN
          ntx := CASE WHEN left(tok->>'text', char_length(w.rs)) = w.rs THEN w.ks || substr(tok->>'text', char_length(w.rs) + 1) END;
          furi := w.r;
        ELSE ntx := w.t; furi := tok->>'text'; END IF;
        IF ntx IS NULL THEN o_bad := concat_ws(', ', o_bad, 'stem ' || rec.k);
        ELSE o_conv := o_conv + 1; tok := tok || jsonb_build_object('text', ntx, 'furigana', furi, 'meaning_src', 'curated'); END IF;
      END IF;
    END IF;
    o_dict := o_dict || jsonb_build_object(rec.k, tok);
    o_seq := o_seq || to_jsonb(rec.k);
  END LOOP;
  SELECT string_agg(CASE WHEN s.k LIKE 'br\_%' THEN E'\n' ELSE o_dict->s.k->>'text' END, '' ORDER BY s.ord) INTO o_raw
    FROM jsonb_array_elements_text(o_seq) WITH ORDINALITY s(k, ord);
END $f$;

CREATE TEMP TABLE jka_state (go boolean NOT NULL, others_md5 text) ON COMMIT DROP;
CREATE TEMP TABLE jka_target (mid bigint PRIMARY KEY) ON COMMIT DROP;
DO $pre$
DECLARE n_backup int; ex record; tr record; bad text; v_cnt bigint; r record;
BEGIN
  SELECT count(*) INTO n_backup FROM backup_private.ja_kanji_a2_20261111;
  INSERT INTO pg_temp.jka_target
    SELECT m.id FROM public.reading_materials m JOIN pg_temp.jka_expect xe ON xe.mid = m.id
    WHERE m.visibility = 'public' AND m.processed_json->>'status' = 'completed'
      AND m.processed_json->'metadata'->>'language' = 'Japanese' AND m.processed_json->'metadata'->>'level' LIKE 'N5%';
  IF n_backup > 0 OR NOT EXISTS (SELECT 1 FROM pg_temp.jka_target) THEN
    INSERT INTO pg_temp.jka_state (go) VALUES (false);
    RAISE NOTICE 'ja kanji a2: nothing to change (backup %, targets %)', n_backup, (SELECT count(*) FROM pg_temp.jka_target);
    RETURN;
  END IF;
  FOR ex IN SELECT x.* FROM pg_temp.jka_expect x JOIN pg_temp.jka_target USING (mid) LOOP
    SELECT * INTO tr FROM pg_temp.jka_transform(ex.mid);
    IF tr.o_bad IS NOT NULL OR tr.o_rules <> ex.rule_hits OR tr.o_conv <> ex.converted OR tr.o_fixkeys <> ex.fix_keys THEN
      bad := concat_ws('; ', bad, format('%s: rules %s/%s conv %s/%s fix %s/%s %s', ex.mid, tr.o_rules, ex.rule_hits, tr.o_conv, ex.converted,
        tr.o_fixkeys, ex.fix_keys, coalesce(tr.o_bad, '')));
    END IF;
    IF to_regclass('public.reading_progress') IS NOT NULL THEN
      EXECUTE 'SELECT count(*) FROM public.reading_progress WHERE material_id = $1 AND last_token_idx >= $2' INTO v_cnt USING ex.mid, coalesce(tr.o_first, 2147483647);
      IF v_cnt > 0 THEN bad := concat_ws('; ', bad, ex.mid || ': reading progress past the first changed token'); END IF;
    END IF;
  END LOOP;
  FOR r IN SELECT * FROM (VALUES ('user_vocabulary', 'material_id'), ('user_vocabulary', 'source_material_id'), ('vocabulary_contexts', 'material_id'),
      ('original_reading_positions', 'material_id'), ('library_bookmarks', 'material_id'), ('token_corrections', 'material_id'),
      ('daily_suggestions', 'material_id')) x(tbl, col) LOOP
    IF to_regclass('public.' || r.tbl) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I WHERE %I IN (SELECT mid FROM pg_temp.jka_target)', r.tbl, r.col) INTO v_cnt;
      IF v_cnt > 0 THEN bad := concat_ws('; ', bad, format('%s.%s has %s rows on target materials', r.tbl, r.col, v_cnt)); END IF;
    END IF;
  END LOOP;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'ja kanji a2: pre-check failed — %', bad; END IF;
  INSERT INTO pg_temp.jka_state (go, others_md5)
  SELECT true, md5(coalesce(string_agg(md5(m::text), '' ORDER BY m.id), '')) FROM public.reading_materials m
  WHERE NOT EXISTS (SELECT 1 FROM pg_temp.jka_target t WHERE t.mid = m.id);
END $pre$;

DO $apply$
DECLARE tr record; ex record;
BEGIN
  IF NOT (SELECT go FROM pg_temp.jka_state) THEN RETURN; END IF;
  INSERT INTO backup_private.ja_kanji_a2_20261111 (material_id, raw_text, processed_json)
  SELECT m.id, m.raw_text, m.processed_json FROM public.reading_materials m JOIN pg_temp.jka_target t ON t.mid = m.id;
  FOR ex IN SELECT mid FROM pg_temp.jka_target LOOP
    SELECT * INTO tr FROM pg_temp.jka_transform(ex.mid);
    UPDATE public.reading_materials m
       SET raw_text = tr.o_raw,
           processed_json = jsonb_set(jsonb_set(jsonb_set(m.processed_json, '{sequence}', tr.o_seq), '{dictionary}', tr.o_dict), '{metadata}',
             ((m.processed_json->'metadata') - 'difficulty') || jsonb_build_object(
               'updated_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'viewerRevision', gen_random_uuid()::text))
     WHERE m.id = ex.mid;
  END LOOP;
  RAISE NOTICE 'ja kanji a2: changed % materials', (SELECT count(*) FROM pg_temp.jka_target);
END $apply$;

DO $post$
DECLARE bad text;
BEGIN
  IF NOT (SELECT go FROM pg_temp.jka_state) THEN RETURN; END IF;
  SELECT string_agg(m.id::text, ', ') INTO bad FROM public.reading_materials m JOIN pg_temp.jka_target t ON t.mid = m.id
  WHERE m.raw_text IS DISTINCT FROM (SELECT string_agg(CASE WHEN s.k LIKE 'br\_%' THEN E'\n' ELSE m.processed_json->'dictionary'->s.k->>'text' END, '' ORDER BY s.ord)
                                     FROM jsonb_array_elements_text(m.processed_json->'sequence') WITH ORDINALITY s(k, ord))
     OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(m.processed_json->'sequence') s(k) WHERE NOT (m.processed_json->'dictionary' ? s.k));
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'ja kanji a2: token join differs from raw_text or a sequence key is missing (%)', bad; END IF;
  IF (SELECT count(*) FROM backup_private.ja_kanji_a2_20261111) <> (SELECT count(*) FROM pg_temp.jka_target) THEN
    RAISE EXCEPTION 'ja kanji a2: backup rows differ from targets';
  END IF;
  IF (SELECT md5(coalesce(string_agg(md5(m::text), '' ORDER BY m.id), '')) FROM public.reading_materials m
      WHERE NOT EXISTS (SELECT 1 FROM pg_temp.jka_target t WHERE t.mid = m.id)) IS DISTINCT FROM (SELECT others_md5 FROM pg_temp.jka_state) THEN
    RAISE EXCEPTION 'ja kanji a2: other materials changed';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_temp.jka_pins b FULL JOIN pg_temp.jka_measure() a USING (k) WHERE a.v IS DISTINCT FROM b.v) THEN
    RAISE EXCEPTION 'ja kanji a2: learning contract fingerprint changed — abort';
  END IF;
END $post$;

DROP FUNCTION pg_temp.jka_transform(bigint);
DROP FUNCTION pg_temp.jka_measure();
