'use client';

import { useEffect, useState } from 'react';

/**
 * 내 진도 — 관리자 전용 학습 진도표 (12월까지 중국어 HSK5 · 프랑스어 B2).
 * 번호 = 한 세션. 레벨마다 [문법 챕터] → [그 레벨 문형 테마] 순.
 * 문형은 테마별(≈10개)로 쪼개 하루치. 어휘는 제외.
 * 번호 클릭 → 완료 토글(localStorage).
 */

const TARGET = '2026-12-31';

const PLAN = {
  zh: {
    key: 'zh', flag: '🇨🇳', title: '중국어 → HSK 5', note: '문법 61 + 문형 58테마 · 어휘 제외',
    levels: [
      { name: 'OT 발음·기초', gram: [[1, '한어병음'], [2, '성조 4성+경성'], [3, '간체자(한자 다리)'], [4, '기본 어순 SVO'], [5, '인칭대명사']], bk: [] },
      { name: 'H1 기초', gram: [[6, '是자문'], [7, '有자문'], [8, '这·那'], [9, '양사 个·本·张'], [10, '의문 吗'], [11, '不·没'], [12, '的'], [13, '연동문'], [14, '시간·장소 어순'], [15, '숫자·시간'], [16, '부사 都·也'], [17, '喜欢·想·请'], [18, '인사 표현']],
        bk: [[19, '기본 술어문'], [20, '부정'], [21, '의문문'], [22, '양사·지시'], [23, '시간·때'], [24, '了·완료'], [25, '능원동사·바람'], [26, '부사·정도'], [27, '개사·대상'], [28, '관용·인사'], [29, '숫자·돈·나이']] },
      { name: 'H2 시간·경험', gram: [[30, '완료 了'], [31, '경험 过'], [32, '진행 在'], [33, '변화 了'], [34, '비교 比'], [35, '능원동사'], [36, '개사 给·对·从'], [37, '시량보어'], [38, '선택의문 还是'], [39, '동량보어'], [40, '정도부사'], [41, '시간 표현']],
        bk: [[42, '진행·경험·완료'], [43, '보어(결과·정도·시량)'], [44, '비교'], [45, '개사틀'], [46, '연결·접속'], [47, '능원·당위'], [48, '강조·어기'], [49, '시간량·빈도'], [50, '의문 심화'], [51, '감정·상태']] },
      { name: 'H3 연결·확장', gram: [[52, '把자문'], [53, '被자문'], [54, '결과보어'], [55, '방향보어'], [56, '정도보어'], [57, '가능보어'], [58, '시량보어'], [59, '복문 연결'], [60, '비교 심화'], [61, '존현문'], [62, '정도·범위 부사'], [63, '어림수'], [64, '빈도 부사']],
        bk: [[65, '把구문·처치'], [66, '被구문·피동'], [67, '방향보어'], [68, '가능보어'], [69, '복문 접속'], [70, '정도·범위 부사'], [71, '시태·빈도 부사'], [72, '동작 표현 심화'], [73, '어기·완곡·확인'], [74, '주제·존재·근거'], [75, '정도보어·결과 심화'], [76, '능원·의지 심화'], [77, '화제·관계절']] },
      { name: 'H4 뉘앙스', gram: [[78, '보어 종합'], [79, '가정 即使·要是'], [80, '강조 是…的'], [81, '连…都'], [82, '除了…以外'], [83, '越…越'], [84, '반어문'], [85, '개사틀'], [86, '不但…而且'], [87, '담화부사']],
        bk: [[88, '把구문·처치'], [89, '被·让·叫 피동'], [90, '강조 是…的'], [91, '연동·겸어'], [92, '결과·방향·가능 보어'], [93, '가정·조건'], [94, '양보·전환'], [95, '점층·추가'], [96, '비교 심화'], [97, '시간·동작 상태'], [98, '원인·결과·목적'], [99, '어림·정도·범위'], [100, '어기·태도']] },
      { name: 'H5 서면어·고급 (← HSK5)', gram: [[101, '서면어 레지스터'], [102, '고급 연결어'], [103, '성어'], [104, '사역 使·令·让'], [105, '被동 격식형'], [106, '문어 대명사 之·其'], [107, '반어·이중부정'], [108, '的·得·地']],
        bk: [[109, '조건·가정 심화'], [110, '양보·전환 심화'], [111, '강조·도치'], [112, '범위·예외·포괄'], [113, '관련사 점층·선택'], [114, '정도·결과보어 심화'], [115, '시간·순서 서면'], [116, '추측·판단·전언'], [117, '관용 격식 표현'], [118, '동작·처치 심화'], [119, '수량·빈도·정도 부사']] },
    ],
  },
  fr: {
    key: 'fr', flag: '🇫🇷', title: '프랑스어 → B2', note: '문법 49 + 문형 55테마 · 어휘 제외',
    levels: [
      { name: 'A0 입문·발음', gram: [[1, '오리엔테이션'], [2, '알파벳·악상'], [3, '모음 u/ou'], [4, '자음·묵음'], [5, '리에종'], [6, '명사의 성'], [7, '관사 le/la·un/une'], [8, '인사·tu/vous']], bk: [] },
      { name: 'A1 첫 문장', gram: [[9, 'être'], [10, 'avoir·il y a'], [11, '-er 동사'], [12, '부정 ne…pas'], [13, '의문문'], [14, '형용사'], [15, '소유 mon/ma'], [16, 'aller/venir'], [17, '부분관사'], [18, '숫자·시간']],
        bk: [[19, '인사·자기소개'], [20, 'être·avoir·faire'], [21, '부정'], [22, '의문문'], [23, '관사·한정사'], [24, '장소·전치사'], [25, '동사구문·준조동사'], [26, '명령·부탁·제안'], [27, '시간·날짜'], [28, '정도·빈도·연결'], [29, '감탄·반응']] },
      { name: 'A2 과거·확장', gram: [[30, '복합과거(avoir)'], [31, '복합과거(être)'], [32, '반과거'], [33, '대명동사'], [34, '목적대명사'], [35, '비교급'], [36, '단순미래'], [37, '명령법'], [38, 'y·en'], [39, '관계대명사 qui/que'], [40, 'depuis'], [41, '수량·tout']],
        bk: [[42, '복합과거'], [43, '반과거'], [44, '미래 표현'], [45, '근접과거·진행'], [46, '목적어 대명사'], [47, '대명동사 확장'], [48, '부정 확장'], [49, '비교·최상급'], [50, '관계대명사·연결'], [51, '시간 표현'], [52, '수량·tout'], [53, '공손한 요청(조건법)'], [54, '의견·간접화법 기초'], [55, '일상 기능 표현']] },
      { name: 'B1 연결·심화', gram: [[56, '조건법'], [57, '접속법 입문'], [58, '대과거'], [59, 'dont/où'], [60, '제롱디프'], [61, '수동태'], [62, '간접화법'], [63, '지시·소유대명사'], [64, 'pour que·dès que']],
        bk: [[65, '가정과 조건'], [66, '공손한 부탁·조언'], [67, '접속법 필요·바람·요구'], [68, '접속법 감정·평가'], [69, '과거의 층위'], [70, '관계대명사·지시'], [71, '수동·사역'], [72, '동시·전후 동작'], [73, '간접화법·시제 일치'], [74, '강조·감탄'], [75, '대명사 결합'], [76, '목적·이유·양보'], [77, '시간의 접속'], [78, '의견·동의·확신'], [79, '부정·제한']] },
      { name: 'B2 (← 목표)', gram: [[80, '접속법 과거·bien que'], [81, 'si 가정문 3형'], [82, '현재분사 -ant'], [83, '논리 연결사'], [84, '동사+전치사 à/de'], [85, "강조 c'est…qui"], [86, '명사화'], [87, '원인·결과 심화'], [88, '부정 ne…ni'], [89, '무인칭·격식']],
        bk: [[90, '접속법 심화'], [91, '양보 무엇이든'], [92, '의심·부정+접속법'], [93, '조건법 과거'], [94, '대립·양보 연결'], [95, '원인·이유 심화'], [96, '결과·정도'], [97, '담화 구성·화제 전환'], [98, '부정의 확장'], [99, '분사구문·문어'], [100, '무인칭 확장'], [101, '명사화·문어 전치사'], [102, '가정·조건 확장'], [103, '동사 보어 구문'], [104, '논증·확언 격식']] },
    ],
  },
};

