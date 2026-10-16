# 일본 문장 작법(에세이·르포·매거진 피처) + 한국어 가교 + 문장 린트 OSS 조사

조사일 2026-10-14(KST). 대상: 「일본, 사람의 일생」 한국어 웹매거진의 편집 문장 가이드와 vitest 계약 테스트 후보.

**조사 환경 한계(먼저 밝힘)**: 이 세션에서 WebFetch가 github.com·npmjs.com·vale.sh·kornorms.korean.go.kr·ko.wikisource.org의 DNS를 풀지 못했고, `gh api`는 세션 권한 밖이라 403, npm registry도 DNS 실패였다. 그래서 도구 버전·릴리스일은 **검색 스니펫과 제3자 미러(depscope·jsdocs·releasealert)** 기준이다. 원문을 열어 확인하지 못한 항목은 "미확인"으로 표시했다. 책 내용도 출판사 페이지·서평·도서관 자료의 요약에 근거했다. 원문 인용은 하지 않았다.

---

## (A-1) 일본의 대표 문장 작법서: 서지와 구체 기법

### Takeaway
실무에 바로 옮길 수 있는 기법은 세 갈래로 모인다. ⑴ 本多勝一의 **수식어 순서·쉼표 원칙**(문장 구조 차원) ⑵ 近藤康太郎의 **"첫 세 줄" 리드와 상투구 금지**(리드·어휘 차원) ⑶ 古賀史健의 **취재→집필→퇴고 3단 분리와 "말이 아니라 글로 번역하라"**(공정 차원). 谷崎潤一郎『文章読本』은 일본에서 저작권이 끝났지만, 青空文庫에서는 아직 "作業中"(미공개)이다.

