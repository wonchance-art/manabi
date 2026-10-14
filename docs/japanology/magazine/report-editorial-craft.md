# 일본 잡지의 기법을 manabi 계약으로 옮기다

조사일 2026-10-14 (KST). 근거 노트: `docs/japanology/magazine/notes/`의 다섯 편(copywriting · editorial_design · typography_oss · writing_craft_lint · ai_skills_prompts).

**결론부터 말하면, 일본 잡지·카피·작문의 전통에서 manabi로 가져올 것은 시각 양식이 아니라 "말을 고르는 규율"과 "검사 가능한 공정"이다.** 아래 다섯 가지를 채택한다.

1. 谷山雅計의 「なんかいいよね」 금지(좋은 이유를 말로 적는다), 花森安治의 실용문 10훈, 近藤康太郎의 "첫 세 줄", 岸政彦의 생활사 방식(실재 화자, 실명 청자, 가공 없음)을 묶어 **매거진 문체 정본 하나**로 만든다.
2. 이 정본 가운데 문장 길이, 금지 구문, 외래어 표기, 출처·취재 메타데이터는 기존 `copyStandard.test.js` 패턴의 **자체 vitest 규칙(`EDIT-STD-*`, `MAG-*`)**으로 심는다. 일본어 생태계의 표준 린터인 textlint는 한국어 규칙이 없어 엔진으로는 쓰지 않는다. 아이디어만 빌린다.
3. 조판은 2026-10 기준 세 브라우저 엔진이 공통으로 지원하는 CSS로 짠다(`vertical-rl`, `text-combine-upright:all`, `ruby`, `keep-all`).
   - 일본어 헤딩만 **BudouX를 서버에서 돌려 `<wbr>`를 넣는다**. 클라이언트 번들 증가는 0 B다.
   - 글꼴은 리포가 이미 쓰는 Noto Serif KR/JP를 재사용한다. 표지용 세로 명조 1종만 추가할지가 오너 결정으로 남는다.
4. 제작 공정은 repo 커맨드 `/magazine-edit` 하나로 묶는다. 여기에 다음을 개념으로 흡수한다. 파일째 가져오는 것은 없다.
   - Anthropic frontend-design의 "AI 디자인 기본값 군집" 자가 점검
   - doc-coauthoring의 "문맥 없는 독자 시험"
   - 한국어 humanizer들의 "보존 불변식 + 변경률 가드"
5. 가장 큰 함정은 의외의 곳에 있다. 크림 종이색, 세리프, 가는 괘선, 다단은 "잡지다움"의 상식이다. 그런데 Anthropic 스킬은 바로 이 조합을 **AI 생성 디자인이 몰리는 기본값**으로 명시한다. 따라서 이 선택은 금지가 아니라 **주제에서 도출했다는 근거를 적어야 하는 선택**이 된다.

조사 환경의 프록시가 advertimes.com, tcc.gr.jp, w3.org, npm, kornorms 등 다수의 1차 출처를 막았다. 그래서 상당수 사실은 검색 요약이나 GitHub clone 실측에 기대고 있으며, 각 항목에 **미확인** 표시를 남겼다.

---

## 1. 다섯 영역에서 건진 가장 강한 레퍼런스

### 1.1 카피: "좋다"에서 멈추지 말고 보편적인 것을 찾아라

