import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';
import { RETRIEVAL_LABELS, errorTags, isWeaknessEvent, splitTag, tagLabel } from '../errorTags.js';
import {
  WEAKNESS_SINCE_DAYS, topLabeledWeakness, weaknessLine, weaknessProfile,
} from '../weaknessProfile.js';
import { computeWeakness } from '../skillRung.js';
import { isGradedReviewEvent } from '../weeklyReport.js';

/**
 * 계약: v2-A R1 약점 진단 (#1077 설계 §4 — 이 절이 이 축의 합격선).
 *
 * 단어 단위 약점은 이미 있었다(confusedQueue). 없던 건 **유형 단위** — "이 단어를 자꾸
 * 틀린다"는 아는데 "듣고 쓰기에서만 무너진다"는 아무 데서도 말해 주지 않았다.
 * 저장하지 않고 유도만 하므로(P1) 규칙을 고치면 과거가 재계산될 뿐이다.
 * 새 테이블·새 source·마이그레이션 0.
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
/** 주석 제거 후 대조 — 설명 문구가 계약에 잡히지 않게(v2-L 자기함정 클래스). */
const codeOf = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const NOW = Date.parse('2026-08-31T12:00:00+09:00');
const at = (daysAgo) => new Date(NOW - daysAgo * 86400000).toISOString();
/** 채점 이벤트 흉내. */
const ev = (qtype, correct, extra = {}) => ({
  source: 'vocab', item_key: 'w', correct, created_at: at(1), detail: { qtype }, ...extra,
});

describe('§2 P1 저장 말고 유도 — 같은 입력이면 언제나 같은 태그', () => {
  it('태그는 이벤트에서만 나온다 — 두 번 불러도 같다', () => {
    const e = ev('typing', false, { source: 'grammar', item_key: 'ba-sentence' });
    expect(errorTags(e)).toEqual(errorTags(e));
    expect(errorTags(e)).toEqual(['retrieval:typing', 'pattern:ba-sentence']);
  });

  it('소급 안전 — qtype이 없던 옛 이벤트도 오류 없이 빈 배열', () => {
    // 태그를 적재했다면 옛 행에는 태그가 없어 영영 프로파일에 못 든다. 유도라서
    // 규칙이 바뀌면 과거까지 통째로 재계산된다 — 그 대신 모르는 옛 행은 조용히 빠진다.
    expect(errorTags({ source: 'vocab', item_key: 'w', correct: false })).toEqual([]);
    expect(errorTags({ source: 'vocab', item_key: 'w', correct: false, detail: {} })).toEqual([]);
    expect(errorTags(null)).toEqual([]);
    expect(errorTags({})).toEqual([]);
  });

  it('item_key가 없으면 축을 만들 수 없다 — ui 계측 행("-")이 섞여도 조용하다', () => {
    expect(isWeaknessEvent({ source: 'ui', correct: true, detail: { qtype: 'push_open' } })).toBe(false);
  });
});