const daysBetween = (a, b) => Math.round((b.getTime() - a.getTime()) / 86400000);

function LangPlan({ plan }) {
  const storageKey = `myplan_${plan.key}_done`;
  const [done, setDone] = useState(() => new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try { setDone(new Set(JSON.parse(localStorage.getItem(storageKey) || '[]'))); } catch {}
  }, [storageKey]);

  function toggle(n) {
    setDone(prev => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      try { localStorage.setItem(storageKey, JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  const allN = plan.levels.flatMap(l => [...l.gram, ...l.bk]).map(s => s[0]);
  const total = allN.length;
  const doneCount = mounted ? done.size : 0;
  const pct = Math.round((doneCount / total) * 100);
  const nextN = [...allN].sort((a, b) => a - b).find(n => !done.has(n));

  const today = new Date();
  const daysLeft = Math.max(1, daysBetween(today, new Date(TARGET + 'T23:59:59')));
  const weeksLeft = Math.max(0.5, daysLeft / 7);
  const remaining = total - doneCount;
  const perWeek = mounted ? Math.ceil(remaining / weeksLeft) : 0;

  const Chip = ([n, label], isBk) => {
    const isDone = mounted && done.has(n);
    const isNext = mounted && n === nextN;
    return (
      <button key={n} type="button" onClick={() => toggle(n)}
        className={`myplan-chip ${isDone ? 'is-done' : ''} ${isBk ? 'is-bk' : ''} ${isNext ? 'is-next' : ''}`}
        title={isDone ? '완료 — 클릭해 해제' : '클릭해 완료'}>
        <span className="myplan-chip__n">{isDone ? '✓' : n}</span>
        <span className="myplan-chip__label">{label}</span>
      </button>
    );
  };

  return (
    <section className="myplan-lang">
      <div className="myplan-lang__head">
        <h3 className="myplan-lang__title">{plan.flag} {plan.title}</h3>
        <span className="myplan-lang__sub">{plan.note}</span>
      </div>
      <div className="myplan-bar"><div className="myplan-bar__fill" style={{ width: `${pct}%` }} /></div>
      <div className="myplan-stat">
        <strong>{doneCount}/{total}</strong> ({pct}%)
        {mounted && remaining > 0 && <> · 남은 {remaining} · 권장 <strong>주 {perWeek}</strong> · 다음 <strong>#{nextN}</strong></>}
        {mounted && remaining === 0 && <> · 🎉 완주!</>}
      </div>

      {plan.levels.map(level => (
        <div key={level.name} className="myplan-level">
          <div className="myplan-level__name">{level.name}</div>
          <div className="myplan-chips">{level.gram.map(s => Chip(s, false))}</div>
          {level.bk.length > 0 && (
            <>
              <div className="myplan-level__sub">문형 (테마별 ≈10개)</div>
              <div className="myplan-chips">{level.bk.map(s => Chip(s, true))}</div>
            </>
          )}
        </div>
      ))}
    </section>
  );
}

export default function StudyPlanPanel() {
  const dleft = daysBetween(new Date(), new Date(TARGET + 'T23:59:59'));
  return (
    <div className="myplan">
      <div className="myplan__head">
        <h2 className="myplan__title">📅 내 진도 — 올 12월까지</h2>
        <p className="myplan__lead">
          번호 클릭 = 완료(이 브라우저 저장). 레벨마다 <strong>문법 챕터 → 그 레벨 문형 테마</strong> 순서.
          문법 한 번호 = 챕터 1개, 문형 한 번호 = 테마 1개(≈10패턴). 어휘는 제외.
          {' '}목표 <strong>{TARGET}</strong> · <strong>D-{dleft}</strong>
        </p>
      </div>
      <div className="myplan__grid">
        <LangPlan plan={PLAN.zh} />
        <LangPlan plan={PLAN.fr} />
      </div>
    </div>
  );
}
