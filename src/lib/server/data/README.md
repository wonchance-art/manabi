# src/lib/server/data — 생성 데이터의 출처·라이선스

서버 분석(`tokenizeZh` → `/api/analyze`)이 읽는 정적 데이터다. 사용자에게 보이는 결과
(병음 루비·품사·이합사 연결)를 바꾸므로 원천 라이선스를 파일 옆에 적어 둔다.
생성기 주석이 1차 근거이며, 이 표는 그 요약이다(감사 2026-10-07 KST).

| 파일 | 원천 | 라이선스 | 생성기 | 원천에서 바꾼 것 |
|---|---|---|---|---|
| `zhNeutralToneCedict.json` | CC-CEDICT © MDBG (npm `cedict-json@1.3.20251213`, 2025-12-13 스냅샷) | **CC BY-SA 4.0** — 출처 표기·라이선스 링크·변경 고지·동일조건 | `scripts/build-zh-neutral-tone.mjs` | 경성 표제어만 추출, 다의어·고유명사·얼화·5자 이상·라이브러리 정답 일치 항목 배제, 수제 층(`zhNeutralTone.js` HAND)이 덮음. 2,018항 |
| `zhPosFixHsk.json` | ivankra/hsk30 (`hsk30.csv`) | MIT | `scripts/build-zh-hsk.mjs` | 품사 열만 사용. CC-CEDICT는 고유명사 판별(병음 대문자)에만 쓰고 그 내용을 싣지 않는다 |
| `zhSeparableHsk.json` | ivankra/hsk30 (WebPinyin ∥ 분철 마커) | MIT | `scripts/build-zh-hsk.mjs` | 2자 V+O 이합사만, 수제 층과 중복 제외 |
| `zhSeparable.json` | 자체 작성(수제 층) | — | — | — |

## CC-CEDICT (CC BY-SA 4.0)

- 저작권: © MDBG — <https://www.mdbg.net/chinese/dictionary?page=cc-cedict>
- 라이선스: Creative Commons Attribution-ShareAlike 4.0 International —
  <https://creativecommons.org/licenses/by-sa/4.0/>
- `zhNeutralToneCedict.json`은 위 원천을 가공한 **파생 데이터**이며 같은 CC BY-SA 4.0으로
  제공된다. 이 파일에 추가 제한을 두지 않는다.
- 사용자 표시: 앱의 자료 출처 화면에 같은 고지를 싣는다(도입 PR에서 연결).

재생성 시 원천 버전이 바뀌면 이 표의 스냅샷 날짜와 항목 수를 함께 갱신한다.
