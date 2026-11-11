# heydamir/unslop — 제3자 스킬 1종

- 출처: https://github.com/heydamir/unslop (CC BY 4.0) · 커밋 `97daa3eb365670ea3f87ed85356cbfcee18105a5`(2026-11-09) · 가져온 날 2026-11-11 KST
- 만든 이: Damir Sokolovsky([@heydamir](https://x.com/heydamir)) — 「unslop was created by Damir Sokolovsky, who started the Unslopping series on X」. 라이선스가 이 표기를 사본 · 각색에 남기라고 요구한다. 지우지 않는다.
- 가져온 것: `skills/unslop` 통째(SKILL.md · references · scripts · agents) — 원문 그대로(수정 없음) + 저장소 루트의 `LICENSE` 사본. 갱신은 같은 방식으로 통째 교체하고 커밋을 여기 적는다.
- 가져오지 않은 것: `examples/` · `test/` · README(스킬 밖 파일).

## 이 저장소에서 쓰는 법(오너 지시 2026-11-11 KST — 「디자인 unslop skill 도입해」)

- **감사와 방향 제안까지만, 고치기는 목업 뒤.** 스킬은 원래 감사 → 방향 확인 → 아홉 패스로 코드를 고친다. 이 저장소는 화면이 바뀌는 변경을 목업 승인 뒤에 한다(CLAUDE.md 「UI 변경은 목업 우선」). 그래서 감사(`references/signs.md` 대조) · 방향 다섯 줄 · 패스별 제안까지만 내고, 고칠 것은 실제 빌드 앞뒤 캡처 아티팩트로 올린 뒤 구현한다.
- **정본은 우리 문서다.** 색 토큰 · 간격 · 글꼴 · 브레이크포인트는 `docs/ui-conventions.md`, 문구는 `docs/design/copy-standard.md`가 정본이다. 스킬의 `references/tokens.md` 값(회색 램프 · 글꼴 표 · lucide 등)은 참고일 뿐이고, 어긋나면 우리 문서를 따른다 — 새 색 · 글꼴 · 아이콘 세트를 스킬 기준으로 들이지 않는다.
- **이미지 생성 · 외부 서비스 연결 금지.** 스킬은 fal · Replicate · OpenAI 이미지 같은 유료 생성 도구를 쓰거나 MCP로 연결하자고 제안할 수 있다. 하드리밋(실화폐 금지 · 새 환경 변수 · 권한 확대)이라 하지 않는다. 그림이 필요하다는 판단은 제안 목록에만 적는다.
- **스토리 영상 · 라이브 스냅숏은 기본으로 쓰지 않는다.** `scripts/story.mjs`(ffmpeg)와 `scripts/snapshot.mjs`(남의 사이트 저장)는 오너가 따로 요청할 때만. 우리 화면은 기존 화면 벽 환경(`scripts/wall-capture.mjs`)의 실제 빌드로 본다.
- 한국어 · 일본어 · 중국어 본문 조판(후리가나 · 병음 · 줄 간격)은 스킬이 다루지 않는다. 스킬의 글자 규칙(대문자 라벨 · 자간 등)은 라틴 문자 UI에만 대조한다.

## 라이선스

Creative Commons Attribution 4.0 International — 전문은 `.claude/skills/unslop/LICENSE`. 표기 문구는 `.claude/skills/unslop/SKILL.md` 머리에 원문 그대로 있다.
