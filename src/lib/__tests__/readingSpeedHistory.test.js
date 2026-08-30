import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';
import {
  SUGGEST_BOOST, SUGGEST_MIN_SAMPLES, SUGGEST_WINDOW,
  median, readingCpmSamples, recentCpm, suggestTargetCpm,
} from '../readingSpeedHistory.js';
import { PACE_MAX_CPM, PACE_MIN_CPM, PACE_STEP_UNIT } from '../readingPacer.js';
import { READING_METRIC_VERSION } from '../readingTimer.js';

/**
 * 계약: v2-I R1b R2 목표 속도 자동 제안 (#1077 설계 §4·§8·§9).
 * 고정 기본값은 잘 읽는 사람에겐 답답하고 이제 시작한 사람에겐 못 따라갈 속도다.
 * 내가 낸 속도에서 +10%로 잡되(§4), **페이서 회차는 표본에서 빼야** 지표가 자기
 * 설정값을 되먹임하지 않는다(§8). 새 테이블·새 이벤트는 여전히 0.
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
/** 주석 제거 후 대조 — 설명 문구가 계약에 잡히지 않게(v2-L 자기함정 클래스). */
const codeOf = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const ev = (cpm, extra = {}) => ({ detail: { ms: 60000, chars: cpm, cpm, v: READING_METRIC_VERSION, paced: false, ...extra } });

describe('§8 표본 자격 — 무엇을 "내 속도"로 치는가', () => {
  it('페이서로 읽은 회차는 표본에서 뺀다 — 내가 설정한 속도가 내 속도로 되먹임된다', () => {
    const rows = [ev(300, { paced: true }), ev(70), ev(80), ev(75)];
    expect(readingCpmSamples(rows)).toEqual([70, 80, 75]);
    // 300이 섞였다면 중앙값이 위로 끌려갔을 것
    expect(recentCpm(rows)).toBe(75);
  });

  it('정의 버전이 다르면 섞지 않는다 — 시간·글자수의 뜻이 달라진 기록이다', () => {
    const rows = [ev(70), ev(999, { v: 99 }), ev(80), ev(75)];
    expect(readingCpmSamples(rows)).toEqual([70, 80, 75]);
  });

  it('망가진 값은 조용히 버린다 — 진단 도구가 화면을 깨뜨리지 않는다', () => {
    const rows = [{ detail: null }, {}, ev(0), ev(NaN), ev(70), ev(80), ev(75)];
    expect(readingCpmSamples(rows)).toEqual([70, 80, 75]);
    expect(readingCpmSamples(null)).toEqual([]);
  });

  it('최근 것만 본다 — 반년 전 실력은 지금의 내가 아니다', () => {
    expect(SUGGEST_WINDOW).toBe(10);
    const rows = Array.from({ length: 30 }, (_, i) => ev(100 + i));
    expect(readingCpmSamples(rows)).toHaveLength(SUGGEST_WINDOW);
    expect(readingCpmSamples(rows)[0]).toBe(100);  // rows는 최신순 — 앞에서 자른다
  });
});

