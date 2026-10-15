# 『TONARI / となり / トナリ』 레터링 도구 조사 (2026-10-16 KST)

목적: 워드마크를 '서체로 쓴 글자'가 아니라 **구성 규칙으로 직접 그린 레터링**으로 만들 때, Claude Code 에이전트가 코드(Python/Node → SVG)로 형태를 만들고 스크린샷으로 검수하는 우리 방식에 붙일 수 있는 **배포 중인 도구**를 찾는다. 같은 폴더의 `marks/lettering/BRIEF.md`(서체 윤곽 금지·결정적 build·iterations 기록)를 전제로 판정했다.

- 열람 시각: 모두 **2026-10-16 00:35–00:45 KST**에 이 세션에서 열었다. 표의 '열람' 칸에 분 단위를 적었다.
- **확인** = 공식 페이지·저장소·패키지 레지스트리(PyPI/npm/crates) 원문을 직접 열어 본 것. **보류** = 원문 접근이 막혀(Cloudflare·Akamai 차단, DNS 실패, 404) 검색 요약 같은 2차 출처만 본 것. 보류 항목의 수치는 판정 근거로 쓰지 않았다.
- 유지 상태는 레지스트리의 최신 버전 업로드일이나 저장소 커밋 페이지의 최근 커밋일이다.
- 이 컨테이너 실측(00:40 KST): `inkscape`·`fontforge`·`mpost` 미설치. 스크래치 venv에 `skia-pathops`·`shapely`·`svgpathtools`·`pyclipr`·`fonttools`는 pip로 바로 설치·임포트됐다. `skia-python`은 `libEGL.so.1` 누락으로 임포트에 실패했다.

---

## 1. Claude/AI 에이전트용 스킬·플러그인·MCP