### Cited Findings
**本多勝一『日本語の作文技術』**
- 목차에 「修飾する側とされる側」「修飾の順序」「句読点のうちかた」가 독립 장으로 있다. 쉼표는 「テンの統辞論」「テンの二大原則」으로 다룬다. 현행판은 朝日文庫 新版(ISBN 978-4-02-261845-0)이다. — [scrapbox 書誌](https://scrapbox.io/silloi-books/%E6%97%A5%E6%9C%AC%E8%AA%9E%E3%81%AE%E4%BD%9C%E6%96%87%E6%8A%80%E8%A1%93); [紀伊國屋 朝日文庫 新版](https://www.kinokuniya.co.jp/f/dsg-01-9784022618450)
- 수식어 순서의 요점(대학도서관 강의자료의 정리): ① 긴 수식어는 앞에, 짧은 수식어는 뒤에 ② 큰 상황에서 작은 상황으로 ③ 친화도(어울림)의 강약에 따라 배열을 바꾼다. — [大阪大学附属図書館 講習資料 PDF](https://www.library.osaka-u.ac.jp/doc/LS_20201217_japanese_writing.pdf) (검색 요약 기준. 본문 fetch는 실패)
- 쉼표론의 핵심은 「構文上のテン」을 가장 중시하고, 구문상 중요한 쉼표의 역할을 침해하지 않는 것이다. — [村越行雄 논문, 跡見学園 리포지터리](https://atomi.repo.nii.ac.jp/record/1336/files/atomi_com8_02.pdf)
- 서평은 수식 순서 설명을 특히 높이 평가한다. 같은 내용의 두 문장을 놓고 "어느 쪽이 왜 읽기 쉬운가"를 묻는 방식이라고 소개한다. — [東洋経済オンライン 書評](https://toyokeizai.net/articles/-/564287?display=b)

**古賀史健**
- 『取材・執筆・推敲 書く人の教科書』: ダイヤモンド社, 2021-04-06. A5판 480쪽, ISBN 978-4-478-11274-8. — [版元ドットコム](https://www.hanmoto.com/bd/isbn/9784478112748)
- 같은 책은 전 10장, 약 21만 자로 구성됐다. 편집자 柿内芳文와 나눈 대담에서 "書く人の教科書", 즉 결정판을 지향했다고 말한다. — [diamond.jp 対談](https://diamond.jp/articles/-/267324)
- 『20歳の自分に受けさせたい文章講義』: 星海社新書, 2012-01. ISBN 978-4-06-138510-8, 발매는 講談社. 출발점은 "말하기와 쓰기는 전혀 다른 행위"라는 전제다. — [版元ドットコム](https://www.hanmoto.com/bd/isbn/9784061385108); [NDL Search](https://ndlsearch.ndl.go.jp/en/books/R100000038-I3950426); [東洋経済](https://toyokeizai.net/articles/-/101182?display=b)
- 한국어판 후보: 왓챠피디아의 『문장 수업 안내 — 쓰려고 하지 말고 번역하라』 목차에 "'뱅글뱅글' 돌아다니는 생각을 말로 번역하라", "문장은 리듬으로 정해진다"가 있다. 이는 『20歳…』의 가이던스(書こうとするな、翻訳せよ)·제1강(リズム)과 대응한다. 다만 해당 페이지에 저자·출판사가 표시돼 있지 않아 **동일서 여부는 미확인**이다. — [watcha pedia](https://pedia.watcha.com/en/contents/bymdO88)

**近藤康太郎『三行で撃つ 〈善く、生きる〉ための文章塾』**
- 저자는 朝日新聞 編集委員이고 CCCメディアハウス에서 나왔다. "사람의 마음을 쏘는 문장 기술 25발"로 구성되며 서두·기승전결·1인칭·문체·리듬을 다룬다. 제목은 "첫 문장, 길어도 세 줄 안에 독자를 놀라게 하라"에서 왔다. 상투구(常套句)를 금지 수로 다루는 논의가 소개된다. 나중에 증보판 문고도 나왔다. — [Newsweek日本版](https://www.newsweekjapan.jp/articles/-/42774); [東洋経済](https://toyokeizai.net/articles/-/401849?display=b)
- 초판 연도(2020)는 검색 요약에 직접 나오지 않았다 → 미확인(추정 2020-12).

**田中泰延『読みたいことを、書けばいい。 人生が変わるシンプルな文章術』**
- ダイヤモンド社, 2019-06. 272쪽, ISBN 978-4-478-10722-5. 중심 사상은 "내가 읽고 싶은 글이 세상에 없으니 쓴다"와 "남이 이미 말한 것은 쓸 필요가 없다"이다. 기법서라기보다 수필에 가깝다. — [diamond.co.jp](https://www.diamond.co.jp/book/9784478107225.html); [文春オンライン](https://bunshun.jp/articles/-/14205); [現代ビジネス](https://gendai.media/articles/-/66236)

**문장독본(文章読本) 계보**
- 谷崎潤一郎『文章読本』: 1934년 中央公論社 간행. 현재는 新潮文庫『陰翳礼讃・文章読本』에 수록돼 있다. — [新潮社](https://www.shinchosha.co.jp/book/100516/); [Book Watch](https://forest.watch.impress.co.jp/docs/bookwatch/aozora/1074212.html)
- 谷崎은 1965-07-30에 사망했다. 青空文庫 작가 페이지에서 『文章読本』(作品ID 59991, 新字新仮名)은 **"作業中" 목록**에 있어 아직 공개되지 않았다. 『陰翳礼讃』(card56642)은 공개 중이다. — [青空文庫 作家別 谷崎潤一郎](https://www.aozora.gr.jp/index_pages/person1383.html)
- 青空文庫는 谷崎를 "사후 50년이 지나 저작권이 소멸한" 작가로 소개했다. — [Book Watch 青空文庫新着](https://forest.watch.impress.co.jp/docs/bookwatch/aozora/1074212.html)
- 中公文庫『文章読本』(1996 개판)은 작가 20인의 문장론 앤솔러지다. 三島由紀夫『文章読本』 발췌와 丸谷才一『文章読本』 발췌 「小説家と日本語」가 들어 있다. — [booklog](https://booklog.jp/item/1/4122025354); [紀伊國屋 中公文庫](https://www.kinokuniya.co.jp/f/dsg-01-9784122069947)
- 井上ひさし『自家製 文章読本』: 新潮文庫판 1987-04-28. 「話すように書くな」「オノマトペ」 같은 장이 있고, 三島『文章読本』을 거듭 인용하며 반론한다. — [新潮社](https://www.shinchosha.co.jp/book/116819/); [bookmeter](https://bookmeter.com/books/457343)

**花森安治 / 暮しの手帖**
- 편집 방침은 "이념보다 일상생활의 실천을 통해 생활을 바꾼다"는 것이었고 창간 때부터 일관됐다. — [JapanKnowledge](https://japanknowledge.com/introduction/keyword.html?i=47)
- 唐澤平吉『花森安治の編集室』 서평에 따르면, 신입이 쓴 기획서·기사를 花森가 어려운 한자가 많다는 이유 등으로 고쳤다. — [文春 books](https://books.bunshun.jp/articles/-/1555)
- 『暮しの手帖』 기사 작법, 특히 프로가 실연하며 설명하는 취재 흐름이 다른 잡지 편집자에게 영향을 준 사례가 있다. — [京大数理研 講究録 PDF](https://www.kurims.kyoto-u.ac.jp/~kyodo/kokyuroku/contents/pdf/2021-12.pdf)

**沢木耕太郎(르포)**
- 『テロルの決算』은 1979년 大宅壮一ノンフィクション賞을 받았다. 소개 문구는 1960년 두 인물이 마주치는 "그 한순간까지의 장면"을 쌓아 가는 구성이다. 沢木 자신은 취재 중 소개받은 인물과의 만남이 최종장을 좌우했다고 회고한다. — [文春 books](https://books.bunshun.jp/articles/-/2040); [紀伊國屋 文春文庫 新装版](https://www.kinokuniya.co.jp/f/dsg-01-9784167209148)
- 뉴저널리즘의 사전적 정의: 기자가 취재 대상과 개인적 관계를 맺어 사건의 본질을 전하려는 보도 기법. — [weblio](https://www.weblio.jp/content/New+Journalism)

### Inferences
- 「장면으로 시작·짧은 문장」 브리프에 가장 직접 맞는 근거는 近藤(첫 세 줄)과 沢木(장면 축적)다. 「사실 검증」 축은 古賀의 취재 공정과 岸의 생활사 방법(아래 A-2)이 받친다.
- 本多의 규칙은 일본어 어순론이지만, 한국어도 수식어가 앞에 오는 SOV 언어라 "긴 수식어 먼저 / 쉼표는 구문 경계에만"은 거의 그대로 옮길 수 있다. 다만 기계 판정은 어렵고 검수 체크리스트 몫이다.
- 저작권: 谷崎(1965 사망)는 2018-12-30 TPP 연장(사후 70년) 전에 이미 보호가 끝나 PD로 본다. 三島(1970)·花森(1978)·向田(1981)·開高(1989)는 연장이 적용돼 보호 중이다. 이는 일본 저작권법 개정 이력에서 추론한 것이고 이번에 원문은 확인하지 못했다. 매거진에는 인용 대신 기법 요약과 서지만 쓴다.

### Gaps
- 本多의 「テンの二大原則」 조문, 즉 ① 긴 수식어 경계 ② 어순 도치 시라는 통설은 이번에 1차 출처로 확인하지 못했다(검색 실패). 원서 대조가 필요하다.
- 古賀『取材・執筆・推敲』의 퇴고 체크리스트 세부(장 구성·체크 항목)는 미확인이다.
- 向田邦子·開高健의 감각 묘사 기법, 丸谷才一 『文章読本』(1977 中央公論社로 알려짐) 서지, 外山滋比古『思考の整理学』(ちくま文庫)는 이번에 출처를 확보하지 못했다 → 미확인.
- 三島『文章読本』 단행본 초판 연도·출판사 미확인.

---

## (A-2) 일본 기행·수필·생활사 전통: 모델로 쓸 만한 것

### Takeaway
**岸政彦『東京の生活史』**의 방법이 「일본, 사람의 일생」에 가장 가깝다. 공모한 청자 150명이 각자 1명의 화자를 듣고, 해설 없이 나열하며, 청자 이름을 명기한다. 핵심은 "실재 화자 + 실명 청자 + 가공 없음"이다. 古典 수필(枕草子·徒然草)은 PD라 자유롭게 참조할 수 있다.

### Cited Findings
- 『東京の生活史』: 筑摩書房 2021-09, 1216쪽. 毎日出版文化賞(第76回)과 紀伊國屋じんぶん大賞2022를 받았다. 공모 청자가 화자를 1대1로 골라 듣고, 150명분을 해설·설명 없이 나열했다. 화자 속성은 목차에 싣지 않고 청자 이름은 실었다. — [筑摩書房](https://chikumashobo.co.jp/product/9784480816832/); [筑摩 特設](https://chikumashobo.co.jp/special/tokyo_project/); [現代ビジネス](https://gendai.media/articles/-/88733); [文春オンライン](https://bunshun.jp/articles/-/40057)
- 岸은 청자 희망자에게 연수회에서 조사 방법을 전했다. 그 내용은 『生活史の方法——人生を聞いて書く』(ちくま新書)로 정리됐다. — [Real Sound](https://realsound.jp/book/2025/11/post-2216319.html/amp); [NDL Search](https://ndlsearch.ndl.go.jp/books/R100000002-I031608184)

### Inferences
- 「사람의 일생」 피처에 생활사 방식을 쓰려면 ⑴ 실제 인터뷰가 있을 때만 화자 발화를 싣고 ⑵ 청자(필자)와 취재일을 명기하며 ⑶ 편집자 해설을 발화와 시각적으로 분리하는 3원칙을 기계 검사 가능한 메타데이터(frontmatter)로 강제할 수 있다. 인터뷰가 없는 기사는 공개 자료(통계·법령·기관 페이지)만으로 서술하고 "가상의 ○○ 씨" 같은 합성 인물은 금지한다. 브리프의 "가공 인터뷰 금지"와 일치한다.

### Gaps
- 枕草子·徒然草의 青空文庫 수록 여부, 일본 紀行文 전통(芭蕉 등)의 기법 정리는 이번에 출처를 확보하지 못했다.
- 『生活史の方法』의 구체 절차(녹음·전사·수정 동의 등)는 미확인이다. 피처 윤리 규정에 쓰려면 원서 확인이 필요하다.

---

## (A-3) 한국어 가교: 번역서·한국 편집서·일본어 한글 표기

### Takeaway
위에 든 일본 작법서의 한국어판은 대부분 **확인하지 못했다**. 일본어 고유명사 한글 표기는 국립국어원 외래어 표기법을 따른다. 장음 미표기와 받침 7자·된소리 금지는 공식 출처로 확인했다. ツ→「쓰」(부카쓰·쓰키지)는 2차 출처로 확인했고 원문 대조가 남아 있다.

### Cited Findings
- 외래어 표기법 기본 원칙(문교부 고시 제85-11호): 현용 24자모만 쓰고, 받침은 ㄱㄴㄹㅁㅂㅅㅇ만 쓰며, 파열음에 된소리를 쓰지 않는 것이 원칙이다. — [위키문헌 외래어 표기법(제85-11호)](https://ko.wikisource.org/wiki/%EC%99%B8%EB%9E%98%EC%96%B4_%ED%91%9C%EA%B8%B0%EB%B2%95_(%EC%A0%9C85-11%ED%98%B8)) (검색 스니펫 기준)
- 장음은 언어 구분 없이 모든 외래어에서 표시하지 않는다. 일본어처럼 원어에서 모음을 겹쳐 써도 마찬가지다. 예외는 화학 용어(알코올 등)뿐이다. — [국립국어원 새국어소식](https://www.korean.go.kr/nkview/nknews/200504/81_4.html)
- 쟈·져·죠·쥬·챠·쳐·쵸·츄는 쓰지 않는다. — [국립국어원 외래어 표기법의 이해](https://www.korean.go.kr/nkview/nknews/200108/37_5.html)
- ツ/つ의 국립국어원 표기는 「쓰」(탁음 「즈」)이다(위키 정리). 조선신보 등 북한 관행과는 다르다. — [더위키 「츠」](https://thewiki.kr/w/츠) (2차 출처. 원문 대조 필요)
- 한국 편집 담론: 최혜진 『에디토리얼 씽킹』(2023). 매거진 에디터 20년 경력의 저자가 수집·연상·범주화·프레임·컨셉 등 12개 키워드로 편집 과정을 정리했다. 출판사는 미확인(검색 결과에 미표시). — [왓챠피디아 책 소개](https://pedia.watcha.com/ko/contents/bymGbdP/book_description); [교보 이벤트](https://event.kyobobook.co.kr/detail/233935)
- 古賀『取材・執筆・推敲』은 대만에서 2022년 究竟出版社가 중국어판을 냈다. 한국어판은 검색에서 찾지 못했다. — [Epoch Times](https://www.epochtimes.com/b5/22/5/23/n13743107.htm)

### Inferences
- 표기 사전 예(규칙에서 기계적으로 도출. 원문 대조 전 잠정): 部活 ぶかつ → **부카쓰**(어두 ぶ=부, 어중 か=카, つ=쓰). 東京 → 도쿄(어두 예사소리, 장음 미표기). 築地 → 쓰키지. 北海道 → 홋카이도(촉음 ㅅ). 「부카츠·토쿄·도오쿄·홋까이도」는 오표기로 린트 대상이다.
- 다만 관용 표기·상표 표기(예: 회사의 공식 한글명)는 예외 허용 목록이 필요하다. CLAUDE.md의 IP 방침상 실존 상호를 텍스트로 쓰는 것은 허용되며, 이때는 해당 사의 한국 공식 표기를 우선한다.

### Gaps
- **외래어 표기법 표4(일본어 가나와 한글 대조표)와 제3장 제7절(일본어의 표기: 촉음 ㅅ 통일, 장모음 미표기) 원문을 열지 못했다**(kornorms DNS 실패). 위 "촉음 ㅅ·어두 예사소리" 세부는 조사자의 사전 지식이므로 사전 구축 전에 반드시 kornorms 원문과 대조해야 한다.
- 古賀 『20歳…』『取材・執筆・推敲』, 近藤『三行で撃つ』, 田中『読みたいことを…』, 本多『日本語の作文技術』의 한국어판 존재·서지는 모두 미확인이다. 『문장 수업 안내』가 古賀 번역서인지도 미확인이다.
- 한국 피처/르포 작법서(기자 글쓰기 책 등)의 서지 확인은 시간 제약으로 수행하지 못했다.

---

## (B) 문장 린트 OSS: 일본어·한국어 지원, 라이선스·유지 상태

### Takeaway
일본어는 **textlint 생태계**가 사실상 표준이다. v15는 2025-06에 나왔고 Node 20+, `createLinter()` API를 쓴다. 그러나 **한국어 textlint 규칙 패키지는 찾지 못했고**, 일본어 규칙은 kuromoji 형태소 분석에 기대므로 한국어 본문에는 쓸 수 없다. 한국어 맞춤법 OSS(hanspell 등)는 외부 웹서비스 호출이라 CI 계약 테스트에 부적합하다. 결론: **규칙 아이디어와 prh식 사전 형식만 빌리고, 엔진은 기존 `copyStandard.test.js` 패턴의 자체 vitest 규칙으로 구현**한다.

### Cited Findings
**textlint 본체**
- v15.0.0(2025-06): v12.3.0부터 deprecated였던 API(`TextLintEngine`·`TextFixEngine`·`TextLintCore`)를 삭제하고 `createLinter()`로 일원화했다. Node.js 20+가 필요하다. 15.1.0에서 `info` severity, 15.2.x에서 `--mcp` 개선이 들어갔다. — [efcl.info v15 릴리스 노트](https://efcl.info/2025/06/25/textlint-v15/)
- 최신 버전은 제3자 미러 기준 15.5.0(jsdocs.io)·15.6.0(conda/depscope)으로 나온다. 공식 릴리스 페이지에서는 확인하지 못했다. — [jsdocs.io](https://www.jsdocs.io/package/textlint); [depscope](https://depscope.dev/pkg/conda/textlint)
- textlint v14.8.0 이후 MCP 서버로 띄울 수 있어 생성→검사→수정 루프에 쓸 수 있다. — [zenn(hibara428)](https://zenn.dev/hibara428/articles/a4235e23f04110)

**일본어 프리셋·규칙**
- textlint-rule-preset-ja-technical-writing: depscope 기준 v12.0.2. sentence-length, max-ten, no-mix-dearu-desumasu, no-doubled-joshi, ja-no-weak-phrase, ja-no-redundant-expression 등을 묶는다. — [depscope](https://depscope.dev/pkg/npm/textlint-rule-preset-ja-technical-writing)
- sentence-length는 기본 100자 초과 시 오류로 보고된 사례가 있고 `max`로 조정할 수 있다(예: 160). max-ten도 `max`로 조정한다(예: 6). — [ServerWorks 블로그](https://blog.serverworks.co.jp/tried-using-textlint); [zenn(takemikami)](https://zenn.dev/takemikami/articles/20171214-textlintrails)
- ja-no-weak-phrase는 「かもしれない」「と思います」 같은 약한 표현을 금지한다. ja-no-redundant-expression은 「学習を行う」→「学習する」처럼 장황한 표현을 지적하지만 문맥 의존이 있다. no-doubled-joshi는 한 문장 안의 같은 조사 반복을 경고하며 `strict`·`allow` 옵션이 있다. — [npm ja-no-weak-phrase](https://npmjs.org/package/textlint-rule-ja-no-weak-phrase); [ServerWorks](https://blog.serverworks.co.jp/tried-using-textlint); [scrapbox 규칙 조정](https://scrapbox.io/tomiokario/textlint%E3%81%AE%E3%83%AB%E3%83%BC%E3%83%AB%E8%AA%BF%E6%95%B4)
- **@textlint-ja/textlint-rule-preset-ai-writing**: AI 생성문에 흔한 패턴(부자연스러운 목록, 과장, 기계적 강조, 영어식 콜론)을 검출한다. "표현이 아니라 구조를 묶는다"는 방침이다. 기본값이 자연스러운 글에도 반응해 `allows` 조정이 필요하고, 패치 버전마다 검출 수가 달라질 수 있어 lockfile을 권장한다. unpkg에 v1.1.0 파일이 있다. — [GitHub textlint-ja/preset-ai-writing](https://github.com/textlint-ja/textlint-rule-preset-ai-writing); [zenn(hibara428)](https://zenn.dev/hibara428/articles/a4235e23f04110); [unpkg 1.1.0](https://app.unpkg.com/textlint-rule-preset-ai-writing@1.1.0/files/src/rules/ai-tech-writing-guideline.ts)
- textlint-rule-preset-japanese는 별도 패키지로 존재한다(releasealert 등재). 규칙 목록은 미확인. — [releasealert](https://releasealert.dev/npmjs/_/textlint-rule-preset-japanese)
- 일본어 규칙 컬렉션 목록(공식 위키). — [textlint wiki Collection of textlint rule](https://github.com/azu/textlint/wiki/Collection-of-textlint-rule)

**한국어**
- 한국어 맞춤법 textlint 규칙 npm 패키지는 찾지 못했다. WikiDocs에 한국어용 textlint 플러그인을 직접 만드는 튜토리얼만 있다. — [WikiDocs 381330](https://wikidocs.net/381330)
- hanspell(9beach): 코드는 MIT이지만, 부산대 인공지능연구실/(주)나라인포테크 맞춤법 웹서비스는 개인·학생만 무료로 쓸 수 있다는 권리자 고지가 있다. 저장소 설명상 다음·네이버 웹서비스를 쓰고 Node 18+가 필요하다. — [GitHub 9beach/hanspell](https://github.com/9beach/hanspell); [Hackage hanspell](https://hackage.haskell.org/package/hanspell-0.2.2.0)
- prettier-plugin-korean-spell-checker는 hanspell을 써서 Prettier에서 맞춤법을 고친다(textlint 아님). — [npm](https://www.npmjs.org/package/prettier-plugin-korean-spell-checker)
- Obsidian 플러그인 Korean Grammar Assistant는 부산대(NaraSpeller)·Bareun.ai 엔진을 호출한다(npm 아님). — [obsidianstats](https://www.obsidianstats.com/plugins/korean-grammar-assistant)

**기타 범용 린터**
- Vale: Go 단일 바이너리이고 별도 런타임이 필요 없다. 3.5.0에서 tree-sitter 기반 fragment를 지원한다. CJK·일본어·한국어 토큰화 관련 문서는 찾지 못했다. — [pkg.go.dev errata-ai/vale v3](https://pkg.go.dev/github.com/errata-ai/vale/v3); [openSUSE 패키지 changelog](https://build.openbuildservice.org/package/show/openSUSE:Factory:zSystems/vale?rev=36)
- RedPen: 일본어 지원 Java 도구. gihyo 연재로 소개됐다. Ruby 래퍼 마지막 버전은 0.2.0(2016-07-30), Docker 이미지는 6~7년 전 갱신이다. 본체의 최종 릴리스는 미확인. — [gihyo.jp](https://gihyo.jp/lifestyle/serial/01/redpen/0004); [rubygems redpen](https://index.rubygems.org/gems/redpen); [Docker Hub](https://hub.docker.com/r/kaito22/redpen)

### Inferences
- textlint 규칙의 한국어 대응물은 형태소 분석 없이 **정규식·사전**만으로 대부분 구현할 수 있다. 문장 길이, 쉼표 수, 헤지 표현, 장황 표현, '의' 연쇄, 문체 혼용, 외래어 표기 사전, AI투 구조(굵게 남발·콜론·과장어)가 여기에 든다. 리포에는 이미 `src/lib/__tests__/copyStandard.test.js`(COPY-STD-001: RULES 정규식 + 파일·조각·이유 ALLOWLIST)가 있으므로 같은 모양으로 `EDIT-STD-*`를 신설하는 것이 CLAUDE.md "기존 부품 재사용" 원칙에 맞는다.
- prh의 YAML 형식(expected/pattern/specs)은 사전 포맷으로 좋다. 다만 리포에 YAML 파서 의존성이 없다(package.json 확인: yaml·js-yaml 없음). 그래서 **같은 필드 구조의 JS/JSON 사전**(`{expected, pattern, specs:[{from,to}]}`)으로 두는 편이 의존성 추가 없이 끝난다. `specs`를 테스트 안에서 자기검증하는 prh의 관례는 그대로 가져온다.
- textlint 자체를 devDependency로 넣는 이점은 일본어 원문 인용 단락에 일본어 규칙을 적용하는 것 정도다. 매거진 본문은 한국어이고 일본어는 키워드 병기 수준이라 이득이 작다. kuromoji 사전 로딩 비용과 버전별 검출 변동(ai-writing 문서의 경고)이 계약 테스트의 결정성을 해친다.

### Gaps
- textlint·각 프리셋의 공식 최신 버전과 마지막 릴리스일(2026-10 기준)은 npm·GitHub 직접 접근 실패로 **미확인**이다. 위 숫자는 제3자 미러 값이다.
- prh 본체·textlint-rule-prh의 최신 버전·라이선스, alex·write-good의 언어 지원(영어 전용으로 알려졌지만 이번에 출처를 확보하지 못함), Vale의 CJK 처리, 바른(Bareun) API 약관은 모두 미확인이다.

---

## manabi 적용 후보

### Takeaway
아래 22개 규칙 중 13개는 결정적 vitest 규칙으로 바로 심을 수 있다(✔). 5개는 메타데이터 강제나 휴리스틱으로 부분 검사할 수 있다(△). 나머지는 검수 체크리스트 몫이다(✘). 도구는 "자체 vitest + prh식 JS 사전"을 채택한다. textlint·preset들은 규칙 아이디어만 차용하고, Vale·RedPen·hanspell·alex/write-good은 배제한다.

### Cited Findings
(이 절은 위 절의 출처를 재사용한다. 각 규칙 옆에 근거를 표기했다.)

**(1) 편집 문장 규칙 22선** — ✔ 기계 검사 가능 / △ 부분(메타데이터·휴리스틱) / ✘ 사람 검수

| # | 규칙 | 근거 | 검사 |
|---|---|---|---|
| 1 | 첫 문단은 장면으로 연다. 시간·장소·인물의 동작 중 2개 이상, 감각 세부 1개 이상 | 近藤『三行で撃つ』 "첫 세 줄" ([Newsweek](https://www.newsweekjapan.jp/articles/-/42774)); 沢木 장면 축적 ([文春](https://books.bunshun.jp/articles/-/2040)) | △ 첫 문단에 숫자/고유명 존재, 금지 리드 사전 |
| 2 | 리드 금지형: "~에 대해 알아보자", "여러분은 ~을 아시나요?", "~라는 말이 있다" | 近藤 상투구 금지 ([東洋経済](https://toyokeizai.net/articles/-/401849?display=b)) | ✔ 사전 |
| 3 | 상투구 금지 목록(예: "그야말로", "말 그대로", "~의 끝판왕", "힐링") | 近藤 상투구 금지 | ✔ 사전 |
| 4 | 한 문장 최대 길이 상한(제안: 본문 70자, 리드 40자) | textlint sentence-length 기본 100자 사례 ([ServerWorks](https://blog.serverworks.co.jp/tried-using-textlint)) → 한국어 압축률 감안 하향 | ✔ |
| 5 | 한 문장 쉼표 최대 2개 | textlint max-ten ([zenn](https://zenn.dev/takemikami/articles/20171214-textlintrails)) | ✔ |
| 6 | 쉼표는 구문 경계(긴 수식어 경계·어순 도치)에만 찍는다 | 本多 「構文上のテン」 ([跡見 논문](https://atomi.repo.nii.ac.jp/record/1336/files/atomi_com8_02.pdf)) | ✘ |
| 7 | 수식어는 긴 것 먼저, 큰 상황→작은 상황 | 本多 수식 순서 ([阪大 자료](https://www.library.osaka-u.ac.jp/doc/LS_20201217_japanese_writing.pdf)) | ✘ |
| 8 | 같은 조사 반복 금지: '의' 3연쇄, 한 문장 '~는…~는' | no-doubled-joshi ([ServerWorks](https://blog.serverworks.co.jp/tried-using-textlint)) | ✔ ('의' 연쇄 정규식) |
| 9 | 약한 표현 금지: "~것 같다", "~라고 할 수 있다", "~지 않을까", "아마도" (인용 발화 안은 제외) | ja-no-weak-phrase ([npm](https://npmjs.org/package/textlint-rule-ja-no-weak-phrase)) | ✔ 사전 + 인용부 제외 |
| 10 | 장황 표현 금지: "~하는 것이 가능하다", "~에 있어서", "~을 진행하다", "~적인 부분" | ja-no-redundant-expression ([ServerWorks](https://blog.serverworks.co.jp/tried-using-textlint)) | ✔ 사전 |
| 11 | AI투 구조 금지: 본문 내 굵게 남발, 문장 중 콜론, "혁신적·놀라운·완벽한" 과장어, 3항 나열 상투 | preset-ai-writing ([GitHub](https://github.com/textlint-ja/textlint-rule-preset-ai-writing)) | ✔ 사전·카운트 |
| 12 | 본문 문체 통일: 해라체(~다) 단일, 합쇼체 혼입 금지(인용 제외) | no-mix-dearu-desumasu ([depscope](https://depscope.dev/pkg/npm/textlint-rule-preset-ja-technical-writing)) | ✔ 종결어미 |
| 13 | 장면 서술은 현재형이 기본. 과거형 종결 비율 상한(예: 장면 문단 30%) | 매거진 브리프(오너 요구) + 近藤 문체·리듬 장 ([Newsweek](https://www.newsweekjapan.jp/articles/-/42774)) | △ 종결어미 비율 |
| 14 | 말하듯 쓰지 말고 머릿속 생각을 글로 "번역"한다. 구어 군말("근데", "뭔가", "약간") 금지 | 古賀『20歳…』 ([東洋経済](https://toyokeizai.net/articles/-/101182?display=b)); 井上「話すように書くな」 ([新潮社](https://www.shinchosha.co.jp/book/116819/)) | △ 구어 군말 사전 |
| 15 | 퇴고는 집필과 다른 패스로 한다(취재 메모→초고→퇴고 3단 산출물을 PR에 분리 기록) | 古賀『取材・執筆・推敲』 ([版元](https://www.hanmoto.com/bd/isbn/9784478112748)) | △ PR 템플릿·frontmatter 필드 |
| 16 | 남이 이미 쓴 것을 요약하지 않는다. 기사마다 "이 글만의 관찰"을 기획서에 1줄 명기 | 田中『読みたいことを…』 ([文春](https://bunshun.jp/articles/-/14205)) | ✘(기획 게이트) |
| 17 | 인물 발화는 실제 취재(청자·일시·장소 기록)가 있을 때만 싣는다. 합성 인물 금지 | 岸 생활사 방식(청자 명기) ([筑摩](https://chikumashobo.co.jp/special/tokyo_project/)) + 브리프 | ✔ 인용 블록 ↔ frontmatter `interviews[]` 대응 |
| 18 | 발화 원문과 편집자 해설을 시각적으로 분리하고, 발화에 해설을 섞지 않는다 | 岸 "해설 없이 나열" ([現代ビジネス](https://gendai.media/articles/-/88733)) | △ 마크업 규약 |
| 19 | 수치·날짜·고유 사실 문장에는 출처 각주 id 필수 | 프로젝트 사실 검증 원칙(브리프) | ✔ 숫자 포함 문장 ↔ `sources[]` |
| 20 | 일본어 고유명사 한글 표기: つ→쓰, 장음 미표기, 촉음 ㅅ, 어두 예사소리(부카쓰·도쿄·홋카이도) | 국립국어원 장음 원칙 ([korean.go.kr](https://www.korean.go.kr/nkview/nknews/200504/81_4.html)); ツ=쓰 ([더위키](https://thewiki.kr/w/츠), 원문 대조 필요) | ✔ prh식 사전(오표기→정표기, specs 자기검증) |
| 21 | 일본어 키워드는 첫 등장 때 "한글(原語)" 병기(예: 부카쓰(部活)), 이후 한글만. 병기 원어는 한 기사에 1회 | manabi 제안(일본어 키워드 병기 요구). 외부 선례 미확인 | ✔ |
| 22 | 어려운 한자어 대신 쉬운 말. 일본어 한자 병기는 괄호 안 8자 이내 | 花森의 어려운 한자 지적 ([文春 books](https://books.bunshun.jp/articles/-/1555)); textlint max-kanji-continuous-len 계열(규칙명은 프리셋 의존목록 기준, 기본값 미확인) | △ 괄호 내 길이만 ✔ |

**(2) 도구 표**

| 항목 | 판정 | 근거 |
|---|---|---|
| 자체 vitest 규칙 `EDIT-STD-*` (copyStandard.test.js 패턴: RULES + 파일·조각·이유 ALLOWLIST) | **채택** | 이미 있는 정본 부품을 재사용하고 의존성이 늘지 않으며 결정적이다. 한국어 본문에 맞는 엔진이 OSS에 없다 |
| prh 사전 형식(expected/pattern/specs) | **부분 채택** | 형식과 specs 자기검증만 차용한다. YAML 파서 의존성이 없어 JS/JSON으로 둔다. 엔진은 자체 |
| textlint v15 본체 | **배제(보류)** | 한국어 규칙이 없고 일본어 규칙은 kuromoji 의존이다. 일본어 원문 단락이 많아지면 재검토. Node 20+ 요건은 충족(Node 24) |
| preset-ja-technical-writing (sentence-length·max-ten·no-doubled-joshi·weak-phrase·redundant·dearu-desumasu) | **부분 채택(아이디어)** | 규칙 6종을 한국어 정규식·사전으로 재구현한다. 임계값은 한국어로 재보정 |
| @textlint-ja/preset-ai-writing | **부분 채택(아이디어)** | "표현 대신 구조를 묶는다"는 방침과 검출 범주(목록·과장·강조·콜론)를 빌린다. 공식 문서도 버전별 변동과 오탐을 경고하므로 직접 의존하지 않는다 |
| textlint-rule-preset-ja-spacing / preset-japanese | **배제** | 일본어 조판(전각·반각 간격) 전용이라 한국어 본문과 무관하다 |
| textlint MCP 서버 | **배제(당장)** | 생성 루프용이다. 계약 테스트 게이트와는 별개 |
| Vale | **배제** | Go 바이너리라 CI 툴체인이 하나 늘고, CJK 처리 근거를 찾지 못했다. 같은 일을 vitest로 할 수 있다 |
| RedPen | **배제** | Java이고 주변 패키지 갱신이 2016~2019년에 멈춘 정황이다(본체 최종 릴리스 미확인) |
| alex / write-good | **배제** | 영어 전용으로 알려져 있다(이번 조사에서 출처 미확보·미확인) |
| hanspell / prettier-plugin-korean-spell-checker | **배제(CI)**, 수동 보조만 | 코드는 MIT이지만 외부 웹서비스(부산대·다음·네이버)를 호출한다. 부산대 서비스는 개인·학생만 무료라는 고지가 있어 비결정적이고 약관 위험이 있다 |
| Bareun.ai / NaraSpeller API | **배제(미확인)** | 상용 API이고 약관을 확인하지 않았다. 계약 테스트에는 부적합 |

### Inferences
- 구현 순서 제안: ⑴ 외래어 표기 사전(#20, 오표기 피해가 가장 크고 판정이 명확함) → ⑵ 출처·취재 메타데이터 대응(#17·#19, 브리프의 "가공 금지"를 계약으로 박음) → ⑶ 문장 길이·쉼표·헤지·장황·문체(#4·5·8·9·10·12) → ⑷ AI투·상투구 사전(#2·3·11, 오탐이 많을 수 있으니 ALLOWLIST 운용). CLAUDE.md "원칙은 계약 테스트로 심는다"와 "선례 조사표 동봉" 요건은 위 도구 표로 충족된다.
- 인용 발화 안(「」·"" 내부)은 #9·#12·#14 검사에서 빼야 실제 화자의 말투를 보존할 수 있다. 생활사 방식의 "가공 없음"과도 맞는다.

### Gaps
- #4·#5·#13의 임계값(70자·2개·30%)은 일본어 기본값에서 옮긴 **제안치**다. 기존 기사 샘플로 분포를 재서 확정해야 한다.
- #20 사전의 세부 규칙(어두 예사소리·촉음 ㅅ)은 kornorms 원문 대조 전에는 잠정이다.
- #21(원어 병기 1회)은 외부 선례를 찾지 못한 manabi 자체 제안이다.