describe('§2 회상 방식은 허용 목록 — 모르는 것은 조용한 쪽으로 떨어진다', () => {
  it('채점된 문항 유형만 축이 된다', () => {
    for (const q of ['choice', 'cloze', 'fill', 'typing', 'listening', 'order', 'match', 'produce']) {
      expect(isWeaknessEvent(ev(q, false)), `${q}는 회상 방식이다`).toBe(true);
      expect(RETRIEVAL_LABELS[q], `${q}에 한국어 라벨이 있어야 한다`).toBeTruthy();
    }
  });

  it('도움 요청은 오답이 아니다 — assist·explain은 correct:false로 적재된다', () => {
    // 막혀서 [도움]을 누른 것을 약점으로 세면 "도와달라고 했다"가 "그 유형에 약하다"로
    // 둔갑한다. 실측: StudySessionPage가 assist/explain을 correct:false로 적재한다.
    for (const q of ['assist', 'explain']) {
      expect(isWeaknessEvent(ev(q, false)), `${q}는 약점이 아니다`).toBe(false);
    }
  });

  it('자기채점은 신뢰하지 않는다 — flash·self', () => {
    // skillRung이 flash 성공을 승급 신호에서 이미 배제한 것과 같은 판단.
    for (const q of ['flash', 'self']) {
      expect(isWeaknessEvent(ev(q, false)), `${q}는 자기채점이다`).toBe(false);
    }
  });

  it('콘텐츠 고장 표식은 사용자의 약점이 아니라 우리 결함이다 — error', () => {
    expect(isWeaknessEvent(ev('error', false))).toBe(false);
  });

  it('행동 계측은 축이 아니다 — 푸시 열람·완독 시간', () => {
    for (const q of ['push_open', 'push_optin', 'push_sent', 'forecast_tap', 'read']) {
      expect(isWeaknessEvent(ev(q, false)), `${q}는 계측이다`).toBe(false);
    }
  });

  it('허용 목록이라 모르는 새 qtype이 화면에 튀어나오지 않는다', () => {
    // 제외 목록이면 새 qtype이 생길 때마다 정체불명의 축이 사용자에게 노출된다.
    expect(isWeaknessEvent(ev('quantum_recall', false))).toBe(false);
    const src = codeOf(read('src/lib/errorTags.js'));
    expect(src).toContain('Object.prototype.hasOwnProperty.call(RETRIEVAL_LABELS, qtype)');
  });
});

describe('§2 문법 축 — item_key는 챕터 slug일 수도 드릴 id일 수도 있다', () => {
  const drill = ev('choice', false, { source: 'grammar', item_key: 'd-h3-07' });

  it('해석기를 주면 드릴 id를 챕터로 되돌린다', () => {
    // 실측: 챕터 복습은 item_key=slug, buildDrillReviewEvent는 item_key=drill.id.
    // 설계 초안의 'slug#문항id' 형태는 코드에 존재하지 않는다.
    expect(errorTags(drill, { chapterOf: () => 'ba-sentence' }))
      .toEqual(['retrieval:choice', 'pattern:ba-sentence']);
  });

  it('못 되돌리면 그 축만 빠진다 — 회상 방식 축은 남는다', () => {
    expect(errorTags(drill, { chapterOf: () => null })).toEqual(['retrieval:choice']);
  });

  it('해석은 호출자 몫이라 순수 모듈이 콘텐츠를 모른다', () => {
    // deriveVocabRungs가 콘텐츠 무의존을 위해 skillRung에 남은 것과 같은 결.
    const src = codeOf(read('src/lib/errorTags.js'));
    for (const banned of ['content/', 'getRefLang', 'REF_LANGS', 'supabase', 'fetch(']) {
      expect(src, `태그 유도가 ${banned}를 알면 순수 함수가 아니다`).not.toContain(banned);
    }
  });

  it('어휘 이벤트에는 문법 축이 안 붙는다', () => {
    expect(errorTags(ev('typing', false))).toEqual(['retrieval:typing']);
  });
});