| 이름 | 무엇을 하나 | 라이선스·가격 | 유지 상태 | 우리 방식 적합성 | 판정·근거 | 출처·열람 |
|---|---|---|---|---|---|---|
| **anthropics/skills** — `canvas-design` | '디자인 철학'(.md)을 먼저 쓰고 그것을 PNG/PDF 캔버스로 표현하는 2단계 지시 | Apache-2.0 (스킬 폴더 LICENSE.txt) | 저장소 최근 커밋 2026-10-09 | 산출이 PNG/PDF라 아웃라인 SVG 패스와 맞지 않는다. 그래도 '철학 문서 → 표현' 2단계는 BRIEF의 '구성 규칙 한 줄 → 작도'와 같은 구조다 | **부분 채택(방법만)** — 도구로는 쓰지 않고, 회차마다 규칙을 먼저 문장으로 고정하는 순서만 빌린다 | github.com/anthropics/skills/tree/main/skills · raw SKILL.md, 00:37 **확인** |
| 〃 — `algorithmic-art` | p5.js와 시드 고정 난수로 생성 예술을 만들고, 파라미터를 조절하는 HTML 뷰어를 만든다 | Apache-2.0 | 〃 | 결정성(시드)과 파라미터 슬라이더 뷰어는 레터링 파라미터(획 굵기·끝 처리 각도) 탐색에 맞는다. 출력이 캔버스 래스터라 최종물로는 맞지 않는다 | **부분 채택(뷰어 패턴만)** — 파라미터 탐색용 card.html에 슬라이더를 붙이는 방식으로만 쓴다 | 같은 위치, 00:37 **확인** |
| 〃 — `brand-guidelines` | Anthropic 자사 브랜드 색과 서체를 적용한다 | Apache-2.0 | 〃 | 우리 브랜드와 관계가 없다 | **배제** — Anthropic 전용이다 | 00:37 **확인** |
| 〃 — `theme-factory` | 10개 프리셋(색과 서체 조합)을 적용하거나 새로 만든다 | Apache-2.0 | 〃 | 서체 조합 도구라서 '서체 윤곽 금지' 방향과 반대다 | **배제** | 00:37 **확인** |
| 〃 — `frontend-design` | UI의 미적 방향을 지시한다 | Apache-2.0 | 〃 | 화면 디자인용이고, 마크 작도와는 관계가 없다 | **배제** | 00:37 **확인** |
| **Design 플러그인**(anthropics/knowledge-work-plugins `design`, Anthropic Directory 등재) | design-critique·design-system·handoff·accessibility 등 스킬 7개와 Figma 등의 MCP 커넥터 | Apache-2.0 | 디렉터리 갱신 2026-09-22 | 이 세션에 이미 `design:design-critique`가 있다. 회차별 시안을 구조적으로 비평하는 데 쓸 수 있다. 형태를 생성하지는 않는다 | **부분 채택(검수 보조)** — 회차 스크린샷 비평에만 쓴다. 레터링 전용 스킬은 디렉터리 검색(typography·font·lettering·logo·svg)에서 **0건**이었다 | raw design/README.md, SearchPlugins 결과, 00:43 **확인** |
| **Figma MCP 서버**(원격, `use_figma` 캔버스 쓰기) | 에이전트가 Plugin API JavaScript로 Figma 파일 안에 프레임·컴포넌트·벡터를 직접 만든다. 지원 클라이언트에 Claude Code가 있다 | 쓰기에는 **Full seat**가 필요하다(Dev seat는 읽기 전용). 베타 기간 무료라는 과금 정보는 2차 출처라서 보류 | 문서 현행(Code to Canvas 섹션) | 사람 디자이너에게 넘기는 공유 캔버스로는 좋다. 하지만 형태 생성은 결국 우리 코드가 하고, Figma는 경유지에 그친다. 이 세션에서 figma 커넥터는 **미인증** 상태다 | **보류(핸드오프 단계 후보)** — 사람 디자이너가 Figma를 쓸 때만 SVG를 올리는 통로로 쓴다. 생성 도구로는 쓰지 않는다 | developers.figma.com/docs/figma-mcp-server/write-to-canvas, 00:41 **확인**(curl). help.figma.com은 DNS 실패 |
| **Illustrator MCP**(ie3jp/illustrator-mcp-server) | ExtendScript로 Illustrator를 조작하는 66개 도구(패스 생성·베지어 핸들·내보내기). 획 아웃라인과 패스파인더는 명시돼 있지 않다 | MIT. Illustrator 2024+ 필요(유료), macOS/Windows | 저장소에 릴리스 표기가 없고 README는 2026년 기준으로 작성됐다 | 리눅스 컨테이너에는 Illustrator가 없다. 결정적 build와도 맞지 않는다 | **배제** — 실행 환경이 없고 결정성이 깨진다 | github.com/ie3jp/illustrator-mcp-server, 00:41 **확인** |
| **Inkscape MCP**(sandraschi/inkscape-mcp) | Inkscape CLI를 감싼 도구 17개. 불리언, LPE(power stroke 등), PNG/PDF 내보내기 | MIT. Inkscape 1.2+ 필요 | 커밋 196개, 날짜는 페이지에 미표기 | Inkscape CLI를 직접 부르는 편이 MCP보다 단순하다. 컨테이너에는 Inkscape가 미설치다 | **보류** — 필요하면 MCP 없이 `inkscape --actions`(stroke-to-path)를 직접 쓴다 | github.com/sandraschi/inkscape-mcp, 00:41 **확인**(기능 목록). 유지 상태는 보류 |
| **Glyphs MCP**(thierryc/Glyphs-mcp) | Glyphs 4 안에서 폰트·글리프 작업(간격·커닝·윤곽 job)을 하는 도구 20개 | Apache-2.0. 대상 앱 Glyphs 4는 €319, macOS 전용 | v2.1.0 | 맥 전용 유료 앱에 묶인다 | **배제** — 환경이 맞지 않는다 | github.com/thierryc/Glyphs-mcp, 00:41 **확인** |

## 2. 오픈소스 글꼴·레터링 편집기·기하 라이브러리

### 2-1. 기하 엔진(코드에서 직접 쓰는 것)

