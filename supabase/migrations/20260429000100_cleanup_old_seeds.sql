-- 시리즈 외 구버전 스타터 자료 삭제 (#N 패턴 없는 것)
-- 사용자가 동일 타이틀로 자료를 만들었을 가능성을 막기 위해 정확 매칭 + visibility=public + owner_id 무관 (관리자 시드 owner_id는 변경될 수 있음)
-- 실행 전 백업 권장: SELECT * FROM reading_materials WHERE title IN (...) 으로 미리 확인

DELETE FROM reading_materials
WHERE visibility = 'public'
  AND title IN (
    -- N5 일상
    '[N5] 私の一日 (하루 일과)',
    '[N5] 天気と季節 (날씨와 계절)',
    '[N5] 家族の紹介 (가족 소개)',
    '[N5] 学校の一日 (학교 하루)',
    '[N5] 朝のあいさつ (아침 인사)',
    '[N5] 食堂で (식당에서)',
    '[N5] 私の趣味 (나의 취미)',
    '[N5] 雨の日 (비 오는 날)',
    -- N4 일상
    '[N4] 休日の過ごし方 (주말 보내기)',
    '[N4] スーパーでの買い物 (마트에서 장 보기)',
    '[N4] 日本の四季 (일본의 사계절)',
    '[N4] 友達と買い物 (친구와 쇼핑)',
    '[N4] 旅行の計画 (여행 계획)',
    '[N4] 新しい仕事 (새 직장)',
    -- N3 일상
    '[N3] インターネットと現代生活 (인터넷과 현대 생활)',
    '[N3] 日本の伝統文化 (일본의 전통문화)',
    '[N3] 環境問題への取り組み (환경 문제 대응)',
    -- N2 일상
    '[N2] 少子高齢化と社会への影響 (저출산 고령화와 사회 영향)',
    '[N2] 人工知能が変える未来 (AI가 바꾸는 미래)',
    -- N1 일상
    '[N1] 言語と思考の関係性 (언어와 사고의 관계)',
    -- A1 일상
    '[A1] My Daily Routine (나의 하루 일과)',
    '[A1] My Room (나의 방)',
    '[A1] My Best Friend (나의 가장 친한 친구)',
    '[A1] Going to School (학교 가기)',
    '[A1] My Pet (나의 반려동물)',
    '[A1] Daily Routines (하루 일과)',
    -- A2 일상
    '[A2] A Visit to My Grandparents (조부모님 방문)',
    '[A2] My Favorite Season (내가 좋아하는 계절)',
    '[A2] A Trip to the Beach (해변 여행)',
    '[A2] Cooking with My Grandma (할머니와 요리하기)',
    '[A2] My Favorite Holiday (내가 좋아하는 명절)',
    -- B1
    '[B1] The Benefits of Language Learning (언어 학습의 이점)',
    '[B1] Urban Farming: Growing Food in the City (도시 농업)',
    -- B2
    '[B2] The Psychology of Procrastination (미루기의 심리학)',
    -- C1
    '[C1] Artificial Intelligence and the Question of Consciousness (AI와 의식의 문제)'
  );