방법론이 가장 체계적으로 기록된 카피라이터는 谷山雅計다. 『広告コピーってこう書くんだ！読本』(宣伝会議 2007-09, ISBN 9784883351794 / 증보신판 2024, ISBN 9784883356027)의 서장은 **「なんかいいよね」 금지**다. '좋다'는 감정을 부정하는 것이 아니다. 거기서 생각을 멈추지 말고 **왜 좋은지 자기 말로 파고들어야 재현할 수 있다**는 뜻이다 ([AdverTimes 발췌](https://www.advertimes.com/20240418/article456833/)). 제1장은 "많이 쓴다 / 짧게 쓰는 의미 / 과장과 거짓에 기대지 않는다"를 다룬다 ([hanmoto](https://www.hanmoto.com/bd/isbn/9784883351794)). 서평자는 카피가 상식과 예술 사이의 **「そういえばそうかも」(그러고 보니 그럴지도) 층**을 노린다고 요약했다. 원문 표현은 미확인이다 ([countand1](https://www.countand1.com/2024/09/how-to-write-great-advertising-copy-new-edition-book-review.html)). 이 층은 한국 독자가 이미 어렴풋이 아는 일본(편의점, 졸업식, 정년)을 새 각도로 보여 준다는 매거진 방향과 정확히 겹친다.

岩崎俊一는 「일본, 사람의 일생」의 철학과 가장 가깝다. 그는 업종과 상관없이 **"기업과 상품의 보편적 가치(普遍的価値)"**를 찾는 데서 출발했다 ([ブレーン 2013-12](https://mag.sendenkaigi.com/brain/201312/creative-direction/001088.php)). "카피는 만드는 것이 아니라 찾는 것"이라는 자세와 후배에게 **소리 내어 읽어 보라**고 한 지도가 같은 검색 요약에 나온다. 다만 개별 문장의 원출처는 미확인이다. 秋山晶는 AdverTimes 연재 제2회 주제가 **'주변의 디테일로 쌓아 올리는 카피'**였다 ([AdverTimes 2025-02-28](https://www.advertimes.com/20250228/article490896/)). "일하다" 같은 큰 주제를 명함 건네기나 퇴근 전철 같은 사물 하나에서 시작하라는 규칙의 근거가 된다.

잡지 쪽에서 가장 바로 쓸 수 있는 것은 花森安治의 **실용문 10훈**이다. ①쉬운 말 ②외래어 피하기 ③눈에 떠오르게 ④짧게 ⑤여운 ⑥중요한 것은 반복 ⑦이치보다 마음 ⑧설득하지 않기 ⑨자기만족 금지 ⑩한 사람의 독자. 항목 표현은 검색 요약의 요지이므로 원문 문구 확인이 필요하다 ([文藝春秋 BOOKS](https://books.bunshun.jp/articles/-/3045)). 원 편집부원 唐澤平吉는 「人に話すように、文章を書け」라는 말로 자주 혼났다고 증언했다. 같은 출처 요약에는 花森가 **귀로 들어서 알 수 없는 말을 피했다**는 서술도 있다 ([文藝春秋 BOOKS](https://books.bunshun.jp/articles/-/1555)).

BRUTUS의 사례에서는 두 가지 운영 규칙이 나온다.

- 「恋の、答え。」「お金の、答え。」의 흐름에서 「福岡の正解」라는 제목이 나왔다. 즉 **시리즈 문형이 새 제목을 낳는다** ([福岡移住計画](https://fukuoka-ijyu.jp/2018/07/19/0718/)).
- 台湾 특집 표지를 고를 때 '台北만의 특집처럼 보이는 것'과 '여성지 특집과 닮아 보이는 것'을 피했다. 즉 **표지는 차별성과 대표성으로 고른다** ([nippon.com](https://www.nippon.com/ja/column/g00521/)).

한국어 쪽 선례로는 정규영 『일본어 명카피 핸드북』이 있다. TCC 연감 30여 권에서 고른 명카피를 해설하는 책으로, '일본 카피로 일본어를 배운다'는 가장 가까운 시장 선례다 ([위픽레터](https://letter.wepick.kr/510/4430931/)). 그러나 이 책은 원문을 싣고, manabi는 싣지 않는다. 그래서 **배제 + 근거**로 기록한다. 花森의 ⑩"한 사람의 독자"는 정철 『카피책』의 '일대일'과 수렴한다 ([교보 eBook](https://ebook-product.kyobobook.co.kr/dig/epd/ebook/E000005228378)). 두 언어권에서 독립적으로 같은 결론에 도달했으므로 우선순위를 높게 둔다.

수상 카피 아카이브도 있다. TCC 『コピー年鑑』(1963년 창간)과 검색 도구 コピラ가 있고, コピラ는 바디카피까지 수록한다 ([言語処理学会 2023](https://www.anlp.jp/proceedings/annual_meeting/2023/pdf_dir/A7-2.pdf)). 다만 **재게재·이용 조건은 TCC, 宣伝会議賞, ACC 어느 쪽도 확인하지 못했다.** 그러므로 편집팀이 내부에서 열람하는 용도로만 쓰고, 말뭉치 구축이나 원문 게재는 하지 않는다.

### 1.2 편집 디자인: 문자가 얼굴이고, 원칙은 편집 윤리다

사진이 없는 manabi에 가장 직접적인 계보는 **"잡지의 얼굴 = 문자"**다.

- 堀内誠一는 anan, BRUTUS, POPEYE의 로고를 설계했다 ([京都新聞](https://www.kyoto-np.co.jp/articles/-/706178); [GINZA](https://ginzamag.com/categories/culture/266587)).
- 花森安治는 편집에 더해 표지화, 삽화, **레터링**, 레이아웃까지 직접 맡았다 ([国立新美術館](https://www.nact.jp/english/artcommons/user/detail/33310)).

옮길 것은 "문자 하나로 얼굴을 만든다"는 원리뿐이다. 구체적인 글자 형태는 복제 대상이 아니다.

服部一成는 『流行通信』 리뉴얼 때 "레이아웃보다 근본 내용부터 함께 만들 수 있는 사람"으로 의뢰받았다 ([ggg 아카이브 인터뷰](https://scrapbox.io/recruit-art-center/%E6%9C%8D%E9%83%A8%E4%B8%80%E6%88%90_%E3%82%A2%E3%83%BC%E3%83%88%E3%83%87%E3%82%A3%E3%83%AC%E3%82%AF%E3%82%BF%E3%83%BC%EF%BC%8F%E3%82%B0%E3%83%A9%E3%83%95%E3%82%A3%E3%83%83%E3%82%AF%E3%83%87%E3%82%B6%E3%82%A4%E3%83%8A%E3%83%BC%EF%BD%9C%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%93%E3%83%A5%E3%83%BC)). Claude가 기획, 카피, 레이아웃을 한 손에 쥐는 manabi 체제와 구조가 같다. **화면 구성을 원고가 확정된 뒤에 얹지 말고, 꼭지를 설계하는 단계에서 함께 정한다.**

原研哉의 「空っぽ(エンプティ)」는 사용자가 자유롭게 관여할 수 있는 그릇 같은 간소함이다 ([MUJI](https://www.muji.com/jp/flagship/huaihai755/archive/hara.html)). 장 표지(扉)를 한 화면에 한 가지만 두는 근거가 된다. 杉浦康平의 「ダイアグラムデザイン」과 「時間地図」 ([artscape](https://artscape.jp/report/review/10104140_1735.html))는 사진 없는 지도 꼭지를 '이동 시간·생애 단계' 축의 도해로 풍부하게 만드는 선례다.

편집 윤리 쪽 선례도 두 가지다.

- d design travel: 편집부가 약 2개월 현지에 머물고, **필자가 실제로 묵고 먹고 산 곳만** 추천하며, 업체는 편집에 개입하지 못하고, **결점도 기록**한다 ([D&DEPARTMENT](https://d-department.com/item/DD_TEXT_REPORT_6872.html); [富山県 자료](https://www.pref.toyama.jp/documents/22537/shiryou1-1.pdf)).
- 『暮しの手帖』의 무광고 원칙 ([MUJI BOOKS](https://www.muji.com/jp/mujibooks/bookdetail_hanamori.html))과 「商品テスト」 전시 ([artagenda](https://www.artagenda.jp/exhibition/detail/1050)).

이 둘은 「モノ・コト・ヒト」와 「해 보기」의 편집 규율로 그대로 채택할 수 있다. 시각 양식이 아니라 윤리이기 때문이다.

웹 선례 셋에서는 형식을 하나씩 가져온다.

| 선례 | 가져올 것 | 버릴 것 |
|---|---|---|
| The Pudding ("숫자에 의미를 부여", [Peabody](https://peabodyawards.com/award-profile/the-pudding/)) | 「숫자로 보기」의 **숫자 1개 → 해석 1문장 → 출처 1줄** 정적 스텝 | 무거운 스크롤 인터랙션 |
| ジモコロ의 편집장 대담 ([ジモコロ](https://www.e-aidem.com/ch/jimocoro/entry/kakijiro28)) | 사진 없이 목소리로 지면을 살리는 칼럼 변형 | (해당 없음) |
| Craig Mod 『Kissa by Kissa』 (판을 거듭해도 B5·단일 본문 서체 유지, [Ridgeline 094](https://craigmod.com/ridgeline/094/)) | **그리드·서체는 8개 호 전체 고정, 호별 변수는 주제어와 보조색뿐**이라는 근거 | (해당 없음) |

한국어권에서는 『매거진 B』가 2011년부터 '한 호 한 대상' 형식으로 일본 브랜드와 도시를 여러 번 다뤘다 ([위키백과](https://ko.wikipedia.org/wiki/%EB%A7%A4%EA%B1%B0%EC%A7%84B)). 한국 독자에게 이미 익숙한 문법이라는 뜻이다.

### 1.3 조판·글꼴: 세 엔진 공통 집합으로 짜고, 서버에서 끝낸다

MDN browser-compat-data 8.1.5(2026-10-13)를 직접 clone해 실측한 결과는 아래와 같다 ([mdn/browser-compat-data](https://github.com/mdn/browser-compat-data/tree/main/css/properties)).

| 지원 범위 | 기능 |
|---|---|
| **세 엔진 공통** | `writing-mode: vertical-rl`(Chr48/Saf9/FF43), `text-combine-upright: all`(Chr48/Saf15.4/FF48), `<ruby>`, `word-break: keep-all`, `line-break: strict`, `text-wrap: balance` |
| Chrome 전용 | `text-spacing-trim`, `word-break: auto-phrase` |
| Safari 전용 | `hanging-punctuation` |
| 어느 엔진도 지원하지 않음 | `text-combine-upright: digits` |

`text-autospace`는 세 엔진 모두 **초기값이 `no-autospace`로 구현돼 있다.** 일본어 문단에서 쓰려면 `:lang(ja)`에 명시적으로 켜야 한다. 한국어 쪽 규범인 KLREQ는 어절 단위 줄 나눔(= `keep-all`), "글자사이 0 기본", 금칙 문자 클래스를 규정한다 ([w3c/klreq](https://github.com/w3c/klreq/blob/main/index.html)).

**BudouX**(Apache-2.0, v0.9.3 2026-09-27, 모델 포함 약 15 KB)는 일본어 구절 분할기다. 스스로 **한국어는 `keep-all`이 더 낫다**고 밝힌다 ([google/budoux README](https://github.com/google/budoux/blob/main/README.md)). Chrome의 `auto-phrase`는 C++로 포팅한 BudouX다 ([Chrome for Developers](https://developer.chrome.com/blog/css-i18n-features)). 그러므로 서버 컴포넌트에서 `parse()`를 돌려 `<wbr>`를 넣으면 Safari와 Firefox에서도 같은 분할을 얻는다.

다른 후보는 쓰지 않는다.

- Vivliostyle: **AGPL-3.0**이고 페이지 미디어·PDF용이다 ([vivliostyle.js](https://github.com/vivliostyle/vivliostyle.js)).
- kuroshiro: 2.0 beta로 막 재가동했지만, 리포에 이미 `kuromojin` 정본이 있어 중복 신설에 해당한다 ([hexenq/kuroshiro](https://github.com/hexenq/kuroshiro)).

글꼴은 조사의 전제를 하나 고친다. **manabi는 이미 serif를 쓴다.** `src/app/(app)/layout.jsx`가 Noto Serif KR(600/700)을, grammar 레이아웃이 Noto Serif JP를 `next/font/google`로 불러온다(리포 실측). 따라서 "명조 글꼴 추가"라는 오너 결정은 사실상 **표지용 일본어 디스플레이 명조 1종을 더할지**로 좁혀진다.

google/fonts의 TTF를 직접 파싱해 비교했다 ([google/fonts ofl](https://github.com/google/fonts/tree/main/ofl)). 세로 자간을 조이는 `vpal`과 약물 조정용 `palt`/`chws`를 모두 갖춘 것은 Noto Serif JP/KR이다. Shippori Mincho는 `palt/vpal/vert`를 갖췄다. Zen Old Mincho와 Dela Gothic One은 `vert`만 있고 `palt`가 없다. Hahmlet은 **한글 2,788자만** 담고 있어 본문에 쓸 수 없다.

가장 위험한 함정은 혼용에 있다. Noto Serif KR은 가나와 한자 8,138자를 함께 담는다. 그래서 일본어 인라인에 `lang="ja"`를 빼먹으면 **한국식 한자 자형**으로 그려진다(실측 기반 추론).

양국 정부 디자인 시스템은 둘 다 산세리프 하나에 넉넉한 행간을 쓴다. 디지털청은 본문 16–17px, 행간 1.7, 자간 0.02em이고 ([digital-go-jp/design-tokens](https://github.com/digital-go-jp/design-tokens)), KRDS는 17px에 행간 1.5다 ([KRDS-uiux](https://github.com/KRDS-uiux/krds-uiux)). 매거진 본문은 이를 **하한**으로 삼아 17–18px, 행간 1.7–1.8로 잡는다.

접근성에는 미해결 문제가 있다. `<ruby>`의 낭독은 스크린 리더마다 다르다. macOS VoiceOver와 Chrome/Safari 조합에서는 `<rt>`가 무시되고 기저 문자가 조각나서 읽힌다. Firefox에서는 중복으로 읽히고, TalkBack에서는 별도 발화로 나온다 ([CodePen 테스트](https://codepen.io/adampage/pen/pvbMrvv/9cf8c1b24ba3944b0f218d1cb7555788); [a11y news](https://a11ynews.substack.com/p/whos-that-code-snippet?open=false)). **읽기 정보를 루비에만 맡기면 안 된다.**

### 1.4 작문과 린트: 공정은 일본에서, 엔진은 직접 만든다

일본 작법서에서 세 가지 차원을 가져온다.

- **문장 구조**: 本多勝一 『日本語の作文技術』(朝日文庫 新版)의 수식어 순서(긴 것 먼저, 큰 상황에서 작은 상황으로)와 「構文上のテン」(구문 경계에만 쉼표) ([阪大 강의자료](https://www.library.osaka-u.ac.jp/doc/LS_20201217_japanese_writing.pdf); [跡見 논문](https://atomi.repo.nii.ac.jp/record/1336/files/atomi_com8_02.pdf)).
- **리드와 어휘**: 近藤康太郎 『三行で撃つ』의 **첫 문장, 길어도 세 줄 안에 독자를 놀라게 하라**와 상투구 금지 ([Newsweek日本版](https://www.newsweekjapan.jp/articles/-/42774); [東洋経済](https://toyokeizai.net/articles/-/401849?display=b)).
- **공정**: 古賀史健 『取材・執筆・推敲』(ダイヤモンド社 2021-04, ISBN 978-4-478-11274-8)의 취재·집필·퇴고 3단 분리 ([版元ドットコム](https://www.hanmoto.com/bd/isbn/9784478112748))와 『20歳の自分に受けさせたい文章講義』의 "말하기와 쓰기는 다른 행위" ([東洋経済](https://toyokeizai.net/articles/-/101182?display=b)).

「사람의 일생」에 가장 가까운 모델은 岸政彦 『東京の生活史』(筑摩書房 2021-09)다. 공모 청자 150명이 각자 화자 1명을 듣고, **해설 없이 나열하며, 청자 이름을 명기**했다 ([筑摩書房](https://chikumashobo.co.jp/special/tokyo_project/); [現代ビジネス](https://gendai.media/articles/-/88733)). 이 원칙을 frontmatter로 강제하면 "가짜 인터뷰 금지"가 계약 테스트가 된다.

일본어 고유명사의 한글 표기는 국립국어원 원칙을 따른다. 확인된 것은 다음과 같다.

- **장음은 표시하지 않는다** ([국립국어원](https://www.korean.go.kr/nkview/nknews/200504/81_4.html)).
- 쟈·죠·츄 계열은 쓰지 않는다 ([국립국어원](https://www.korean.go.kr/nkview/nknews/200108/37_5.html)).
- 파열음에 된소리를 쓰지 않는다 ([외래어 표기법 제85-11호](https://ko.wikisource.org/wiki/%EC%99%B8%EB%9E%98%EC%96%B4_%ED%91%9C%EA%B8%B0%EB%B2%95_%28%EC%A0%9C85-11%ED%98%B8%29)).

ツ→「쓰」는 2차 출처로만 확인했다 ([더위키](https://thewiki.kr/w/츠)). 촉음 ㅅ과 어두 예사소리 규칙은 조사자의 사전 지식이므로 **kornorms 원문 대조가 필요하다.**

린터 생태계는 일본어 쪽이 textlint v15로 정리돼 있다(Node 20+, `createLinter()`, [efcl.info](https://efcl.info/2025/06/25/textlint-v15/)). 그러나 **한국어 textlint 규칙 패키지는 찾지 못했다.** 일본어 규칙은 kuromoji 형태소 분석에 기대므로 한국어 본문에는 무효다. hanspell은 코드는 MIT이지만 부산대/나라인포테크의 외부 웹서비스를 호출한다. 이 서비스는 개인·학생만 무료이므로 CI에 넣을 수 없다 ([9beach/hanspell](https://github.com/9beach/hanspell)). 결론은 이렇다. textlint 프리셋에서는 **규칙 아이디어**를 가져온다(sentence-length, max-ten, no-doubled-joshi, weak-phrase, redundant, dearu-desumasu). 사전 형식은 **prh의 `{expected, pattern, specs}`**를 가져온다. 엔진은 리포의 `copyStandard.test.js`(COPY-STD-001: RULES 정규식 + 파일·조각·이유 ALLOWLIST)와 같은 모양으로 직접 짠다.

### 1.5 AI 스킬과 프롬프트: 표본, 2패스, 새 독자, 보존 불변식

anthropics/skills의 **frontend-design**(Apache-2.0)은 이 프로젝트에 가장 아픈 지적을 한다. AI 디자인이 몰리는 다섯 군집 가운데 둘이 manabi 매거진 시안의 상식과 정확히 겹친다.

- ① 따뜻한 크림 배경 + 고대비 세리프 + 테라코타 악센트
- ③ **헤어라인 괘선, 0 radius, 신문 같은 다단(broadsheet)**

해법도 함께 제시한다. 토큰 플랜(4~6 hex, 서체 역할, ASCII 와이어프레임)을 먼저 쓰고, "비슷한 프롬프트로 누가 해도 같은 곳에 도달하는가"를 브리프에 대 보는 **2패스**를 거친 뒤 코드로 간다. "대담함은 한 곳에"라는 원칙도 있다 ([frontend-design/SKILL.md](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md)). Anthropic은 이 현상을 학습 데이터의 안전한 중심값으로 쏠리는 "distributional convergence"로 설명한다 ([claude.com 블로그](https://claude.com/blog/improving-frontend-design-through-skills)).

**doc-coauthoring**의 Reader Testing은 문맥 없는 새 서브에이전트에 문서만 주고 독자가 물을 질문 5~10개에 답하게 하는 방식이다. 오독과 모호함을 잡는 데 쓴다 ([doc-coauthoring/SKILL.md](https://github.com/anthropics/skills/blob/main/skills/doc-coauthoring/SKILL.md)). 다만 LICENSE가 없어 라이선스가 미확인이므로 개념만 쓴다.

한국어 humanizer 두 종은 검수 공학이 잘 짜여 있다. 둘 다 MIT다.

- **nomadamas/k-skill korean-humanizer**: D군 'AI 관용구'를 정리했다. 결산 피벗("결론적으로·이를 통해"), "시사하는 바가 크다", 의인화 추상 주어, "~할 때다" 결말 공식, 과장된 의의, 출처 없는 권위가 여기 든다. **고유명사·수치·날짜·직접 인용은 수정 대상에서 제외**하고, 변경률은 30% 이하로 제한한다 ([nomadamas/k-skill](https://github.com/nomadamas/k-skill)).
- **daleseo/korean-skills**: S1~S3 심각도, 의미 보존 자체 검증, 변경률 가드(<30% 정상 / 30~50% 경고 / >50% 중단)를 둔다 ([daleseo/korean-skills](https://github.com/daleseo/korean-skills)). KatFishNet(ACL 2025)의 쉼표·띄어쓰기·품사 다양성 특징에 기반한다 ([ACL Anthology](https://aclanthology.org/2025.acl-long.1030)).

blader/humanizer(MIT)는 "어휘 습관은 모델마다 바뀌지만 **구조적 습관은 지속된다**"와 "**글쓴이 표본이 규칙보다 우선**"이라는 두 원칙을 준다 ([blader/humanizer](https://github.com/blader/humanizer/blob/main/SKILL.md)). Wikipedia의 "Signs of AI writing"도 같은 방향이다. 판정은 **신호의 조합**으로 하고 자동 탐지기는 믿지 말라고 한다 ([TechCrunch](https://techcrunch.com/2025/11/20/the-best-guide-to-spotting-ai-writing-comes-from-wikipedia/)).

팩트체크의 기준선은 Anthropic의 환각 줄이기 지침이다. "모른다"고 말할 권한을 주고, 직접 인용을 먼저 뽑고, **뒷받침할 인용을 못 찾으면 주장을 철회**한다 ([Anthropic docs](https://docs.anthropic.com/en/docs/test-and-evaluate/strengthen-guardrails/reduce-hallucinations)).

일본 커뮤니티 기법은 대부분 이미 리포 관행과 같은 구조다.

- 深津式(命令書/制約条件/入力文/出力文)과 ゴールシーク(목표 선언 후 역질문)는 리포의 SPEC 발주 관행과 동형이다 ([AIsmiley](https://aismiley.co.jp/ai_news/what-is-fukatsu-prompt/); [MiraLab](https://miralab.co.jp/media/goal_seek_prompt/)).
- Zenn 사례는 **기계적 점검은 Skill, 흐름 판단은 리뷰 Agent로 분리**하고 SKILL.md 본문은 500줄 이내로 쓰라고 권한다 ([Givery AI Lab](https://zenn.dev/givery_ai_lab/articles/3807845e371a1c); [atsushi11o7](https://zenn.dev/atsushi11o7/articles/zenn-writing-with-claude-code)).

---

## 2. 채택 · 부분 채택 · 배제 통합표

| 영역 | 항목 | 판정 | 근거 |
|---|---|---|---|
| 카피 | 谷山 「なんかいいよね」 금지 · 다작 후 선택 · 짧게 · 과장 금지 | **채택** | 검사 가능한 규칙으로 바로 옮겨진다. 서지 확인됨 ([hanmoto](https://www.hanmoto.com/bd/isbn/9784883351794)) |
| 카피 | 谷山 「そういえばそうかも」 3분법 | 부분 채택 | 표지·제목 검수 질문으로만 쓴다. 서평자 요약이라 원문은 미확인 |
| 카피 | 岩崎 보편적 가치 · 소리 내어 읽기 | **채택** | 시리즈 철학과 일치한다. 낭독 검사는 비용이 가장 싸다 |
| 카피 | 秋山 주변 디테일에서 쌓기 | **채택** | 칼럼 첫 문장 규칙의 근거 |
| 카피 | 花森 실용문 10훈 | **채택**(②는 한국어로 번역) | 1순위 독자(초급 성인 여행자)에 거의 그대로 맞는다. 일본어 칩은 ② '외래어 피하기'의 예외 |
| 카피 | BRUTUS 시리즈 문형 · 표지 차별성/대표성 검사 | 부분 채택 | 원리만 가져온다. 「〇〇の、答え。」라는 **문형 자체는 쓰지 않는다** |
| 카피 | BRUTUS 「〇〇好きのための〇〇」 정형 | 배제 | 1차 근거 없음(미확인) |
| 카피 | 岡本 스테이트먼트(편지처럼), 梅田 내적 언어 메모 | 부분 채택 | 편집자의 말 작성 절차에만 쓴다 |
| 카피 | TCC コピラ/연감 · 宣伝会議賞 · ACC 원문 | **배제**(게재·말뭉치) | 이용 조건 미확인. IP ⑵. 내부 열람만 허용 |
| 카피 | 정규영 『일본어 명카피 핸드북』 형식(원문+해설) | 배제 | 원문 게재 모델이라 manabi 정책과 충돌. 시장 선례로 기록만 남긴다 |
| 카피 | 新PASONA · PASBECONA · QUEST · AIDA | 배제(한정 참고) | 판매 DR 공식이라 피처 문체와 맞지 않는다. 단계 정의도 미확인 |
| 디자인 | 堀内·花森 "문자가 얼굴" 원리 | 부분 채택 | 원리만. 제호·레터링 형태는 금지 |
| 디자인 | 服部 "내용부터 함께 짜는 AD" | **채택**(공정) | 꼭지 설계 단계에서 화면을 함께 정한다 |
| 디자인 | 原 「空っぽ」 | 부분 채택 | 扉 한 화면 한 요소. MUJI 시각 톤은 금지 |
| 디자인 | 杉浦 時間地図·다이어그램 | 부분 채택 | 지도 꼭지의 도식 축. 기존 지도 핀을 재사용 |
| 디자인 | d design travel 직접 경험·결점 기록·업체 비개입 | **채택**(윤리) | 「モノ・コト・ヒト」 「해 보기」 규율 |
| 디자인 | 暮しの手帖 商品テスト 정신 | 부분 채택 | 「해 보기」를 '해 본 결과 + 실패 1줄' 형식으로 |
| 디자인 | The Pudding 정적 스텝 | 부분 채택 | 숫자→해석→출처. 스크롤 JS는 배제 |
| 디자인 | ジモコロ 대담 | 부분 채택 | **실제 취재가 있을 때만** 쓰는 칼럼 변형 |
| 디자인 | Kissa by Kissa 판형·서체 고정 | **채택** | 8개 호 그리드·서체 고정, 호별 변수 2개 |
| 디자인 | 매거진 B 한 호 한 대상 | **채택**(구조) | 판형·표지 방식은 금지 |
| 조판 | `vertical-rl` · `text-combine-upright:all` · `ruby` · `keep-all` · `line-break:strict` · `text-wrap:balance` | **채택** | BCD 8.1.5 기준 세 엔진 공통 |
| 조판 | `ruby-align` · `ruby-overhang` · `text-wrap:pretty` · `text-autospace`(ja만) · `text-spacing-trim` · `auto-phrase` | 부분 채택 | 점진적 향상. 일부 엔진에만 있다 |
| 조판 | `hanging-punctuation` · `text-combine-upright:digits` | 배제 | Safari 전용 / 어느 엔진도 지원 안 함 |
| 조판 | BudouX 0.9.3 (서버 `parse()` → `<wbr>`) | **채택**(서버 전용) | Apache-2.0, 활발히 유지, 클라이언트 0 B. 한국어에는 쓰지 않음 |
| 조판 | Vivliostyle | 배제 | AGPL-3.0, PDF용(PDF는 보류 범위) |
| 조판 | kuroshiro / kuromoji.js 신규 도입 | 배제 | `kuromojin` 정본과 중복. kuromoji.js는 2018년 이후 정지 |
| 조판 | 약물 보정 JS · YakuHanJP | 배제 / 미확인 | 클라이언트 JS 0 원칙. YakuHanJP 라이선스 미검증 |
| 글꼴 | Noto Serif KR / JP | **채택**(기존 재사용) | OFL, `palt/vpal/chws/vert` 완비. 이미 로드 중 |
| 글꼴 | Shippori Mincho(B1) 표지 1종 | 부분 채택(오너 결정) | OFL, `palt/vpal/vert` 보유. 굵기당 TTF 약 8 MB → 표지 서브셋 |
| 글꼴 | Zen Old Mincho · Dela Gothic One · Klee One · Gowun Batang | 부분 채택(대안) | `palt` 없음 또는 가나 없음 → 용도 한정 |
| 글꼴 | Hahmlet · Nanum Myeongjo · BIZ UD · Kaisei · Hina · Gothic A1 · Zen Kaku · Pretendard | 배제 | 한글 결자 / 기능 부족 / 기존과 중복 / Google Fonts 미등록 |
| 글꼴 | MaruBuri · RIDIBatang | **보류** | 공식 라이선스 미확인 → 착수 금지 |
| 린트 | 자체 vitest `EDIT-STD-*` (copyStandard 패턴) | **채택** | 재사용·결정성·의존성 0. 한국어 엔진 OSS 부재 |
| 린트 | prh 사전 형식 + specs 자기검증 | 부분 채택 | YAML 파서가 없으므로 JS로 둔다 |
| 린트 | preset-ja-technical-writing · preset-ai-writing 규칙 개념 | 부분 채택(아이디어) | 한국어 정규식으로 재구현. 버전별 검출 변동 경고 있음 |
| 린트 | textlint 본체 · MCP | 배제(보류) | 한국어에 무효. 일본어 인용 블록이 커지면 재검토 |
| 린트 | Vale · RedPen · alex/write-good · hanspell · Bareun · KatFishNet 탐지기 | 배제 | CJK 근거 없음 / 유지 정지 / 영어 전용(미확인) / 외부 서비스·약관 / 통계 탐지는 비권장 |
| 작문 | 本多 수식 순서·구문 쉼표 · 近藤 첫 세 줄·상투구 · 古賀 3단 공정 | **채택** | 사람 검수 + 사전 린트 + PR 산출물 |
| 작문 | 岸 생활사 3원칙 | **채택**(메타데이터로 강제) | 가짜 인터뷰 금지를 계약으로 |
| 작문 | 국립국어원 일본어 표기 | **채택**(사전) | 장음 미표기 등은 확인됨. 세부는 원문 대조 후 |
| AI | frontend-design 기본값 군집 점검 · 2패스 · 대담함 한 곳 | 부분 채택(개념) | 파일 이식은 `ui-conventions.md` 정본과 중복 |
| AI | doc-coauthoring Reader Testing | 부분 채택(개념) | 라이선스 미확인 |
| AI | k-skill / daleseo humanizer: 분류 · 보존 불변식 · 변경률 가드 · S1~S3 | 부분 채택(핵심 개념) | MIT이지만 copy-standard와 정본이 이중화될 우려. 레지스터도 다르다 |
| AI | blader/humanizer · Wikipedia AISIGNS | 부분 채택(개념) | 구조 우선, 표본 우선. AISIGNS는 CC BY-SA라 요약만 |
| AI | Anthropic 환각 지침 · Claude 4 산문 지시 원칙 | **채택**(규칙화) | 팩트 게이트 기준선. 커맨드 본문을 산문 위주로 쓴다 |
| AI | superpowers verification-before-completion | 부분 채택(개념) | 증거 없이 완료 주장 금지 |
| AI | 深津式 · ゴールシーク | 부분 채택(흡수) | 브리프 양식 · owner-gate에 한정한 역질문 |
| AI | skill-creator | 부분 채택(도구) | 커맨드를 스킬로 승격할 때 with/without 평가 |
| AI | docx/pdf/pptx/xlsx 스킬 · theme-factory · awesome 목록 · content-research-writer | 배제 | Proprietary / 토큰 체계와 무관 / 색인일 뿐 |

---

## 3. manabi 적용: 문체 · 판면 · 공정 · 계약

### 3.1 통합 편집 스타일 가이드 (안)

검사 등급은 세 가지다. **자동**은 결정적 vitest 규칙이다. **부분**은 메타데이터 강제나 휴리스틱으로 일부만 잡는다. **사람**은 검수 체크리스트로 본다. 임계값 숫자는 일본어 도구 기본값을 옮겨 온 **제안치**이므로, 첫 2개 호 원고의 분포를 잰 뒤 확정한다.

| # | 규칙 | 검사 | 근거 |
|---|---|---|---|
| 1 | 각 호의 리드에 **이 삶의 단계가 한국 독자의 삶과도 겹치는 보편적 가치**를 말하는 문장을 1개 둔다. 일본의 특이함을 팔지 않는다 | 사람 | 岩崎 ([ブレーン](https://mag.sendenkaigi.com/brain/201312/creative-direction/001088.php)) |
| 2 | 리드와 칼럼에 **왜 좋은가를 말하는 이유 문장**을 1개 이상 둔다. '좋다/멋지다/감성적'으로 끝나면 반려한다 | 부분(형용사 단독 종결 사전) | 谷山 ([AdverTimes](https://www.advertimes.com/20240418/article456833/)) |
| 3 | 표지 문구와 특집 제목은 **후보를 20개 이상** 쓰고 목록 파일로 남긴다. 「그러고 보니」 반응(이미 앎/모름/그러고 보니)을 독자군별로 표시한다 | 부분(후보 파일 존재) | 谷山 ([hanmoto](https://www.hanmoto.com/bd/isbn/9784883351794); [countand1](https://www.countand1.com/2024/09/how-to-write-great-advertising-copy-new-edition-book-review.html)) |
| 4 | 제목·표지 후보는 기존 일본 잡지 특집명이나 유명 카피와 **기시감 검색**을 거친다. 비슷하면 버린다 | 사람(검색 기록) | 児島 오리지널리티 ([AdverTimes](https://www.advertimes.com/?p=487241)), IP ⑵ |
| 5 | 8개 호 제목은 **manabi 고유의 한 문형**을 따른다(예: 「배우다 — 일본에서 처음 교복을 입는 날」 계열). BRUTUS 문형은 차용하지 않는다 | 자동(호 목록 정규식) | BRUTUS 흐름 원리 ([福岡移住計画](https://fukuoka-ijyu.jp/2018/07/19/0718/)) |
| 6 | 표지 시안마다 두 가지를 체크한다. '교과서·여행 가이드·여성지처럼 보이지 않는가', '부분이 전체 주제를 대표하는가' | 사람 | 西田 ([nippon.com](https://www.nippon.com/ja/column/g00521/)) |
| 7 | 각 호 기획서에 **핵심 독자 1군**을 명시한다(기본 a: 초급 성인 여행자). 표지와 리드는 그 1군에 맞춘다 | 자동(frontmatter `coreReader`) | 西田 도넛 독자층 ([exp-d](https://exp-d.com/interview/8109/)) |
| 8 | **첫 장면**은 첫 3문장 안에 눈·귀·손으로 확인되는 구체물 3개 이상을 담는다. 추상명사(문화·정서·정신)로 시작하지 않는다 | 부분(첫 문장 추상명사 사전) | 花森 ③, 近藤 첫 세 줄 ([Newsweek](https://www.newsweekjapan.jp/articles/-/42774)), 沢木 장면 축적 ([文春](https://books.bunshun.jp/articles/-/2040)) |
| 9 | 큰 주제의 칼럼은 **사물이나 순간 하나**에서 시작한다(명함, 퇴근 전철) | 사람 | 秋山 ([AdverTimes](https://www.advertimes.com/20250228/article490896/)) |
| 10 | 리드 금지형: "~에 대해 알아보자", "여러분은 ~을 아시나요?", "~라는 말이 있다" | **자동** | 近藤 상투구 금지 ([東洋経済](https://toyokeizai.net/articles/-/401849?display=b)) |
| 11 | 상투구·과장어 금지 사전: "그야말로", "말 그대로", "힐링", "최고의", "완벽한", "반드시", "모든 일본인이" | **자동** | 近藤, 谷山 과장 금지 |
| 12 | 문장 길이 상한은 본문 70자, 리드 40자. 표지 한국어 문구는 한 줄 15자 이내 | **자동** | textlint sentence-length 기본 100자 사례 ([ServerWorks](https://blog.serverworks.co.jp/tried-using-textlint)), 花森 ④ |
| 13 | 한 문장에 쉼표는 최대 2개. 쉼표는 구문 경계에만 찍는다 | 자동(개수) / 사람(위치) | max-ten ([zenn](https://zenn.dev/takemikami/articles/20171214-textlintrails)), 本多 ([跡見](https://atomi.repo.nii.ac.jp/record/1336/files/atomi_com8_02.pdf)) |
| 14 | 수식어는 긴 것 먼저, 큰 상황에서 작은 상황으로 | 사람 | 本多 ([阪大](https://www.library.osaka-u.ac.jp/doc/LS_20201217_japanese_writing.pdf)) |
| 15 | '의' 3연쇄를 금지하고, 같은 조사를 한 문장에서 반복하지 않는다 | **자동**('의' 연쇄) | no-doubled-joshi |
| 16 | 약한 표현 금지: "~것 같다", "~라고 할 수 있다", "~지 않을까", "아마도". 인용 발화 안은 제외 | **자동** | ja-no-weak-phrase ([npm](https://npmjs.org/package/textlint-rule-ja-no-weak-phrase)) |
| 17 | 장황 표현 금지: "~하는 것이 가능하다", "~에 있어서", "~을 진행하다", "~적인 부분" | **자동** | ja-no-redundant-expression |
| 18 | AI 구조 신호를 잡는다. **S1(1회라도 제거)**: 결산 피벗 남발, "시사하는 바가 크다", 의인화 추상 주어, "~할 때다" 결말, 과장된 의의(이정표·새 지평), 출처 없는 권위("전문가들은"), 볼드 라벨 목록, 문장 중간 콜론. **S2(3회 이상이면 제거)**: "X에서 Y로", 강제 3박자, 번역투 조사("~을 통해·~에 대해"). 판정은 단어 금지가 아니라 빈도·조합으로 한다 | **자동**(S1 0건, S2 카운트) | k-skill ([GitHub](https://github.com/nomadamas/k-skill)), preset-ai-writing ([GitHub](https://github.com/textlint-ja/textlint-rule-preset-ai-writing)), AISIGNS ([The Decoder](https://the-decoder.com/heres-how-to-spot-ai-writing-according-to-wikipedia-editors/)) |
| 19 | 꼭지별 문체는 장르 매트릭스로 고정한다(§3.1.1). 한 꼭지 안에서 섞지 않는다. 인용은 제외 | **자동**(종결어미) | no-mix-dearu-desumasu, daleseo style-guide 장르 매트릭스 |
| 20 | 장면 서술은 현재형이 기본이다. 장면 문단의 과거형 종결은 30% 이하 | 부분 | 近藤 문체·리듬 |
| 21 | 구어 군말 금지: "근데", "뭔가", "약간". 말하듯 쓰지 말고 생각을 글로 번역한다 | 부분(사전) | 古賀 ([東洋経済](https://toyokeizai.net/articles/-/101182?display=b)), 井上 「話すように書くな」 ([新潮社](https://www.shinchosha.co.jp/book/116819/)) |
| 22 | **귀로 듣고 알 수 있는 말**로 쓴다. 어려운 한자어와 영어 외래어는 쉬운 말로 바꾼다. 낭독 검수 1회를 거쳐 막힌 곳을 표시한다 | 사람 | 花森 ([文春 BOOKS](https://books.bunshun.jp/articles/-/1555)), 岩崎 소리 내어 읽기 |
| 23 | 설교·설득 종결("~해야 한다", "~하자")을 금지한다. 칼럼 마지막 문장은 교훈 대신 장면·질문·여운으로 닫는다 | 자동(종결 사전) / 사람(유형) | 花森 ⑤⑦⑧ |
| 24 | 표지의 큰 일본어 단어는 리드·본문·칩·해 보기에 걸쳐 **3회 이상** 다시 나온다 | **자동** | 花森 ⑥ |
| 25 | 일본어 키워드는 첫 등장 때 `한글(原語)` 병기(예: 부카쓰(部活)), 이후에는 한글만 쓴다. 괄호 안 원어는 8자 이내 | **자동** | manabi 자체 제안(외부 선례 미확인), 花森 한자 지적 |
| 26 | 일본어 고유명사의 한글 표기는 사전으로 검사한다. 장음 미표기, 쟈·죠 금지, 된소리 금지, つ→쓰. 오표기 예: 토쿄·도오쿄·부카츠·홋까이도. 실존 상호는 그 회사의 한국 공식 표기를 우선한다. **예외(오너 결정 2026-10-14): 호칭 접미사 さん·ちゃん은 관용 표기 상·쨩** | **자동**(prh식, specs 자기검증) | 국립국어원 ([장음](https://www.korean.go.kr/nkview/nknews/200504/81_4.html); [쟈죠](https://www.korean.go.kr/nkview/nknews/200108/37_5.html)). 촉음·어두 세부는 원문 대조 전 잠정 |
| 27 | 수치·날짜·제도명·고유 사실이 든 문장에는 **출처 id**가 필수다. 출처에는 URL과 확인 시각(KST)이 있어야 한다 | **자동** | Anthropic 환각 지침 ([docs](https://docs.anthropic.com/en/docs/test-and-evaluate/strengthen-guardrails/reduce-hallucinations)) |
| 28 | 인물 발화는 **실제 취재 기록**(청자·일시·장소)이 있을 때만 싣는다. 합성 인물("가상의 ○○ 씨")은 금지한다. 「첫 장면」이 재구성이면 `reconstructed: true`와 화면 표기 「재구성 장면」이 필수다 | **자동** | 岸 ([筑摩](https://chikumashobo.co.jp/special/tokyo_project/)), 제품 원칙 |
| 29 | 발화 원문과 편집자 해설은 시각적으로 분리한다. 발화 안에 해설을 섞지 않는다 | 부분(마크업) | 岸 해설 없이 나열 ([現代ビジネス](https://gendai.media/articles/-/88733)) |
| 30 | 「モノ・コト・ヒト」와 「해 보기」는 필자가 직접 경험했거나 1차 출처가 있는 것만 다룬다. 장점과 함께 **한계 1줄**을 쓰고, 협찬·광고 문구는 금지한다. 「해 보기」는 비용·자격 없이 할 수 있는 일상 행동으로, 절차 + 해 본 결과 + 주의 1줄 형식으로 쓴다 | 부분(필드 존재) | d design travel ([D&DEPARTMENT](https://d-department.com/item/DD_TEXT_REPORT_6872.html)), 商品テスト ([artagenda](https://www.artagenda.jp/exhibition/detail/1050)) |
| 31 | 이 글만의 관찰 1줄을 기획서에 적는다. 남이 이미 쓴 것을 요약하지 않는다 | 사람(기획 게이트) | 田中 ([文春](https://bunshun.jp/articles/-/14205)) |
| 32 | 수상 카피와 저작물 원문(가사·소설·기사)은 0건이어야 한다. 제목·인물명 언급만 허용한다 | **자동**(식별 사전 대조) | IP ⑵, 이용 조건 미확인 |

#### 3.1.1 문체: 해라체와 해요체 사이의 결정안

리포의 `docs/design/copy-standard.md`는 UX 문구를 **해요체**로 정해 두었다. 장문 피처에 그대로 적용되는지는 정해져 있지 않다(오너 결정 대기). 권고안은 daleseo style-guide의 장르 매트릭스 발상을 빌린 **꼭지별 고정 레지스터**다.

| 꼭지 | 권고 레지스터 | 이유 |
|---|---|---|
| 첫 장면, 숫자로 보기, 짧은 꼭지, 한국과 나란히 | **해라체 평서** | 장면 축적과 현재형 서술에 맞다. 잡지 피처의 관습이다 |
| 편집자의 말 | 해요체, 1인칭 편지 | 岡本 스테이트먼트(편지처럼), 花森 ⑩ 한 사람의 독자 |
| 살게 된다면, 해 보기, 이야기해 봐요 | 해요체 | 독자에게 하는 행동 안내라 앱 UX 문구 정본과 이어진다 |
| 칩, 캡션, 출처 노트 | 체언 종지 | 판면 요소 |

frontmatter에 꼭지별 `register`를 선언하고, 규칙 19가 그 선언과 종결어미가 일치하는지 검사한다. 오너가 단일 해라체나 단일 해요체를 고르면 표의 값만 바꾸면 된다.

### 3.2 시각 체계 결정

**글꼴**

- 한국어 본문과 헤딩은 Noto Serif KR을 그대로 쓴다. 400 굵기 추가만 검토한다.
- 일본어 인라인, 인용, 칩은 Noto Serif JP를 쓴다. grammar 레이아웃의 `subsets:['latin'], preload:false` 패턴을 따른다.
- 이렇게 하면 새 의존성은 0이다.
- 표지의 세로 큰 단어용 디스플레이 명조는 **Shippori Mincho(B1) 1종 1굵기**만 오너 결정으로 올린다. 고정 문구라 빌드 시 서브셋 woff2(`next/font/local`)로 수 KB까지 줄일 수 있다. 정확한 KB는 빌드 실측이 필요하다.
- 큰 숫자 페이지는 기존 라틴 글꼴의 tabular 숫자를 쓴다.
- 폰트 스택은 `:lang(ja){font-family: var(--font-serif-jp), …}`처럼 **lang 기반**으로 둔다. 일본어 요소에는 반드시 `lang="ja"`를 단다.

**세로쓰기 한도**

- 세로쓰기는 세 곳에만 쓴다.
  - 표지 단어: 1–4자
  - 扉 소제목
  - 1문장 인용: 20자 이하
- 한국어 본문, 캡션, 표는 항상 가로로 짠다(320px에서 가로 스크롤을 피하기 위한 추론).
- 세로 안의 숫자는 **2자리 이하만** `<span>` + `text-combine-upright:all`로 처리한다. 3자리 이상은 한자 숫자로 쓰거나 가로로 분리한다. `digits` 값은 쓰지 않는다.
- 세로 디스플레이에만 `font-feature-settings:'vpal'`을 켠다. 가로 헤딩에만 `'palt'`를 켠다. 본문에는 쓰지 않는다.

**루비와 접근성**

- `<ruby lang="ja">`를 쓴다.
- 핵심 단어는 루비에 더해 **접근 가능한 읽기 텍스트**를 따로 둔다. 키워드 칩의 별도 읽기 필드나 시각적으로 숨긴 "읽기: まなぶ"가 그 예다.
- `aria-label`로 기저 문자를 덮어쓰지 않는다.
- 세로 표지 단어는 `aria-hidden="true"`로 처리하고, 같은 단어를 가로 `h1`에 둔다. 낭독이 중복되거나 조각나는 것을 막기 위해서다.
- NVDA, JAWS, Narrator 실기기 확인은 미완료 항목으로 남긴다.

**줄 나눔**

- 한국어는 `:lang(ko){word-break:keep-all; line-break:strict}`로 짠다.
- 헤딩에는 `text-wrap:balance`를, 본문에는 `pretty`를 건다. Firefox에서는 `pretty`가 무시되지만 해가 없다.
- 일본어 헤딩과 인용은 **서버 컴포넌트에서 BudouX `loadDefaultJapaneseParser().parse()`** 결과를 `[seg, <wbr/>, seg…]`로 렌더한다. 부모에는 `word-break:keep-all; overflow-wrap:anywhere`를 준다.
- `translateHTMLString`과 Web Components(`<budoux-ja>`)는 쓰지 않는다. 각각 `dangerouslySetInnerHTML`·linkedom 의존 문제와 ZWSP 중복 경고가 있다.
- 일본어 문단에만 `text-autospace:normal`을 명시한다.

**색**

- 색은 `docs/ui-conventions.md` §1의 **토큰으로만** 쓴다.
- 편집 디자인 노트가 적은 `#fffdf9`/`#322e30`은 리포의 v2 셸 값(종이 F6F4EE, 글자 252721, 로즈 994A5A, COLOR-V2-UNIFY-001)과 다르다. 그러므로 **hex를 새로 들이지 않는다.**
- 각 호의 변수는 보조색 1개다. 숫자, 장 번호, 괘선에만 쓰고 면적은 10% 안팎으로 둔다(수치는 추론).
- 보조색은 라이트·다크 두 테마에서 AA를 통과해야 한다.
- frontend-design의 기본값 군집(크림+세리프+괘선 다단)을 쓰려면 근거를 한 줄 적어야 한다. 이 프로젝트의 근거는 "종이 잡지 문법을 웹 학습지로 옮기는 주제에서 도출"이다. 그리고 **대담함은 표지의 세로 단어 한 곳에만** 둔다. 섹션마다 fade-up을 넣거나, 대문자 아이브로, 'A · B · C' 중점 메타를 쓰지 않는다. 장 번호 01–08은 실제 순서이므로 허용한다.

**柱와 ノンブル**

- 상단 sticky 한 줄에 「일본, 사람의 일생 · 제2호 배우다 · 02 숫자로 보기」를 표시한다.
- 꼭지 첫머리에 2자리 장 번호를 단다.
- JLReq 용어 체계를 차용한 것이며, 조항 원문은 미열람이다.

**PD 이미지 (오너 결정 대기)**

- 허용 출처는 셋뿐이다.
  - Met CC0 ([Met](https://www.metmuseum.org/hubs/open-access))
  - ColBase: 출처 표기와 가공 표기 필수, CC BY 호환 ([ColBase 規約](https://colbase.nich.go.jp/pages/term))
  - NDL 「インターネット公開(保護期間満了)」만 ([NDL](https://ndl.go.jp/jp/use/reproduction/index.html))
- 위 조건은 모두 검색 요약 기준이므로 채택 전에 원문을 재확인한다.
- 호당 0–2장. 장식이 아니라 **자료**로 쓴다.
- **로고·상표가 보이는 근대 광고·포스터는 배제**한다(IP ⑴).
- 캡션 형식은 하나로 고정한다(출처 표기는 Met을 포함해 전부 통일).

```
작품명 · 작가 · 연도 — 이 그림이 보여 주는 것 한 문장
출처: ColBase (https://colbase.nich.go.jp/…) · 가공: 일부 잘라냄
```

### 3.3 제작 공정: `.claude/commands/magazine-edit.md` 스케치

기존 `/korean-copy`(UX 마이크로카피, 해요체 3안)와는 범위가 다르므로 공존할 수 있다. **금지 표현 목록은 코드 한 곳(`src/lib/editorialRules.js` 가칭)에만 둔다.** 커맨드와 테스트가 같은 목록을 읽게 해야 정본이 갈리지 않는다. 커맨드 본문은 산문 위주로 짧게 쓴다. 상세 목록, 표본, 장르 매트릭스는 `docs/magazine/`(정본 문체 가이드 + `style-samples/`)로 분리한다(progressive disclosure, 본문 500줄 이내).

| 단계 | 하는 일 | 차용 근거 |
|---|---|---|
| 0 브리프 | 아래 항목을 채운다(필드 구조는 深津式) | 深津式 |
| 1 역질문 | **owner-gate, 사실 근거 부족, 레지스터 미정**일 때만 묻는다. 나머지는 담당자가 구체화하고 기대 예시를 먼저 기록한다(AGENTS.md 공통 품질 실행 원칙) | ゴールシーク(제한적) |
| 2 취재 | 사실 표 `sources[]`, 취재 기록 `interviews[]`, 이 글만의 관찰 1줄. 직접 인용을 먼저 뽑는다 | 古賀 취재, Anthropic 지침 |
| 3 설계(1패스) | 아래 항목을 거친 뒤 수정 사유를 기록한다 | 谷山, 児島, frontend-design, 服部 |
| 4 초안 | `docs/magazine/style-samples/`의 **오너 승인 표본 2–3편을 먼저 읽고** 문장 길이, 종결, 문두를 맞춘다. 표본이 금지 목록보다 우선한다 | humanizer 표본 우선 |
| 5 퇴고 패스 | 집필과 분리된 별도 패스로 S1을 0건으로, S2를 카운트한다. 아래 보존 불변식과 변경률 가드를 지킨다 | 古賀, k-skill, daleseo |
| 6 팩트 게이트 | 주장마다 출처의 직접 인용과 확인 시각 KST를 단다. 인용을 못 찾으면 삭제하거나 단정을 완화한다. '미확인'을 허용한다 | Anthropic, verification-before-completion |
| 7 낭독 + 독자 시험 | 소리 내어 읽고 막힌 곳을 표시한다. 문맥 없는 서브에이전트 4명(독자군 a/c/b/d 페르소나)에게 기사만 주고 질문 5–10개에 답하게 한 뒤, 오독이 난 단락을 고친다 | 岩崎, 花森, doc-coauthoring |
| 8 판면 | 텍스트 목업을 먼저 낸다(CLAUDE.md). 토큰 플랜과 ASCII 와이어프레임에 기본값 군집 자가 점검을 붙인다 | frontend-design 2패스 |
| 9 계약 | `npm test`(Node 24)에서 §3.4 테스트가 green이어야 한다 | 리포 규약 |
| 10 출력 | 아래 6종 | discernment-nudge |

0단계 브리프에 채우는 항목은 다음과 같다.

- 호와 꼭지 유형
- 핵심 독자 1군
- 꼭지별 레지스터
- 표지 일본어 단어
- 필수 사실
- 금지 영역(IP ⑴~⑷, 중화권 정치 배제)
- 표본 기사 경로

3단계 설계에서 거치는 항목은 다음과 같다.

- 꼭지 각도 메모와 첫 장면에 놓을 가장 특징적인 장면
- 제목과 표지 후보 20개, 「그러고 보니」 표시, 기시감 검색
- "비슷한 주제로 누가 써도 같은 데 도달하는가?"라는 자가 점검
- 화면 구성을 이 단계에서 함께 정한다

5단계의 보존 불변식과 변경률 가드는 다음과 같다.

- 고유명사, 수치, 날짜, 직접 인용, 일본어 원문, 루비는 한 글자라도 바뀌면 그 편집을 롤백한다.
- 변경률이 30%를 넘으면 경고하고, 50%를 넘으면 중단하고 보고한다.

10단계에서 내놓는 6종은 다음과 같다.

1. 최종 원고
2. 팩트 표
3. 잔존 신호 목록
4. 변경률
5. 독자 시험 요약
6. **오너가 확인할 사실 2–3개**

커맨드가 안정되면 skill-creator의 with/without 비교 평가를 거쳐 스킬로 승격하는 경로를 열어 둔다.

### 3.4 추가할 계약 테스트

대상 경로는 매거진 콘텐츠가 들어갈 `src/content/studies/japan/magazine/**`(가칭)이다. 현재 `copyStandard.test.js`는 `src/content`를 검사 범위 밖으로 두고 있으므로 **새 테스트 파일이 필요하다.** 형식은 COPY-STD-001과 같다. RULES 배열, 주석 제거, `{파일, 고유 조각, 이유}` ALLOWLIST로 구성하고, 위반 0에서 시작한다.

| ID (가칭) | 위치 | 고정하는 것 |
|---|---|---|
| EDIT-STD-001 | `src/lib/__tests__/editorialStandard.test.js` | 규칙 10·11·15·16·17·18(S1 0건, S2 임계)·21·23 사전. 문장 길이(12)와 쉼표 수(13). **「」·"" 인용 내부는 제외** |
| EDIT-STD-002 | 같은 파일 | prh식 표기 사전 `{expected, pattern, specs:[{from,to}]}`. 테스트가 먼저 specs로 **사전 자체를 검증**한 뒤 본문에 적용한다(규칙 26). 원어 병기 첫 1회(25) |
| EDIT-STD-003 | 같은 파일 | 꼭지 `register` 선언 ↔ 종결어미 일치(19). 장면 문단 과거형 비율(20) |
| MAG-FACT-001 | `src/content/studies/__tests__/magazineFacts.test.js` | 숫자·연도가 든 문장 ↔ `sources[]` id 대응. 각 source에 `url`과 `checkedAt`(KST, 'Z' 금지) 필수(27) |
| MAG-PEOPLE-001 | 같은 파일 | 인용 블록 ↔ `interviews[]`(청자·일시·장소) 대응. "가상의/어느 ○○ 씨" 패턴 0건. `reconstructed:true`이면 화면 라벨 「재구성 장면」 존재(28) |
| MAG-ANATOMY-001 | `magazineAnatomy.test.js` | 호마다 꼭지 순서 고정(표지 → 편집자의 말 → 01 … 08 → 이 호의 일본어 → 더 읽고 보기 → 출처·검증 노트). 표지 단어 3회 이상 반복(24). `coreReader` 필드(7). 키워드 칩은 **기존 단어 저장 경로로만 링크**(새 저장 엔드포인트 0) |
| MAG-TYPE-001 | `uiConventions.test.js` 확장 | `vertical-rl`은 허용 컴포넌트에서만, 표지 4자·인용 20자 이하. `text-combine-upright`는 2자리 이하만, `digits` 0건. `<ruby>`에 `lang="ja"`. 세로 표지 `aria-hidden` + 가로 `h1` 중복. 호별 보조색 토큰의 AA 대비(라이트·다크) |
| MAG-BUDOUX-001 | 같은 확장 | `budoux` import는 `'use client'`가 없는 서버 모듈에서만 허용. `translateHTMLString`·`budoux-ja` 사용 0 |
| MAG-IP-001 | `ipPolicy.test.js` 확장 | 수상 카피 식별 사전(노트에 나온 대표 문구) 0건(32). PD 이미지 항목은 `source ∈ {met, colbase, ndl-expired}`, 캡션 필드(작품·작가·연도·설명·출처 URL·가공) 필수, `showsLogo:false`. 실존 잡지명을 꼭지명·제호로 쓴 경우 0건 |

---

## 4. 따라 하지 말 것

시각 정체성부터 정리한다.

- 堀内誠一가 만든 anan, POPEYE, BRUTUS 제호의 글자 형태와 배치, 로고 설계도류 레터링을 닮게 그리지 않는다 ([京都新聞](https://www.kyoto-np.co.jp/articles/-/706178); [BRUTUS.jp](https://brutus.jp/en/post-417493/)). manabi 제호는 기성 폰트 조합으로 직접 설계한다.
- 花森安治의 손글씨 레터링과 유화 표지 양식, 仲條正義의 『花椿』 그래픽 양식, 原研哉의 無印良品 시각 톤을 따르지 않는다.
- d design travel과 『매거진 B』의 판형, 표지 구성, 제호 방식을 닮게 옮기지 않는다.
- 실존 잡지명을 꼭지명이나 "○○ 스타일"로 쓰지 않는다.
- 로고가 보이는 PD 이미지를 쓰지 않는다.

이상은 모두 CLAUDE.md IP ⑴(시각 재현 금지)에 해당한다.

텍스트에서 피할 것은 다음과 같다.

- TCC, 宣伝会議賞, ACC 수상 카피 원문을 게재하거나 말뭉치로 만들지 않는다. 이 보고서에 대표작 이름이 나오는 것은 식별용 인용일 뿐이다.
- 정규영 책 같은 '원문 + 해설' 형식을 쓰지 않는다.
- 아직 보호 중인 작가의 문장을 인용하지 않는다. 三島(1970 사망), 花森(1978) 등이 해당하며, 이는 일본 저작권법 개정 이력에서 추론한 것이다. 谷崎 『文章読本』도 青空文庫에서는 아직 "作業中"이라 공개본이 없다 ([青空文庫](https://www.aozora.gr.jp/index_pages/person1383.html)). 기법 요약과 서지만 쓴다.
- Wikipedia AISIGNS 문장을 복제하지 않는다(CC BY-SA).
- 프롬프트 원문을 전재하지 않는다.
- **본문을 확인하지 못한 문구를 인용으로 쓰지 않는다.** 糸井의 「ロゴをデザインするようにコピーを書く」는 소제목만 확인했다. 岩崎 추도 기사 「うまいこと言え。」는 긍정인지 반어인지 맥락이 미확인이다.
- 「〇〇の、答え。」 같은 특정 잡지의 문형을 그대로 쓰지 않는다.

공정과 도구에서 피할 것은 다음과 같다.

- 합성 인물과 가짜 인터뷰를 만들지 않는다. 출처 없는 "전문가들은"도 쓰지 않는다.
- docx, pdf, pptx, xlsx 스킬 파일을 이식하지 않는다(Proprietary).
- humanizer와 style-guide 파일을 통째로 들여와 copy-standard와 정본을 이중화하지 않는다.
- 통계 AI 탐지 점수로 판정하지 않는다.
- hanspell 같은 외부 맞춤법 서비스를 CI에 넣지 않는다.
- AGPL인 Vivliostyle을 서버 런타임에 쓰지 않는다.
- 라이선스가 미확인인 MaruBuri와 RIDIBatang을 도입하지 않는다.

---

## 5. 미확인 항목과 오너 결정

**조사 환경의 한계**

이그레스 프록시가 1차 출처 다수를 막았다(CONNECT 403 또는 DNS 실패). 막힌 곳은 advertimes.com, tcc.gr.jp, sendenkaigi.com, hanmoto.com, bunshun.jp, ndlsearch, w3.org, fonts.google.com, npm 레지스트리, kornorms.korean.go.kr, colbase, metmuseum, `gh api` 등이다. 카피·잡지·작법서 내용은 검색엔진 요약에 기댄다. 글꼴·BCD·BudouX·스킬 라이선스는 GitHub clone 실측으로 보완했다. 법적 효력이 있는 조건(PD 이용 규약, 수상작 권리)과 표기 규범(외래어 표기법 표4·제3장 제7절)은 **채택 전에 원문을 재확인해야 한다.**

**미확인으로 남은 사실**

카피·잡지:
- 花森 10훈의 원문 문구와 출전(『私の岩波物語』설)
- 松浦弥太郎의 "지금도 지킨다" 발언 원출처
- 岩崎 "찾는 것"·"소리 내어 읽기"의 개별 원출처
- 谷山 3분법의 원문 표현
- コピラ와 각 상의 이용 약관
- 『コピーのぜんぶ』·川上徹也 책·谷山 『相談室』 서지
- BRUTUS 「〇〇好きのための」 정형
- 일본 잡지 캡션 작법의 1차 자료

디자인:
- ku:nel 창간 AD(有山達也 여부)
- 仲條正義 『花椿』 재임 시작 연도
- 鈴木成一·名久井直子·平野甲賀의 발언
- TRANSIT·&Premium·Casa BRUTUS 지면 수치
- JLReq 柱·ノンブル 조항 원문과 TR 최신 발행일

조판·글꼴:
- `next/font/google`의 `text` 옵션 지원 여부
- Google Fonts woff2 조각이 `palt/vert/chws`를 보존하는지
- 기사 1편당 실제 전송 KB
- NVDA·JAWS·Narrator의 루비 낭독
- 세로쓰기 읽기 순서에 관한 공식 지침
- YakuHanJP 라이선스

작문·린트:
- 本多 「テンの二大原則」 조문
- 古賀 퇴고 체크리스트 세부
- 작법서 한국어판 존재 여부(『문장 수업 안내』가 古賀 번역서인지 포함)
- textlint와 프리셋의 공식 최신 버전(제3자 미러 값만 확인)
- 외래어 표기 촉음·어두 규칙 원문

AI:
- doc-coauthoring 라이선스
- 각 저장소 스타 수
- 深津式 원문
- PASONA/QUEST 단계 정의
- 문체 표본 조건화의 정량 효과

임계값:
- 70자/40자/쉼표 2개/과거형 30%/보조색 10%는 제안치다. 원고 분포를 재서 확정한다.

**오너 결정 대기**

1. **문체**: 단일 해라체, 단일 해요체, §3.1.1의 꼭지별 매트릭스 중 하나를 고른다. 권고는 매트릭스다.
2. **명조 글꼴**: Noto Serif KR/JP는 이미 로드 중이다. 표지용 Shippori Mincho(B1) 1종 1굵기를 서브셋으로 추가할지만 정하면 된다.
3. **PD 아카이브 이미지**: 쓸지 말지를 정한다. 쓴다면 Met/ColBase/NDL 만료분, 호당 0–2장, 로고 배제, §3.2 캡션 형식을 따른다.
4. **매거진 이름**: 규칙 3·4(후보 20개, 기시감 검색)를 거친 후보 목록을 받아 결정한다.
5. **표본 기사**: 오너 승인 표본 2–3편이 없으면 `/magazine-edit` 4단계가 작동하지 않는다. 창간사와 1호 「첫 장면」을 첫 표본 후보로 권한다.

---

## 결론

이번 조사로 바뀐 이해는 두 가지다.

첫째, 일본 잡지의 강점은 판면보다 **편집부의 금지 목록과 취재 윤리**에 있다. 「なんかいいよね」 금지, 귀로 들어 알 수 없는 말 금지, 직접 겪은 곳만 추천, 결점도 기록, 해설 없이 화자의 말을 나열하는 것이 그 예다. 이것들은 manabi의 "원칙은 계약 테스트로 심는다" 규약과 놀랄 만큼 잘 맞는다. 문체의 절반 가까이를 결정적 vitest 규칙으로 고정할 수 있고, 나머지 절반은 낭독과 독자 시험이라는 싼 사람 검수로 남는다.

둘째, "잡지처럼 보이게" 만드는 일은 지금 AI가 가장 쉽게 도달하는 기본값이다. 크림, 세리프, 괘선, 다단이 바로 그것이다. 그래서 manabi 매거진의 차별점은 장식을 더하는 데서 나오지 않는다. **세로로 선 일본어 한 단어**에 대담함을 모으고, 그 단어가 본문·칩·FSRS 복습으로 되돌아오는 학습 순환을 만들 때 나온다. 다음 단계는 표본 기사 1편과 `EDIT-STD-001`·`MAG-FACT-001` 두 계약을 먼저 세우는 것이다. 이 셋이 있어야 나머지 여덟 호가 같은 목소리로 나온다.