| 이름 | 무엇을 하나 | 라이선스 | 유지 상태 | 적합성 | 판정·근거 | 출처·열람 |
|---|---|---|---|---|---|---|
| **fontTools** | 펜 프로토콜, `SVGPathPen`, 변환, UFO 입출력 | MIT | 4.67.0 (2026-10-14) | 이미 `build-marks.py`가 쓰고 있다. 작도 결과를 SVG 패스로 쓰고, UFO로 Fontra에 넘기는 접착제다 | **채택** — 재사용하므로 신설할 것이 없다 | pypi.org/pypi/fonttools, 00:39 **확인** |
| **skia-pathops** | Skia PathOps 바인딩. union·intersection·difference·xor, `simplify`(겹침 제거) | BSD-3-Clause | 0.9.2 (2026-02-16) | 획을 합치고 잉크 트랩·획 끊김 같은 서명 디테일을 difference로 깎는 핵심 연산이다. fontTools 펜과 직접 호환된다. **획 확장(stroke)은 없다** | **채택** — 스모크 테스트를 통과했다(아래 §6) | github.com/fonttools/skia-pathops, pypi, 00:37 **확인** |
| **shapely** (`buffer`) | 중심선(LineString)을 굵기로 확장한다. 끝 처리 round/flat/square, 꺾임 round/mitre/bevel | BSD-3-Clause | 2.2.0 (2026-10-07) | 중심선을 획으로 바꾸는 가장 견고한 방법이다. 결과가 다각형(직선 근사)이라서 곡선 맞춤이나 `simplify(tol)`로 점 수를 줄여야 한다 | **부분 채택** — 자유곡선 획 확장에 쓴다. 직선·원호 획은 해석적 오프셋이 더 가볍다 | pypi.org/pypi/shapely, 00:39 **확인**. 실측 §6 |
| **Clipper2** / **pyclipr** | 폴리곤 불리언과 오프셋(InflatePaths: join round/square/miter, 열린 경로의 끝 처리) | BSL-1.0 | Clipper2 2.0.1 (2025-12-19), pyclipr 0.1.8 (2026-02-01), clipper2-ts 2.0.1-18 (2026-07-04) | shapely와 역할이 겹친다. 정수 좌표 기반이라 결정성이 강하다 | **부분 채택(예비)** — shapely 결과가 흔들리면 교체 후보로 둔다 | github.com/AngusJohnson/Clipper2/tags, pypi pyclipr, npm, 00:39–00:42 **확인** |
| **svgpathtools** | SVG 경로 파싱, 호 길이, 법선·접선, 샘플링 | MIT | 1.8.0 (2026-09-05) | KanjiVG 중심선 읽기, 획 끝에서 법선 방향 계산(붓 끝 각도)에 쓴다 | **채택** | pypi, 00:39 **확인** |
| **Paper.js** (+`paperjs-offset`) | 베지어를 보존하는 불리언과 오프셋(곡선 출력) | MIT | 코어 0.12.18 (2024-07-17, 이후 커밋 없음). paperjs-offset 2.2.1 (2026-07-31) | Node 쪽에서 곡선을 유지한 채 오프셋할 수 있는 유일한 대안이다. 코어가 2년째 정체돼 있다 | **부분 채택(Node 대안)** — 다각형 근사가 문제가 될 때만 쓴다 | github.com/paperjs/paper.js/commits/develop, npm, 00:39–00:42 **확인** |
| **skia-python** (Paint stroke → `getFillPath`) | Skia 스트로커로, 베지어로 된 획 윤곽을 낸다 | BSD-3 계열 | 144.0.post2 (2026-03-19) | 품질은 가장 좋다. 하지만 이 컨테이너에서는 `libEGL.so.1` 누락으로 **임포트 실패**를 실측했다 | **보류** — 시스템 라이브러리를 추가해야 해서 지금은 붙이지 않는다 | pypi, 00:40 **확인**(실측) |
| **kurbo** (Rust, stroke expansion) | 곡선을 보존하는 획 확장과 오프셋 | (crates 메타 미열람) | 0.13.1 (2026-05-13) | Rust 툴체인이 필요하다 | **배제** — 빌드 체인을 새로 들여야 한다 | crates.io/api, 00:40 **확인**(버전만) |
| **ufostroker** (MFEKmath) | UFO 글리프에 획(노블/펜) 확장 | (PyPI 미표기) | 0.3.0 (2023-11-28) | 2023년 이후 멈춰 있다 | **배제** — 유지가 정체됐다 | pypi, 00:40 **확인** |
| **opentype.js** | 폰트 파싱과 OTF 쓰기 | MIT | 2.0.0 (2026-05-06) | fontTools와 중복된다. 서체 윤곽은 이번 라운드에서 금지다 | **배제** — 중복이다 | npm, 00:39 **확인** |

