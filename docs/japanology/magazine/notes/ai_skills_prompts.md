# AI 스킬·프롬프트 라이브러리·프롬프팅 기법 조사 — 매거진 카피·편집 디자인·팩트체크용 (2026-10-14 KST 기준)

> 조사 방법 메모: 이 세션은 WebFetch·GitHub API(`gh api`)·npm 레지스트리가 프록시 정책으로 막혀 있어서, GitHub 저장소는 **git shallow clone으로 LICENSE·SKILL.md를 직접 열어 확인**했고(최종 커밋일 = clone 시점 HEAD 커밋일, KST 환산), 웹 문서는 WebSearch 요약에 의존했다. 따라서 **GitHub 스타 수는 직접 확인하지 못했다**(제3자 디렉터리 수치는 '미확인'으로 표시). 프롬프트 원문은 옮기지 않고 구조만 요약했다.

## 1. Anthropic 공식 스킬 저장소(anthropics/skills) — 관련 스킬, 라이선스, 담긴 원칙

### Takeaway
anthropics/skills(최종 커밋 2026-10-10 KST)의 19개 스킬 중 매거진 작업에 직접 쓸 만한 것은 frontend-design·doc-coauthoring·skill-creator·theme-factory·canvas-design·discernment-nudge이며, 이들은 Apache-2.0(단 doc-coauthoring은 LICENSE 파일이 없어 미확인)이고 docx/pdf/pptx/xlsx만 source-available(Proprietary)이다. 특히 frontend-design은 "크림 배경+세리프 디스플레이", "헤어라인 괘선·0 radius·신문식 다단(broadsheet)"을 **AI 디자인의 기본값 신호**로 명시해, 매거진 페이지가 빠지기 쉬운 함정을 정면으로 짚는다.

