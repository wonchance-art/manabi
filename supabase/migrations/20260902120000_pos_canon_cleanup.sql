-- X 품사 정본 정합(#1077 5504885559) — 코드로만 낸다. 운영 적용은 오너 수동(하드리밋).
-- 정본 밖 pos를 NULL로 돌린다('·' 조각 전부가 정본이어야 통과). NULL 행은 다음 분석에서 재조회되어
-- 자가 치유된다(기존 미싱 경로). source='user_verified'는 오너 확정이라 건드리지 않고 **목록만** 뽑는다.
-- 정규식은 src/lib/server/posCanon.js에서 생성했다(posCanon 계약이 재생성값과 대조).
-- DDL 없음(스키마 무변경).

-- Chinese
UPDATE morpheme_dictionary SET pos = NULL
 WHERE language = 'Chinese' AND source <> 'user_verified' AND pos IS NOT NULL AND pos !~ '^(명사|인명|지명|기관명|고유명사|동사|부사성 동사|명사성 동사|형용사|부사성 형용사|명사성 형용사|부사|수사|양사|대명사|전치사|접속사|조사|허사|어기조사|의성어|감탄사|성어|관용구|약어|처소사|시간사|방위사|구별사|상태사|접두|접미|어소|기호|기타|외국어|수량사)(·(명사|인명|지명|기관명|고유명사|동사|부사성 동사|명사성 동사|형용사|부사성 형용사|명사성 형용사|부사|수사|양사|대명사|전치사|접속사|조사|허사|어기조사|의성어|감탄사|성어|관용구|약어|처소사|시간사|방위사|구별사|상태사|접두|접미|어소|기호|기타|외국어|수량사))*$';
UPDATE user_vocabulary SET pos = ''
 WHERE language = 'Chinese' AND pos IS NOT NULL AND pos <> '' AND pos !~ '^(명사|인명|지명|기관명|고유명사|동사|부사성 동사|명사성 동사|형용사|부사성 형용사|명사성 형용사|부사|수사|양사|대명사|전치사|접속사|조사|허사|어기조사|의성어|감탄사|성어|관용구|약어|처소사|시간사|방위사|구별사|상태사|접두|접미|어소|기호|기타|외국어|수량사)(·(명사|인명|지명|기관명|고유명사|동사|부사성 동사|명사성 동사|형용사|부사성 형용사|명사성 형용사|부사|수사|양사|대명사|전치사|접속사|조사|허사|어기조사|의성어|감탄사|성어|관용구|약어|처소사|시간사|방위사|구별사|상태사|접두|접미|어소|기호|기타|외국어|수량사))*$';

-- Japanese
UPDATE morpheme_dictionary SET pos = NULL
 WHERE language = 'Japanese' AND source <> 'user_verified' AND pos IS NOT NULL AND pos !~ '^(명사|동사|형용사|형용동사|부사|연체사|접속사|감탄사|조사|조동사|기호|접두사|간투사|기타)(·(명사|동사|형용사|형용동사|부사|연체사|접속사|감탄사|조사|조동사|기호|접두사|간투사|기타))*$';
UPDATE user_vocabulary SET pos = ''
 WHERE language = 'Japanese' AND pos IS NOT NULL AND pos <> '' AND pos !~ '^(명사|동사|형용사|형용동사|부사|연체사|접속사|감탄사|조사|조동사|기호|접두사|간투사|기타)(·(명사|동사|형용사|형용동사|부사|연체사|접속사|감탄사|조사|조동사|기호|접두사|간투사|기타))*$';

-- English
UPDATE morpheme_dictionary SET pos = NULL
 WHERE language = 'English' AND source <> 'user_verified' AND pos IS NOT NULL AND pos !~ '^(명사|동사|형용사|부사|전치사|접속사|관사|대명사|조동사|감탄사|수사)(·(명사|동사|형용사|부사|전치사|접속사|관사|대명사|조동사|감탄사|수사))*$';
UPDATE user_vocabulary SET pos = ''
 WHERE language = 'English' AND pos IS NOT NULL AND pos <> '' AND pos !~ '^(명사|동사|형용사|부사|전치사|접속사|관사|대명사|조동사|감탄사|수사)(·(명사|동사|형용사|부사|전치사|접속사|관사|대명사|조동사|감탄사|수사))*$';

-- French
UPDATE morpheme_dictionary SET pos = NULL
 WHERE language = 'French' AND source <> 'user_verified' AND pos IS NOT NULL AND pos !~ '^(명사|동사|형용사|부사|전치사|접속사|관사|대명사|조동사|감탄사|수사|기호)(·(명사|동사|형용사|부사|전치사|접속사|관사|대명사|조동사|감탄사|수사|기호))*$';
UPDATE user_vocabulary SET pos = ''
 WHERE language = 'French' AND pos IS NOT NULL AND pos <> '' AND pos !~ '^(명사|동사|형용사|부사|전치사|접속사|관사|대명사|조동사|감탄사|수사|기호)(·(명사|동사|형용사|부사|전치사|접속사|관사|대명사|조동사|감탄사|수사|기호))*$';

-- user_verified 행은 오너 판정 — 목록만
SELECT language, base_form, pos FROM morpheme_dictionary
 WHERE language = 'Chinese' AND source = 'user_verified' AND pos IS NOT NULL AND pos !~ '^(명사|인명|지명|기관명|고유명사|동사|부사성 동사|명사성 동사|형용사|부사성 형용사|명사성 형용사|부사|수사|양사|대명사|전치사|접속사|조사|허사|어기조사|의성어|감탄사|성어|관용구|약어|처소사|시간사|방위사|구별사|상태사|접두|접미|어소|기호|기타|외국어|수량사)(·(명사|인명|지명|기관명|고유명사|동사|부사성 동사|명사성 동사|형용사|부사성 형용사|명사성 형용사|부사|수사|양사|대명사|전치사|접속사|조사|허사|어기조사|의성어|감탄사|성어|관용구|약어|처소사|시간사|방위사|구별사|상태사|접두|접미|어소|기호|기타|외국어|수량사))*$';
SELECT language, base_form, pos FROM morpheme_dictionary
 WHERE language = 'Japanese' AND source = 'user_verified' AND pos IS NOT NULL AND pos !~ '^(명사|동사|형용사|형용동사|부사|연체사|접속사|감탄사|조사|조동사|기호|접두사|간투사|기타)(·(명사|동사|형용사|형용동사|부사|연체사|접속사|감탄사|조사|조동사|기호|접두사|간투사|기타))*$';
SELECT language, base_form, pos FROM morpheme_dictionary
 WHERE language = 'English' AND source = 'user_verified' AND pos IS NOT NULL AND pos !~ '^(명사|동사|형용사|부사|전치사|접속사|관사|대명사|조동사|감탄사|수사)(·(명사|동사|형용사|부사|전치사|접속사|관사|대명사|조동사|감탄사|수사))*$';
SELECT language, base_form, pos FROM morpheme_dictionary
 WHERE language = 'French' AND source = 'user_verified' AND pos IS NOT NULL AND pos !~ '^(명사|동사|형용사|부사|전치사|접속사|관사|대명사|조동사|감탄사|수사|기호)(·(명사|동사|형용사|부사|전치사|접속사|관사|대명사|조동사|감탄사|수사|기호))*$';