### 2-2. 사람이 손대는 편집기와 파라메트릭 선례

| 이름 | 무엇을 하나 | 라이선스 | 유지 상태 | 적합성 | 판정·근거 | 출처·열람 |
|---|---|---|---|---|---|---|
| **Fontra** (+fontra-pak) | 브라우저 기반 폰트 편집기(로컬 Python 서버). UFO/designspace 읽기·쓰기, 클립보드 **SVG 붙여넣기**(image/svg+xml 인식), 겹침 제거 등 패스 연산, 가변 축, `fontra-workflow`(YAML 파이프라인) | GPL-3.0(도구 라이선스이고, 우리가 만든 산출물에는 전파되지 않는다) | fontra-pak 2026.10.0 (2026-10-05), main 최근 커밋 2026-10-06 | 코드가 만든 UFO를 사람이 열어 미세 조정하고, 다시 UFO로 저장하면 build가 그것을 읽는다. 결정성을 유지할 수 있다 | **채택(사람 미세조정 창구)** | github.com/fontra/fontra, …/commits/main, fontra-pak/releases, raw CHANGELOG.md, 00:37–00:42 **확인** |
| **FontForge** | 데스크톱 편집기. Python 헤드리스 스크립팅, Expand Stroke, Spiro 곡선 | GPLv3 계열(릴리스 페이지에 미표기 — 라이선스는 보류) | 20251009 릴리스(2025-10-09) | 헤드리스 Expand Stroke는 베지어 획 확장의 대안이다. 컨테이너에는 미설치다 | **부분 채택(예비)** — shapely 다각형 근사가 거슬릴 때 `apt` 설치를 검토한다 | github.com/fontforge/fontforge/releases, 00:38 **확인** |
| **libspiro** (Spiro 곡선) | 점만 찍으면 G2 연속 곡선을 만든다(Raph Levien). 레터링 곡선 작도에 이상적이다 | GPL-3.0 | 날짜 미표기(FontForge 동반) | 원리(점 → 매끈한 곡선)를 쓸 수 있다. PyPI `pyspiro` 1.0.0(2026-10-07)은 출처를 검증하지 못했다 | **부분 채택(원리만)** — 직접 바인딩하지 않는다. 곡선이 필요하면 Hobby/Spiro식 보간을 작은 함수로 짠다 | github.com/fontforge/libspiro, 00:42 **확인** |
| **MetaPost / Metafont** | 펜 모양을 경로를 따라 쓸어 글자를 만든다. Hobby 곡선. MetaPost는 SVG 출력 | LGPL(MetaPost) | TeX Live 동봉. CTAN 공지는 2013년 이후 없음 | **'펜을 정의하고 중심선을 쓸기'는 서체 없이 구성 규칙으로 그리는 원형 선례다.** 컨테이너에는 미설치다 | **부분 채택(개념)** — 납작붓 펜(타원·기울기)을 중심선 따라 쓸어 볼록 껍질을 합집합하는 것을 Python으로 직접 구현한다 | ctan.org/pkg/metapost, tug.org/metapost.html, 00:42 **확인** |
| **Glyphr Studio 2** | 브라우저 폰트 편집기(입문자용) | GPL-3.0 | v2.10.6 (2026-10-02) | Fontra와 중복된다. SVG·UFO 파이프라인 언급이 없다 | **배제** — 중복이다 | github.com/glyphr-studio/Glyphr-Studio-2, 00:38 **확인** |
| **BirdFont** | 데스크톱 폰트 편집기 | GPLv3 | 최근 커밋 2025-11-23, 버전 2.33.6 (2024-09) | 유지가 저조하다 | **배제** | github.com/johanmattssonm/birdfont, 00:38 **확인** |
| **Runebender** | Rust 폰트 편집기 | Apache-2.0 | 최근 커밋 2023-06-06. README에 "not yet suitable for use" | 미완성이다 | **배제** | github.com/linebender/runebender, 00:38 **확인** |
| **Prototypo** | 웹 파라메트릭 폰트 서비스 | MPL-2.0(.js/.jsx/.json만. CSS·SVG·PNG는 회사 소유) | 최근 커밋 2020-07-01 "shutdown signin and signup" | 서비스가 종료됐다 | **배제** — 종료됐다. 파라메트릭 선례로 기록만 남긴다 | github.com/byte-foundry/prototypo, 00:38 **확인** |
| **Metapolator** | Metafont 기반 웹 파라메트릭 편집기(계획) | GPL-3.0 | 최근 커밋 2018-07-23, 미출시 | 중단됐다 | **배제** | github.com/metapolator/metapolator, 00:42 **확인** |
| **Metaflop** | Metafont 파라미터 슬라이더 웹앱 | GPL v3(2차 출처) | 2013–2014 자료만 있음. github.com/metaflop/metaflop은 404 | 자기 형태 업로드가 불가하고 라틴 전용이다 | **배제(보류 근거)** | 검색 요약만, 00:42 **보류** |