describe('§2 점수는 정본 재사용 — 새 카운터를 만들지 않는다', () => {
  it('축별 집계가 computeWeakness와 같은 값을 낸다', () => {
    // 여기서 따로 세면 "헷갈린 단어"와 "약한 유형"이 서로 다른 헷갈림을 말하게 된다
    // (confusedQueue가 신규 카운터를 금지한 것과 같은 이유).
    const events = [ev('typing', false), ev('typing', false), ev('typing', true)];
    const got = weaknessProfile(events, { now: NOW });
    const want = computeWeakness(
      events.map((e) => ({ source: 'tag', item_key: 'retrieval:typing', correct: e.correct, created_at: e.created_at })),
      { sinceMs: NOW - WEAKNESS_SINCE_DAYS * 86400000, cap: 8 },
    );
    expect(got[0]).toMatchObject({ tag: 'retrieval:typing', wrong: 2, total: 3 });
    expect(got[0].score).toBe(want[0].score);
  });

  it('약점 모듈이 자체 점수식을 갖지 않는다', () => {
    const src = codeOf(read('src/lib/weaknessProfile.js'));
    expect(src).toContain('computeWeakness(projected');
    expect(src, '자체 점수식을 세우면 두 화면이 다른 헷갈림을 말한다').not.toMatch(/Math\.log|\/ *total/);
  });

  it('집계 창이 헷갈린 단어 큐와 같다 — 두 화면이 같은 헷갈림을 말해야 한다', () => {
    expect(WEAKNESS_SINCE_DAYS).toBe(14);
    expect(read('src/lib/confusedQueue.js')).toContain('CONFUSED_SINCE_DAYS = 14');
  });

  it('한 이벤트가 두 축에 동시에 들되 축별 분모는 각자다', () => {
    const g = (correct) => ev('order', correct, { source: 'grammar', item_key: 'ch-a' });
    const p = weaknessProfile([g(false), g(false), ev('typing', false), ev('typing', false)], { now: NOW });
    const byTag = new Map(p.map((w) => [w.tag, w]));
    expect(byTag.get('retrieval:order')).toMatchObject({ wrong: 2, total: 2 });
    expect(byTag.get('pattern:ch-a')).toMatchObject({ wrong: 2, total: 2 });
    expect(byTag.get('retrieval:typing')).toMatchObject({ wrong: 2, total: 2 });
  });
});

describe('§3 P3 표본 미달이면 침묵 — 없는 진단을 지어내지 않는다', () => {
  it('한 번만 나온 축은 약점이 아니다 — 정본의 최소 표본 2를 그대로 탄다', () => {
    expect(weaknessProfile([ev('typing', false)], { now: NOW })).toEqual([]);
  });

  it('한 번도 안 틀린 축은 목록에 없다 — "약한 곳"이 거짓말이 되면 안 된다', () => {
    expect(weaknessProfile([ev('typing', true), ev('typing', true)], { now: NOW })).toEqual([]);
  });

  it('창 밖 이벤트는 세지 않는다', () => {
    const old = [{ ...ev('typing', false), created_at: at(30) }, { ...ev('typing', false), created_at: at(31) }];
    expect(weaknessProfile(old, { now: NOW })).toEqual([]);
  });

  it('게스트·첫날은 빈 배열로 조용하다 — 무해성', () => {
    expect(weaknessProfile([], { now: NOW })).toEqual([]);
    expect(weaknessProfile(null, { now: NOW })).toEqual([]);
    expect(weaknessProfile(undefined)).toEqual([]);
  });

  it('할 말이 없으면 줄도 없다', () => {
    expect(topLabeledWeakness([])).toBeNull();
    expect(topLabeledWeakness(null)).toBeNull();
    expect(weaknessLine(null)).toBeNull();
  });
});

describe('§3 화면은 말할 수 있는 것만 말한다', () => {
  it('라벨을 못 내는 축은 건너뛰고 다음 축을 고른다', () => {
    // 챕터 제목을 안 든 화면에 pattern:ba-sentence는 아무 말도 아니다.
    const profile = [
      { tag: 'pattern:ba-sentence', wrong: 9, total: 10, score: 2 },
      { tag: 'retrieval:listening', wrong: 6, total: 9, score: 1 },
    ];
    expect(topLabeledWeakness(profile)).toMatchObject({ tag: 'retrieval:listening', label: '듣고 쓰기' });
  });

  it('챕터 제목을 든 화면에서는 문법 축도 말할 수 있다', () => {
    const profile = [{ tag: 'pattern:ba-sentence', wrong: 9, total: 10, score: 2 }];
    expect(topLabeledWeakness(profile, { chapterTitleOf: () => '把자문' }))
      .toMatchObject({ label: '把자문' });
  });

  it('망가진 태그는 라벨이 없다', () => {
    for (const bad of ['retrieval', ':x', 'x:', null, 42]) expect(tagLabel(bad)).toBeNull();
    expect(splitTag('a:b')).toEqual({ axis: 'a', value: 'b' });
  });

  it('문구가 채점표가 아니다 — 이 카드는 거울이지 성적표가 아니다', () => {
    // WeeklyReportCard 규약(증감 화살표·색상 없음)과 같은 톤. "6/9 실패"는 채점표다.
    expect(weaknessLine({ label: '듣고 쓰기', wrong: 6, total: 9 })).toBe('듣고 쓰기 9번 중 6번 틀림');
  });
});

