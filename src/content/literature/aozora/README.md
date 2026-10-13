# 정본 문학책 — 青空文庫 (아오조라)

설계: 아오조라 「책자」 재설계(2026-10-12 KST, 오너 결정 D1–D6). 이 폴더는 공개 책으로 게시할 퍼블릭 도메인
원작의 **원문 정본**과 **권리 기록**을 둔다. 원문은 리포에 두고, `scripts/build-literature.mjs`가 결정적으로
`chapters.json`(장별 `rawText`·저자 루비 잠금·크레딧)을 만든다. 게시(공개 `reading_materials` 삽입 →
관리자 1회 분석)는 별도 관리자 단계다 — 이 폴더의 파일만으로는 아무것도 공개되지 않는다.

## 폴더 구조

```
src/content/literature/aozora/
  aozora-<인물ID 6자리>-<작품ID 6자리>/   ← 폴더 이름 = 작품 키(metadata.book.key). 다르면 빌드 실패
    source.txt      ← 青空文庫 「テキストファイル(ルビあり)」 zip 안의 txt를 UTF-8로 바꾼 것(내용 수정 금지)
    entry.json      ← 카탈로그·권리 기록(아래)
    chapters.json   ← 빌드 산출물(손으로 고치지 않는다)
```

작품이 0편이면 `--check`는 그대로 통과한다.

## 작품 추가 절차

1. **선정(D5)** — 아래를 모두 만족해야 한다. 하나라도 아니면 넣지 않는다.
   - 文字遣い種別 `新字新仮名`, 미해결 외자 0(JIS 면구점만 있는 외자는 미해결로 친다 — 빌드가 실패한다).
   - **1931년 이전 출판** 또는 **작가 1945년 이전 사망**. 번역자·삽화가 없음(원작만).
   - 장당 1,500–4,000자(10–15분)에 맞는 분량. 見出し 주석이 2개 이상이면 그 표제로 장을 나눈다.
2. **원문 받기** — 도서 카드(`https://www.aozora.gr.jp/cards/<인물ID>/card<작품ID>.html`)의
   「テキストファイル(ルビあり)」 zip을 받는다.
   - zip의 SHA-256을 기록한다: `sha256sum xxx_ruby_yyy.zip` → `entry.json`의 `sourceSha256`.
   - zip 안 txt(Shift_JIS)를 UTF-8로: `iconv -f SHIFT_JIS -t UTF-8 xxx.txt > source.txt`
     (CRLF는 그대로 둬도 된다 — 파서가 정규화한다). 변환 뒤 내용을 손대지 않는다.
   - `source.txt`의 SHA-256 → `entry.json`의 `textSha256`(빌드가 매번 대조한다 — 원문 수정을 막는 장치).
3. **권리 검토 기록** — `rights`를 사람이 채운다. 법률 판단을 자동화하지 않는다(fail-closed 증거 계약).
   - `status: "approved"`, `basis: "public-domain"`(허락작·CC 작품 `permission`은 공개 불가).
   - `reviewedBy`(역할명, 예: `"owner"` — 이메일·실명은 적지 않는다. 공개 자료 metadata에 실린다),
     `reviewedAt`(KST 날짜 `YYYY-MM-DD`), `evidenceUrl`(HTTPS — 보통 도서 카드).
   - `reviewedJurisdictions`: **`["JP", "KR", "US"]` 셋을 모두** 검토해 적는다.
4. `node scripts/build-literature.mjs` → `chapters.json` 생성. 출력의 장 수·진단(`diagnostics`)을 확인한다.
   - `mappedRubyCount`/`rubyCount`, `droppedRubyCount`(0이어야 정상), `annotationRubyCount`(독음이 아닌 루비 수).
5. `node scripts/build-literature.mjs --check`와 `npm test` 통과 후 PR. (`prebuild`에도 `--check`가 걸려 있다.)

## entry.json 형식

```json
{
  "schemaVersion": 1,
  "personId": "000000",
  "workId": "0",
  "title": "작품명 — source.txt 첫 줄과 같아야 한다",
  "author": "저자명 — source.txt 머리 마지막 줄과 같아야 한다",
  "language": "ja",
  "charset": "新字新仮名",
  "publishedYear": 1900,
  "authorDeathYear": 1940,
  "level": "N2 상급",
  "cardUrl": "https://www.aozora.gr.jp/cards/000000/card0.html",
  "sourceFileUrl": "https://www.aozora.gr.jp/cards/000000/files/0_ruby_0.zip",
  "sourceFormat": "txt",
  "sourceSha256": "<zip SHA-256, 소문자 64자>",
  "textSha256": "<source.txt SHA-256, 소문자 64자>",
  "attribution": { "author": "저자명", "translator": null, "illustrator": null },
  "rights": {
    "status": "approved",
    "basis": "public-domain",
    "reviewedBy": "owner",
    "reviewedAt": "2026-10-12",
    "reviewedJurisdictions": ["JP", "KR", "US"],
    "evidenceUrl": "https://www.aozora.gr.jp/cards/000000/card0.html"
  }
}
```

- `level`은 편집 레벨 라벨(`JP_LEVELS` 중 하나, D6 — 개인 맞춤도 「아는 단어 N%」와 함께 보인다).
- `translator`·`illustrator`는 키를 빼지 말고 `null`로 적는다(빠뜨림 = 미검토로 보고 공개하지 않는다).

## 산출물이 담는 것

- 장마다 `rawText`(문단 사이 빈 줄, 루비·주석 제거), `metadata.book`(책 묶음), `metadata.level`,
  `metadata.literature`(크레딧: 底本·親本·입력·교정·도서 카드·권리 기록, 우리가 바꾼 점, `rubyLocks`).
- `rubyLocks`는 그 장 `rawText` 기준 문자 범위다. 분석(`analyzeText`) 끝에서 토큰과 **정확히** 맞는 것만 사전
  독음을 덮는다. 우선순위는 사용자 교정 > 저자 루비 > 분석기.
- 뷰어는 `metadata.literature`로 출처 줄(青空文庫 · 底本 · 입력 · 교정 · 원작 퍼블릭 도메인 · 도서 카드)을 그린다.
