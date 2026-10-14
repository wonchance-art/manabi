# 정본 문학책 — 青空文庫 (아오조라)

설계: 아오조라 「책자」 재설계(2026-10-12 KST, 오너 결정 D1–D6). 이 폴더는 공개 책으로 게시할 퍼블릭 도메인
원작의 **원문 정본**과 **권리 기록**을 둔다. 원문은 리포에 두고, `scripts/build-literature.mjs`가 결정적으로
`chapters.json`(장별 `rawText`·저자 루비 잠금·크레딧)을 만든다. 게시(공개 `reading_materials` 삽입 →
관리자 1회 분석)는 별도 관리자 단계다 — 이 폴더의 파일만으로는 아무것도 공개되지 않는다.

같은 빌드가 루트에 두 파일을 더 만든다(손으로 고치지 않는다 — `--check`가 낡음을 잡는다):
- `index.generated.js` — 관리자 게시 API(`/api/admin/literature`)가 정적 import하는 책 목록(장 원문 포함, 서버 전용).
- `manifest.generated.json` — 뷰어 정본 대조표(장 원문 SHA-256 + 크레딧). 뷰어 출처 줄은 이 표로 그린다.

## 게시 (관리자) — 분석 → 검수·편집 → 공개 (P0-3 · P0-4)

1. 관리자 → **📚 정본 문학책** 탭에서 작품의 권리 근거(초출·몰년·관할·도서 카드)를 확인하고 「게시」.
   장마다 **비공개** 자료가 생기고(소유자 = 게시한 관리자, `status: pending`), 같은 화면이 장마다 한 번씩 바로 분석한다
   (뷰어 「이 챕터 분석하기」와 같은 경로 — 분석 말미에 저자 루비 잠금 + 검수 힌트). 화면을 닫으면 멈추고, 다시 열어 「이어서 분석」.
   같은 책을 다시 눌러도 없는 장만 넣는다(book key + 장 순서 멱등). 정본과 원문이 다른 장·중복 장이 있으면
   아무것도 넣지 않고 「확인 필요」로 보인다.
2. **검수** — 장 링크를 열어 「뜻 확인 필요」 목록에서 문맥 뜻 제안을 고르거나(「문맥 제안」), 사전 뜻을 고르거나,
   그대로 두기로 확정한다. 단어 경계 묶기·나누기, 뜻·발음 교정도 이때 한다(원문은 고칠 수 없다). 확인이 0이 되면
   관리자 화면에서 그 장 「검수 완료」. 다시 분석하면 그 장은 다시 검수해야 한다.
3. 「공개」 — 모든 장이 분석·검수 완료일 때만 공개로 바뀌고 산책 › 함께 읽는 글에 책 카드로 보인다.
   사용자는 「분석 전」·「검수 전」 장을 보지 않는다. 분석·검수 결과는 모두가 같이 쓰고, 단어 상태만 사람마다 따로다.

### 검수 힌트 `review.json` (선택)

사전 검토자가 「사전 뜻만으로는 이 자리에서 틀리거나 부족한 낱말」에 문맥 뜻 제안을 단다(고어·사투리·한자 차용 표기·
의성어 등 — 예: 十米의 米 = 미터, お手々がちんちんする = 시려서 얼얼하다). 뜻 자체를 바꾸지 않고 「뜻 확인 필요」 표식과
제안만 붙는다 — 확정은 검수자가 한다.

```json
{ "schemaVersion": 1, "reviewedBy": "claude",
  "hints": [ { "chapter": 1, "form": "米", "nth": 1, "meaning": "미터(m)", "note": "十米 = 10미터" } ] }
```
- `form`은 그 장 본문에 있는 글자 그대로(공백 없음), `nth`는 그 장에서 몇 번째(기본 1). 빌드가 위치로 풀고, 원문에 없거나
  겹치면 빌드가 실패한다. 분석기가 그 범위와 같은 토큰(없으면 범위를 품은 토큰)에 붙인다.
- `meaning` ≤ 80자, `note` ≤ 120자(검수자용 근거 — 「뜻 확인 필요」 목록에만 보인다).

