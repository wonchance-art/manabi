-- 중국어 공개 시드 9편(HSK 1~3) — 서버 시드 작업이 분석한다(ZH-SEED-001 — 오너 승인 2026-11-07 11:35 KST 「권장안대로」, 오케스트레이터 경유).
-- 적용 경로 = main 병합 → supabase-migrations.yml(db push), 암묵 트랜잭션 하나.
--
-- 지금까지 공개 시드는 일본어 63 · 영어 60편이고 중국어는 0편이었다. 이 파일은 Claude가 직접 쓴 짧은 생활 · 여행 본문 9편을 넣는다
--   (H1 기초 3 · H2 초급 3 · H3 중급 3, 한 편 8~11줄 · 124~136자 — 일본어 시드 평균 122자 · 영어 227자 사이). 주제 = 일상 · 여행 ·
--   대만/중국 생활, 정치 서술 없음(CLAUDE.md IP ⑷ — 민감지역 미등장). 실존 상호는 텍스트로만(全家 · 上海 外滩 · 台北 捷运 · 夜市).
-- 표기 = 간체 정본(src/content/chinese/SCHEMA.md 「원문 = zh 간체자」 · 정본 책과 같은 길 — 분석은 간체 한 번, 번체는 보기 전환).
-- 근거(PR 본문): 운영 토크나이저(tokenizeZhLine) 기준 한자 토큰의 85.1%가 HSK 1~3 어휘(리포 src/content/chinese/vocab h1~h3 표),
--   토큰 이음 = 원문 9/9, 병음은 운영 분석기 출력으로 검수(只用 zhī · 请了假 jiǎ · 下个星期/一 · 李/明 분절 4곳을 문장을 고쳐 피함).
-- 이 파일이 하는 것: 시드 작업(kind starter)의 주인(관리자) 소유 · 공개 · 분석 전(idle)으로 9행을 넣고, 그 작업이 running/paused면
--   material_ids 끝에 붙인다(다음 하루 한 번 예약 실행이 분석). 같은 주인 · 같은 제목이 이미 있으면 그 편은 넣지 않는다(다시 돌려도 안전).
--   다른 자료 · 작업의 진행 · 사용량 · 정책 · 함수 · 학습 계약 지문은 그대로. 작업이 없으면 아무것도 넣지 않고 알린다.
-- 복원: delete from public.reading_materials m using public.canonical_analysis_jobs j where j.kind = 'starter' and m.owner_id = j.owner_id
--         and m.title like '[H_ %' and m.processed_json->'metadata'->>'language' = 'Chinese' and m.visibility = 'public';
--       update public.canonical_analysis_jobs set material_ids = array(select x from unnest(material_ids) x where exists
--         (select 1 from public.reading_materials m where m.id = x)) where kind = 'starter';   (분석이 저장된 뒤라도 같은 방법 — 학습 기록이 붙기 전에만)

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $zh_seed$
DECLARE j public.canonical_analysis_jobs%rowtype; n int; added bigint[];
BEGIN
  IF to_regclass('public.canonical_analysis_jobs') IS NULL THEN
    RAISE EXCEPTION 'relation public.canonical_analysis_jobs does not exist' USING ERRCODE = '42P01';
  END IF;
  SELECT count(*) INTO n FROM public.canonical_analysis_jobs WHERE kind = 'starter';
  IF n <> 1 THEN
    RAISE NOTICE 'zh seeds: expected exactly 1 starter job, found % — nothing inserted', n;
    RETURN;
  END IF;
  SELECT * INTO j FROM public.canonical_analysis_jobs WHERE kind = 'starter' FOR UPDATE;

  WITH seed(title, level, body) AS (VALUES
    ('[H1 생활 #1] 自我介绍 (자기소개)', 'H1 기초', $seed$你好！我叫金美英。
我是韩国人，今年二十岁。
我是大学生，现在在北京学习汉语。
我的老师是中国人，她姓王。
王老师很好，我们都喜欢她。
我有一个中国朋友，他叫李明。
他会说一点儿韩语。
认识你很高兴！
我们常常一起学习，一起吃饭。
这是我的电话，有时间我们一起喝咖啡吧。$seed$),
    ('[H1 생활 #2] 今天几号？ (날짜 · 요일 · 시간)', 'H1 기초', $seed$今天是星期五，十一月七号。
现在是上午八点半。
我九点去学校上课。
中午十二点，我和同学去吃饭。
下午我在家看书。
晚上七点，妈妈给我打电话。
明天是星期六，我不上课。
我想去商店买东西。
我的生日是十一月九号，是星期天。
那天我想请朋友们吃饭。
你的生日是几月几号？$seed$),
    ('[H1 생활 #3] 在饭馆 (식당에서)', 'H1 기초', $seed$服务员：你好！你们几位？
我：两位。
服务员：请坐。你们想吃什么？
我：我们要两碗米饭和一碗鸡蛋汤。
朋友：我想喝茶，你们有茶吗？
服务员：有。还要别的吗？
我：不要了，谢谢。一共多少钱？
服务员：一共四十八块。
我：好的，给你一百块。
服务员：找你五十二块。欢迎下次再来！$seed$),
    ('[H2 생활 #1] 全家便利店 (편의점에서)', 'H2 초급', $seed$我家楼下有一家便利店，叫“全家”。
这家便利店二十四小时都开门。
我常常在那里买水和面包。
今天我买了一瓶牛奶和两个苹果。
一共十五块五。
我用手机付钱，非常快。
店员笑着对我说：“谢谢，欢迎再来！”
我觉得便利店真方便。
有时候我也在这里买咖啡和早饭。
晚上很晚回家的时候，这里还开着门。$seed$),
    ('[H2 여행 #1] 去上海旅游 (상하이 여행)', 'H2 초급', $seed$上个月我和朋友去上海旅游了。
我们是坐高铁去的，五个小时就到了。
上海的天气很好，不冷也不热。
晚上我们去外滩看了很漂亮的夜景。
第二天我们坐地铁去了很多地方。
上海的地铁很方便，也不贵。
我们还吃了小笼包，非常好吃。
下次我想一个人再去一次。
上海人说话很快，我只听懂了一点儿。$seed$),
    ('[H2 생활 #2] 在台北的一天 (타이베이의 하루)', 'H2 초급', $seed$我在台北住了半年。
每天早上，我去家旁边的早餐店吃早饭。
我最喜欢喝豆浆，吃蛋饼。
台北的捷运很干净，大家都排队上车。
下午我常常去咖啡店学习。
晚上，我和朋友去夜市吃东西。
夜市的人很多，东西也不贵。
我觉得台北是一个很舒服的城市。
台北人很热情，问路的时候，大家都很愿意帮忙。$seed$),
    ('[H3 생활 #1] 生病了 (아플 때)', 'H3 중급', $seed$昨天晚上我突然发烧了，头也很疼。
今天早上，我给老师打电话请假了。
同屋陪我去了学校附近的医院。
医生检查以后说，我感冒了，不太严重。
他让我多喝水，多休息，按时吃药。
回到宿舍，我吃了药就睡觉了。
下午醒来的时候，我觉得好多了。
希望明天能回去上课。
以后我要多穿衣服，注意身体。$seed$),
    ('[H3 여행 #2] 问路 (길 묻기)', 'H3 중급', $seed$请问，去火车站怎么走？
一直往前走，到了第二个路口往右拐。
那儿离这儿远不远？
不太远，走路大概十分钟。
如果你着急，也可以坐公共汽车。
在哪儿坐车？
马路对面就有一个车站，坐三路车，三站就到了。
太感谢你了！
不客气，路上小心！
我按照他说的走，很快就找到了火车站。$seed$),
    ('[H3 생활 #2] 周末打算 (주말 계획)', 'H3 중급', $seed$这个周末天气很好，我打算和家人去爬山。
我们准备早上七点出发，开车去城外的一座山。
听说山上的风景特别美，秋天的叶子都红了。
爬山虽然有点儿累，但是对身体很好。
中午我们会在山上吃自己带的东西。
下山以后，我们要去附近的饭馆吃饭。
晚上回家，我想早点儿睡觉。
你周末有什么打算？$seed$)
  ), ins AS (
    INSERT INTO public.reading_materials (title, raw_text, processed_json, visibility, owner_id, direction)
    SELECT s.title, s.body,
           jsonb_build_object('status', 'idle', 'sequence', '[]'::jsonb, 'dictionary', '{}'::jsonb,
             'metadata', jsonb_build_object('language', 'Chinese', 'level', s.level)),
           'public', j.owner_id, 'read'
      FROM seed s
     WHERE NOT EXISTS (SELECT 1 FROM public.reading_materials m WHERE m.owner_id = j.owner_id AND m.title = s.title)
    RETURNING id
  )
  SELECT coalesce(array_agg(id ORDER BY id), '{}') INTO added FROM ins;

  IF cardinality(added) > 0 AND j.status IN ('running', 'paused') THEN
    IF cardinality(j.material_ids) + cardinality(added) > 200 THEN
      RAISE EXCEPTION 'zh seeds: starter job would exceed 200 materials';
    END IF;
    UPDATE public.canonical_analysis_jobs SET material_ids = material_ids || added, updated_at = now() WHERE id = j.id;
  END IF;
  RAISE NOTICE 'zh seeds: % inserted %, job % (%)', cardinality(added), added, j.id, j.status;
END $zh_seed$;
