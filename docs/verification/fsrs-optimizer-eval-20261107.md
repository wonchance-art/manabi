# FSRS 매개변수 최적화 평가 — 오프라인, 적용 안 함 (FSRS-OPT-EVAL-001 · 2026-11-07 KST)

오케스트레이터 순회(16:25 KST) 1번. 운영 일정 적용은 학습 동작 변경이라 별도 결정이다. 여기서는 평가만 한다.

## 데이터(운영, 읽기 전용 · 사용자 · 카드 id는 해시만)
| | 사용자 A | 사용자 B | 나머지 7명 |
|---|---|---|---|
| FSRS v2 유효 채점(`fsrs_effective_reviews`, 되돌린 채점 제외, `optimizerEligible`) | **201**(카드 55장 · 10/22~11/02) | 2(카드 1장) | 0 |
| 그중 다른 날 복습(이전 상태 ≠ New · 경과 ≥ 1일 — 기억 곡선을 시험하는 줄) | **62** | 0 | 0 |
| 옛 기록(`review_events` source vocab, FSRS v2 이전 일정기) | 2,011(낱말 494 · 7/2~11/3) | 46 | 0 |

- 운영 매개변수: ts-fsrs 5.3.2 · FSRS-6 기본 w(`generatorParameters`) · 감쇠 w20 = 0.1542 · 목표 기억률 0.9(`FSRS_POLICY`). 사용자별 최적화는 없다.
- 공식 최소 리뷰 수:
  - Anki 24.06.3 이상은 최소 수가 없다. 리뷰 수에 따라 최적화할 매개변수를 고른다(적으면 첫 복습 안정도만).
  - 그 전에는 24.04가 400, 그보다 앞선 판이 1,000이었다(Anki FSRS FAQ · FSRS4Anki 튜토리얼).
  - 보수 기준 400으로 보면 넘는 사람은 9명 중 **0명**이다(FSRS v2 기준). 옛 기록까지 치면 1명이다.

## 기본값의 예측력(시간 분할 7:3, 다른 날 복습 62줄)
| 구간 | 줄 | 실제 기억 | 기본값 예측 평균 | log-loss 기본값 | log-loss 상수(앞 구간 평균) |
|---|---|---|---|---|---|
| 앞(10/26~10/31) | 43 | 0.837 | 0.845 | 0.571 | 0.444 |
| 뒤(10/31~11/02, 검증) | 19 | 0.789 | 0.868 | **0.526** | **0.522** |

- R = (1 + f·t/S)^(−w20), f = 0.9^(−1/w20) − 1. S는 직전 카드 안정도, t는 경과일, 기억 = 채점 > 1(Again이 아님).
- 검증 구간에서 기본값은 상수 예측과 거의 같다(0.526 vs 0.522). 기억을 8%p 높게 본다(0.868 vs 0.789).
- 19줄로는 차이를 가를 수 없다. RMSE(bins)는 칸마다 표본이 1~5줄이라 의미가 없어 내지 않았다.

## 최적화기 · 선례
| 후보 | 상태 | 판정 | 근거 |
|---|---|---|---|
| fsrs-rs(`@open-spaced-repetition/binding` — WASI 바인딩, `computeParameters`) | MIT · open-spaced-repetition 유지 · ts-fsrs가 공식 짝으로 소개 | **보류(나중 채택 후보)** | 운영 일정기(ts-fsrs)와 같은 모형이다. 이번 세션은 외부 패키지 설치가 권한 판정기에 막혀 직접 돌리지 못했다. 돌려도 지금 데이터(다른 날 62줄)면 첫 복습 안정도(w0~w3)만 조정된다. |
| ts-fsrs 자체 최적화 | 최적화기 없음(일정기만) | 배제 | 매개변수 학습 기능이 없다. |
| 자체 구현(경사 하강 등) | — | 배제 | fsrs-rs가 기준 구현이다. 다시 쓰면 jsdiff → 자체 LCS 같은 선례와 달리 검증 비용만 든다. |
| 옛 기록 2,011줄로 학습 | 다른 일정기 · 채점 의미가 섞임 | 배제(지금) | v2 이전 rating · 간격이 FSRS 상태와 맞물리지 않는다. 섞으면 매개변수가 옛 일정기 습관을 배운다. |

## 결론
- **지금은 적용하지 않는다(배제 · 보류).** 사용자별 최적화가 기본값보다 낫다고 보일 데이터가 없다.
  - 최대 사용자도 다른 날 복습 62줄 · 8일치다.
  - 기본값이 상수 예측과 비긴다는 결과 자체가 「표본 부족」의 증상이다.
- **다시 볼 기준(제안):** 한 사용자의 FSRS v2 유효 채점이 400줄 이상 **그리고** 다른 날 복습이 200줄 이상일 때, fsrs-rs로 시간 분할 평가를 다시 한다.
  - 기본값 대비 검증 log-loss가 낮고 RMSE(bins)가 나아질 때만 적용 결정을 올린다(적용은 오너 결정 — 학습 동작 변경).
- **지금 할 수 있는 무변경 관찰:** 검증 구간에서 기본값이 기억을 8%p 높게 본다. 데이터가 쌓이면 이 차이(보정 곡선)를 같은 SQL로 다시 잰다. 재현 SQL은 이 문서 생성 세션 기록에 있다(읽기 전용).

출처: [Anki FSRS FAQ](https://docs.ankiweb.net/faqs/frequently-asked-questions-about-fsrs) · [FSRS4Anki 튜토리얼](https://github.hscsec.cn/open-spaced-repetition/fsrs4anki/blob/main/docs/tutorial.md) · [How many reviews for accurate optimization?](https://forums.ankiweb.net/t/how-many-reviews-for-accurate-optimization/53320) · [@open-spaced-repetition/binding](https://www.pkgstats.com/pkg:@open-spaced-repetition/binding)