## 3. 웹앱(상용 포함)

생성형 AI 공통 판정 근거:
- **저작권**: 미국 저작권청 보고서 Part 2(2025-01-29)가 생성 AI 산출물의 저작물성을 다룬다. 이 보고서의 취지는 프롬프트만으로 만든 결과는 인간 저작이 아니라는 것이다. 일본 문화청 「AIと著作権に関する考え方について」(2024-03-15)도 있다. 보고서 본문은 열지 않았고, 발행 사실만 원문으로 확인했다(copyright.gov/ai, bunka.go.jp, 00:43 **확인**).
- **상표**: 상표 등록 가능성은 저작권과 별개로 식별력·선행 유사성으로 결정된다. 그런데 생성 결과는 남과 같거나 비슷하게 나올 수 있다고 약관이 스스로 인정한다(아래 Ideogram 조항).
- **학습 데이터**: Recraft·Ideogram·Kittl은 학습 데이터 구성을 공개하지 않는다. 우리 BRIEF의 '다른 로고 모방 금지'를 검증할 수 없다.
- 그래서 마크 최종물에는 쓰지 않는다. 내부 무드보드로도 권하지 않는다. 생성물을 본 뒤에는 닮음을 판별하기 어렵다.

| 이름 | 무엇을 하나 | 라이선스·가격 | 유지 상태 | 적합성 | 판정·근거 | 출처·열람 |
|---|---|---|---|---|---|---|
| **Recraft**(V4.1, AI Vector Generator) | 프롬프트에서 SVG 로고·아이콘을 생성한다 | 약관 2026-08-11: 유료 플랜은 산출물 소유와 저작권 양도(단, AI 학습 사용 금지). **무료 플랜 산출물은 Recraft 소유이고 공개되며 상업 이용 불가**. 입력·산출물에는 Recraft에 영구 이용권이 설정된다. 제3자 상표·스타일 모방 책임은 사용자에게 있다. 가격은 JS 렌더라 미확인 | 현행(V4.1) | SVG가 나오지만 형태를 우리 규칙으로 통제하거나 재현(결정성)할 수 없다 | **배제** — 저작물성이 불확실하다(USCO Part 2). 학습 데이터가 비공개다. 결정적 build와 맞지 않는다 | recraft.ai/terms, /pricing, /ai-vector-generator, 00:41–00:44 **확인** |
| **Ideogram**(4.5) | 글자가 든 이미지를 생성한다(래스터, '편집 가능 텍스트 레이어' 기능) | ToS: 산출물 소유를 주장하지 않고 권리를 양도한다. 하지만 **"산출물이 고유하지 않을 수 있고 다른 사용자가 비슷한 것을 만들 수 있다"**고 명시한다. 기본 공개이며 Private 기능이 따로 있다 | 현행(4.5) | 래스터라 아웃라인 SVG 원칙과 맞지 않는다 | **배제** — 고유성을 보증하지 않으므로 상표 식별력에 위험하다. 래스터다 | ideogram.ai/legal/tos/, 00:42 **확인** |
| **Kittl**(Text Effects·AI Vector·Logo Maker) | 텍스트 효과, 벡터 생성, 템플릿 로고 | Licensing: Pro/Expert 플랜만 AI 이미지 소유. 무료 플랜 산출물은 커뮤니티 공유. 플랫폼에 '게시'한 디자인은 **권리 전부가 Kittl로 이전**되고 AI 학습에도 쓰인다. **Kittl Content(템플릿·서체 등)는 권리 등록 주장 금지** | 현행 | 서체·효과 기반이라 '서체 윤곽 금지'와 정면으로 충돌한다 | **배제** — Kittl 요소를 쓴 로고는 상표 등록이 막힌다 | kittl.com/terms, /licensing, /pricing, 00:41–00:44 **확인** |
| **Adobe Firefly 텍스트 효과 / Illustrator 'Text to Vector Graphic'** | 프롬프트로 벡터와 글자 효과를 만든다 | 2차 출처: Adobe Stock·퍼블릭 도메인으로 학습했고, 기업 고객은 일부 워크플로에 IP 면책이 있다 | — | Illustrator가 필요하고 결정성이 없다 | **보류**(원문 Akamai 차단) — 원문을 열더라도 저작물성 문제는 같아서 배제 쪽으로 기운다 | helpx.adobe.com·adobe.com 차단. 기업 FAQ PDF도 차단. 00:43 **보류** |
| **Canva** | 템플릿 로고 편집 | 2차 출처(Canva 도움말 검색 요약): 템플릿·스톡 그래픽을 쓴 로고는 상표 불가. 서체·기본 도형은 허용 | — | 템플릿 조립형이다 | **보류**(원문 차단) — 방향이 달라서 배제 쪽으로 기운다 | canva.com/help/logo-trademarks 차단, 00:43 **보류** |
| **Looka / Brandmark**(로고 생성기) | 업종·스타일을 입력하면 아이콘과 서체를 조합한다 | 2차 출처(Looka 도움말 요약): 전체 소유는 주되, 아이콘·서체는 DB에서 빼지 않는다(요소는 비독점) | — | 서체+아이콘 조합이다 | **보류**(Looka는 Cloudflare, Brandmark 약관은 404) — 서체 기반이라 배제 쪽으로 기운다 | 00:43 **보류** |
| **Calligraphr** | 손글씨 템플릿을 스캔해 TTF/OTF를 만든다 | 무료(75자·1폰트) / Pro $10/월(600자) | 현행 | 손글씨 원고가 없다. 우리 목표는 한 단어 마크라서 맞지 않는다 | **배제** | calligraphr.com/en/pricing/, 00:42 **확인** |
| **Glyphs 4 / Glyphs Mini 2** | 업계 표준 맥 폰트 편집기(참고) | €319 / €49, macOS 12+ | 현행 | 사람 레터링 디자이너가 쓸 가능성이 높다. 우리 컨테이너에서는 못 쓴다 | **부분 채택(핸드오프 수용 포맷)** — 디자이너가 Glyphs를 쓰면 `.glyphs`를 받아 `glyphsLib`(6.16.0, 2026-10-08)로 UFO로 바꾼다 | glyphsapp.com/buy, pypi glyphsLib, 00:42 **확인** |
| **Figma 플러그인**(텍스트 워프 'Warp It' 등) | 텍스트를 엔벨로프로 왜곡한다 | — | 2차 출처(가이드 2025-12) | 서체 윤곽 변형이라 금지 방향이다 | **배제(보류 근거)** | 검색 요약만, 00:43 **보류** |

