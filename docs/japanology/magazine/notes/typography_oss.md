# 일·한 편집 타이포그래피(웹) — 표준·오픈소스·폰트 비교 노트 (2026-10-14 KST 기준)

> 조사 방법 메모: 이 컨테이너에서 w3.org·fonts.google.com·krds.go.kr·design.digital.go.jp·npm 레지스트리 직접 열람이 프록시로 차단되어, **1차 원천은 GitHub 저장소를 직접 clone해 읽었다**: MDN browser-compat-data(BCD, `8.1.5`, 2026-10-13 커밋), google/fonts(HEAD `66928797`, 2026-10-12 커밋)의 METADATA.pb·TTF 실물, w3c/jlreq·w3c/klreq, google/budoux, vivliostyle.js, kuroshiro, kuromoji.js, orioncactus/pretendard, digital-go-jp/design-tokens, KRDS-uiux/krds-uiux. 폰트의 OpenType 기능·글자 수는 TTF를 직접 파싱한 **자체 실측값**이다(아래 "실측" 표기). 웹 검색 요약만으로 얻은 내용은 따로 표시했다.
>
> 리포 현황 실측(이 조사의 전제를 고침): manabi는 이미 serif를 쓰고 있다 — `src/app/(app)/layout.jsx`가 `Noto_Serif_KR`(600/700, `--font-serif-kr`)을, `src/app/(app)/japanese/grammar/layout.jsx`가 `Noto_Serif_JP`·`Noto_Serif_KR`(400, `preload:false`)를, `src/components/viewer/ChineseSerif.jsx`가 `Noto_Serif_SC`(사용자가 고를 때만 지연 로드)를 `next/font/google`로 불러온다. 따라서 "serif/명조 없음"은 정확하지 않다. 또 `next/font/google`은 빌드 때 Google Fonts에서 받아 자체 호스팅하는 방식이며 리포에 폰트 파일을 vendoring하는 것과는 다르다(리포에 vendoring된 폰트는 `public/fonts/KanjiStrokeOrders-kana.woff2`뿐). 형태소 분석은 이미 `kuromojin ^3.0.1`(package.json)이 있다.

## 1. 표준 — JLREQ·KLREQ에서 웹에 중요한 규칙과 2026 CSS 지원 현황

### Takeaway
JLREQ·KLREQ가 요구하는 핵심(금칙, 약물 반각 처리, 루비, 섞어짜기 간격, 세로짜기)은 2026-10 현재 **세 엔진 공통으로 바로 쓸 수 있는 것**(writing-mode/text-orientation/text-combine-upright, ruby 요소, line-break:strict, word-break:keep-all, text-wrap:balance, text-autospace, font-feature-settings)과 **Chrome 전용**(text-spacing-trim, word-break:auto-phrase), **Safari 전용**(hanging-punctuation)으로 나뉜다. 매거진의 기본 조판은 앞의 공통 집합으로 짜고, 엔진별 기능은 없어도 깨지지 않는 점진적 향상으로만 얹는 것이 맞다.

