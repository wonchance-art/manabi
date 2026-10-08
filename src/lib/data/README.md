# src/lib/data — 생성 데이터의 출처·라이선스

클라이언트(뷰어 글자 카드·한자 대조·수업 판서)가 읽는 정적 데이터다. 생성기 주석이
1차 근거이며, 이 표는 그 요약이다(감사 2026-10-07 KST). 고지문 원문은 `LICENSES/`에 둔다.
이 디렉터리의 JSON은 로컬 Node 22에서만 재생성한다(AGENTS.md — 결정성).

| 파일 | 원천 | 라이선스 | 생성기 |
|---|---|---|---|
| `hanjaEtym.json` | Unicode Unihan (kTotalStrokes·kRSUnicode·kTraditionalVariant·kSimplifiedVariant, unicode-org/unicodetools @ e4a5a6c9) + BabelStone IDS (qundao/backup-babelstone-ids @ d8bd67e5) | Unicode License v3 (`LICENSES/Unicode-3.0.txt`) · BabelStone IDS는 출처 표기 없이 이용 허용 | `scripts/build-hanja-etym.mjs` |
| `hanjaPanel.json` | 한자 창(AE-R4): Unicode Unihan `kPhonetic`·`kMandarin`(unicode-org/unicodetools @ e4a5a6c9) + `hanjaEtym.json`의 1단 분해(BabelStone IDS)·부수(kRSUnicode) + `hanjaTrad.json`(OpenCC s2t — 정체 꼴 글자 우주) + 수기 판정 `scripts/hanja-curated.mjs`(`ROLE_OVERRIDES`·`PIECE_LABELS`, 라벨 훈은 libhangul `hanja.txt`에서 다듬음). 검수 대조 자료(Make Me a Hanzi, LGPL)는 로그로만 쓰고 싣지 않는다 | Unicode License v3 (`LICENSES/Unicode-3.0.txt`) · Apache-2.0 · BSD 3-Clause | `scripts/generate-hanja-panel.mjs` |
| `hanjaJa.json` | Unicode Unihan 17.0.0 (kTraditionalVariant · kJoyoKanji · kJinmeiyoKanji — unicode-org/unicodetools `unicodetools/data/ucd/17.0.0/Unihan`) + OpenCC `JPShinjitaiCharactersRev`·`STCharacters` (npm `opencc-data@1.4.1`) + libhangul `hanja.txt`(음 계열 매칭). 일본 상용·인명용 한자(상용한자표 2010 내각 고시 · 호적법 시행규칙 별표 제2 — 일본 저작권법 제13조의 고시·법령)는 다른 글자로 바꾸지 않는다(2026-10-07 KST) | Unicode License v3 (`LICENSES/Unicode-3.0.txt`) · Apache-2.0 (`LICENSES/Apache-2.0-OpenCC.txt`) · BSD 3-Clause (`LICENSES/BSD-3-Clause-libhangul-hanja.txt`) | `scripts/generate-hanja-ja.mjs` |
| `hanjaKo.json` | npm `hanja` 1.1.5 `hanjaeum.json` + libhangul `hanja.txt` + OpenCC `STCharacters` | MIT · BSD 3-Clause · Apache-2.0 | `scripts/generate-hanja-ko.mjs` |
| `hanjaTrad.json` | OpenCC `STPhrases`·`STPhrases_GeneratedFromRegionalPhrases`·`STCharacters`(s2t, npm `opencc-data@1.4.1`) 중 HSK·우리 사전 표제어·수량 구절의 변환 결과 + 대만 이체 `TWVariants`·`TWVariantsPhrases`(s2tw 둘째 단계 — 正 줄)·모호 글자·검증 표제어 + 한국 다음자 예외·정자 이체(`scripts/hanja-curated.mjs`) | Apache-2.0 (`LICENSES/Apache-2.0-OpenCC.txt`) | `scripts/generate-hanja-trad.mjs` |
| `jaWords.json` | **JMdict/EDICT**(EDRDG, EDICT `Created: 2025-11-06`) 중 중국어 표제어(HSK·우리 사전)와 같은 표기의 일본어 단어의 표기·요미(日 줄). 열쇠 = Unihan kJapaneseNewVariant · OpenCC s2t · `hanjaJa.json`, 뜻 관문 = CC-CEDICT 영문 뜻 겹침(표에는 싣지 않음), 거부 목록 = `scripts/hanja-curated.mjs` `JA_FALSE_FRIENDS` | **CC BY-SA 4.0 — 이 파일만** (`LICENSES/CC-BY-SA-4.0.txt`) | `scripts/generate-ja-words.mjs` |
| `hanjaHun.json` | libhangul `hanja.txt` 훈음 필드 + OpenCC `STCharacters` + 수기 감수(`scripts/hanja-curated.mjs`) | BSD 3-Clause · Apache-2.0 | `scripts/generate-hanja-hun.mjs` |
| `zhHskLevel.json` | ivankra/hsk30 (`hsk30.csv`) | MIT | `scripts/build-zh-hsk.mjs` |
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
- **JMdict/EDICT** — © Electronic Dictionary Research and Development Group(EDRDG).
  CC BY-SA 4.0, EDRDG 라이선스(https://www.edrdg.org/edrdg/licence.html)에 따라 사용한다.
  `jaWords.json`은 이 사전에서 고른 표기·요미를 가공한 **파생 데이터베이스이며 이 파일만 같은
  CC BY-SA 4.0으로 제공**한다(앱 코드·다른 데이터 파일에는 걸리지 않는다 — 별도 파일로 담은 모음).
  변경: 중국어 표제어와 같은 표기의 일본어 단어만 골라 요미와 함께 실었다. 사용자 화면 고지는
  `/credits#jmdict`(`src/lib/dataCredits.js`). 전문: `LICENSES/CC-BY-SA-4.0.txt`.