## 작품 추가 절차

1. **선정(D5)** — 아래를 모두 만족해야 한다. 하나라도 아니면 넣지 않는다.
   - 文字遣い種別 `新字新仮名`, 미해결 외자 0(JIS 면구점만 있는 외자는 미해결로 친다 — 빌드가 실패한다).
   - **1931년 이전 출판** 또는 **작가 1945년 이전 사망**. 번역자·삽화가 없음(원작만).
   - 장당 1,500–4,000자(10–15분)에 맞는 분량. 見出し 주석이 2개 이상이면 그 표제로 장을 나눈다.
     見出し가 있으면 짧은 장이 생겨도 **목차대로 나눈다**(합치지 않는다 — 오너 확정 2026-10-14 KST, 예: ごん狐 6장).
     見出し가 없으면 장 수를 round(전체/3,000)로 정해 고르게 나눈다(짧은 꼬리 장 없음, 장 머리가 앞 대사의 이음 문단이 아닌 경계).
   - JIS 3·4수준 외자(`第3水準1-87-71` 등 면구점만 있는 것)가 있는 작품은 지금 넣을 수 없다(예: 蜘蛛の糸·羅生門·夢十夜·トロッコ).
     新字旧仮名(예: 杜子春)도 제외.
2. **원문 받기** — 도서 카드(`https://www.aozora.gr.jp/cards/<인물ID>/card<작품ID>.html`)의
   「テキストファイル(ルビあり)」 zip을 받는다.
   - zip의 SHA-256을 기록한다: `sha256sum xxx_ruby_yyy.zip` → `entry.json`의 `sourceSha256`.
   - zip 안 txt(Shift_JIS)를 UTF-8로: `iconv -f SHIFT_JIS -t UTF-8 xxx.txt > source.txt`
     (CRLF는 그대로 둬도 된다 — 파서가 정규화한다). 변환 뒤 내용을 손대지 않는다.
   - `source.txt`의 SHA-256 → `entry.json`의 `textSha256`(빌드가 매번 대조한다 — 원문 수정을 막는 장치).
3. **권리 검토 기록** — `rights`를 사람이 채운다. 법률 판단을 자동화하지 않는다(fail-closed 증거 계약).
   - `status: "approved"`, `basis: "public-domain"`(허락작·CC 작품 `permission`은 공개 불가).
   - `reviewedBy`(역할명, 예: `"owner"`·`"claude"` — 이메일·실명은 적지 않는다. 공개 자료 metadata에 실린다).
     Claude가 근거(도서 카드의 초출·몰년)를 대조해 채운 기록은, 관리자가 게시 화면에서 같은 근거를 보고
     「게시」를 누를 때 사람 확인이 끝난다(게시 전에는 아무것도 공개되지 않는다).
     그 밖의 칸:
     `reviewedAt`(KST 날짜 `YYYY-MM-DD`), `evidenceUrl`(HTTPS — 보통 도서 카드).
   - `reviewedJurisdictions`: **`["JP", "KR", "US"]` 셋을 모두** 검토해 적는다.
4. `node scripts/build-literature.mjs` → `chapters.json` 생성. 출력의 장 수·진단(`diagnostics`)을 확인한다.
   - `mappedRubyCount`/`rubyCount`, `droppedRubyCount`(0이어야 정상), `annotationRubyCount`(독음이 아닌 루비 수).
5. `node scripts/build-literature.mjs --check`와 `npm test` 통과 후 PR. (`prebuild`에도 `--check`가 걸려 있다.)

## 수록 작품 (2026-10-14 KST, AOZORA-P0-2)

| 작품 키 | 작품 | 저자(몰년) | 초출 | 레벨 | 장 |
|---|---|---|---|---|---|
| aozora-000121-000637 | 手袋を買いに | 新美南吉(1943) | 1943 『牛をつないだ椿の木』(사후) | N4 기본 | 1 |
| aozora-000121-000628 | ごん狐 | 新美南吉(1943) | 1932 「赤い鳥」 | N3 중급 | 6(見出し) |
| aozora-000081-043754 | 注文の多い料理店 | 宮沢賢治(1933) | 1924 | N3 중급 | 2 |
| aozora-000879-000042 | 鼻 | 芥川龍之介(1927) | 1916 「新思潮」 | N2 상급 | 2 |
| aozora-000148-000753 | 文鳥 | 夏目漱石(1916) | 1908 「大阪朝日」 | N1 심화 | 4 |

