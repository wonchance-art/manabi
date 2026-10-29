# src/lib/data — 생성 데이터의 출처·라이선스

클라이언트(뷰어 글자 카드·한자 대조·수업 판서)가 읽는 정적 데이터다. 생성기 주석이
1차 근거이며, 이 표는 그 요약이다(감사 2026-10-07 KST). 고지문 원문은 `LICENSES/`에 둔다.
이 디렉터리의 JSON은 로컬 Node 22에서만 재생성한다(AGENTS.md — 결정성). 예외: `jaKanjiReadings.json`·`jaJeongja.json`·`jaExampleWords.json`은
정렬한 문자열 JSON만 써서 Node 22·24가 같은 바이트를 낸다(PNG·zlib 경로 없음 — 2026-10-19 KST 확인, 생성은 Node 24).

| 파일 | 원천 | 라이선스 | 생성기 |
|---|---|---|---|
| `hanjaEtym.json` | Unicode Unihan (kTotalStrokes·kRSUnicode·kTraditionalVariant·kSimplifiedVariant, unicode-org/unicodetools @ e4a5a6c9) + BabelStone IDS (qundao/backup-babelstone-ids @ d8bd67e5) | Unicode License v3 (`LICENSES/Unicode-3.0.txt`) · BabelStone IDS는 출처 표기 없이 이용 허용 | `scripts/build-hanja-etym.mjs` |
| `hanjaPanel.json` | 한자 창(AE-R4): Unicode Unihan `kPhonetic`·`kMandarin`(unicode-org/unicodetools @ e4a5a6c9) + `hanjaEtym.json`의 1단 분해(BabelStone IDS)·부수(kRSUnicode) + `hanjaTrad.json`(OpenCC s2t — 정체 꼴 글자 우주) + 수기 판정 `scripts/hanja-curated.mjs`(`ROLE_OVERRIDES`·`PIECE_LABELS`, 라벨 훈은 libhangul `hanja.txt`에서 다듬음). 검수 대조 자료(Make Me a Hanzi, LGPL)는 로그로만 쓰고 싣지 않는다 | Unicode License v3 (`LICENSES/Unicode-3.0.txt`) · Apache-2.0 · BSD 3-Clause | `scripts/generate-hanja-panel.mjs` |
| `hanjaJa.json` | Unicode Unihan 17.0.0 (kTraditionalVariant · kJoyoKanji · kJinmeiyoKanji — unicode-org/unicodetools `unicodetools/data/ucd/17.0.0/Unihan`) + OpenCC `JPShinjitaiCharactersRev`·`STCharacters` (npm `opencc-data@1.4.1`) + libhangul `hanja.txt`(음 계열 매칭). 일본 상용·인명용 한자(상용한자표 2010 내각 고시 · 호적법 시행규칙 별표 제2 — 일본 저작권법 제13조의 고시·법령)는 다른 글자로 바꾸지 않는다(2026-10-07 KST) | Unicode License v3 (`LICENSES/Unicode-3.0.txt`) · Apache-2.0 (`LICENSES/Apache-2.0-OpenCC.txt`) · BSD 3-Clause (`LICENSES/BSD-3-Clause-libhangul-hanja.txt`) | `scripts/generate-hanja-ja.mjs` |
| `hanjaKo.json` | npm `hanja` 1.1.5 `hanjaeum.json` + libhangul `hanja.txt` + OpenCC `STCharacters` | MIT · BSD 3-Clause · Apache-2.0 | `scripts/generate-hanja-ko.mjs` |
| `hanjaTrad.json` | OpenCC `STPhrases`·`STPhrases_GeneratedFromRegionalPhrases`·`STCharacters`(s2t, npm `opencc-data@1.4.1`) 중 HSK·우리 사전 표제어·수량 구절의 변환 결과 + 대만 이체 `TWVariants`·`TWVariantsPhrases`(s2tw 둘째 단계 — 正 줄)·모호 글자·검증 표제어 + 한국 다음자 예외·정자 이체(`scripts/hanja-curated.mjs`) | Apache-2.0 (`LICENSES/Apache-2.0-OpenCC.txt`) | `scripts/generate-hanja-trad.mjs` |
| `jaWords.json` | **JMdict/EDICT**(EDRDG, EDICT `Created: 2025-11-06`) 중 중국어 표제어(HSK·우리 사전)와 같은 표기의 일본어 단어의 표기·요미(日 줄). 열쇠 = Unihan kJapaneseNewVariant · OpenCC s2t · `hanjaJa.json`, 뜻 관문 = CC-CEDICT 영문 뜻 겹침(표에는 싣지 않음), 거부 목록 = `scripts/hanja-curated.mjs` `JA_FALSE_FRIENDS` | **CC BY-SA 4.0 — 이 파일만** (`LICENSES/CC-BY-SA-4.0.txt`) | `scripts/generate-ja-words.mjs` |
| `jaKanjiReadings.json` | **KANJIDIC2**(EDRDG, database_version 2026-292 · `kanjidic2.xml.gz` sha256 `e03dfd07…` — 생성기 `_source`에 전체 해시) 글자별 음독(ja_on)·훈독(ja_kun, 오쿠리가나 앞까지). 글자 우주 = 상용·인명용(grade 있는 글자) ∪ 우리 일본어 단어 콘텐츠의 한자(3,051자). JLPT 단어 페이지 글자 칸 첫 줄(経 날 경 **けい**)을 빌드 때 나누는 데만 쓰고 표는 화면으로 보내지 않는다 | **CC BY-SA 4.0 — 이 파일만** (`LICENSES/CC-BY-SA-4.0.txt`) | `scripts/generate-ja-kanji.mjs`(`--check`) |
| `jaJoyo.json` | **常用漢字表**(2010-11-30 내각 고시 제2호, 문화청 `joyokanjihyo_20101130.pdf`) 본표의 음훈 — 2,136자 · 4,388음훈, 표 순서 그대로(음 가타카나 · 훈 히라가나, 오쿠리가나는 `.` 뒤), 한 자 내린 읽기 178개는 `*`. 표의 꼴 𠮟 · 塡 · 剝 · 頰은 흔한 꼴로도 싣는다. 오쿠리가나(원문 가는 글씨 — 글자로 뽑히지 않음)는 같은 줄 예에서 되살린다. JLPT 단어 페이지 글자 창의 음 · 훈 표. 화면은 동적 import만 | 고시(일본 저작권법 제13조 — 권리의 목적이 되지 않는 저작물) | `scripts/generate-ja-joyo.mjs`(`--check`) |
| `jaKanjiOnKun.json` | **KANJIDIC2**(EDRDG) 중 상용 밖 콘텐츠 한자(醤 등)의 음독 · 훈독(오쿠리가나는 `.` 뒤). `jaJoyo.json`과 같은 모양으로 글자 창의 음 · 훈 표에 쓴다 | **CC BY-SA 4.0 — 이 파일만** (`LICENSES/CC-BY-SA-4.0.txt`) | `scripts/generate-ja-joyo.mjs`(`--check`) |
| `jaJeongja.json` | OpenCC `JPShinjitaiCharacters`(npm `opencc-data@1.4.1`) 중 후보가 하나이고 꼴이 다른 신자체 → 정자(経 → 經, 393자). JLPT 글자 칸 아래 회색 글자 · 훈음 찾기 꼴 | Apache-2.0 (`LICENSES/Apache-2.0-OpenCC.txt`) | `scripts/generate-ja-kanji.mjs`(`--check`) |
| `jaExampleWords.json` | 저장소 JLPT 단어 예문(`src/content/japanese/vocab`)을 앱 분석기 `tokenizeJaLine`(kuromoji + IPADIC)으로 나눈 단어 조각 길이 · 원형(して → する). 예문 글은 싣지 않고 해시 열쇠만 | 콘텐츠 원천 · kuromoji/IPADIC 라이선스를 따른다 | `jaExampleWordsBuild.test.js`(`UPDATE_JA_EXAMPLE_WORDS=1`) |
| `hanjaHun.json` | libhangul `hanja.txt` 훈음 필드 + OpenCC `STCharacters` + 수기 감수(`scripts/hanja-curated.mjs`) | BSD 3-Clause · Apache-2.0 | `scripts/generate-hanja-hun.mjs` |
| `zhHskLevel.json` | ivankra/hsk30 (`hsk30.csv`) — HSK 2021 등급표. **분절 방벽 전용**(`server/zhTokenFix.js` isZhRealWord), 화면 급수에는 쓰지 않는다 | MIT | `scripts/build-zh-hsk.mjs` |
| `zhHsk2026Level.json` | 《中文水平考试 HSK 考试大纲》(中外语言交流合作中心, 2025-11 발표 · 2026-07 시행) 词汇大纲 — 설계 정본 `docs/design/hsk2026/words.json`에서 생성(동형어 번호 뗌 · 같은 표기는 가장 낮은 급수 · 괄호 급수는 앞 급수, 10,896단어). **화면 급수 표시 정본**(`src/lib/zhHskLevel.js`) | 공식 시험 대강의 단어·급수 목록만 발췌(PDF 원문은 싣지 않는다) | `scripts/build-zh-hsk2026.mjs`(`--check`, Node 22·24 같은 바이트) |
| `zhHanzi/<level>.json` | 「한자」 탭 표(HANZI-TAB-AL-001): 글자 목록 · 급수 = 《中文水平考试 HSK 考试大纲》 汉字大纲 认读字(`docs/design/hsk2026/chars.json`), 조어력 = `zhHsk2026Level.json`, 단어 · 병음 = 우리 사전(`src/content/chinese/vocab`), 뜻 갈래 · 주의 = 자체 콘텐츠 `src/content/chinese/hanzi/<level>.json`(AI 초안 → 다른 모델 표본 대조), 묶음 조각 = `hanjaPanel.json` · `hanjaTrad.json`. 화면은 동적 import만 | 공식 대강의 글자 · 급수 목록만 발췌 · 자체 저작 · 위 표들의 라이선스 | `scripts/build-zh-hanzi.mjs`(`--check`) |
| `examSchedules.json` | 시험 일정(LEVEL-ROUND-001 K): HSK한국사무국(hsk.or.kr) · chinesetest.cn · jlpt.or.kr · jlpt.jp 공식 페이지와 대조한 시험일 · 접수 기간만. 줄마다 `source`(공식 URL) · `checkedAt`(확인일, KST). 학원 · 블로그 정리는 싣지 않는다(`examSchedules.test.js`가 출처 도메인을 막는다) | 사실 정보(날짜)만 — 공식 페이지 문구는 싣지 않는다 | 수기 대조(생성기 없음) |
| `hanjaStory.json` | 자체 작성 | — | — |
| `jaYomiIndex.json` | 저장소 콘텐츠(`src/content/japanese/**`)에서 생성 | 콘텐츠 원천을 따른다 | `jaYomiIndexBuild.test.js` 참조 |
| `drillRefs.json` | 저장소 콘텐츠에서 생성 | 자체 | `drillRefsBuild.test.js` 참조 |