describe('§4 이음새 신설 0 — 읽기만 한다', () => {
  it('순수 모듈이 서버를 모른다', () => {
    for (const f of ['src/lib/errorTags.js', 'src/lib/weaknessProfile.js']) {
      const src = codeOf(read(f));
      for (const banned of ['supabase', 'insert(', 'upsert(', 'fetch(']) {
        expect(src, `${f}가 ${banned}를 알면 안 된다`).not.toContain(banned);
      }
    }
  });

  it('새 source를 만들지 않는다 — 태그 투영은 메모리 안에서만 산다', () => {
    // 'tag'는 computeWeakness에 넘기는 투영 키일 뿐 적재되는 값이 아니다.
    const rows = codeOf(read('src/lib/weaknessRows.js'));
    expect(rows).toContain("from('review_events')");
    for (const banned of ['insert(', 'upsert(', 'update(', 'delete(']) {
      expect(rows, `약점 조회가 ${banned}를 하면 안 된다`).not.toContain(banned);
    }
    expect(rows).toMatch(/catch \{\s*return \[\];\s*\}/);
  });

  it('정답률 정본을 건드리지 않는다 — isGradedReviewEvent 무변경', () => {
    // 약점 필터는 이보다 좁다(assist·flash 제외). 그렇다고 이쪽을 좁히면 주간 리포트의
    // 정답률 수치가 통째로 바뀐다 — 좁히기는 약점 모듈 안에서만 한다.
    expect(isGradedReviewEvent({ source: 'assist', correct: false })).toBe(true);
    expect(isGradedReviewEvent({ source: 'ui' })).toBe(false);
    expect(codeOf(read('src/lib/weeklyReport.js')))
      .toContain("event.source !== 'ui' && event.source !== 'dict'");
  });

  it('마이그레이션 0 — 이 축은 읽기만 한다', () => {
    const files = fs.readdirSync(path.join(process.cwd(), 'supabase/migrations'));
    for (const f of files) {
      const sql = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations', f), 'utf8');
      for (const banned of ['error_tags', 'weakness_profile', 'user_weakness']) {
        expect(sql.includes(banned), `${f}에 ${banned} 테이블이 생기면 안 된다`).toBe(false);
      }
    }
  });
});

describe('배선 — 리포트 한 줄은 모달을 열었을 때만', () => {
  const stats = codeOf(read('src/views/ProfileStats.jsx'));
  const line = sliceBetween(stats, 'function WeakSpotLine(', '\n}');

  it('홈 첫 화면이 태그 유도용 조회를 치르지 않는다', () => {
    expect(stats).toContain('<WeeklyReportCard weekly={weekly} header={false} showWeakness />');
    expect(line).toContain("queryKey: ['weak-spot', user?.id, weekStartMs]");
    expect(line).toContain('enabled: !!user?.id,');
  });

  it('창을 카드와 맞춘다 — 카드가 "이번 주"인데 줄만 2주면 한 카드가 두 기간을 섞는다', () => {
    expect(line).toContain('fetchWeaknessRows(user.id, { sinceMs: weekStartMs })');
    expect(line).toContain('weaknessProfile(rows || [], { sinceMs: weekStartMs })');
  });

  it('할 말이 없으면 줄 자체가 없다 — 빈 칸이 남으면 고장으로 읽힌다', () => {
    expect(line).toContain('if (!line) return null;');
  });

  it('경고색을 쓰지 않는다 — 거울이지 성적표가 아니다', () => {
    expect(line).toContain("color: 'var(--text-muted)'");
    for (const banned of ['--danger', '--warning', '--error']) {
      expect(line, `약점 줄에 ${banned}를 쓰면 성적표가 된다`).not.toContain(banned);
    }
  });
});