### Cited Findings
**표준 문서 상태**
- JLREQ 저장소(w3c/jlreq)는 2026-09-18까지 커밋이 이어지고 있고(마지막 커밋 "Clarify properties and classes definitions"), `docs/spacing_property/`, `docs/simple-ruby/`, `docs/line-composition/` 같은 후속 작업 문서와 `jpan/` 일본어 gap analysis(2026-07-23 갱신)를 함께 관리한다 — [w3c/jlreq](https://github.com/w3c/jlreq). TR 발행본의 정확한 최신 날짜는 w3.org에 접근하지 못해 **미확인**이다(기억으로는 2020-08 Group Note).
- KLREQ(Requirements for Hangul Text Layout and Typography) 저장소의 respec 설정은 `specStatus: "ED"`, `publishDate: "2020-05-27"`이고, 2026-03-21에 gap-analysis 체계(`kore/`)에 맞춘 구조 개편 커밋이 있었다 — [w3c/klreq](https://github.com/w3c/klreq).
- KLREQ의 목차는 텍스트 방향(가로·세로짜기), 글꼴(한글 폰트 커닝), 문장 부호, 줄 바꿈(글줄 시작/끝 금칙, 단어 분할 금지), 정렬·양끝 맞춤, 글자 간격(한글·로마자 섞어짜기, 괄호 앞뒤 공백), 줄 간격, 각주·면주로 구성된다 — [w3c/klreq index.html](https://github.com/w3c/klreq/blob/main/index.html).

**KLREQ 핵심 규칙(원문 인용)**
- 줄 나눔: "각 줄의 마지막에 한글이 올 때 줄 나눔 기준을 '글자' 또는 '어절' 단위로 한다. 문서 작성자가 … 지정할 수 있다." CSS로는 어절 단위가 `word-break: keep-all`에 해당한다 — [KLREQ](https://github.com/w3c/klreq/blob/main/index.html).
- 금칙: "닫기 괄호(cl2), 하이픈 기호(cl5), 문장 구분 기호(cl6), 중점류(cl7), 구두점류(cl8~9), 반복 기호류(cl11), 장음 기호(cl12)는 글줄 시작에 위치할 수 없다", "열기 괄호(cl1)는 글줄 끝에 위치할 수 없다" — [KLREQ](https://github.com/w3c/klreq/blob/main/index.html).
- 간격: "한글, 한자, 가나 등의 문자는 글자사이 0으로 배열하는 것을 기본으로 한다", "닫기 괄호의 뒤에 열기 괄호가 이어질 경우, 그 사이는 반각으로 처리함을 원칙으로 한다". 세로짜기의 섞어짜기에서는 로마자를 "한 글자씩 세로로 배열"하거나 "시계방향 90도로 회전하여 배열"한다 — [KLREQ](https://github.com/w3c/klreq/blob/main/index.html).
- 첨자 크기는 "일반적으로 어미 글자의 60~70%"다(루비·주석 크기의 참고값) — [KLREQ](https://github.com/w3c/klreq/blob/main/index.html).
- JLREQ의 세부 규칙(행두·행말 금칙 문자 클래스, 약물 반각, 일·영 사이 四分アキ, 모노/그룹/숙어 루비, 縦中横)은 w3.org 접근 실패로 이번에 원문을 다시 대조하지 못했다 → 아래 Gaps.

**CSS 지원 현황 — BCD 8.1.5(2026-10-13) 실측, 숫자는 최초 지원 버전**

| 기능 | Chrome | Safari(iOS 동일) | Firefox | 비고 |
|---|---|---|---|---|
| `writing-mode: vertical-rl` | 48 | 9 | 43 | `sideways-rl/lr`은 Chrome 132, Safari 18.4, FF 43 |
| `text-orientation` (mixed/upright) | 48 | 14 | 41 | |
| `text-combine-upright: all` (縦中横) | 48 | 15.4 | 48 | Chrome 9·Safari 5.1부터는 `-webkit-text-combine`(digits 값 없음) |
| `<ruby>/<rt>/<rp>` | 5 | 5 | 38 | |
| `ruby-position` over/under | 84 | 18.2 | 38 | `inter-character`는 Chrome·Safari partial, FF 미지원 |
| `ruby-align` | 128 | 18.2 | 38 | |
| `ruby-overhang` | 151 | 18.2 | 미지원 | |
| `text-spacing-trim` | 123 | **미지원** | **미지원** | BCD상 experimental |
| `text-autospace` | 140(normal/no-autospace만) | 18.4 | 145 | 세 엔진 모두 "초기값이 `normal`이 아니라 `no-autospace`"라는 주석(csswg-drafts #12386). Safari 27에서 `insert` 값 추가 |
| `word-break: auto-phrase` | 119 | preview | 미지원 | Chrome 주석: "content language가 `ja` 또는 `ko`로 결정되는 텍스트에 작동한다. 일본어는 ML 기반 구절 분할 엔진, 한국어는 ICU의 비ML 구절 분할 경로" |
| `word-break: keep-all` | 44 | 9 | 15 | |
| `line-break: strict` | 25 | 8 | 69 | |
| `hanging-punctuation` | **미지원** | 10(값별) | **미지원** | Safari 주석: `'`/`"`는 first/last 대상이 아님(webkit bug 309123) |
| `font-feature-settings` | 48 | 9.1 | 34 | `palt`·`vpal`·`vert`는 폰트가 기능을 가져야 동작 |
| `text-wrap-style: balance` | 130(`text-wrap: balance`는 이전부터) | 17.5 | 124 | |
| `text-wrap-style: pretty` | 130 | 26 | 미지원 | |
| `text-emphasis`(圏点) | 99(접두사 없는 버전) | 7 | 46 | |

출처: [mdn/browser-compat-data css/properties](https://github.com/mdn/browser-compat-data/tree/main/css/properties)(writing-mode·text-orientation·text-combine-upright·ruby-*·text-spacing-trim·text-autospace·word-break·line-break·hanging-punctuation·font-feature-settings·text-wrap-style·text-emphasis .json), [html/elements ruby/rt/rp](https://github.com/mdn/browser-compat-data/tree/main/html/elements).

- Chrome 블로그는 `word-break: auto-phrase`(Chrome 119)가 "C++로 포팅한 BudouX"를 쓴다고 하며, 헤딩·시처럼 짧은 텍스트에 가장 유용하고 `<wbr>`/ZWSP로 분할점을 강제하거나 ZWJ로 막을 수 있다고 설명한다(웹 검색 요약 경유) — [Chrome for Developers: Introducing four new international features in CSS](https://developer.chrome.com/blog/css-i18n-features). 같은 글은 `text-spacing-trim`을 "개발 중"으로 적었지만, BCD는 Chrome 123 출시로 기록한다. 블로그가 더 오래된 글이므로 **BCD를 따른다**.

### Inferences
- 매거진 본문(가로, 한국어 + 일본어 인라인)의 공통 기본값: `:lang(ko){word-break:keep-all; line-break:strict}` + 헤딩만 `text-wrap:balance`. 본문 `text-wrap:pretty`는 Firefox에서 그냥 무시되므로 넣어도 손해가 없다.
- `word-break:auto-phrase`는 Chrome에서만 동작하고 이제 `ko`에도 걸린다. 한국어 본문에는 keep-all이 더 예측 가능하므로 auto-phrase는 **일본어 큰 헤딩(lang="ja")에만** 쓰고, 다른 브라우저에서는 서버에서 BudouX로 넣은 `<wbr>`로 같은 결과를 맞추는 편이 낫다(§2).
- `text-autospace`는 초기값이 `no-autospace`로 구현됐으므로, 일본어 문단의 일·영·숫자 사이 간격이 필요하면 `:lang(ja){text-autospace:normal}`처럼 명시해야 한다. 한국어는 띄어쓰기를 쓰므로 KO 문단에는 켜지 않는다.
- 縦中横(`text-combine-upright:all`)은 세 엔진에 모두 들어갔으므로 세로 표지 단어 안의 두 자리 숫자("24時間")를 안전하게 처리할 수 있다. 다만 `digits` 값은 지원 행이 없어 쓰지 않는다.
- `text-spacing-trim`·`hanging-punctuation`은 각각 한 엔진에만 있다. 큰 인용구의 「」 정렬은 `palt`(폰트 기능)나 수동 음수 indent로 처리하고, 이 두 속성은 있으면 좋은 정도로 둔다.

### Gaps
- JLREQ TR 최신 발행일과 세부 조항 번호(3.1.7 행두 금칙 등)는 w3.org 접근 실패로 **미확인**.
- Chrome의 `text-spacing-trim`이 폰트의 `halt`/`chws` 기능을 요구하는지는 1차 원천에서 확인하지 못했다(**미확인**). 아래 폰트 실측에서 Noto Serif JP/KR만 `chws`/`vchw`를 가졌다는 점은 확인했다.

## 2. 라이브러리 — BudouX·Vivliostyle·약물 보정·루비 생성

### Takeaway
SSR·클라이언트 JS 0이라는 제약에 맞는 것은 **BudouX(Apache-2.0, v0.9.3)를 서버 컴포넌트에서 `parse()`해 `<wbr>`로 출력하는 방식**뿐이다. Vivliostyle은 AGPL-3.0인 데다 인쇄·페이지 조판용이라 웹 매거진 런타임에는 맞지 않는다. 루비 생성은 이미 있는 kuromojin 파이프라인을 재사용하고, 2026-10에 2.0 beta로 다시 움직이기 시작한 kuroshiro는 참고만 한다.

### Cited Findings
- **BudouX**: Apache-2.0, npm `budoux` 0.9.3. 태그 날짜는 v0.9.0 2026-08-07, v0.9.1 2026-08-28, v0.9.2 2026-09-16, v0.9.3 2026-09-27이고 마지막 커밋은 2026-10-10이다(활발히 유지됨). 런타임 의존성은 `commander`, `linkedom` — [google/budoux](https://github.com/google/budoux), [javascript/package.json](https://github.com/google/budoux/blob/main/javascript/package.json).
- BudouX는 "모델을 포함해 약 15 KB"라고 소개한다. 사전학습 모델은 일본어·간체·번체·태국어이고, 모델 JSON 원본 크기는 ja.json 20,190 B, zh-hans 64,385 B다 — [README](https://github.com/google/budoux/blob/main/README.md), 저장소 `budoux/models/` 실측.
- 한국어는 지원하지 않는다: "Korean uses spaces between words, so you can generally prevent words from being split … by applying `word-break: keep-all` … much more performant than installing BudouX." — [README](https://github.com/google/budoux/blob/main/README.md).
- API: `loadDefaultJapaneseParser()`, `parser.parse()`(구절 배열), `translateHTMLString()`(ZWSP 삽입, 내부에서 DOM 구현 사용), `HTMLProcessor`, Web Components(`<budoux-ja>`). Web Components는 shadow DOM 없이 입력 DOM을 직접 바꾸므로 복제·편집 시 ZWSP가 중복될 수 있다고 README가 경고한다. 순수 `Parser`는 DOM 없이 동작한다(Worker 예시) — [javascript/README.md](https://github.com/google/budoux/blob/main/javascript/README.md). Python 예시는 `<span style="word-break: keep-all; overflow-wrap: anywhere;">`로 감싼 출력을 권장한다 — [README](https://github.com/google/budoux/blob/main/README.md).
- **Vivliostyle**: `@vivliostyle/core` 2.45.2(2026-09-23), 마지막 커밋 2026-10-13, 라이선스 **AGPL-3.0** — [vivliostyle/vivliostyle.js](https://github.com/vivliostyle/vivliostyle.js), LICENSE·packages/core/package.json 실측.
- **kuroshiro**: MIT. 2021-06-07의 1.2.0 이후 정지했다가 2026-09-27 2.0.0-beta.1, 2026-10-05 1.2.1·2.0.0-beta.2가 나왔다. 최근 커밋은 "preserve kana tokens with unequal reading lengths"(2026-10-08), "correct Hepburn and unknown-token romanization"(2026-10-05) — [hexenq/kuroshiro](https://github.com/hexenq/kuroshiro).
- **kuromoji.js**: 마지막 태그 0.1.2(2018-03-20), 마지막 커밋 2018-11-24로 사실상 유지가 멈췄다 — [takuyaa/kuromoji.js](https://github.com/takuyaa/kuromoji.js). manabi는 이미 래퍼 `kuromojin ^3.0.1`을 쓴다(package.json 실측).
- 약물(約物) 보정 전용 JS("palt helper", "Yakumono" 류)는 신뢰할 만한 1차 원천을 찾지 못했다 → Gaps.

### Inferences
- BudouX의 SSR 사용법(제안): 서버 컴포넌트에서 `loadDefaultJapaneseParser().parse(text)` → 구절 배열을 React 노드 `[seg, <wbr/>, seg…]`로 렌더하고, 부모에 `word-break: keep-all; overflow-wrap: anywhere`를 준다. `translateHTMLString`은 서버에서 linkedom이 필요하고 `dangerouslySetInnerHTML`을 부르므로 피한다. 이렇게 하면 클라이언트 번들에 0 B가 들어가고, Chrome의 auto-phrase와 같은 계열의 분할을 Safari·Firefox에서도 얻는다.
- 적용 범위는 **일본어 큰 표지 단어·풀 인용·헤딩**으로 좁힌다(BudouX와 Chrome 블로그 모두 짧은 텍스트에 유용하다고 한다). 한국어는 keep-all로 충분하다(BudouX 공식 견해와 일치).
- 루비 생성: 형태소·읽기 정보는 이미 kuromojin 계열 정본이 있으므로, 새 의존성(kuroshiro)을 들이면 CLAUDE.md의 "중복 신설 금지" 원칙에 걸린다. kuroshiro 2.0의 "읽기 길이가 다른 가나 토큰 보존" 수정은 **모노 루비 분할 알고리즘의 참고 사례**로만 본다.
- Vivliostyle은 AGPL이라 서버에서 렌더해 배포하면 소스 공개 의무 해석 위험이 있고, 목적도 페이지 미디어/PDF다. PDF는 CLAUDE.md상 보류 범위이므로 배제한다. CSS 조판 레퍼런스로 읽는 것은 무방하다.

### Gaps
- npm 레지스트리 접근이 막혀 budoux 패키지의 unpackedSize, 주간 다운로드는 **미확인**.
- "palt 자동 적용"류 소형 JS(예: Yakuhanjp 같은 약물 반각 폰트, TypeSquare 기능)의 라이선스·유지 상태는 이번에 확인하지 못했다(**미확인**). 참고로 YakuHanJP(약물만 반각으로 만든 서브셋 웹폰트, OFL 계열로 기억)는 검토할 가치가 있으나 미검증.

## 3. 폰트 — 라이선스·크기·가변·Google Fonts(next/font) 가용성·기능 실측

### Takeaway
후보 일본·한국 폰트는 **모두 google/fonts의 `ofl/`(SIL OFL)에 있어 `next/font/google`로 바로 쓸 수 있다**. 단 MaruBuri·RIDIBatang·Pretendard는 Google Fonts에 없다. 매거진 품질을 가르는 OpenType 기능(`palt`/`vpal`/`vert`/`chws`)을 실측해 보면 **Noto Serif JP/KR이 가장 완비**됐고, Shippori Mincho는 palt/vpal/vert를 갖췄으며, Zen Old Mincho·Zen Antique·Dela Gothic One은 `vert`는 있지만 `palt`가 없다. 가장 싼 경로는 "한국어 본문 = 이미 로드 중인 Noto Serif KR, 일본어 디스플레이 = 1종 추가(Shippori Mincho B1 또는 Zen Old Mincho), 굵은 표지용 = Dela Gothic One 선택"이다.

### Cited Findings
**Google Fonts 메타데이터 + TTF 실측** — 출처는 각 [google/fonts ofl/<폴더>](https://github.com/google/fonts/tree/main/ofl)의 METADATA.pb와 TTF(HEAD 66928797, 2026-10-12). 크기는 원본 TTF 1개 기준이다(실제 전송은 woff2 + unicode-range 조각이라 훨씬 작다). 기능과 글자 수는 cmap/GSUB/GPOS를 직접 파싱한 자체 실측이다.

| 폰트 | 라이선스·디자이너·GF 등록일 | 굵기/가변 | TTF 크기 | 글자 수(실측) | 주요 기능(실측) |
|---|---|---|---|---|---|
| Noto Serif JP | OFL, Google, 2018-08-22 | 가변 wght 200–900 | 12.95 MB | 가나 189, CJK 12,744 | GSUB `vert vrt2 ruby hwid fwid pwid jp78/83/90`; GPOS `palt vpal halt vhal chws vchw kern` |
| Noto Serif KR | OFL, Google, 2018-08-22 | 가변 wght 200–900 | 22.69 MB | 한글 11,172, 가나 189, CJK 8,138 | GSUB `vert vrt2 ruby ljmo vjmo tjmo`; GPOS `palt vpal halt vhal chws vchw kern` |
| Shippori Mincho | OFL, FONTDASU, 2021-01-04 | 400/500/600/700/800 | 약 8.2–8.3 MB/굵기 | 가나 186, CJK 13,591(Bold) | GSUB `vert vrt2 vkna ss01 ss02`; GPOS `palt vpal` |
| Shippori Mincho B1 | OFL, FONTDASU, 2021-01-04 | 400–800 5종 | 약 14.4–14.5 MB/굵기 | (미측정) | (미측정, B1은 Shippori Mincho에 가나·기호를 더 고전적으로 바꾼 변형으로 기억 — 미확인) |
| Zen Old Mincho | OFL, Yoshimichi Ohira, 2021-10-22 | 400/500/600/700/900 | 약 5.2 MB/굵기 | 가나 182, CJK 6,682 | GSUB `vert vrt2 vkna hwid fwid`; GPOS `kern`만(**palt 없음**) |
| Zen Antique | OFL, Ohira, 2021-10-22 | 400 | 5.25 MB | 가나 182, CJK 6,682 | `vert vrt2 vkna`; **palt 없음** |
| BIZ UDPMincho / UDMincho | OFL, Type Bank·Morisawa, 2022-03-16 | 400/700 | 5.87 / 6.78 MB | 가나 189, CJK 9,575 | GSUB `vert vrt2 vkna ruby`; GPOS 없음(**palt 없음**, P판은 이미 비례폭) |
| Klee One | OFL, Fontworks, 2021-06-08 | 400/600 | 8.32 / 8.49 MB | 가나 185, CJK 7,917 | GSUB `vert vrt2 vkna ruby`; GPOS `palt vpal halt vhal` |
| Kaisei Tokumin / Opti / Decol | OFL, Font-Kai, 2021-05-21 | 400/500/700(+800) | 약 4.1–4.4 MB/굵기 | 가나 184, CJK 6,713(Tokumin XB) | `vert vrt2`; GPOS 없음 |
| Hina Mincho | OFL, Satsuyako, 2021-04-14 | 400 | 6.15 MB | 가나 187, CJK 6,685 | `vert vrt2 vkna`; **palt 없음** |
| Dela Gothic One | OFL, artakana, 2020-12-14 | 400 | 2.39 MB | 가나 183, CJK 7,654 | `vert vrt2`; GPOS `kern`(**palt 없음**) |
| Zen Kaku Gothic New | OFL, Ohira, 2021-10-22 | 300/400/500/700/900 | 약 2.1–2.25 MB/굵기 | (미측정) | (미측정) |
| Nanum Myeongjo | OFL, Sandoll, 2012-05-09 | 400/700/800 | 약 2.9–3.0 MB | 한글 11,172, 가나 0 | GSUB `fwid`, GPOS `kern`만 |
| Gowun Batang | OFL, 류양희, 2021-06-10 | 400/700 | 8.04 / 7.80 MB | 한글 11,172, 가나 0 | `kern mark`; 세로 기능 없음 |
| Hahmlet | OFL, Hypertype, 2021-05-13 | 가변 wght 100–900 | 3.39 MB | **한글 2,788만**(11,172 중) | `kern calt smcp` 등; 세로 기능 없음 |
| Gothic A1 | OFL, HanYang I&C, 2018-02-24 | 100–900 9종 | 약 2.2 MB/굵기 | (미측정) | (미측정) |
| (참고) Noto Sans JP / KR | OFL, Google | 가변 wght 100–900 | 9.15 / 9.93 MB | — | — |
| (참고) M PLUS 1 | OFL | 가변 100–900 | 4.00 MB | — | — |

- Google Fonts의 CJK 전송 방식: 한국어는 "가장 많이 쓰는 2,000자를 빈도순으로 20개 조각, 나머지는 코드포인트 순으로 100개 조각"으로 나누며 이전 최선 전략보다 "38% 적은 바이트"를 내려받게 됐다고 한다. 일본어는 "상위 3,000자를 20개 조각"이 최적이었다고 한다. 둘 다 `unicode-range`와 woff2, HTTP/2 동시 전송에 기댄다 — [Google Fonts launches Korean support](https://developers.googleblog.com/en/google-fonts-launches-korean-support/), [Google Fonts launches Japanese support](https://developers.googleblog.com/en/google-fonts-launches-japanese-support/). 이 방식은 빈도 분석이며 "머신러닝"이라는 표현은 제3자 패키지 설명에서만 나왔다(웹 검색 요약).
- **Pretendard**: OFL(Reserved Font Name 'Pretendard'; Source Han Sans·Inter·M PLUS 1 파생 고지 포함). 마지막 태그 v1.3.9(2023-11-05), 마지막 커밋 2025-06-28로 릴리스가 2년 가까이 멈춰 있다. Google Fonts에 없어 `next/font/local`이 필요하다 — [orioncactus/pretendard](https://github.com/orioncactus/pretendard) LICENSE·태그 실측.
- **MaruBuri(마루 부리)**: 네이버가 2019년 '마루프로젝트'로 발표했고 2021년 한글캠페인 사이트에서 무료 배포한다는 기사는 있다. 그러나 **라이선스(OFL 여부)는 1차 원천에서 확인하지 못했다**(hangeul.naver.com fetch 차단) — [데일리안 기사](https://m.dailian.co.kr/news/view/815051), [뉴데일리 2021-10-06](https://biz.newdaily.co.kr/site/data/html/2021/10/06/2021100600021.amp.html). Google Fonts에도 없다(google/fonts ofl/ 실측 목록에 없음 — 폴더명 `maruburi` 미존재는 검색 범위 밖이라 **미확인**).
- **RIDIBatang**: 공식 라이선스 문서를 찾지 못했다. jsDelivr의 제3자 패키지 `@noonnu/ridi-batang`이 "MIT"로 표기돼 있으나 RIDI 공식 조건으로 볼 수 없다 — [jsDelivr @noonnu/ridi-batang](https://www.jsdelivr.com/package/npm/@noonnu/ridi-batang). **미확인**.

### Inferences
- **세로 큰 표지 단어**에는 GSUB `vert`(세로용 약물·장음 대체)가 필수다. 후보는 모두 가지고 있다. 세로 자간을 조이는 `vpal`까지 가진 것은 Noto Serif JP, Shippori Mincho, Klee One이다. 표지처럼 글자 수가 적은 곳은 자간을 수동으로 줘도 되므로 `vpal`이 없는 Dela Gothic One·Zen Antique도 쓸 수 있다.
- **Hahmlet은 한글 2,788자만 담는다**(실측). 기사 본문처럼 임의 문자열이 들어가는 곳에서는 빠진 음절이 시스템 폰트로 섞여 나온다. 디스플레이 전용이거나 배제다.
- **한·일 혼용의 함정(중요)**: Noto Serif KR은 가나 189자와 CJK 8,138자를 함께 담는다(실측). 그래서 `font-family: 'Noto Serif KR', 'Noto Serif JP'` 순서면 한국어 문단 안의 일본어 단어가 **한국식 한자 자형**과 KR 폰트의 가나로 그려진다. 일본어 인라인에는 반드시 `lang="ja"`를 주고 `:lang(ja){font-family: <JP 폰트>, …}`로 JP 폰트를 앞세워야 한다. 같은 Source Han 계열인 Noto Serif JP를 쓰면 획 대비·x높이가 맞아 섞어짜기가 가장 자연스럽다.
- 크기 예산: 원본 TTF는 수 MB에서 20 MB대지만 Google Fonts·next/font 경로에서는 페이지에 실제 쓰인 글자의 조각만 받는다. 정확한 KB 측정은 Gaps에 남긴다. 세로 표지 단어처럼 **글자가 고정된 디스플레이 용도**는 `next/font/google`의 `text` 옵션(지원 여부 **미확인**)이나 빌드 시 서브셋(next/font/local + 사전 서브셋 woff2)으로 수 KB까지 줄일 수 있다.
- `next/font/google`에서 CJK 폰트는 `subsets`에 japanese/korean을 넣어 preload하는 방식이 맞지 않는다. 리포의 기존 패턴(`subsets:['latin'], preload:false`)이 이미 정답에 가깝다(리포 실측). 이때 unicode-range 조각들이 자체 호스팅된다.
- 페어링 제안: (a) 본문 한국어 = Noto Serif KR(이미 600/700 로드 중이므로 400 추가만 검토) 또는 산세리프 본문 유지. (b) 일본어 인라인·풀 인용 = Noto Serif JP(Noto Serif KR과 같은 Source Han 계열, palt/vpal/chws 완비) — 이미 grammar 레이아웃에서 쓰므로 새 의존성이 없다. (c) 표지 세로 단어 = 개성이 필요하면 Shippori Mincho(B1) 1종, 고딕 계열 굵은 표지는 Dela Gothic One. (d) 큰 숫자 페이지 = 라틴 숫자는 이미 있는 Inter/Manrope의 tabular/lining 숫자를 쓰고 CJK 폰트를 따로 들이지 않는다.

### Gaps
- MaruBuri·RIDIBatang 라이선스 원문: **미확인**(공식 페이지 접근 불가).
- Google Fonts API가 전송하는 woff2 조각이 `palt`/`vert`/`chws` 기능을 그대로 보존하는지: **미확인**(이번 실측은 원본 TTF 기준). GPOS `kern`처럼 서로 다른 조각에 걸친 글자 쌍 사이의 기능은 조각 분리로 동작하지 않을 수 있다는 점은 추론이다.
- 조각별 실제 전송 KB(예: 한국어 기사 1편이 Noto Serif KR 조각 몇 개, 몇 KB를 받는지)는 빌드 실측이 필요하다 — 이 컨테이너에서는 fonts.gstatic.com 접근이 막혀 측정하지 못했다.
- `next/font/google`의 `text` 파라미터 지원 여부는 Next 15.5 문서로 확인하지 못했다(node_modules 미설치). **미확인**.

## 4. 선례 — 일본·한국의 우수 웹 타이포그래피와 공공 디자인 시스템 지침

### Takeaway
양국 정부 디자인 시스템은 모두 **산세리프 하나 + 넉넉한 행간**이 기본이다. 일본 디지털청은 Noto Sans JP, 본문 16–17px, 행간 1.7–1.75, 자간 0.02em을, KRDS는 Pretendard GOV, 본문 17px, 행간 1.5, 자간 0 또는 0.1rem을 쓴다. 매거진은 이를 본문 가독성의 하한으로 삼고, 명조와 세로짜기는 표지·인용 같은 디스플레이 층에만 얹는 구성이 선례에 맞는다.

### Cited Findings
- 디지털청 design-tokens(npm 2.0.1, MIT, 마지막 커밋 2026-05-28): `--font-family-sans: 'Noto Sans JP', -apple-system, BlinkMacSystemFont, sans-serif`, 크기 스케일 14/16/17/18/20/22/24/26/28/32/36/45/48/57/64px, 행간 토큰 1.0/1.2/1.3/1.4/1.5/1.6/1.7/1.75. 본문 클래스 `std-16N-170`·`std-17N-170`은 `line-height:1.7; letter-spacing:0.02em`을 쓴다 — [digital-go-jp/design-tokens](https://github.com/digital-go-jp/design-tokens) `examples/tokens.css`, `examples/app.css`.
- 디지털청 디자인 시스템 콘텐츠는 2024-05-30 전용 사이트 "デジタル庁デザインシステムβ版"으로 옮겨졌다(웹 검색 요약) — [デジタル庁 デザインシステム](https://www.digital.go.jp/policies/servicedesign/designsystem).
- KRDS(KRDS-uiux/krds-uiux 1.1.0, ISC, 마지막 커밋 2026-01-12): `--krds-font-family-base: var(--krds-typo-font-type)`이고 리소스에 "Pretendard GOV"가 등장한다. 본문 크기는 PC `body-large 1.9rem / medium 1.7rem / small 1.5rem`, 모바일 `medium 1.7rem / small 1.5rem`, `--krds-line-height-base: 1.5`, 자간은 `0rem`/`0.1rem` — [KRDS-uiux/krds-uiux](https://github.com/KRDS-uiux/krds-uiux) 실측. rem 값이 17px에 대응한다는 해석(62.5% 루트)은 갤러리 요약의 "17px 본문"과 일치한다 — [디자인 시스템 갤러리: KRDS](https://www.oppadu.com/tools/design-systems-site/brand/krds.html).
- 일반 일본어 조판 지침: 행간은 글자 크기의 약 1.5–1.8배, 가로쓰기 한 줄 13–40자가 권장되며(아이치현 교육 자료), 모리사와 UD 폰트 개발자 인터뷰는 "행간 = 글자 크기의 약 50%"를 경험칙으로 든다(웹 검색 요약) — [アイチ 教育 자료 docx](https://apec.aichi-c.ed.jp/kyouka/jouho/contents/2021/jissen/16.files/moji.docx), [Gizmodo×Morisawa](https://www.gizmodo.jp/article/morisawa-biz/).
- 일본어 세로짜기 웹의 현황 정리: "日本語縦書きWebの現在地 2025"(berlysia)는 writing-mode가 상속된다는 점, 스크롤이 생기면 스크롤 요소 자체를 세로로 만들어야 한다는 점 등을 다룬다(검색 요약 수준) — [Speaker Deck: berlysia 2025](https://speakerdeck.com/berlysia/japanese-vertical-writing-on-the-web-the-state-of-play-in-2025-a19f0026-9473-4863-b75d-35eae77c7e01), [BuriKaigi 2026 발표](https://speakerdeck.com/berlysia/burikaigi2026-use-vertical-writing-on-a-site-or-create-a-vertical-writing-site).
- note·ほぼ日刊イトイ新聞의 구체적인 폰트·행간·palt 설정을 기록한 1차 원천은 찾지 못했다 → Gaps.

### Inferences
- manabi 매거진 본문은 KRDS(17px/1.5)보다 넉넉하게 잡는 것이 매거진다움과 가독성에 맞다: 한국어 serif 본문 17–18px, 행간 1.7–1.8, 자간 0(KLREQ "글자사이 0 기본"). 일본어 인라인은 디지털청 선례대로 0.02em까지 허용.
- 두 정부 시스템 모두 명조를 쓰지 않는다. 명조·세로짜기는 "UI 정본"이 아니라 **매거진 전용 디스플레이 토큰**으로 분리해 `docs/ui-conventions.md` 계약(색 토큰·접근성 하한)과 충돌하지 않게 두는 것이 안전하다.

### Gaps
- note.com, ほぼ日, 모리사와 공식 가이드의 구체 수치: 1차 원천 **미확인**.
- 디지털청 β 사이트의 타이포그래피 문서 원문(일본어 조판 주의 사항, palt 사용 여부)과 KRDS 공식 사이트의 타이포그래피 페이지 원문: 직접 접속이 막혀 토큰 저장소로 대체했다.

## 5. 접근성 — 세로쓰기·루비와 스크린 리더

### Takeaway
`<ruby>`의 낭독은 **브라우저와 스크린 리더 조합마다 다르다**(읽기가 무시되거나, 조각나거나, 두 번 읽힘). 학습용 읽기 정보는 루비에만 맡기지 말고 별도의 접근 가능한 텍스트를 함께 둬야 한다. 세로쓰기는 DOM 순서가 곧 읽기 순서이므로, 시각 순서를 CSS로 뒤집지 않는 한 위험이 낮다.

### Cited Findings
- 루비 낭독 테스트(Adam Page의 CodePen 테스트 페이지, 웹 검색 요약): macOS VoiceOver + Chrome/Safari는 `<rt>`를 노출하지 않고 기저 문자를 조각내 읽는다("mi, ta, me, ijou"). macOS VoiceOver + Firefox는 읽기를 노출하지만 "mi mi ta me me ijou ijou"처럼 중복된다. iOS VoiceOver(Safari)는 `<rt>`를 노출하되 조각·중복이 생긴다. Android TalkBack은 `<rt>`를 별도 발화로 내고 영어 음성과 일본어 음성을 오간다 — [CodePen: Ruby annotations test page](https://codepen.io/adampage/pen/pvbMrvv/9cf8c1b24ba3944b0f218d1cb7555788), [a11y news: Who's that code snippet?](https://a11ynews.substack.com/p/whos-that-code-snippet?open=false).
- 2012년 W3C i18n 메일링 리스트에는 "NVDA와 VoiceOver는 ruby를 특별히 처리하지 않는다"는 언급이 있다(오래된 자료) — [public-i18n-cjk 2012](https://lists.w3.org/Archives/Public/public-i18n-cjk/2012JanMar/0015.html).
- 세로쓰기와 스크린 리더 읽기 순서를 직접 다룬 1차 원천은 찾지 못했다(검색 결과는 writing-mode 일반 설명뿐) — [MDN text-orientation(ja)](https://developer.mozilla.org/ja/docs/Web/CSS/text-orientation).

### Inferences
- 단어 학습 매거진에서는 루비 요소에 `lang="ja"`를 주는 것이 최소 조건이다. 핵심 단어는 루비 외에 접근 가능한 대체(예: 시각적으로 숨긴 "読み: たべる" 또는 용어 카드의 별도 읽기 필드)를 제공하는 편이 안전하다. `aria-label`로 기저 문자를 덮어쓰는 방식은 브라이유·검색·복사에 부작용이 있어 권하지 않는다(추론).
- 세로 표지 단어는 장식이면서 동시에 의미를 지닌다. 같은 단어를 가로 본문(헤딩)에도 두고 표지 쪽은 `aria-hidden`으로 처리하면 낭독 중복과 조각 읽기를 피할 수 있다(추론). 縦中横 숫자도 DOM 텍스트 그대로 읽히므로 문제가 없다.
- 대비: 세로 표지 단어를 배경 이미지 위에 얹으면 WCAG AA 대비(큰 텍스트 3:1) 검사를 라이트/다크 두 테마에서 따로 해야 한다 — 기존 `uiConventions.test.js` 계약에 넣을 후보.

### Gaps
- NVDA(일본어판 포함)·JAWS·Windows Narrator의 `<ruby>` 처리, 그리고 `ruby-position:under`·`inter-character`의 낭독 영향은 **미확인**. 실기기 테스트가 필요하다.
- 세로쓰기 + 스크린 리더 읽기 순서 관련 공식 지침(WAI 또는 디지털청)은 **미확인**.

## manabi 적용 후보

| 항목 | 판정 | 근거(라이선스·크기·SSR 적합성·유지 상태) |
|---|---|---|
| `writing-mode: vertical-rl` + `text-orientation: mixed` (세로 표지) | 채택 | 세 엔진 모두 오래전부터 지원(Chr48/Saf9/FF43, BCD). CSS만으로 동작해 JS 0 |
| `text-combine-upright: all` (縦中横 2자리 숫자) | 채택 | Chr48/Saf15.4/FF48. `digits` 값은 미지원이라 쓰지 않음 |
| `<ruby>/<rt>/<rp>` + `ruby-position: over` | 채택 | 전 엔진 지원. 단 SR 낭독 편차가 있어 읽기를 별도 텍스트로도 제공(§5) |
| `ruby-align`/`ruby-overhang` | 부분 채택 | Chr128/151·Saf18.2·FF(overhang 미지원). 점진적 향상으로만 사용 |
| `:lang(ko){word-break: keep-all}` + `line-break: strict` | 채택 | KLREQ 어절 단위 줄 나눔과 일치, 전 엔진 지원 |
| `word-break: auto-phrase` | 부분 채택 | Chrome 전용(119+), Safari preview, FF 미지원. 일본어 헤딩에만 쓰고 BudouX `<wbr>`로 보완 |
| `text-wrap: balance`(헤딩) / `pretty`(본문) | 채택 / 부분 채택 | balance는 세 엔진 지원. pretty는 FF 미지원이지만 무해 |
| `text-autospace` | 부분 채택 | Chr140/Saf18.4/FF145. 초기값이 no-autospace라 `:lang(ja)` 블록에만 명시적으로 켬. 한국어에는 끔 |
| `text-spacing-trim` | 부분 채택 | Chrome 123만 지원(BCD experimental). 큰 인용 「」에 있으면 좋은 정도. 폰트 `chws`가 있는 Noto Serif JP와 조합 |
| `hanging-punctuation` | 배제(대체) | Safari 전용. 인용 부호 정렬은 음수 indent·`palt`로 처리 |
| `font-feature-settings: 'palt'`(가로 디스플레이), `'vpal'`(세로) | 부분 채택 | 전 엔진 지원이나 폰트별로 다름: Noto Serif JP/KR·Shippori·Klee는 있음, Zen Old/Antique·Dela·Hina·BIZ UD는 없음(실측). 본문에는 쓰지 않고 헤딩·표지에만 |
| BudouX (npm `budoux` 0.9.3) | 채택(서버 전용) | Apache-2.0, 2026-09-27 릴리스로 활발히 유지, 모델 포함 약 15 KB. 서버 컴포넌트에서 `parse()` → `<wbr>` 출력으로 클라이언트 0 B. 한국어 모델은 없어 KO에는 쓰지 않음 |
| Vivliostyle (core 2.45.2) | 배제 | AGPL-3.0, 페이지 미디어·PDF용. 웹 SSR 매거진 목적과 다르고 PDF는 보류 범위. 조판 레퍼런스로 읽기만 허용 |
| kuroshiro (2.0.0-beta.2) | 배제(참고) | MIT, 2026-10에 재가동했지만 beta. 이미 kuromojin 정본이 있어 중복 신설에 해당. 모노 루비 분할 수정 사례만 참고 |
| kuromoji.js | 배제(신규) | 0.1.2(2018) 이후 정지. 기존 kuromojin 경유 사용은 유지 |
| 약물 보정 JS(palt helper류) | 배제 | 1차 원천·유지 상태 미확인. CSS `palt`와 폰트 선택으로 충분하고 클라이언트 JS 0 원칙에 어긋남 |
| Noto Serif KR (한국어 serif 본문·헤딩) | 채택(기존 재사용) | OFL, 가변 200–900, 한글 11,172자, palt/vpal/chws/vert 완비(실측). 이미 600/700 로드 중이라 추가 비용은 400 굵기 정도 |
| Noto Serif JP (일본어 인라인·인용) | 채택(기존 재사용) | OFL, 가변 200–900, CJK 12,744자, palt/vpal/chws/vert/ruby 완비(실측). KR과 같은 Source Han 계열이라 섞어짜기가 자연스러움. grammar 레이아웃에서 이미 사용 중 |
| Shippori Mincho / B1 (표지 세로 명조) | 부분 채택(1종만) | OFL, 정적 5굵기, 굵기당 TTF 약 8 MB(B1은 약 14 MB). palt/vpal/vert 보유(실측). 표지 1–2굵기만, 디스플레이 서브셋으로 |
| Zen Old Mincho / Zen Antique | 부분 채택(대안) | OFL, 굵기당 약 5.2 MB로 가벼움, vert는 있음. palt 없음(실측) → 자간을 수동으로 조정해야 함 |
| Dela Gothic One (굵은 고딕 표지) | 부분 채택 | OFL, 2.39 MB 단일 굵기, vert 있음, palt 없음(실측). 큰 숫자·포스터형 표지에 한정 |
| Klee One (손글씨풍 교과서체) | 부분 채택(선택) | OFL, palt/vpal/vert/ruby 완비(실측). 학습 메모·손글씨 톤의 코너용. 굵기당 약 8.3 MB |
| BIZ UDMincho / UDPMincho | 배제 | OFL이지만 GPOS가 없어 palt 없음(실측). UD 목적은 본문 판독성인데 본문은 KR이라 효용이 낮음 |
| Kaisei 시리즈 / Hina Mincho | 배제 | OFL이지만 palt 없음, 개성이 강해 1종 예산과 경합 |
| Zen Kaku Gothic New | 배제 | 기존 Noto Sans JP와 역할이 겹침 |
| Nanum Myeongjo | 배제 | OFL·가벼움(약 3 MB)이지만 기능이 fwid·kern뿐이고 가나가 없음. Noto Serif KR이 상위 호환 |
| Gowun Batang | 부분 채택(대안) | OFL, 한글 11,172자, 따뜻한 본문 톤. 세로 기능이 없고 가나가 없음 → 가로 한국어 본문 대안으로만 |
| Hahmlet | 배제 | OFL·가변이지만 한글 2,788자만 담음(실측). 임의 본문에서 글자가 빠짐 |
| Gothic A1 | 배제 | 기존 Noto Sans KR과 중복 |
| Pretendard | 배제(현 시점) | OFL이지만 Google Fonts에 없고(next/font/local 필요) 마지막 릴리스가 v1.3.9(2023-11). 기존 Noto Sans KR UI와 중복. KRDS 선례(Pretendard GOV)는 참고만 |
| MaruBuri | 보류(미확인) | 라이선스 원문 미확인, Google Fonts 미등록. 라이선스 확인 전에는 착수하지 않음 |
| RIDIBatang | 보류(미확인) | 공식 라이선스 미확인(제3자 npm에 MIT 표기뿐). 착수 금지 |
| CJK 서브셋 전략 | 채택 | 본문은 `next/font/google` 기본 unicode-range 조각(`subsets:['latin'], preload:false`, 리포 기존 패턴). 고정 문구 표지는 빌드 시 서브셋 woff2(`next/font/local`)로 수 KB 수준. 정확한 KB는 빌드 실측 필요 |
| `lang` 기반 폰트 스택(`:lang(ja)`에서 JP 폰트 우선) | 채택 | Noto Serif KR이 가나·한자를 포함하므로(실측), lang을 지정하지 않으면 일본어 단어가 한국식 자형으로 렌더됨 |
| 디지털청·KRDS 수치 | 부분 채택(하한 참고) | 디지털청 16–17px/1.7–1.75/0.02em(MIT 토큰), KRDS 17px/1.5. 매거진 본문은 17–18px/1.7–1.8로 상향 |