다섯 편 모두 작가 1945년 이전 사망(D5) · 번역·삽화 없음 · 新字新仮名 · 외자 미해결 0. 레벨은 편집 라벨(D6).

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
  },
  "display": {
    "titleReading": "さくひんめい",
    "titleKo": "작품 한국어 제목",
    "authorKo": "작가 한국어 이름(외래어 표기법)",
    "cover": "ink",
    "motif": "ink-steam",
    "coverTitle": "여섯 자를 넘는\n제목만"
  }
}
```

- `level`은 편집 레벨 라벨(`JP_LEVELS` 중 하나, D6 — 개인 맞춤도 「아는 단어 N%」와 함께 보인다).
- `translator`·`illustrator`는 키를 빼지 말고 `null`로 적는다(빠뜨림 = 미검토로 보고 공개하지 않는다).
- `display`(AOZORA-P0-5)는 표지·카드 표기다. 원서 표지·삽화 이미지는 쓰지 않는다(IP 정책 §2.1 금지⑴) — 표지는 같은 틀에
  세로 제목과 작품 색만 바뀌는 타이포그래피 표지다. 빌드가 검사하고 대조표(`manifest.generated.json`)에 싣는다.
  - `titleReading`은 가나만. `cover`는 팔레트 이름(`snow`·`vermilion`·`forest`·`ink`·`slate`, `literatureDisplay.js`) —
    작품 이미지에 맞춰 고르고 이미 쓴 색과 겹치지 않게 한다. 새 색이 필요하면 CSS와 팔레트를 함께 늘리고 흰 글자 대비 4.5:1 이상을 지킨다.
  - `motif`는 표지 문양(`LITERATURE_COVER_MOTIFS` — `LiteratureCoverArt`의 자작 SVG). 원서 표지·기존 삽화·알려진 캐릭터를
    옮기지 않는다. 새 작품은 그 작품 분위기의 새 문양을 같은 틀(오른쪽 위 제목 자리 비움 · 아래·왼쪽에 주제 · 색은 CSS)로 그려 더한다.
  - 표지는 모든 작품이 같은 배치다: 제목(11px)이 오른쪽 위에서 한 줄로, 작가가 그 왼쪽 아래에. 제목은 한 줄 여섯 자까지 —
    넘는 제목만 `coverTitle`에 작품명 그대로 줄바꿈(`\n`)을 넣고 첫 줄을 길게(둘째 줄은 아래에 붙는다). 여섯 자 이하를
    나누거나 다른 글자를 넣으면 빌드 실패.
- 장 이름은 빌드가 정한다: 見出し가 있으면 그대로(「ごん狐 — 一」), 분량으로 나눈 장은 「1/2」(자료 제목 「鼻 (1/2)」),
  한 장이면 작품명만. 교재의 「과」·연재의 「편」은 쓰지 않는다(오너 확정 2026-10-14 KST). 카드의 장 줄은 장 첫 문장(incipit)을 단다.

## 산출물이 담는 것

- 장마다 `rawText`(문단 사이 빈 줄, 루비·주석 제거), `metadata.book`(책 묶음), `metadata.level`,
  `metadata.literature`(크레딧: 底本·親本·입력·교정·도서 카드·권리 기록, 우리가 바꾼 점, `rubyLocks`).
- `rubyLocks`는 그 장 `rawText` 기준 문자 범위다. 분석(`analyzeText`) 끝에서 토큰과 **정확히** 맞는 것만 사전
  독음을 덮는다. 우선순위는 사용자 교정 > 저자 루비 > 분석기.
- 뷰어는 `metadata.literature`로 출처 줄(青空文庫 · 底本 · 입력 · 교정 · 원작 퍼블릭 도메인 · 도서 카드)을 그린다.
