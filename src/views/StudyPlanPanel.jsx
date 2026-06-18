'use client';

import { useEffect, useState } from 'react';

/**
 * 내 진도 — 관리자 전용 학습 진도표 (12월까지 중국어 HSK5 · 프랑스어 B2).
 * 번호를 클릭하면 완료 토글(localStorage 저장). 어휘 제외, 문형 통합.
 * 각 문법 번호 = 챕터 + 연관 문형 / ✅ = 그 레벨 남은 문형 총정리.
 */

const TARGET = '2026-12-31';

const PLAN = {
  zh: {
    key: 'zh',
    flag: '🇨🇳',
    title: '중국어 → HSK 5',
    note: '문형 451개 통합 · 어휘 제외',
    levels: [
      { name: 'OT 발음·기초', steps: [
        [1, '한어병음'], [2, '성조 4성+경성'], [3, '간체자(한자 다리)'], [4, '기본 어순 SVO'], [5, '인칭대명사'],
      ] },
      { name: 'H1 기초', steps: [
        [6, '是자문'], [7, '有자문'], [8, '这·那'], [9, '양사 个·本·张'], [10, '의문 吗'], [11, '不·没'], [12, '的'],
        [13, '연동문'], [14, '시간·장소 어순'], [15, '숫자·시간'], [16, '부사 都·也'], [17, '喜欢·想·请'], [18, '인사 표현'],
        [19, 'H1 문형 80개 총정리', true],
      ] },
      { name: 'H2 시간·경험', steps: [
        [20, '완료 了'], [21, '경험 过'], [22, '진행 在'], [23, '변화 了'], [24, '비교 比'], [25, '능원동사'],
        [26, '개사 给·对·从'], [27, '시량보어'], [28, '선택의문 还是'], [29, '동량보어'], [30, '정도부사'], [31, '시간 표현'],
        [32, 'H2 문형 90개 총정리', true],
      ] },
      { name: 'H3 연결·확장', steps: [
        [33, '把자문'], [34, '被자문'], [35, '결과보어'], [36, '방향보어'], [37, '정도보어'], [38, '가능보어'], [39, '시량보어'],
        [40, '복문 연결'], [41, '비교 심화'], [42, '존현문'], [43, '정도·범위 부사'], [44, '어림수'], [45, '빈도 부사'],
        [46, 'H3 문형 101개 총정리', true],
      ] },
      { name: 'H4 뉘앙스', steps: [
        [47, '보어 종합'], [48, '가정 即使·要是'], [49, '강조 是…的'], [50, '连…都'], [51, '除了…以外'], [52, '越…越'],
        [53, '반어문'], [54, '개사틀'], [55, '不但…而且'], [56, '담화부사'],
        [57, 'H4 문형 100개 총정리', true],
      ] },
      { name: 'H5 서면어·고급 (← HSK5)', steps: [
        [58, '서면어 레지스터'], [59, '고급 연결어'], [60, '성어'], [61, '사역 使·令·让'], [62, '被동 격식형'],
        [63, '문어 대명사 之·其'], [64, '반어·이중부정'], [65, '的·得·地'],
        [66, 'H5 문형 80개 + HSK5 모의', true],
      ] },
    ],
  },
  fr: {
    key: 'fr',
    flag: '🇫🇷',
    title: '프랑스어 → B2',
    note: '문형 429개 통합 · 어휘 제외',
    levels: [
      { name: 'A0 입문·발음', steps: [
        [1, '오리엔테이션'], [2, '알파벳·악상'], [3, '모음 u/ou'], [4, '자음·묵음'], [5, '리에종'],
        [6, '명사의 성'], [7, '관사 le/la·un/une'], [8, '인사·tu/vous'],
      ] },
      { name: 'A1 첫 문장', steps: [
        [9, 'être'], [10, 'avoir·il y a'], [11, '-er 동사'], [12, '부정 ne…pas'], [13, '의문문'], [14, '형용사'],
        [15, '소유 mon/ma'], [16, 'aller/venir'], [17, '부분관사'], [18, '숫자·시간'],
        [19, 'A1 문형 94개 총정리', true],
      ] },
      { name: 'A2 과거·확장', steps: [
        [20, '복합과거(avoir)'], [21, '복합과거(être)'], [22, '반과거'], [23, '대명동사'], [24, '목적대명사'], [25, '비교급'],
        [26, '단순미래'], [27, '명령법'], [28, 'y·en'], [29, '관계대명사 qui/que'], [30, 'depuis'], [31, '수량·tout'],
        [32, 'A2 문형 91개 총정리', true],
      ] },
      { name: 'B1 연결·심화', steps: [
        [33, '조건법'], [34, '접속법 입문'], [35, '대과거'], [36, 'dont/où'], [37, '제롱디프'], [38, '수동태'],
        [39, '간접화법'], [40, '지시·소유대명사'], [41, 'pour que·dès que'],
        [42, 'B1 문형 121개 총정리', true],
      ] },
      { name: 'B2 (← 목표)', steps: [
        [43, '접속법 과거·bien que'], [44, 'si 가정문 3형'], [45, '현재분사 -ant'], [46, '논리 연결사'], [47, '동사+전치사 à/de'],
        [48, '강조 c\'est…qui'], [49, '명사화'], [50, '원인·결과 심화'], [51, '부정 ne…ni'], [52, '무인칭·격식'],
        [53, 'B2 문형 123개 + 종합', true],
      ] },
    ],
  },
};

function daysBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function LangPlan({ plan }) {
  const storageKey = `myplan_${plan.key}_done`;
  const [done, setDone] = useState(() => new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey) || '[]');
      setDone(new Set(raw));
    } catch {}
  }, [storageKey]);

  function toggle(n) {
    setDone(prev => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n); else next.add(n);
      try { localStorage.setItem(storageKey, JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  const allSteps = plan.levels.flatMap(l => l.steps);
  const total = allSteps.length;
  const doneCount = mounted ? done.size : 0;
  const pct = Math.round((doneCount / total) * 100);

  // 다음 할 번호 = 완료 안 된 가장 작은 번호
  const nextN = allSteps.map(s => s[0]).sort((a, b) => a - b).find(n => !done.has(n));

  // 권장 페이스
  const today = new Date();
  const daysLeft = Math.max(1, daysBetween(today, new Date(TARGET + 'T23:59:59')));
  const weeksLeft = Math.max(0.5, daysLeft / 7);
  const remaining = total - doneCount;
  const perWeek = mounted ? Math.ceil(remaining / weeksLeft) : 0;

  return (
    <section className="myplan-lang">
      <div className="myplan-lang__head">
        <h3 className="myplan-lang__title">{plan.flag} {plan.title}</h3>
        <span className="myplan-lang__sub">{plan.note}</span>
      </div>

      <div className="myplan-bar">
        <div className="myplan-bar__fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="myplan-stat">
        <strong>{doneCount}/{total}</strong> 완료 ({pct}%)
        {mounted && remaining > 0 && (
          <> · 남은 {remaining}개 · 권장 <strong>주 {perWeek}개</strong> · {mounted && nextN ? `다음 #${nextN}` : ''}</>
        )}
        {mounted && remaining === 0 && <> · 🎉 완주!</>}
      </div>

      {plan.levels.map(level => (
        <div key={level.name} className="myplan-level">
          <div className="myplan-level__name">{level.name}</div>
          <div className="myplan-chips">
            {level.steps.map(([n, label, check]) => {
              const isDone = mounted && done.has(n);
              const isNext = mounted && n === nextN;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => toggle(n)}
                  className={`myplan-chip ${isDone ? 'is-done' : ''} ${check ? 'is-check' : ''} ${isNext ? 'is-next' : ''}`}
                  title={isDone ? '완료 — 클릭해 해제' : '클릭해 완료'}
                >
                  <span className="myplan-chip__n">{check ? '✅' : isDone ? '✓' : n}</span>
                  <span className="myplan-chip__label">{check ? label : label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}

export default function StudyPlanPanel() {
  const today = new Date();
  const dleft = daysBetween(today, new Date(TARGET + 'T23:59:59'));

  return (
    <div className="myplan">
      <div className="myplan__head">
        <h2 className="myplan__title">📅 내 진도 — 올 12월까지</h2>
        <p className="myplan__lead">
          번호를 클릭하면 완료 처리(이 브라우저에 저장). 번호 하나 = 한 세션(챕터 읽기 + 예문 + 다리 + 패턴 체크 80% + 연관 문형).
          {' '}목표일 <strong>{TARGET}</strong> · <strong>D-{dleft}</strong>
        </p>
      </div>
      <div className="myplan__grid">
        <LangPlan plan={PLAN.zh} />
        <LangPlan plan={PLAN.fr} />
      </div>
    </div>
  );
}