### Cited Findings
- 저장소 README: "Many skills in this repo are open source (Apache 2.0)… docx, pdf, pptx, xlsx … are source-available, not open source." — [anthropics/skills README](https://github.com/anthropics/skills)
- 2026-10 현재 스킬 목록(직접 clone 확인): academy-guide, algorithmic-art, brand-guidelines, canvas-design, claude-api, discernment-nudge, doc-coauthoring, docx, frontend-design, internal-comms, mcp-builder, pdf, pptx, skill-creator, slack-gif-creator, theme-factory, web-artifacts-builder, webapp-testing, xlsx. 루트 LICENSE 파일은 없고 스킬별 LICENSE.txt로 관리. — [anthropics/skills/skills](https://github.com/anthropics/skills/tree/main/skills)
- 스킬별 라이선스(각 폴더 LICENSE.txt 직접 확인): Apache-2.0 = frontend-design, brand-guidelines, canvas-design, theme-factory, internal-comms, skill-creator, discernment-nudge, algorithmic-art, web-artifacts-builder, webapp-testing, mcp-builder, slack-gif-creator, claude-api, academy-guide. Proprietary("© 2025 Anthropic, PBC. All rights reserved") = docx, pdf, pptx, xlsx. **doc-coauthoring은 LICENSE.txt도 frontmatter `license:`도 없음 → 라이선스 미확인**. — [anthropics/skills](https://github.com/anthropics/skills)
- frontend-design 파생물(Impeccable)도 원본을 "Apache License 2.0, Copyright 2025 Anthropic, PBC"로 표기 — [Impeccable NOTICE](https://git.secluded.site/agent-skills/blob/main/vendor/impeccable/NOTICE.md)
- **frontend-design(71줄) 핵심 원칙 요약**(현행판, description이 "templated defaults를 피하는 의도적 시각 디자인"으로 개정됨): — [frontend-design/SKILL.md](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md)
  - 페르소나: "모든 고객에게 남과 혼동되지 않는 정체성을 주는 디자인 스튜디오의 디자인 리드", 클리셰 제안을 이미 거절한 고객.
  - **주제에 뿌리내리기**: 업계·소재·재료·토박이 어휘(vernacular)에서 독창적 선택이 나온다. 실제 콘텐츠로 빌드.
  - 히어로는 "주제 세계에서 가장 특징적인 것"으로 연다. '큰 숫자+작은 라벨+그라데이션'은 기본값이므로 정말 최선일 때만.
  - 타이포가 개성을 담는다: 1~2 패밀리, 의도적 서체 선택, *The Elements of Typographic Style* 기본을 따르는 타입 스케일, 본문 행 길이 80자 미만, 세리프 본문은 행간을 더.
  - 생성 페이지의 흔한 신호: 헤드라인 한 단어만 이탤릭/색 강조, 라벨 전부 대문자, 불필요한 아이브로 라벨. 번호(01/02/03)는 내용이 실제 순서일 때만.
  - 모션은 한 번의 오케스트레이션된 순간만; 섹션마다 fade-slide-up은 AI 신호.
  - **AI 디자인이 몰리는 5가지 군집**: ① 따뜻한 크림 배경(#F4F1EA 근처)+고대비 세리프+테라코타 악센트(#D97757 = Claude 자체 악센트) ② 거의 검정 배경+형광 녹/주홍 단일 악센트 ③ **헤어라인 괘선·0 border-radius·신문 같은 빽빽한 다단의 broadsheet 레이아웃** ④ SaaS 카드 키트 ⑤ 주제와 무관한 템플릿 크롬(트래킹 넓힌 대문자 아이브로, 'A · B · C' 중점 메타, 'WORD — fragment', #111 near-black, 모노스페이스 데이터 라벨, 링크 끝 '→'). "브리프가 명시하면 따르되, 자유로운 축을 이 기본값에 쓰지 말라."
  - **2패스 공정**: 토큰 플랜(4~6개 명명 hex, 서체 역할, ASCII 와이어프레임 레이아웃, 원칙) → 브리프 대비 검토("비슷한 프롬프트로 같은 곳에 도달하는가?") 후 수정 사유 명시 → 코드.
  - 절제: "대담함은 한 곳에", 샤넬의 "나가기 전 액세서리 하나를 빼라". 품질 하한(반응형·키보드 포커스·reduced motion·접근성) 충족, 스크린샷 자기 비평.
  - 디자인 속 글쓰기: 사용자 관점 명명, 능동태, CTA는 결과를 말한다, 같은 행동은 흐름 내내 같은 이름, 오류는 사과하지 않고 구체적.
- Anthropic은 이 문제를 "distributional convergence"로 설명: 지시 없으면 웹 학습 데이터의 안전한 중심값(Inter/Roboto 등)으로 수렴; 해법은 디자인 차원 명명·영감 출처 지정·피할 기본값 명시. — [Improving frontend design through Skills (claude.com)](https://claude.com/blog/improving-frontend-design-through-skills); [Prompting for frontend aesthetics (cookbook, 2025-10-21)](https://platform.claude.com/cookbook/coding-prompting-for-frontend-aesthetics)
- cookbook 타이포 지침: "Arial, Inter 같은 generic 폰트를 피하고 독특한 선택", 색은 지배색+날카로운 악센트, IDE 테마·**문화적 미학**에서 영감. (보라색 그라데이션 언급은 제3자 요약에만 있어 미확인) — [cookbook](https://platform.claude.com/cookbook/coding-prompting-for-frontend-aesthetics)
- doc-coauthoring(375줄): 3단계 — ① Context Gathering(질문·정보 덤프) ② Refinement & Structure(질문→브레인스토밍→큐레이션→갭 체크→초안→반복) ③ **Reader Testing: 문맥 없는 새 서브에이전트에 문서만 주고 독자 예상 질문 5~10개에 답하게 해 오독·모호·모순을 잡고 돌아가 고친다.** — [doc-coauthoring/SKILL.md](https://github.com/anthropics/skills/blob/main/skills/doc-coauthoring/SKILL.md)
- canvas-design: 먼저 4~6문단 "디자인 철학(미학 운동)"을 .md로 쓰고 그것을 시각으로 표현(90% 시각, 10% 텍스트), 주제는 "미묘한 레퍼런스"로 녹이며 기존 작가 모방 금지. — [canvas-design/SKILL.md](https://github.com/anthropics/skills/blob/main/skills/canvas-design/SKILL.md)
- theme-factory: 색·폰트 프리셋 테마 10종(arctic-frost, botanical-garden, desert-rose … tech-innovation)을 아티팩트에 적용. — [theme-factory](https://github.com/anthropics/skills/tree/main/skills/theme-factory)
- internal-comms: 3P 업데이트·사내 뉴스레터·FAQ 예시 파일로 '회사가 좋아하는 형식'을 주입하는 구조(예시 파일 = 스타일 샘플 조건화). — [internal-comms](https://github.com/anthropics/skills/tree/main/skills/internal-comms)
- discernment-nudge: 실질적 답변 뒤 2~3개 후속 질문으로 사용자가 사실 확인·추론 검증·누락 맥락을 점검하게 함(창작 글쓰기에는 생략). — [discernment-nudge/SKILL.md](https://github.com/anthropics/skills/blob/main/skills/discernment-nudge/SKILL.md)
- skill-creator: 의도 파악→인터뷰→SKILL.md 작성(점진적 공개, 500줄 이하 권장 취지)→**스킬 有/無 동시 실행 비교·assertion 채점·뷰어**→피드백 반복→description 트리거 최적화. — [skill-creator/SKILL.md](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md)
- Agent Skills 설계 원칙은 progressive disclosure(메타데이터 → SKILL.md → 번들 파일 순으로 필요 시 로드), 스크립트는 컨텍스트 로드 없이 결정적 실행 가능. 2025-10-16 공개. — [Anthropic Engineering: Equipping agents for the real world with Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)

### Inferences
- manabi 매거진 페이지(일본 생활사 특집)는 "크림+세리프+괘선 다단"이라는 '잡지다운' 기본값에 끌리기 쉽다. frontend-design 원칙상 이 선택은 금지가 아니라 **주제(일본, 인생 주기, 종이 잡지 문법)에서 도출됐다는 근거를 적어야 하는 선택**이 된다. 즉 디자인 플랜 단계에 "기본값 자가 점검" 항목을 넣어야 한다.
- doc-coauthoring의 'Reader Testing(새 서브에이전트 독자 시험)'은 매거진 기사 검수에 그대로 쓸 수 있는 개념이다(한국 독자 페르소나로 오독·궁금증 점검).
- docx/pdf/pptx/xlsx는 Proprietary이므로 파일 이식 금지. Apache-2.0 스킬은 NOTICE·라이선스 표기를 지키면 이식 가능하지만, manabi는 repo 규약(ui-conventions·copy-standard)이 정본이라 **개념 이식**이 맞다.

### Gaps
- doc-coauthoring의 라이선스: 폴더에 LICENSE가 없고 저장소 루트에도 LICENSE가 없음 → 미확인(파일 이식 배제 사유).
- anthropics/skills 스타 수: GitHub API 차단으로 미확인.
- Claude 4 best practices 문서의 장문 산문 지침 원문은 WebFetch 차단으로 2차 요약만 확인(섹션 4 참조).

## 2. 커뮤니티 스킬 컬렉션 — 카피·편집·스타일 가이드·팩트체크·일본어/한국어 글쓰기

### Takeaway
영문 awesome 목록에는 '매거진 편집'급 스킬은 없고, 쓸 만한 것은 ① Wikipedia "Signs of AI writing" 기반 humanizer(MIT) ② 한국어 humanizer 2종(daleseo/korean-skills MIT, nomadamas/k-skill MIT)과 한국어 style-guide·grammar-checker ③ superpowers의 verification-before-completion(MIT, '증거 먼저' 규율) 정도다. 한국어 humanizer들은 S1~S3 심각도·변경률 가드·고유명사/수치 보존 같은 **검수 공학**이 잘 설계돼 있어 개념 차용 가치가 높다.

### Cited Findings
- travisvn/awesome-claude-skills: 최종 커밋 2026-04-29 KST, **LICENSE 파일 없음**(라이선스 미확인). Writing 관련은 사실상 Anthropic 공식(frontend-design, internal-comms, docx 등)과 superpowers 소개뿐. — [travisvn/awesome-claude-skills](https://github.com/travisvn/awesome-claude-skills)
- ComposioHQ/awesome-claude-skills: 최종 커밋 2026-07-24 KST, README에 "Apache License 2.0… Individual skills may have different licenses"(루트 LICENSE 파일은 없음). "Communication & Writing" 범주에 content-research-writer, article-extractor, brainstorming, twitter-algorithm-optimizer 등. — [ComposioHQ/awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills)
- content-research-writer(Composio 동봉): 리서치·인용 추가·훅(도입부) 개선·아웃라인 반복·섹션별 피드백("What works well / Suggestions: 더 구체적으로, 데이터 추가, 흐름") 구조. 별도 license frontmatter 없음(저장소 README의 Apache-2.0 적용으로 보이나 미확인). — [content-research-writer](https://github.com/ComposioHQ/awesome-claude-skills/tree/master/content-research-writer)
- obra/superpowers: MIT(© 2025 Jesse Vincent), v7.0.0, 최종 커밋 2026-10-10 KST. 스킬 15개는 모두 개발 공정(brainstorming, writing-plans, systematic-debugging, TDD, verification-before-completion, writing-skills 등) — 글쓰기 전용 스킬 없음. verification-before-completion의 "Iron Law: 신선한 검증 증거 없이 완료 주장 금지 / IDENTIFY→RUN→READ→VERIFY" 구조는 팩트체크 규율로 전용 가능. — [obra/superpowers](https://github.com/obra/superpowers)
- blader/humanizer: MIT(© 2025 Siqi Chen), v3.1.0, 최종 커밋 2026-09-28 KST, 397줄. Wikipedia "Signs of AI writing" 기반 26개 패턴을 6군(A 연출: not-X-but-Y·한 줄 마무리·심오한 척 격언·빌드업·가상의 반론 / B 규칙적 리듬: 강제 3박자·같은 문두·대시 남용 / C 과장·빌린 권위 / D 규칙적 서식: 장식 볼드·장식 헤딩 / E 채팅 잔재 / F 엉뚱한 독자)으로 분류. 공정: 신호 표시→초안→낭독 점검(사실·이름·숫자·인용 추가/누락 확인)→최종본. **글쓴이 샘플이 있으면 샘플이 규칙보다 우선**. 스타 수는 제3자 집계 약 2,910(미확인). — [blader/humanizer](https://github.com/blader/humanizer); [agentskill.work 집계](https://agentskill.work/en/skills/blader/humanizer)
- daleseo/korean-skills: MIT(© 2026 Dale Seo), 최종 커밋 2026-05-05 KST. 3개 스킬 — humanizer v1.6.0(40개 패턴, 6범주: 문장부호·띄어쓰기·품사 다양성·어휘·구조·번역투; ✅과학적/📊경험적 검증 표기; S1~S3; 자연도 등급 A~D; **의미 보존 자체 검증 필수 단계**; 변경률 가드 <30% 정상/30~50% 경고/>50% 중단), style-guide v1.1.0(어조·용어·숫자·목록·따옴표·날짜 7범주 × 문서 타입 4종 장르 매트릭스로 일관성 검사), grammar-checker v1.0.1(맞춤법·띄어쓰기·문법·구두점, 확신도 표시, 과교정 회피). 스타 49(제3자 집계, 미확인). — [daleseo/korean-skills](https://github.com/daleseo/korean-skills); [claudemarketplaces 집계](https://claudemarketplaces.com/skills/daleseo/korean-skills/humanizer)
- nomadamas/k-skill: MIT, 최종 커밋 2026-10-08 KST, 한국 생활 스킬 100여 종 중 korean-humanizer·korean-spell-check·korean-slang-writing·korean-character-count 포함. korean-humanizer의 `ai-tell-taxonomy.md`는 A 번역투 / B 영어 인용 과다 / C 구조적 AI 패턴 / D AI 관용구(결산 피벗 "결론적으로·이를 통해", "시사하는 바가 크다", hype 어휘 3회+, 의인화 추상 주어 "시대가 부른다", 결말 공식 "~할 때다", "X에서 Y로" 반복, 과장된 의의 '이정표·새 지평', 출처 없는 권위 "전문가들은") / E 리듬·종결어미 / F 과잉 수식 / G hedging / H 접속사 남발 / I 형식명사 / J 시각 장식 / 챗봇 잔재. **제외 대상: 고유명사·수치·날짜·직접 인용·법조문**. 자가검증 6항(보존 100%·변경률 30% 이하·장르 이탈 없음·격식 보존·S1 0건·원문에 없던 비유 추가 금지) 위반 시 해당 편집 롤백. 스타 7.1k(제3자 집계, 미확인). — [nomadamas/k-skill](https://github.com/nomadamas/k-skill); [claudemarketplaces 집계](https://claudemarketplaces.com/skills/nomadamas/k-skill/korean-humanizer)
- daleseo humanizer가 근거로 삼는 KatFishNet(ACL 2025 Long, Park·Kim·Kim·Han, 연세대): 한국어 LLM 생성문은 쉼표 사용·띄어쓰기 패턴·품사 다양성에서 사람 글과 다르며, 기존 최고 탐지기 대비 평균 AUROC 19.78% 향상. 데이터는 논설문·시·논문 초록 3장르. — [ACL Anthology 2025.acl-long.1030](https://aclanthology.org/2025.acl-long.1030); [arXiv 2503.00032](https://arxiv.org/html/2503.00032v2)
- 일본어 humanizer 스킬("humanizer-japanese", 33패턴)은 제3자 레지스트리에만 있고 원 저장소·저자 미확인. — [claudskills.com](https://claudskills.com/skills/humanizer-japanese/)

### Inferences
- 매거진 기사의 "AI 말투 제거" 단계는 k-skill/daleseo의 **분류 체계 + 보존 규칙 + 변경률 가드** 3종 세트를 개념으로 가져오면 된다. 특히 "고유명사·수치·인용은 건드리지 않는다"는 manabi IP 정책(실존 상호·지명을 적극 사용)과 팩트체크 정합성 모두에 필요하다.
- 두 한국어 스킬은 MIT라 파일 이식도 법적으로 가능하지만, manabi 정본(`docs/design/copy-standard.md`, 해요체 등)과 레지스터가 다르다(매거진은 해라체/평서 서술 가능성). 파일째 넣으면 정본이 둘로 갈린다 → CLAUDE.md '중복 신설 금지' 원칙상 부분 채택이 맞다.

### Gaps
- 영어권 awesome 목록에서 '팩트체크 전용' 또는 '매거진/편집부' 스킬은 찾지 못함(검색·목록 검토 기준). 존재하지 않는다는 증거는 아님.
- 각 저장소 스타 수·이슈 활동은 API 차단으로 직접 확인 못함.

## 3. 일본 커뮤니티 프롬프트·스킬 (深津式, ゴールシーク, PASONA 등) 및 한국 커뮤니티

### Takeaway
일본 프롬프트 기법은 모두 **구조 템플릿**(深津式 = 命令書/制約条件/入力文/出力文 분리, ゴールシーク(シュンスケ式) = 목표 선언 후 AI가 역질문으로 부족 정보를 채우는 대화형)이며 특정 문구 저작권보다 '개념'으로 쓰는 것이 적절하다. 일본어 AI 문체 검출 OSS로는 textlint-ja의 `textlint-rule-preset-ai-writing`(MIT, azu)이 사실상 표준이고, textlint MCP 서버로 Claude Code와 "생성→검사→수정" 루프를 공식 상정한다. Zenn에서는 '기획/본문/교정/종합 리뷰/PII 체크'를 별개 스킬로 분리하는 운용 사례가 반복된다.

### Cited Findings
- 深津式汎用プロンプト: note CXO 深津貴之 고안. 「命令書」로 역할 부여 → 「制約条件」(글자 수, '초등학생도 알게' 등) → 「入力文」 → 「出力文」(빈칸)로 분리. note사 사내 메일 작성에 활용, 내용·제약만 바꿔 재사용. **원문 note 기사는 1차 확인 못함(2차 해설만)**. — [scrapbox 기록](https://scrapbox.io/shu-san/%E3%83%97%E3%83%AD%E3%83%B3%E3%83%97%E3%83%88%E3%82%A8%E3%83%B3%E3%82%B8%E3%83%8B%E3%82%A2%E3%83%AA%E3%83%B3%E3%82%B0%E3%80%81%E3%83%97%E3%83%AD%E3%83%B3%E3%83%97%E3%83%88%E3%83%87%E3%82%B6%E3%82%A4%E3%83%B3); [AIsmiley](https://aismiley.co.jp/ai_news/what-is-fukatsu-prompt/); [WEEL](https://weel.co.jp/media/prompt-technique)
- ゴールシークプロンプト(シュンスケ式): ひふみ㈱ 林駿甫 고안. 최종 목표를 먼저 정하고 "이 목표를 위해 어떤 추가 정보가 필요한지 질문하라"며 AI가 역질문하게 해 반복적으로 정밀도를 높임. 세부 템플릿 원문은 미확인. — [MiraLab](https://miralab.co.jp/media/goal_seek_prompt/); [WEEL](https://weel.co.jp/media/chatgpt-prompt-design)
- 新・PASONAの法則: 神田昌典 『稼ぐ言葉の法則』(ダイヤモンド社)에 수록, 1999년 개발된 PASONA의 신판. PASBECONA는 PASONA의 웹 시대 발전형으로 소개됨. **각 단계 정의·QUEST 공식은 이번 검색에서 1차 확인 못함(미확인)**. 모두 판매 카피(DR) 공식이라 매거진 피처 문체와는 거리가 있음. — [diamond.jp](https://diamond.jp/articles/-/85746); [booklog](https://booklog.jp/item/1/4478067481); [SBbit](https://www.sbbit.jp/article/cont1/38231)
- `@textlint-ja/textlint-rule-preset-ai-writing`: MIT(© 2025 azu), v1.7.0, 최종 커밋 2026-05-14 KST. 원칙 "표현이 아니라 구조를 묶는다". 규칙 5종 — no-ai-list-formatting(「- **重要**: …」식 볼드 라벨 목록), no-ai-hype-expressions(과장·hype·절대 표현·추상 표현), no-ai-emphasis-patterns(강조 남발), no-ai-colon-continuation(「実行します:」처럼 술어 뒤 콜론으로 블록을 잇는 영어식 서식; 「使用方法:」 명사 종지는 허용), ai-tech-writing-guideline(7C 원칙, 「まず最初に」「することができます」 등 장황 표현). `npx textlint --mcp`로 MCP 서버화해 "AI 생성 → textlint 검사 → AI 수정" 루프 공식 지원. textlint 15.1.0+ 필요. — [textlint-ja/textlint-rule-preset-ai-writing](https://github.com/textlint-ja/textlint-rule-preset-ai-writing)
- 일본 'AI 같은 문장' 신호(비공식 종합): 단락 리듬·어미 균일, 정형 마무리, 근거 없는 대언장담. 반면 「いかがでしたか」는 AI 이전 SEO 양산 기사 정형구라 AI 판정 근거로 불충분하다는 반론. 통일된 권위 기준은 없음. — [smartwatchlife.jp](https://www.smartwatchlife.jp/60468/); [fyve.co.jp](https://fyve.co.jp/ai-advisor/articles/ai-text-detection-myths-japan); [HubSpot JP 체크리스트 PDF](https://offers.hubspot.jp/hubfs/53/jp-offer/chatgpt-at-work-bundle-1/AI-Generated%20Content%20Refinement%20Checklist_JA.pdf)
- Zenn 사례: Givery AI Lab은 骨子作成·本文化·文章校正·包括レビュー·PIIチェック를 5개 스킬로 분리하고 교정 스킬은 집필 스킬과 역할을 고정 분리; atsushi11o7은 기계적 점검(frontmatter·이미지 경로·표기 규칙)=Skill, 흐름·가독성 판단=편집 리뷰 Agent로 분리; 복수 글이 SKILL.md 본문 500줄 이내·세부 규약은 references/로 분리를 권장. — [Givery AI Lab (Zenn)](https://zenn.dev/givery_ai_lab/articles/3807845e371a1c); [atsushi11o7 (Zenn)](https://zenn.dev/atsushi11o7/articles/zenn-writing-with-claude-code); [nomuraya (Zenn)](https://zenn.dev/nomuraya/articles/claude-code-skills-poc-advanced)
- 일본 잡지 편집부 실험(DIME, 2024-04): ChatGPT로 원고·제목·디자인·이미지 생성 검증 — 요약 성향이 강해 자연스러운 문장은 약하나 반복 대화로 정밀도 상승, 전문용어 쉬운 말 바꾸기가 특히 유용. 모델 세대가 오래돼 현재 성능과 다름. — [DIME](https://dime.jp/genre/1748558/2)
- 한국: "자연스럽게 써 줘"는 효과가 약하므로 어조를 형용사가 아닌 **구체 조건 + 자기 글 표본**으로 지시하고 결과를 기계 검사·낭독으로 다시 거르라는 실무 조언; 번역투·사실 없는 과장·AI식 지시문·문어체 어휘가 주요 교정 대상(교정 사례 36건). 과잉 공감 'GPT 어화둥둥체' 밈. — [디지털마케터: 말투와 문체 지시하기](https://www.digitalmarketer.co.kr/class/prompt-design-in-practice/tone-and-style-instructions); [디지털마케터: AI 말투 교정](https://www.digitalmarketer.co.kr/insights/ai-writing-tone-editing); [위픽레터](https://letter.wepick.kr/post/23702)

### Inferences
- 深津式·ゴールシーク는 manabi에 이미 있는 SPEC 발주 구조(역할/제약/입력/출력, 착수 전 질문)와 사실상 같다 → 새 파일 불필요, "편집 브리프 양식"과 "착수 전 역질문" 단계로 흡수하면 된다.
- PASONA류 판매 공식은 매거진 피처(서사·관찰)와 결이 맞지 않는다. 쓰더라도 '특집 표지 문구·광고성 배너' 등 한정 용도.
- textlint 프리셋은 **일본어 텍스트 검사기**라 한국어 본문에는 직접 쓸 수 없다. 단, manabi 매거진에 일본어 원문 인용·예문이 들어가면 그 부분의 기계 검사, 그리고 "구조를 묶는다"는 설계 사상(볼드 라벨 목록·콜론 연결 같은 구조 신호 검출)은 한국어 계약 테스트 설계에 차용 가능.

### Gaps
- 七里式 프롬프트: 이번 조사에서 신뢰할 만한 출처를 찾지 못함(존재 여부 미확인).
- QUEST 공식(마이클 포티 계열로 알려짐)의 일본어 1차 출처 미확인.
- 일본어 '편집자(編集者) 페르소나' 전용 Claude 스킬·GitHub 저장소는 찾지 못함.
- 深津 원문(note) 1차 확인 불가(WebFetch 차단).

## 4. 창작 글쓰기 품질에 검증된 프롬프팅 기법 — 문체 표본, 비평→수정, 편집자 페르소나, 추고 체크리스트, 금지어, 평가 루브릭, Anthropic 문서

### Takeaway
반복적으로 확인되는 패턴은 ① **문체 표본 조건화**(규칙보다 표본이 우선 — humanizer·한국 실무 조언·internal-comms 예시 파일) ② **"하지 말라"보다 "이렇게 하라" + 피할 기본값의 명시적 열거**(Anthropic best practices·frontend cookbook) ③ **2패스: 계획/초안 → 브리프 대비 자기 비평 → 수정**(frontend-design, humanizer) ④ **문맥 없는 새 독자 에이전트 시험**(doc-coauthoring) ⑤ **보존 불변식 + 변경률 가드 + 심각도 등급 루브릭**(한국어 humanizer들)이다. 팩트체크는 Anthropic 공식 '환각 줄이기' 지침(모름 허용·직접 인용 먼저·주장마다 인용, 못 찾으면 철회)이 기준선이다.

### Cited Findings
- Anthropic Claude 4 best practices: 하지 말 것 대신 할 것을 말하라(예: "부드럽게 흐르는 산문 문단으로"), **프롬프트의 서식 스타일이 응답 스타일에 영향**을 준다(산문을 원하면 프롬프트도 산문으로). — [Claude 4 best practices](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices) (WebFetch 차단으로 검색 요약 경유)
- 최신 모델은 지시를 더 문자 그대로 따르므로 "깔끔하고 미니멀하게" 같은 모호한 지시는 과도하게 빈약한 결과를 낼 수 있어, 하지 말 것의 가드레일을 명시하라는 제3자 관찰. — [UX Planet (2차)](https://uxplanet.org/prompting-best-practices-for-claude-code-62a914e0fca9)
- Anthropic 환각 줄이기: "모른다"고 말할 권한 명시, 긴 문서(>20k 토큰)는 **원문 직접 인용을 먼저 뽑고** 작업, 각 주장에 인용·출처를 달고 생성 후 **뒷받침 인용을 못 찾으면 주장 철회**, 인용문과 원문의 문자열 일치율 검사. — [Reduce hallucinations (Anthropic docs)](https://docs.anthropic.com/en/docs/test-and-evaluate/strengthen-guardrails/reduce-hallucinations)
- Wikipedia "Signs of AI writing"(WikiProject AI Cleanup, 단축 WP:AISIGNS): 정책이 아닌 서술적 관찰 모음이며 특정 단어 금지가 아님; 판정은 **신호의 조합**으로 하고 자동 탐지기를 신뢰하지 말 것. 범주: 홍보성·과장("stands as a testament", "rich cultural heritage"), 편집자적 논평("it's important to note"), 정형 접속사·마무리 요약("In conclusion"), 저명성 부풀리기, 제목 대문자·마크다운 등 기술적 흔적. — [The Decoder](https://the-decoder.com/heres-how-to-spot-ai-writing-according-to-wikipedia-editors/); [TechCrunch 2025-11-20](https://techcrunch.com/2025/11/20/the-best-guide-to-spotting-ai-writing-comes-from-wikipedia/)
- humanizer 설계 근거: "모델은 가장 넓은 독자에 맞는 선택을, 사람 작가는 한 독자·한 주제에 맞는 선택을 한다"; 어휘 습관은 모델마다 바뀌지만 **구조적 습관(연출·규칙적 리듬·과장·규칙적 서식·잔재·엉뚱한 독자)은 지속**되므로 구조를 우선 본다; "남기는 모든 문장은 독자가 아직 갖지 못한 것을 더해야 한다". — [blader/humanizer SKILL.md](https://github.com/blader/humanizer/blob/main/SKILL.md)
- 비평→수정 사례: Mistral 공식 쿡북은 뉴스 기사를 '스타일' 관점에서 비평하고 문제점과 개선 예를 내게 하는 프롬프트를 제공. — [Mistral cookbook](https://docs.mistral.ai/cookbooks/mistral-data_generation-data_generation_refining_news)
- 일본 교육 현장 보고: AI 제안을 그대로 채택하지 말고 자기 글과 **나란히 비교**해 의도 부합 여부를 판단하게 함. — [文部科学省 リーディングDXスクール 실천 보고 PDF](https://leadingdxschool.mext.go.jp/files/achieve_r6/ai/C147232500011_B3.pdf)
- AI 탐지 점수는 문장 길이 균일성·접속사 빈도 등의 통계 추정일 뿐이라 그대로 믿지 말라는 지적(일본). — [Luft AI 日本語チェック](https://www.luft.co.jp/cgi/ai-ja-text-check.php); [fyve.co.jp](https://fyve.co.jp/ai-advisor/articles/ai-text-detection-myths-japan)

### Inferences
- 매거진 문체는 "규칙 목록"만으로는 고정되지 않는다. **기준 표본 기사(오너 승인본) 2~3편을 references/에 두고 표본 우선** 원칙을 명시하는 것이 가장 효과가 클 것으로 본다(여러 독립 출처가 같은 결론).
- 금지어 목록은 '단어 금지'가 아니라 '빈도·조합 기반 심각도'로 운용해야 오탐(정당한 "결론적으로" 1회 등)을 피한다(Wikipedia·k-skill·daleseo 공통).
- 팩트체크는 "주장 목록화 → 각 주장에 출처 대조(직접 인용) → 못 찾으면 삭제/완화 → 수치·고유명사 변경 금지 불변식"이 최소 계약. manabi의 '원칙은 계약 테스트로 심는다' 규약에 맞춰, 출처 필드 누락·금지 구조 패턴을 테스트로 고정할 수 있다.

### Gaps
- 문체 표본 조건화·비평-수정 루프의 **정량 효과**를 보여주는 1차 연구는 이번에 확보하지 못함(실무·공식 가이드 수준 근거).
- Anthropic 문서의 장문 글쓰기 전용 페이지 원문(차단으로 미열람) — 2차 요약에 기반.

## 5. 일본어·한국어 AI 문체 탐지 OSS

### Takeaway
일본어는 textlint-ja AI 프리셋(MIT, 규칙 기반·MCP 연동)이 실용 표준이고, 한국어는 학술 탐지기 KatFishNet(ACL 2025, 코드 공개)과 이를 근거로 한 규칙형 스킬(daleseo humanizer)이 있다. 다만 통계 탐지기는 판정 도구로 신뢰하지 말라는 것이 Wikipedia·일본 실무 양쪽의 공통 경고다.

### Cited Findings
- textlint-ja/textlint-rule-preset-ai-writing (MIT, v1.7.0, 2026-05-14 KST, textlint MCP 연동) — [GitHub](https://github.com/textlint-ja/textlint-rule-preset-ai-writing)
- KatFishNet: 한국어 LLM 생성문 탐지, 쉼표·띄어쓰기·품사 다양성 특징, 코드·데이터는 저자(Shinwoo-Park) GitHub에 공개 링크. 라이선스 미확인. — [arXiv 2503.00032](https://arxiv.org/html/2503.00032v2); [ACL Anthology](https://aclanthology.org/2025.acl-long.1030)
- daleseo/korean-skills humanizer: KatFishNet 기반 패턴(문장부호 7·띄어쓰기 3·품사 3 등) + 경험적 번역투 13 등 40패턴, MIT. — [daleseo/korean-skills](https://github.com/daleseo/korean-skills)
- nomadamas/k-skill korean-humanizer: 규칙형 taxonomy, 외부 호출 없음, MIT. — [nomadamas/k-skill](https://github.com/nomadamas/k-skill)
- Wikipedia 지침은 자동 AI 탐지기 의존을 경고. — [The Decoder](https://the-decoder.com/heres-how-to-spot-ai-writing-according-to-wikipedia-editors/)

### Inferences
- manabi에는 **탐지 점수가 아니라 '구조 신호 린트'**가 맞다: 볼드-라벨 목록, 헤드라인 단어 하나 강조, '결론적으로/시사하는 바' 계열 S1 구문, 원문에 없는 수치 등. 자체 정규식 계약 테스트로 구현하면 외부 의존 없이 CI에서 잡힌다(fitty→cqi, jsdiff→자체 LCS 선례와 같은 '선례 검증 후 자체 구현' 경로).

### Gaps
- 한국어 textlint 대응(예: textlint-rule-preset-korean) 계열의 AI 문체 규칙은 찾지 못함.
- KatFishNet 코드 라이선스·유지 상태 미확인.

## 6. manabi 적용 후보 및 `/magazine-edit` 커맨드 스케치

### Takeaway
파일째 이식할 대상은 사실상 없다(정본 중복·레지스터 불일치·일부 Proprietary/라이선스 미확인). 대신 frontend-design의 '기본값 군집 자가 점검 + 2패스', doc-coauthoring의 '새 독자 시험', 한국어 humanizer의 '심각도·보존 불변식·변경률 가드', Anthropic의 '인용 근거 팩트체크'를 개념으로 묶은 repo-local 커맨드 하나(`.claude/commands/magazine-edit.md`)와 계약 테스트로 심는 것이 최적이다. 일본어 원문이 섞이는 경우에만 textlint AI 프리셋을 개발 의존성으로 검토한다.

### Cited Findings
- 근거 출처는 위 1~5절의 각 인용을 따른다(아래 표의 근거 열은 그 요약). 기존 repo 커맨드: `/korean-copy`는 UX 문구(해요체, A/B/C 3안) 전용이며 정본은 `docs/design/copy-standard.md` — repo 내 `.claude/commands/korean-copy.md` 직접 확인.

### manabi 적용 후보 표

| 항목 | 판정 | 근거 |
|---|---|---|
| anthropics/skills **frontend-design** (Apache-2.0) | 부분 채택(개념) | '기본값 5군집'(크림+세리프, broadsheet 괘선 다단 등)이 매거진 페이지의 함정과 정확히 겹침. 2패스(토큰 플랜→브리프 대비 검토→코드)·"대담함은 한 곳에"를 커맨드 단계로 흡수. 파일 이식은 `docs/ui-conventions.md` 정본과 충돌·중복이라 배제. 이미 세션에 artifact-design 등 유사 지침 존재. |
| Anthropic cookbook *Prompting for frontend aesthetics* | 부분 채택(개념) | "디자인 차원 명명·영감 출처·피할 기본값 명시" 3전략. 영감 출처를 '일본 잡지 조판 문법(세로/가로 혼용, 루비, 여백)'으로 구체화하는 데 사용. |
| **doc-coauthoring** Reader Testing | 부분 채택(개념) | 새 서브에이전트에 기사만 주고 한국 독자 질문 5~10개로 오독·모호 점검. 라이선스 파일 부재(미확인)로 파일 이식 배제. |
| **skill-creator** (Apache-2.0) | 부분 채택(도구 사용) | magazine-edit을 스킬로 승격할 때 with/without 비교 평가 루프에 활용. 파일 이식 불필요(세션에 이미 탑재). |
| theme-factory / brand-guidelines / canvas-design | 배제(참고만) | 프리셋 테마·Anthropic 브랜드는 manabi 토큰 체계와 무관. canvas-design의 '디자인 철학 문서 먼저' 아이디어만 특집 비주얼 방향 문서에 참고 가능. |
| docx / pdf / pptx / xlsx | 배제 | Proprietary(source-available). PDF/인쇄물도 CLAUDE.md상 보류 범위. |
| **discernment-nudge** (Apache-2.0) | 부분 채택(개념) | 오너 보고 끝에 "검증할 사실 2~3개"를 붙이는 관행으로 차용. 창작 본문에는 적용 안 함(스킬 자체가 창작 제외). |
| blader/**humanizer** (MIT) | 부분 채택(개념) | 26패턴의 '구조 우선' 분류(연출·규칙적 리듬·과장·서식·잔재·엉뚱한 독자)와 "표본이 규칙보다 우선". 영어 중심이라 파일 이식 배제. 원 지침(Wikipedia)은 CC BY-SA이므로 문장 복제 시 라이선스 유의. |
| daleseo/korean-skills **humanizer·style-guide·grammar-checker** (MIT) | 부분 채택(개념) | 40패턴 범주·S1~S3·자연도 A~D·의미 보존 자체검증·변경률 가드(30/50%)·장르 매트릭스. 파일 이식은 copy-standard와 정본 이중화 우려로 보류. 필요 시 MIT 고지 유지 조건으로 references에 발췌 가능. |
| nomadamas/k-skill **korean-humanizer** (MIT) | 부분 채택(개념, 핵심) | D군 'AI 관용구' 목록(결산 피벗·시사하는 바·hype 3회+·의인화 추상 주어·결말 공식·과장된 의의·출처 없는 권위)과 **고유명사·수치·인용 불변** 규칙이 매거진 팩트 보존에 직결. 자가검증 6항을 검수 체크리스트로. |
| obra/superpowers **verification-before-completion** (MIT) | 부분 채택(개념) | "증거 없이 완료 주장 금지"를 팩트체크에 적용: 각 사실 주장 → 출처 확인 행위 → 결과 기록. 개발 공정 스킬이라 파일 이식 불필요. |
| Composio **content-research-writer** | 배제(참고만) | 블로그형 훅·섹션 피드백 일반론, 라이선스 표기 불명확. 새 개념 거의 없음. |
| awesome 목록(travisvn, Composio) | 배제 | 색인일 뿐, 매거진·팩트체크 스킬 부재. travisvn은 LICENSE 없음. |
| **textlint-ja AI-writing 프리셋** (MIT) | 부분 채택(조건부 도구) | 한국어엔 무효. 매거진에 일본어 인용·예문 블록이 들어갈 때만 devDependency+MCP로 검사 검토. "표현이 아니라 구조를 묶는다" 설계 사상은 한국어 계약 테스트에 차용. |
| 深津式 汎用プロンプト | 부분 채택(개념) | 命令書/制約条件/入力文/出力文 = 편집 브리프 양식. 이미 SPEC 발주 관행과 동형이라 새 파일 불필요. |
| ゴールシーク(シュンスケ式) | 부분 채택(개념) | 착수 전 '부족 정보 역질문' 단계. 단 CLAUDE.md의 '짧은 지시도 담당자가 구체화' 원칙과 충돌하지 않게 질문은 owner-gate 사항에 한정. |
| 新PASONA / PASBECONA / QUEST / AIDA | 배제(한정 참고) | 판매 DR 카피 공식이라 매거진 피처 문체와 불일치. 특집 표지·배너 카피에서만 참고. 단계 정의 1차 미확인. |
| PREP | 부분 채택(개념) | 지역학 해설 박스·Q&A 칼럼처럼 '결론 먼저' 형식에 한정. (1차 출처는 이번에 조사하지 않음) |
| Anthropic 환각 줄이기 지침 | 채택(규칙으로 명문화) | 모름 허용·직접 인용 먼저·주장별 출처·못 찾으면 철회 — 매거진 팩트체크의 기준선. 공식 문서라 개념을 커맨드에 직접 규칙화. |
| Anthropic Claude 4 best practices(산문 지시) | 채택(규칙으로 명문화) | "할 것을 말하라", 프롬프트 서식이 출력 서식을 끌고 간다 → 커맨드 본문 자체를 산문 위주로 쓰고 불릿 남발 금지. |
| KatFishNet 탐지기 | 배제 | 판정용 통계 탐지는 Wikipedia·일본 실무 모두 비권장, 운영 부담. 특징(쉼표 과다 등)만 체크리스트에 반영. |
| Wikipedia *Signs of AI writing* | 부분 채택(개념) | '신호 조합으로 판단, 단어 금지 아님' 원칙. 문장 복제는 CC BY-SA 의무 발생하므로 요약만. |

### `.claude/commands/magazine-edit.md` 스케치 (요구 내용 — 문안이 아니라 구성)

1. **역할(편집장 페르소나)**: "일본 생활사를 한국 독자에게 전하는 매거진의 편집장 겸 교열부". 독자 = 일본에 관심 있는 한국인 학습자(manabi 순환과의 접점: 기사 속 단어 저장→FSRS, '이 자료로 오늘 학습'). 브리프의 말이 항상 우선.
2. **입력 브리프 양식(深津式 구조 차용)**: 특집명(「일본, 사람의 일생」 회차)·꼭지 유형(피처/칼럼/인터뷰형 재구성/박스 해설/캡션)·분량·레지스터(평서 해라체 vs 해요체 — 정본 확정 필요)·필수 사실·금지 영역(IP 정책 ⑴~⑷, 중화권 정치 배제)·참고 표본 기사 경로.
3. **착수 전 역질문(ゴールシーク 차용, 제한적)**: owner-gate·사실 근거 부족·레지스터 미정만 질문. 나머지는 '공통 품질 실행 원칙'대로 담당자가 구체화하고 기대 예시를 먼저 기록.
4. **문체 표본 우선**: `docs/magazine/style-samples/`(가칭)의 오너 승인 표본 2~3편을 먼저 읽고 문장 길이·종결어미·문두·접속 방식을 맞춘다. 표본이 아래 금지 목록보다 우선(humanizer 원칙).
5. **집필 2패스**: ① 꼭지 설계 메모(이 꼭지만의 각도·첫 문단에 놓을 가장 특징적인 장면·버릴 것) → "비슷한 주제로 누가 써도 같은 데 도달하는가?" 자가 점검 후 수정 사유 기록 ② 초안.
6. **AI 말투 점검(심각도 기반)**: S1(한 번이라도 제거) — 결산 피벗 남발, "시사하는 바가 크다/주목할 만하다", 의인화 추상 주어, "~할 때다" 결말 공식, 과장된 의의(이정표·새 지평), 출처 없는 권위, 챗봇 잔재, 장식 볼드 라벨 목록. S2(3회+ 시 제거) — "X에서 Y로" 반복, 강제 3박자, 번역투 조사('~에 대해·~을 통해·~에 있어서'), 피동 남용, 줄표 연결. S3(중첩 시만). 단어 금지가 아니라 빈도·조합 판정.
7. **보존 불변식(수정 금지 대상)**: 고유명사(실존 상호·지명·작품명)·수치·날짜·직접 인용·일본어 원문 표기·루비. 윤문 후 원본과 대조해 한 글자라도 바뀌면 그 편집 롤백. 변경률 30% 초과 경고, 50% 초과 중단 후 보고.
8. **팩트체크 게이트(Anthropic 지침 + verification-before-completion)**: 사실 주장을 표로 추출(주장·출처 URL/문헌·직접 인용·확인 시각 KST·상태). 출처 인용을 못 찾으면 삭제 또는 단정 완화. "모른다/미확인" 허용. 통계·연도·제도명은 1차 출처 우선. IP ⑵ 준수: 가사·기사 원문 복제 금지, 제목·인물명 언급만.
9. **독자 시험(doc-coauthoring)**: 문맥 없는 서브에이전트에 기사만 주고 "한국 독자가 물을 질문 5~10개"에 답하게 해 오독·모호·전제 누락을 찾고 해당 단락 수정.
10. **페이지 디자인 연계(frontend-design)**: 레이아웃을 바꾸는 경우 텍스트 목업 우선(CLAUDE.md 규약). 토큰 플랜(4~6 hex·서체 역할·ASCII 와이어프레임)에 '기본값 군집 자가 점검' 항목(크림+세리프, 괘선 다단, 대문자 아이브로, 중점 메타, 단어 하나 강조, 섹션마다 fade-up)을 두고, 쓴다면 주제 근거를 한 줄로 적는다. 정본은 `docs/ui-conventions.md`.
11. **출력 형식**: ① 최종 원고 ② 팩트 표 ③ 잔존 신호 목록(S1 0건 확인)·자연도 등급 A~D ④ 변경률 ⑤ 독자 시험 결과 요약 ⑥ 오너가 확인할 사실 2~3개(discernment-nudge 차용). 시각은 KST.
12. **계약 테스트로 심을 것(문서가 아니라 테스트)**: 매거진 콘텐츠 파일에서 S1 구문 정규식 0건, 볼드-라벨 목록 패턴 0건, 모든 사실 블록에 출처 필드 존재, 금지 IP 패턴(가사 블록 등) 0건 — 기존 `ipPolicy.test.js`·`uiConventions.test.js`와 같은 방식.
13. **참조 분리(progressive disclosure)**: 커맨드 본문은 짧게, S1~S3 상세 목록·표본·장르 매트릭스는 `docs/magazine/` 하위 references로(Zenn 사례·Anthropic 권고: 본문 500줄 이내).

### Inferences
- 기존 `/korean-copy`(UX 마이크로카피, 해요체 3안)와 `/magazine-edit`(장문 피처·교열·팩트)은 범위가 달라 공존 가능하나, 금지 표현 목록은 한 곳(예: copy-standard의 하위 절 또는 docs/magazine 정본)에만 두어야 중복 신설 금지 원칙을 지킨다.
- 커맨드보다 스킬(SKILL.md + references)로 만들면 description 트리거와 점진적 공개 이점이 있으나, repo 관례가 `.claude/commands`이므로 1차는 커맨드, 사용이 안정되면 skill-creator로 평가 후 승격하는 경로가 무난하다.

### Gaps
- 매거진 레지스터(해라체 평서 vs 해요체) 결정은 오너 확인 필요 — copy-standard는 UX 기준이라 장문 기사에 그대로 적용되는지 미확인.
- 표본 기사(스타일 샘플)가 아직 없다면 1~2편을 먼저 오너 승인받아야 4번 단계가 작동한다.