## 고지

- **libhangul `hanja.txt`** — Copyright (c) 2005,2006 Choe Hwanjin. BSD 3-Clause.
  `hanjaHun.json`·`hanjaKo.json`·`hanjaJa.json`은 이 사전의 음·훈음 필드에서 파생되었다.
  전문: `LICENSES/BSD-3-Clause-libhangul-hanja.txt`.
- **OpenCC** (BYVoid/OpenCC, npm `opencc-data@1.4.1`) — Apache License 2.0. 상류에 NOTICE
  파일이 없다(2026-10-07 확인). 변환 표 일부를 글자 단위 매핑과 표제어 단위 구절 표(`hanjaTrad.json`)로 가공해 사용한다.
  전문: `LICENSES/Apache-2.0-OpenCC.txt`.
- **Unicode Unihan** — Unicode License v3. 위 고지문이 데이터와 함께 있어야 하므로
  `LICENSES/Unicode-3.0.txt`에 원문을 둔다.
- **BabelStone IDS** — Andrew West. 출처 표기 의무는 없으나 자료 출처 화면에 함께 적는다.
- **KANJIDIC2** — © Electronic Dictionary Research and Development Group(EDRDG).
  CC BY-SA 4.0, EDRDG 라이선스(https://www.edrdg.org/edrdg/licence.html)에 따라 사용한다.
  `jaKanjiReadings.json`은 이 사전의 음독·훈독 필드에서 고른 **파생 데이터베이스이며 이 파일만 같은
  CC BY-SA 4.0으로 제공**한다. 변경: 상용·인명용·우리 단어 콘텐츠 글자의 읽기만 남기고 오쿠리가나를
  뗐다. `jaKanjiOnKun.json`도 같은 사전의 파생 데이터베이스이며 **이 파일만 같은 CC BY-SA 4.0으로 제공**한다.
  변경: 상용한자표 밖 콘텐츠 한자의 음독 · 훈독만 남기고 접두 · 접미 표지(-)가 붙은 읽기를 뺐다.
  사용자 화면 고지는 `/credits#kanjidic2`(`src/lib/dataCredits.js`).
- **JMdict/EDICT** — © Electronic Dictionary Research and Development Group(EDRDG).
  CC BY-SA 4.0, EDRDG 라이선스(https://www.edrdg.org/edrdg/licence.html)에 따라 사용한다.
  `jaWords.json`은 이 사전에서 고른 표기·요미를 가공한 **파생 데이터베이스이며 이 파일만 같은
  CC BY-SA 4.0으로 제공**한다(앱 코드·다른 데이터 파일에는 걸리지 않는다 — 별도 파일로 담은 모음).
  변경: 중국어 표제어와 같은 표기의 일본어 단어만 골라 요미와 함께 실었다. 사용자 화면 고지는
  `/credits#jmdict`(`src/lib/dataCredits.js`). 전문: `LICENSES/CC-BY-SA-4.0.txt`.