describe('대푯값 — 이상치 한 건에 목표가 끌려가면 안 된다', () => {
  it('평균이 아니라 중앙값을 쓴다 — 자리 비운 회차 하나가 목표를 통째로 낮춘다', () => {
    const rows = [ev(5), ev(70), ev(75), ev(80), ev(85)];
    expect(recentCpm(rows)).toBe(75);              // 중앙값 75 (평균이면 63)
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it('표본이 모자라면 제안하지 않는다 — 한두 번으로 내 속도를 단정할 수 없다', () => {
    expect(SUGGEST_MIN_SAMPLES).toBe(3);
    expect(recentCpm([ev(70), ev(80)])).toBeNull();
    expect(suggestTargetCpm([ev(70), ev(80)])).toBeNull();
    expect(suggestTargetCpm([])).toBeNull();
  });
});

describe('§4 제안값 — 자기 기준 +10%, 수동 조절과 같은 눈금', () => {
  it('내 속도의 1.1배를 목표로 준다', () => {
    expect(SUGGEST_BOOST).toBe(1.1);
    // 중앙값 80 × 1.1 = 88 → 5 눈금으로 90
    expect(suggestTargetCpm([ev(70), ev(80), ev(90)])).toBe(90);
  });

  it('조절 버튼과 같은 눈금에 앉는다 — 제안값에서 한 칸 올림이 예측 가능해야 한다', () => {
    const s = suggestTargetCpm([ev(73), ev(77), ev(81)]);
    expect(s % PACE_STEP_UNIT).toBe(0);
    // 눈금 상수를 페이서와 공유한다(두 곳에 5를 적어 두면 언젠가 갈린다)
    expect(codeOf(read('src/lib/readingSpeedHistory.js'))).toContain('PACE_STEP_UNIT');
    expect(codeOf(read('src/lib/readingPacer.js'))).not.toMatch(/Math\.round\(next \/ 5\)/);
  });

  it('사람이 쓸 수 있는 범위를 벗어나지 않는다', () => {
    expect(suggestTargetCpm([ev(5000), ev(5000), ev(5000)])).toBe(PACE_MAX_CPM);
    expect(suggestTargetCpm([ev(1), ev(1), ev(1)])).toBe(PACE_MIN_CPM);
  });
});

describe('조회 — 언어로 좁히고, 새 테이블·새 이벤트는 0', () => {
  const rows = codeOf(read('src/lib/readingSpeedRows.js'));

  it('I-a가 남긴 완독 이벤트만 읽는다 — 쓰기는 없다', () => {
    expect(rows).toContain("from('review_events')");
    expect(rows).toContain("eq('source', 'reading')");
    for (const banned of ['insert(', 'upsert(', 'delete(', 'reading_speed']) {
      expect(rows, `제안 조회가 ${banned}를 하면 안 된다`).not.toContain(banned);
    }
  });

  it('언어로 좁힌다 — 같은 사람도 중국어와 영어의 자/분이 몇 배 다르다', () => {
    expect(rows).toContain("eq('lang', lang)");
    expect(rows).toContain("order('created_at', { ascending: false })");
  });

  it('실패는 빈 배열 — 제안이 없을 뿐 페이서는 언어 기본값으로 그대로 돈다', () => {
    expect(rows).toMatch(/catch \{[\s\S]*?return \[\];/);
    expect(rows).toContain('if (!userId || !lang) return [];');
  });
});

describe('배선 — 우선순위와 되돌아갈 길', () => {
  const viewer = read('src/views/ViewerPage.jsx');

  it('직접 고른 값 > 자동 제안 > 언어 기본값', () => {
    expect(viewer).toContain('const paceTargetCpm = paceCpm || suggestedCpm || defaultTargetCpm(materialLang);');
  });

  it('조회는 페이서를 켰을 때만 — 안 쓰는 사람에게 쿼리를 태우지 않는다', () => {
    const q = sliceBetween(viewer, "queryKey: ['reading-speed'", '});');
    expect(q).toContain('enabled: !!user && autoPace,');
    expect(q).toContain('queryFn: () => fetchReadingSpeedRows(user.id, materialLang),');
    // 언어가 키에 들어가야 자료를 갈아탈 때 남의 언어 제안이 남지 않는다
    expect(q).toContain("['reading-speed', user?.id, materialLang]");
  });

  it('직접 설정에서 자동으로 되돌아갈 길이 있다 — 한 번 누르면 못 돌아오면 막다른 길', () => {
    const row = sliceBetween(viewer, '{paceCpm ? (', ') : myCpm ? (');
    expect(row).toContain('onClick={() => setPaceCpm(null)}');
    expect(row).toContain('자동으로');
  });

  it('숫자의 출처를 밝힌다 — 조용히 바뀌면 "왜 어제와 다르지?"가 된다', () => {
    expect(viewer).toContain('내 속도 {myCpm}자/분 기준 +10%');
    expect(viewer).toContain('const myCpm = recentCpm(paceHistoryRows || []);');
  });
});