## 4. 일본어 가나 레터링 특화

| 이름 | 무엇을 하나 | 라이선스 | 유지 상태 | 적합성 | 판정·근거 | 출처·열람 |
|---|---|---|---|---|---|---|
| **KanjiVG** | 109×109 SVG 획 데이터. 획마다 `kvg:XXXXX-sN` 순번이 붙은 **중심선 path**(획순·방향 포함). **가나도 포함한다** — と(03068)·な(0306a)·り(0308a)·ト(030c8)·ナ(030ca)·リ(030ea)를 원문으로 확인했다 | **CC BY-SA 3.0**(Ulrich Apel, COPYING 원문 확인) | r20260714 (2026-07-14). PyPI `kanjivg` 20260714 | 한 획 골격을 바로 얻을 수 있다. 다만 형태가 교과서체 손글씨 궤적이다. **SA 조항이 문제다**: 좌표를 그대로 굵게 만든 로고는 '개작물'로 볼 여지가 있고, 그러면 같은 라이선스 배포 의무가 생겨 상표 로고의 독점 이용과 부딪힌다 | **부분 채택(참조 전용)** — 획 수·순서·방향·대략의 기울기 같은 사실 정보만 대조한다. 최종 SVG의 중심선은 우리 구성 규칙으로 **새로 작도**한다. 실험 build에서 읽더라도 출처를 NOTES에 적고, 최종 산출에는 KanjiVG 좌표를 넣지 않는다 | github.com/KanjiVG/kanjivg, /releases, raw kanji/*.svg·COPYING, 00:37–00:39 **확인** |
| **AnimCJK** | 일본어 가나 177자(히라가나 86·가타카나 91)의 SVG 획과 **median(중심선)** | 문자 SVG는 Arphic Public License. 가나·획 SVG는 선택적으로 LGPL-3.0+ | 변경 로그 최신 2026-10-13 | KanjiVG 교차 대조용이다. 역시 카피레프트 계열이다 | **부분 채택(교차 참조만)** — 사용 조건은 KanjiVG와 같다 | github.com/parsimonhi/animCJK, licenses/COPYING.txt, 00:39–00:42 **확인** |
| **KAGE 엔진**(@kurgm/kage-engine) | GlyphWiki의 KAGE 형식(획 종류 + 기필·수필 형태 코드 + 좌표)으로 한자 글리프를 생성한다 | GPL-3.0 (TypeScript) | 0.7.0 (2026-09-06) | **'획 종류와 끝 처리 규칙으로 글자를 생성'하는 구성 규칙의 일본 선례다.** 한자 명조·고딕 중심이라 가나 레터링의 미감과는 거리가 있다 | **부분 채택(개념)** — 획 끝 처리(수필·하네·하라이)를 이름 붙은 파라미터로 분리하는 설계를 빌린다. 엔진은 쓰지 않는다 | github.com/kurgm/kage-engine, …/commits/master, npm, 00:39–00:40 **확인** |
| **GlyphWiki**(KAGE 데이터) | 공동 편집 한자·가나 글리프 DB | 라이선스 원문 미열람 | — | 위 KAGE와 같다 | **보류**(Cloudflare 차단) | glyphwiki.org, 00:44 **보류** |
| **KST32B / KanjiStrokeOrders**(획 폰트) | 단선 획 폰트(CAD용) / 획순 번호 폰트 | 2차 출처: freeware / BSD 계열 | — | 폰트라서 이번 라운드의 금지 대상이다 | **보류·배제 쪽** | 검색 요약만, 00:43 **보류** |
| **일본어 로고타입(作字) 전용 오픈소스 도구** | — | — | — | 일본어·영어 검색에서 **배포 중인 전용 도구를 찾지 못했다.** 현업 作字는 Illustrator 펜 툴과 아웃라인 편집이 표준이다 | **해당 없음** — 공백이므로 우리 build 스크립트가 그 자리를 채운다 | 검색 결과, 00:43 |

## 5. 권고

### 5-1. 당장 붙일 도구 3개와 쓰는 법

1. **골격: svgpathtools + 자작 중심선(KanjiVG는 대조용)**
   - と·な·り·ト·ナ·リ·T·O·N·A·R·I의 중심선을 우리 구성 규칙으로 직접 정의한다. 예: "모든 획 = 직선 + 반지름 r 원호 하나", "획 끝은 45° 절단". 직선·원호·Spiro/Hobby식 보간 중에서 고른다.
   - KanjiVG/AnimCJK는 `svgpathtools`로 읽어 획 수·순서·방향을 대조하는 검사에만 쓴다. 예: ナ 2획째 시작점이 1획 위에 있는가, り/リ 혼동을 줄 굽음이 있는가.
   - 최종 SVG에는 KanjiVG 좌표를 넣지 않는다(CC BY-SA 회피).
2. **획 확장: shapely `buffer`(자유곡선)·해석적 오프셋(직선·원호)과 펜 쓸기**
   - 단일 굵기 획은 `buffer(w/2, cap_style, join_style)`로 만든다.
   - '그린 맛'은 MetaPost 원리를 빌려 만든다. 납작붓·타원 펜을 기울기 θ로 정의하고 중심선을 따라 쓸어 볼록 껍질을 합집합한다. 그러면 획의 방향에 따라 굵기가 바뀐다.
   - 다각형 근사는 `simplify(0.05)`로 점 수를 줄인다. 24px 헤더용 경량화는 SVG 바이트로 검사한다.
3. **불리언·마감: skia-pathops, 사람 조정은 Fontra**
   - 획 합집합 → `simplify`(겹침 제거)로 마감한다.
   - 서명 디테일(획 사이 틈, 잉크 트랩, 주홍 악센트 분리)은 `difference`로 깎는다.
   - 결과를 fontTools로 UFO에 써서 **Fontra**(fontra-pak 2026.10.0)로 사람이 노드를 다듬는다. build는 그 UFO를 다시 읽어 SVG·card.png를 낸다. 소스 = 규칙 코드 + 손 조정 UFO이고, 결정성은 유지된다.
   - 회차 검수는 `shotfull.cjs` 스크린샷과 `design:design-critique`로 한다.

예비 도구:
- 곡선을 보존한 획 확장이 필요해지면 FontForge 헤드리스 Expand Stroke(설치 필요)나 Paper.js + paperjs-offset(Node)을 쓴다.
- skia-python은 libEGL 문제를 해결한 뒤에 쓴다.

### 5-2. 사람 레터링 디자이너에게 맡길 경우 넘길 것

| 넘길 것 | 내용 |
|---|---|
| **브리프 1장** | 세 표기의 역할(TONARI 우산 / となり 일본 / トナリ 경계), 우리 구성 규칙 한 줄과 그 이유, 서명 디테일 후보, 금지 사항(BRUTUS·POPEYE·Casa·&Premium 닮음, 서체 윤곽 변형, AI 생성 이미지 사용), 읽힘 기준(ナ≠テ, り≠リ, 원어민 판독), 24px 실루엣, 색 3개(밤 #151b2c·눈 #eef0f4·주홍 #d4462a 악센트 하나)와 단색 인쇄 동형 |
| **SVG 시안** | 우리 회차 최종안의 아웃라인 SVG. **중심선 골격 레이어와 윤곽 레이어를 분리**하고 구성 그리드·치수표(`marks.json` 형식의 기둥·배율·자간 값)를 붙인다. 버린 시도와 버린 이유(iterations/·NOTES.md) |
| **사용 견본** | `sheet.png`(헤더 24px·표지 제호·칩·스티커 자리) — 마크가 실제로 놓일 환경 |
| **받을 것** | 편집 가능한 원본(.glyphs·.ufo 또는 .ai, 우리는 UFO 우선). 아웃라인 SVG(light/dark/mono). 최소 크기·여백 규정. **저작권 양도(또는 독점 이용 허락) 계약**, **AI 생성 이미지 미사용 및 제3자 서체 윤곽 미사용 확인서**(상표 출원 대비). 중간 시안 2회 이상(골격 단계 → 마감 단계) |

## 6. 실측 메모(스크래치, 리포 미반입)

- KanjiVG `03068.svg`(と) 중심선 2획을 `svgpathtools`로 획당 201점 샘플링하고, `shapely.buffer(4.5, round)`로 확장했다. 이어서 `unary_union` → `skia-pathops simplify` → `fontTools SVGPathPen` 순서로 처리해 SVG를 만들었다.
- 결과는 윤곽 1개, 패스 37.7KB였다. 형태는 정상으로 렌더링됐다(PNG 육안 확인).
- 판정에 반영한 점:
  - 파이프라인이 끊김 없이 돈다.
  - 다각형 근사라 패스가 무겁다 → `simplify` 필요.
  - KanjiVG 궤적은 교과서체 손글씨라서, 균일 굵기로 확장하면 '마커 글씨'처럼 보인다. 그래서 형태는 자작해야 한다.
- 스크립트 위치: `/tmp/claude-0/-home-user-manabi/0206ac3f-d009-52b8-9c9c-c828c4ca53fe/scratchpad/tools-survey/bin/smoke.py`
