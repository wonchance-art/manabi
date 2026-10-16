# Standard Ebooks 정본 책 (영어 원작 — LIT-SRC-EN-1)

오너 「ㄱㄱ」(2026-10-16 KST)로 시작한 영어 시범. 원문은 [Standard Ebooks](https://standardebooks.org) 판(미국 퍼블릭 도메인 원문을
다시 교정·구조화, 교정·서식 기여는 CC0 1.0)을 **한 커밋에 고정**해 리포에 둔다. 권리 선·출처 표기는 `docs/policy-brand-content.md` §2.1.

## 작품 폴더

```
se-<작가>_<작품>/
  entry.json        판 저장소·커밋·작품 정보·권리 기록·본문 파일 목록(파일마다 SHA-256)
  source/*.xhtml    판 저장소 src/epub/text의 본문 파일 그대로(bodymatter만 — 표제·판권·후기는 넣지 않는다)
  chapters.json     빌드 산출물(손으로 고치지 않는다)
index.generated.js       관리자 게시 API용 책 목록(장 원문 포함 — 서버 전용)
manifest.generated.json  뷰어 정본 대조표(장마다 제목·원문 SHA-256 + 크레딧, 원문 없음)
```

## 작품 추가

```
node scripts/literature/se-add-work.mjs <작가>_<작품> --published 1865 --death 1898 --origin GB --level "B1 중급" \
     --title-ko "이상한 나라의 앨리스" --author-ko "루이스 캐럴" --approve claude      # --dry-run이면 진단만
node scripts/build-literature.mjs && npm test
```

- 판 저장소는 `https://github.com/standardebooks/<작가>_<작품>`. `--commit`이 없으면 기본 가지 끝 커밋으로 고정한다.
- 권리: 원산국 사후 70년 + 미국 출판 95년(검토 연도 기준 — 2026년이면 작가 1955년 이전 사망 · 1930년 이전 출판), 번역본 없음,
  판정 규칙이 있는 원산국(GB·US)만. `--approve`는 판정이 통과할 때만 approved로 적는다(법률 판단을 대신하지 않는다 — 공개는
  관리자 게시 화면에서 사람이 누를 때만).
- 장 나눔: 판의 본문 파일(장·단편·stave) 하나가 기본. 2,200단어를 넘으면 그 안에서 문단 경계로 고르게(「A Scandal in Bohemia (2/4)」).
- 글자 정리: 보이지 않는 조판 문자(단어 결합자 U+2060, 고정 공백 등)만 정리하고 따옴표·줄표는 판 그대로. 삽화·그림 설명은 싣지 않는다.

## 수록 작품 (2026-10-16 KST)

| 작품 | 작가(몰년) | 초출 | 레벨 | 장 | 판 커밋 |
|---|---|---|---|---|---|
| Alice’s Adventures in Wonderland | Lewis Carroll(1898) | 1865 | B1 중급 | 12 | `9ecdf2ff` |
| The Adventures of Sherlock Holmes | Arthur Conan Doyle(1930) | 1892 | B2 상급 | 47 | `48ec456e` |
| A Christmas Carol | Charles Dickens(1870) | 1843 | B2 상급 | 13 | `dd1fb9f8` |

게시는 青空文庫와 같은 관리자 → 📚 정본 문학책 표에서(준비 → 분석 → 검수 → 공개).

## 표지 — 「빅토리아 천 장정」(오너 「그럼 B로」 → 「실물에 가깝게」 2026-10-16 KST)

entry.json `display`에 `coverTitle`(표지 큰 글자, 한두 줄) · `coverKicker`(그 위 작은 글자 — 실물에 있을 때만) · `coverAuthor`(앞표지 작가 —
실물에 있을 때만) · `cloth` · `binding`(장정 구성)을 적는다(키는 `src/lib/victorianCover.js`, 빌드가 검사한다). 값은 그 작품 초판 앞표지의
실물 구성을 따른다 — 근거·표는 `docs/literature-pipeline.md` §8.4. 새 작품은 초판 사진·서지 기록부터 대조해 장정 구성을 고르거나(없으면
새로 그린다), 천 색은 실물 사진에서 재고 기존 천과 색차 12 이상인지 본다. 원본은 옮겨 붙이지 않고, 사람 몸·출판사 표지(총서 이름 등)는 그리지 않는다.
