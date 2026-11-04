/**
 * 지표 사전(STATS-MAP-001 S1, 오너 결정 2026-11-01 KST) — 화면에 나오는 통계 이름 · 정의 · 단위 · 하루 경계를 한 곳에.
 *
 * ── 왜
 * 「아는 단어」 한 이름이 네 값을 가리켰다: 현황 = 「이미 알아요」 표시 수 · 서재 = 안정도 7일 이상 · 뷰어 = 이 글의 아는 말 비율 ·
 * 단어 목록 = 졸업. 같은 이름 · 다른 숫자는 화면끼리 서로를 반증하고, 바깥(에이전트 요약)으로 나가면 어느 쪽인지 아무도 모른다.
 * 이름은 여기서만 받는다 — 같은 이름이 두 정의에 붙으면 계약(metricRegistry.test.js)이 잡는다.
 *
 * ── 세는 단위 (오너 결정 5, 2026-11-01 KST — CARD-TYPES-001 설계 §6 권장안)
 * 화면의 큰 숫자는 **단어 단위**(한 단어에 카드가 몇 장이든 하나). 기억률 표만 카드 종류별 줄(단어 → 뜻 · 뜻 → 단어 · 듣기)을 더한다.
 * 꺼 둔 카드 종류는 통계에서 뺀다. 카드 종류가 들어오기 전까지는 카드 = 단어라 둘이 같다.
 *
 * ── 하루 경계 (오너 결정 2, 2026-11-01 KST)
 * 표시 통계는 04시 학습일(fsrsScheduler.learningDay)로 통일한다. 연속(DB fsrs_private.activity_day)도 2026-11-03 04:00 KST부터
 * 같은 학습일이다(STREAK-LEARNING-DAY-001, 마이그레이션 20261101130000 · 운영 실측 11/3 · 11/4) — 그래서 streak.day도 'learning'.
 * 순수 상수 모듈 — import 없음.
 */
export const COUNT_UNIT = 'word';

export const METRICS = Object.freeze({
  knownMarked: Object.freeze({ label: '이미 아는 단어', unit: '단어', day: null,
    def: '「이미 알아요」로 표시한 단어 수(user_known_words). 복습 일정에서 빠진다.' }),
  remembered: Object.freeze({ label: '기억한 단어', sub: '일주일 넘게 기억한 단어', unit: '단어', day: null,
    def: '담은 단어 중 기억 안정도가 7일 이상인 단어 수(growthStats.isKnownWord).' }),
  textCoverage: Object.freeze({ label: '이 글에서 아는 말', short: '아는 말', unit: '%', day: null,
    def: '이 글의 내용어 중 담은 표현 ∪ 이미 아는 단어가 덮는 비율(materialFit).' }),
  predictedRetention: Object.freeze({ label: '유지율', unit: '%', day: null,
    def: '지금 기억하고 있을 확률의 예측 평균(memoryHealth). 측정값이 아니다.' }),
  trueRetention: Object.freeze({ label: '실제 기억률', unit: '%', day: 'learning',
    def: '복습 단계 단어를 다시 만났을 때 기억해 낸 비율의 측정값(trueRetention).' }),
  weeklyReviews: Object.freeze({ label: '이번 주 복습', unit: '문항', day: 'learning',
    def: '이번 주 채점 문항 수와 정답 비율(weeklyReport). 연습 · 목록 자기 확인은 활동량에만.' }),
  streak: Object.freeze({ label: '연속', unit: '일', day: 'learning',
    def: '하루도 빠짐없이 학습한 날 수(profiles.streak_count). 쉼 1회는 하루 빈 날을 이어 준다.' }),
});
