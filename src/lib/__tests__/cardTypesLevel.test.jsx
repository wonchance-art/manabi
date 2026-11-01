// CARD-TYPES-001 3단계 — 단어 페이지의 카드 세 종류(오너 결정 2026-11-01 KST · 설계 docs/design/card-types.md §2 · §3 · §5 · 실렌더 시안 승인).
// 계약:
//   ① 문제 면 — 단어 → 뜻 = 표제어, 뜻 → 단어 = 뜻(표제어와 같은 크기 규칙), 듣기 = 소리 단추만. 종류 글씨 없음 · 문제 면 후리가나 없음 · 답을 흘리지 않음.
//   ② 답 면 — 모든 답 면에 예문(후리가나) · 듣기 답 면 = 예문 · 해석 · 표제어 줄.
//   ③ 리스트 — 접힌 줄은 문제 면 하나(같은 44px 줄) · 네 칸 위 안내 줄 = 문제 면.
//   ④ 「카드」 줄 — 단어 → 뜻 잠김 · 하루와 같은 configure 길 · 실패면 되돌림.
//   ⑤ 줄 — 형제 규칙(pickSiblings) · 차례로 붙이기(nextVariantKind) · 종류 카드는 하루 새 단어 몫 밖 · 꺼진 종류는 줄에서 빠진다.
//   ⑥ 기본값(단어 → 뜻 하나)이면 지금 화면 그대로 — 카드 목록을 읽지 않고 종류 카드가 없다.
//   ⑦ 보기 탭 없앰(A안) · 끝 화면 「전체 훑어보기」 · 카드 기억률 줄.
import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { GradeBar, OneWordCard, OneWordDone } from '@/components/levels/word/OneWord';
import { WordCard } from '@/components/levels/word/WordCard';
import { AreaRow } from '@/components/levels/word/WordAreas';
import { CardKindsRow, TitleSheet } from '@/components/levels/word/WordSheets';
import { WordLangContext } from '@/components/levels/word/wordLang';
import { GuideFace, MeaningFace, faceN } from '@/components/cards/CardFaces';
import { LEVEL_CARD_KIND_ITEMS, LEVEL_CARD_KIND_NOTE, levelCardKey, parseLevelCardKey, planLevelCardKinds, toggleLevelCardKind, variantProjection } from '../levelCardKinds';
import { RECOGNITION_ONLY } from '../fsrsCardKinds';
import { introduceFsrsCard, scheduleFsrsReview } from '../fsrsScheduler';
import { addLevelSessionKeys, dropLevelSessionKeys, gradeLevelSession, startLevelSession } from '../levelWordSession';
import { gradePreviews, levelWordStatus } from '../levelWordStatus';
import * as prefs from '../levelWordPrefs';

vi.mock('next/link', () => ({ default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a> }));

const L = { hw: 'ja', exReading: 'ja', head: (e) => ({ hw: e.word, sub: e.reading }), tag: (l) => `JLPT ${l}`,
  Reading: ({ text }) => <span className="lw-py">{text}</span>, levelPill: (k) => k, levelOf: (k) => k, levelHref: (k) => `/japanese/vocab/${k}` };
const wrap = (node) => renderToStaticMarkup(<WordLangContext.Provider value={L}>{node}</WordLangContext.Provider>);
const E = { key: '約束', word: '約束', reading: 'やくそく', meaning: '약속', kr: 'やく,そく',
  ex: { text: '友達と約束があります。', ko: '친구와 약속이 있어요.', furi: '0,2,ともだち;3,2,やくそく' } };
const info = { status: 'today', previews: null };
const speak = () => {};
const KIND_LABELS = ['단어 → 뜻', '뜻 → 단어', '듣기 카드', '종류', 'production', 'listening', 'recognition'];
const textOf = (html) => html.replace(/<[^>]+>/g, ' ');
const one = (kind, revealed) => wrap(<OneWordCard entry={E} kind={kind} info={info} tiles={null} speak={speak} tone revealed={revealed} onReveal={() => {}} />);
const row = (kind) => wrap(<WordCard entry={E} kind={kind} cardKey={levelCardKey(E.key, kind)} level="N3" info={info} tiles={null} speak={speak} tone />);
const screen = fs.readFileSync('src/components/levels/word/LevelWordScreen.jsx', 'utf8');
const css = fs.readFileSync('src/components/levels/word/level-word.css', 'utf8');

describe('① 문제 면 — 종류 글씨 없이 면만으로 구분 · 후리가나 없음 · 답을 흘리지 않음', () => {
  it('단어 → 뜻 = 표제어 · 뜻 → 단어 = 뜻(한국어 · 표제어 크기 칸) · 듣기 = 소리 단추만', () => {
    const word = one('recognition', false), meaning = one('production', false), listen = one('listening', false);
    expect(word).toContain('<span class="lw-one__hw" lang="ja" style="--n:2">約束</span>');
    expect(meaning).toContain('<span class="lw-one__hw cf-meaning" lang="ko" style="--n:2">약속</span>');
    expect(listen).toMatch(/<button type="button" class="lw-listen cf-play cf-play--one" aria-label="문장 듣기"/);
    // 답을 흘리지 않는다 — 뜻 카드 앞면에 표제어 · 읽기 · 예문이 없고, 듣기 앞면에는 글자가 없다(화면 읽기 이름표 포함).
    expect(meaning).not.toMatch(/約束|やくそく|友達/);
    expect(listen).not.toMatch(/約束|やくそく|약속|友達/);
    expect(word).not.toMatch(/약속|やくそく/);
    for (const html of [word, meaning, listen]) {
      expect(html).not.toContain('<ruby>');
      expect(html).toContain('정답 확인 <span class="lw-one__key">· Space</span>');
      for (const label of KIND_LABELS) expect(textOf(html), label).not.toContain(label);
    }
  });
  it('크기 규칙 하나 — 글자 수(로마자 · 숫자 반 칸), 뜻도 표제어와 같은 칸 수', () => {
    expect(faceN('약속')).toBe(2);
    expect(faceN('익숙하게 되다')).toBe(7);
    expect(faceN('expérience')).toBe(5.5);
    expect(renderToStaticMarkup(<MeaningFace meaning="경험" className="lw-card__hw" />)).toBe('<span class="lw-card__hw cf-meaning" lang="ko" style="--n:2">경험</span>');
  });
});

describe('② 답 면 — 예문은 모든 답 면(후리가나) · 듣기 답 면은 예문 · 해석 · 표제어 줄', () => {
  it('세 종류 모두 예문 루비 · 해석', () => {
    for (const kind of ['recognition', 'production', 'listening']) {
      const html = one(kind, true);
      expect(html, kind).toContain('<ruby>約束<rt>やくそく</rt></ruby>');
      expect(html, kind).toContain('친구와 약속이 있어요.');
      for (const label of KIND_LABELS) expect(textOf(html), label).not.toContain(label);
    }
  });
  it('뜻 → 단어 답 면 — 묻는 뜻은 위에 그대로, 답(표제어)은 점선 아래 첫 줄 · 읽기 · 예문(오너 2026-11-01 KST 「갑자기 뜻이 사라지는 거?」)', () => {
    const html = one('production', true);
    expect(html).toMatch(/<div class="lw-one__front"><span class="lw-one__hw cf-meaning"[^>]*>약속<\/span>/);
    expect(html).toContain('<div class="lw-one__back"><div class="lw-one__answer"><span class="lw-one__hw" lang="ja" style="--n:2">約束</span></div>');
    expect(html).toContain('やくそく');
    expect(html).not.toContain('lw-one__mean'); // 뜻 줄을 아래에 또 쓰지 않는다 — 위에 이미 있다
  });
  it('듣기 답 면 — 단추는 그 자리(다시 듣기) · 예문 · 해석 · 표제어 줄(표제어 · 읽기 · 뜻 · 단어 듣기)', () => {
    const html = one('listening', true);
    expect(html).toMatch(/<div class="lw-one__front"><button type="button" class="lw-listen cf-play cf-play--one"/);
    expect(html).toContain('<div class="lw-ex--answer">');
    expect(html).toMatch(/<div class="lw-one__word"><span class="lw-row__word" lang="ja">約束<\/span><span class="lw-py">やくそく<\/span><span class="lw-card__mean">약속<\/span><button[^>]*aria-label="단어 듣기"/);
    expect(html.indexOf('lw-ex--answer')).toBeLessThan(html.indexOf('lw-one__word'));
  });
  it('훑어보기(view all)는 종류와 무관하게 단어 앞면 · 펼친 뒷면', () => {
    const html = wrap(<OneWordCard entry={E} kind="listening" view="all" info={info} tiles={null} speak={speak} tone revealed onReveal={() => {}} />);
    expect(html).toContain('<p class="lw-one__mean">약속</p>');
    expect(html).not.toContain('cf-play');
  });
});

describe('③ 리스트 — 접힌 줄은 문제 면 하나 · 같은 줄 높이 · 안내 줄 = 문제 면', () => {
  it('접힌 줄: 표제어 / 뜻 / 소리 단추 — 카드 열쇠는 종류마다 다르다', () => {
    const word = row('recognition'), meaning = row('production'), listen = row('listening');
    expect(word).toMatch(/<li class="lw-card" data-key="約束" data-view="word">/);
    expect(meaning).toMatch(/<li class="lw-card" data-key="約束@@production" data-view="meaning"><div class="lw-card__head"><span class="lw-card__word"><span class="lw-card__hw cf-meaning" lang="ko" style="--n:2">약속<\/span>/);
    expect(listen).toMatch(/<li class="lw-card" data-key="約束@@listening" data-view="sound"><div class="lw-card__head"><button type="button" class="lw-listen cf-play cf-play--row"/);
    expect(meaning).not.toMatch(/約束<|やくそく/);
    expect(listen).not.toMatch(/約束<|やくそく|약속/);
    for (const html of [word, meaning, listen]) {
      expect(html).not.toContain('<ruby>');
      for (const label of KIND_LABELS) expect(textOf(html), label).not.toContain(label);
    }
    expect(css).toContain('.lw-card[data-view]>.lw-card__head{min-height:44px}');
  });
  it('네 칸 위 안내 줄 — 단어 → 뜻 = 표제어 · 뜻 → 단어 = 뜻 · 듣기 = 소리 아이콘(글자 없음)', () => {
    const guide = (kind) => renderToStaticMarkup(<GuideFace kind={kind} meaning="약속" hw="約束" hwLang="ja" />);
    expect(guide('recognition')).toBe('<b lang="ja">約束</b>');
    expect(guide('production')).toBe('<b lang="ko">약속</b>');
    expect(guide('listening')).toMatch(/^<span class="cf-guide-icon" role="img" aria-label="소리"><svg/);
    expect(textOf(guide('listening')).trim()).toBe('');
    expect(wrap(<GradeBar previews={null} onGrade={() => {}} label={<GuideFace kind="production" meaning="약속" hw="約束" />} />)).toContain('<p class="lw-gradebar__guide"><b lang="ko">약속</b></p>');
    expect(screen).toContain('label={<GuideFace kind={focusEntry.kind} meaning={focusEntry.meaning} hw={cfg.head(focusEntry).hw} hwLang={cfg.hw} />}');
  });
});

describe('④ 「카드」 줄 — 세 칸 · 단어 → 뜻 잠김 · 하루 아래 · 같은 configure 길', () => {
  it('세 칸 이름 · 잠긴 칸 · 회색 한 줄', () => {
    const html = renderToStaticMarkup(<CardKindsRow value={['recognition', 'listening']} onPick={() => {}} />);
    expect([...html.matchAll(/<button[^>]*>([^<]+)<\/button>/g)].map((m) => m[1])).toEqual(['단어 → 뜻', '뜻 → 단어', '듣기']);
    expect(html).toContain('<button type="button" aria-pressed="true" aria-disabled="true">단어 → 뜻</button>');
    expect(html).toContain('<button type="button" aria-pressed="false">뜻 → 단어</button>');
    expect(html).toContain('<button type="button" aria-pressed="true">듣기</button>');
    expect(html).toContain(`<p class="lw-sheet__sub" id="lw-cardkinds-help">${LEVEL_CARD_KIND_NOTE}</p>`);
    expect(LEVEL_CARD_KIND_NOTE).toBe('단어 → 뜻은 늘 켜짐 · 끈 카드는 일정을 지우지 않고 쉬어요');
    expect(LEVEL_CARD_KIND_ITEMS.map((it) => it.id)).toEqual(['recognition', 'production', 'listening']);
  });
  it('시트 — 하루 아래에, 켜진 종류를 서버에서 읽은 때만(손님 · 호환 모드는 줄 없음)', () => {
    const sheet = (cardKinds) => wrap(<TitleSheet levels={['N3']} levelKey="N3" kinds={[]} prefs={{ order: 'mix' }} onPrefs={() => {}} perDay={15} onPerDay={() => {}}
      cardKinds={cardKinds} onCardKinds={() => {}} onClose={() => {}} />);
    const on = sheet(['recognition']);
    expect(on.indexOf('>하루<')).toBeGreaterThan(0);
    expect(on.indexOf('>카드<')).toBeGreaterThan(on.indexOf('>하루<'));
    expect(sheet(null)).not.toContain('>카드<');
    expect(screen).toContain('cardKinds={userId && slots ? cardKinds : null} onCardKinds={changeCardKinds}');
  });
  it('켜고 끄기 — 단어 → 뜻은 끌 수 없고, 정해진 순서로', () => {
    expect(toggleLevelCardKind(['recognition'], 'listening')).toEqual(['recognition', 'listening']);
    expect(toggleLevelCardKind(['recognition', 'listening'], 'production')).toEqual(['recognition', 'production', 'listening']);
    expect(toggleLevelCardKind(['recognition', 'production'], 'production')).toEqual(['recognition']);
    expect(toggleLevelCardKind(['recognition'], 'recognition')).toEqual(['recognition']);
    expect(toggleLevelCardKind(null, 'production')).toEqual(['recognition', 'production']);
  });
  it('저장 — 하루와 같은 길(levelSetCardKinds → 입장 configure, 하루 새 단어 수는 그대로) · 먼저 반영 · 실패면 되돌림 · 알림', () => {
    const load = fs.readFileSync('src/lib/levelDailyLoad.js', 'utf8');
    expect(load).toContain('if (!(await controller.configure(quota.limit, { cardKinds }))) return { ok: false };');
    expect(screen).toContain("const res = await import('@/lib/levelDailyLoad').then((m) => m.levelSetCardKinds(userId, next)).catch(() => ({ ok: false }));");
    expect(screen).toMatch(/setKindsChoice\(next\);\n\s+const res = await import/);
    expect(screen).toMatch(/if \(!res\.ok\) \{\n\s+setKindsChoice\(null\);\n\s+toast\('카드 종류를 바꾸지 못했어요\. 잠시 뒤 다시 해 주세요\.', 'error'\);/);
  });
});

describe('④-2 저장 길 — 입장 configure에 cardKinds 칸(같은 판본 · 생략하면 그대로)', () => {
  afterEach(() => { vi.resetModules(); vi.doUnmock('../useLearningAdmission'); });
  it('levelSetCardKinds — configure(limit, { cardKinds }) · 성공이면 서버 값 · 실패 · 호환 모드는 ok false', async () => {
    const calls = [];
    let quota = { installed: true, enabled: true, active: true, fsrsEnabled: true, startsAt: '2026-10-01T00:00:00Z', limit: 15, cardKinds: ['recognition'] };
    let accept = true;
    vi.doMock('../useLearningAdmission', () => ({
      createLearningAdmissionClient: () => ({}),
      createLearningAdmissionController: () => ({
        refresh: async () => true,
        getSnapshot: () => ({ quota }),
        configure: async (limit, opts) => { calls.push([limit, opts]); if (accept) quota = { ...quota, cardKinds: opts.cardKinds }; return accept; },
        dispose() {},
      }),
    }));
    const { levelSetCardKinds } = await import('../levelDailyLoad');
    expect(await levelSetCardKinds('u1', ['listening', 'recognition'])).toEqual({ ok: true, cardKinds: ['recognition', 'listening'] });
    expect(calls).toEqual([[15, { cardKinds: ['recognition', 'listening'] }]]);
    accept = false;
    expect(await levelSetCardKinds('u1', ['recognition'])).toEqual({ ok: false });
    expect(await levelSetCardKinds('u1', ['production'])).toEqual({ ok: false }); // 단어 → 뜻 없음 — 보내지 않는다
    expect(calls).toHaveLength(2);
  });
  it('입장 클라이언트 · 컨트롤러가 cardKinds를 같은 configure 요청에 싣는다(없으면 칸 없음)', () => {
    const src = fs.readFileSync('src/lib/useLearningAdmission.js', 'utf8');
    expect(src).toContain("configure: ({ dailyNewLimit, expectedPolicyRevision, cardKinds }) => perform({ action: 'configure', dailyNewLimit, expectedPolicyRevision,\n      ...(cardKinds ? { cardKinds } : {}) }),");
    expect(src).toContain('const response = await client.configure({ dailyNewLimit, expectedPolicyRevision: state.quota.policyRevision, ...(cardKinds ? { cardKinds } : {}) });');
  });
});

// ── 카드 목록 항목(서버 publicState 모양) ──
const ACTOR = '10000000-0000-4000-8000-000000000001';
const W1 = '20000000-0000-4000-8000-000000000001', W2 = '20000000-0000-4000-8000-000000000002';
const P1 = '2fffffff-0000-4000-8000-000000000001', P2 = '2fffffff-0000-4000-8000-000000000002';
const MIN = 60_000, DAY = 86_400_000;
const T = Date.parse('2026-11-03T03:00:00Z'); // 12:00 KST
const iso = (ms) => new Date(ms).toISOString();
const reviewCard = (lastAt, dueAt) => {
  const intro = introduceFsrsCard(iso(lastAt - 2 * MIN), { policyVersion: 'anki-v2' });
  const card = scheduleFsrsReview(intro, 3, iso(lastAt), { policyVersion: 'anki-v2' }).card;
  return { ...card, state: 'Review', step: 0, scheduledDays: 2, lastReview: iso(lastAt), due: iso(dueAt) };
};
const item = (cardId, card, extra = {}) => ({ cardId, card, attempt: null, enrolled: true, eligible: true, known: false, excluded: false,
  firstQuestionAt: card.state === 'New' ? null : iso(T - 5 * DAY), nextQuestionAt: card.due, ...extra });
const newVariant = (cardId, vocabularyId, kind, at = T - 2 * DAY) => item(cardId, introduceFsrsCard(iso(at), { policyVersion: 'anki-v2' }),
  { kind, vocabularyId, resting: false });
const entries = [{ key: '約束', ex: E.ex }, { key: '天気' }];
const ids = { 約束: W1, 天気: W2 };
const plan = (cards, cardKinds = ['recognition', 'production', 'listening'], at = T) => planLevelCardKinds({ entries, vocabularyIdOf: (k) => ids[k] ?? null,
  hasExampleOf: (k) => !!entries.find((e) => e.key === k)?.ex, cards, cardKinds, actorId: ACTOR, at });

describe('⑤ 줄 — 종류 카드 · 형제 규칙 · 차례로 붙이기', () => {
  it('카드 열쇠 — 단어 → 뜻은 단어 열쇠 그대로, 종류 카드는 「단어@@종류」', () => {
    expect(levelCardKey('約束')).toBe('約束');
    expect(levelCardKey('約束', 'production')).toBe('約束@@production');
    expect(parseLevelCardKey('約束@@listening')).toEqual({ wordKey: '約束', kind: 'listening' });
    expect(parseLevelCardKey('a@@b')).toEqual({ wordKey: 'a@@b', kind: 'recognition' });
  });
  it('종류 카드의 투영은 단어 → 뜻과 같은 함수로 — 상태 · 네 칸 미리보기가 그대로 돈다, 막 붙은 카드는 지금 차례', () => {
    const v = newVariant(P1, W1, 'production');
    const projection = variantProjection(v, { actorId: ACTOR, at: T });
    expect(projection.source).toBe('fsrs-v1');
    expect(projection.review.available).toBe(true);
    expect(levelWordStatus({ projection, at: T })).toBe('saved'); // 화면이 「오늘」로 바꿔 몫 밖에 세운다
    expect(gradePreviews({ projection, row: { id: P1 }, at: T })).not.toBeNull();
    expect(variantProjection({ ...v, resting: true }, { actorId: ACTOR, at: T }).review.available).toBe(false);
    expect(variantProjection({ cardId: P1 }, { actorId: ACTOR })).toBeNull();
  });
  it('켜진 종류 · 이 레벨 단어의 종류 카드만 · 쉬는 카드는 빼고', () => {
    const cards = [item(W1, reviewCard(T - 3 * DAY, T + 2 * DAY)), newVariant(P1, W1, 'production'), newVariant(P2, W1, 'listening', T - DAY)];
    expect([...plan(cards).variants.keys()]).toEqual(['約束@@production', '約束@@listening']);
    expect([...plan(cards, ['recognition', 'production']).variants.keys()]).toEqual(['約束@@production']);
    expect([...plan([cards[0], cards[1], { ...cards[2], resting: true }]).variants.keys()]).toEqual(['約束@@production']);
  });
  it('형제 규칙 — 같은 날 둘 이상이 차례면 더 오래 밀린 것 하나(나머지는 오늘 줄에서만 뺀다)', () => {
    const cards = [item(W1, reviewCard(T - 3 * DAY, T - 2 * DAY)), newVariant(P1, W1, 'production', T - DAY)];
    expect([...plan(cards).hidden]).toEqual(['約束@@production']); // 단어 → 뜻 기한이 더 이르다
    const later = [item(W1, reviewCard(T - 3 * DAY, T - HOURS(1))), newVariant(P1, W1, 'production', T - DAY)];
    expect([...plan(later).hidden]).toEqual(['約束']); // 뜻 → 단어가 더 오래 밀렸다
    // 같은 단어의 다른 카드를 오늘 채점했으면 그날 처음 꺼낼 카드는 다음 학습일로
    const answered = [item(W1, reviewCard(T - 30 * MIN, T + 2 * DAY)), newVariant(P1, W1, 'production', T - DAY)];
    expect([...plan(answered).hidden]).toEqual(['約束@@production']);
    // 단어마다 카드가 한 장이면 아무것도 빼지 않는다
    expect(plan([item(W2, reviewCard(T - 3 * DAY, T - DAY))]).hidden.size).toBe(0);
  });
  it('차례로 붙이기 — 단어 → 뜻이 날 단위로 넘어간 다음 학습일에 뜻 → 단어 · 듣기는 예문이 있을 때만(nextVariantKind 거울)', () => {
    expect(plan([item(W1, reviewCard(T - 2 * DAY, T + DAY))]).enroll).toEqual([{ wordKey: '約束', vocabularyId: W1, kind: 'production' }]);
    expect(plan([item(W1, reviewCard(T - 2 * DAY, T + DAY))], ['recognition', 'listening']).enroll)
      .toEqual([{ wordKey: '約束', vocabularyId: W1, kind: 'listening', hasExample: true }]);
    expect(plan([item(W2, reviewCard(T - 2 * DAY, T + DAY))], ['recognition', 'listening']).enroll).toEqual([]); // 예문 없는 단어
    expect(plan([item(W1, reviewCard(T - 30 * MIN, T + DAY))]).enroll).toEqual([]); // 오늘 채점 — 다음 학습일에
  });
  it('종류 카드는 하루 새 단어 몫 밖(오늘 복습과 같이 선다) · 뒤에 생긴 카드는 더하고 꺼진 종류는 뺀다', () => {
    const list = [{ key: 'n1' }, { key: 'w' }, { key: 'w@@production' }];
    const st = { n1: 'new', w: 'review', 'w@@production': 'today' };
    const s = startLevelSession(list, (k) => st[k], () => 0, T, { newCap: 0 });
    expect(s.queue).toEqual(['w@@production']);
    expect(s.held).toEqual(['n1']);
    const added = addLevelSessionKeys(s, [{ key: 'w@@listening', at: 0, rank: 3 }, { key: 'w@@production', at: 0 }], T);
    expect(added.queue).toEqual(['w@@production', 'w@@listening']);
    expect(added.total).toBe(s.total + 1);
    // 채점해 줄에서 빠진 카드는 다시 세우지 않는다(seen)
    const graded = gradeLevelSession(added, 'w@@listening', 3, null);
    expect(addLevelSessionKeys(graded, [{ key: 'w@@listening', at: 0 }], T)).toBe(graded);
    // 끄면 빠지고, 다시 켜면 다시 선다
    const off = dropLevelSessionKeys(added, (k) => !k.endsWith('@@production'));
    expect(off.queue).toEqual(['w@@listening']);
    expect(addLevelSessionKeys(off, [{ key: 'w@@production', at: 0 }], T).queue).toEqual(['w@@listening', 'w@@production']);
  });
  it('화면 배선 — 종류 카드 채점은 그 카드 id로 같은 한 번 채점 · 몫 안내에 걸리지 않음 · 붙이기는 바로 보내기(보낼함에 막힌 연산을 남기지 않는다)', () => {
    expect(screen).toContain('const res = info.variant ? await grader.gradeCard(info.variant, rating, { ahead: aheadMode }) : await grader.grade(entry, rating, { ahead: aheadMode });');
    expect(screen).toContain("out.set(key, { status: status === 'saved' ? 'today' : status, graded: true, projection: v.projection, row: { id: v.entry.cardId }, known: false, variant: v });");
    const grade = fs.readFileSync('src/lib/useLevelWordGrade.js', 'utf8');
    expect(grade).toContain('const result = await gradeLevelFsrs({ accountId: userId, row: { id: card.entry.cardId }, rating, waitMs: waitMs || 0 });');
    const fsrs = fs.readFileSync('src/lib/levelFsrsGrade.js', 'utf8');
    expect(fsrs).toContain('const response = await client.enrollVariant({ accountId, cardId, expectedRevision: 0, operationId: makeId(),');
    expect(fs.readFileSync('src/lib/fsrsLearningClient.js', 'utf8')).toMatch(/enrollVariant\(payload\) \{\n\s+assertOwner\(\);\n\s+if \(!payload\?\.cardKind\) throw problem\('fsrs_invalid_request'\);\n\s+return online\('enroll', payload\);/);
    // 한 번 읽을 때 붙이는 수는 page장까지
    expect(screen).toContain('.slice(0, LEVEL_WORD_PREFS.page);');
  });
});
const HOURS = (n) => n * 60 * MIN;

describe('⑥ 기본값(단어 → 뜻 하나) — 지금 화면 그대로', () => {
  it('종류가 꺼져 있으면 종류 카드가 있어도(쉬는 카드) 아무것도 만들지 않는다', () => {
    const cards = [item(W1, reviewCard(T - 3 * DAY, T - DAY)), newVariant(P1, W1, 'production')];
    const off = plan(cards, RECOGNITION_ONLY);
    expect(off.variants.size + off.hidden.size + off.enroll.length).toBe(0);
    expect(plan(cards, null).variants.size).toBe(0);
  });
  it('켜진 종류를 모르면 단어 → 뜻 하나 · 카드 목록은 종류가 켜졌을 때만 읽는다 · 줄은 단어 항목 그대로', () => {
    expect(screen).toContain('const cardKinds = kindsChoice || slots?.cardKinds || RECOGNITION_ONLY;');
    expect(screen).toContain('const kindsOn = !!userId && cardKinds.length > 1;');
    expect(screen).toMatch(/queryKey: \['level-card-kinds', userId\],[\s\S]{0,300}enabled: mounted && kindsOn,/);
    expect(screen).toContain('const variantsSettled = !kindsOn || variantQuery.isFetched;');
    expect(screen).toMatch(/const lineEntries = useMemo\(\(\) => \(kindPlan\.variants\.size \? [\s\S]{0,200}: allEntries\)/);
    expect(screen).toContain('if (!kindPlan.variants.size) return byKey;');
  });
});

describe('⑦ 보기 탭 없앰(A안) · 끝 화면 「전체 훑어보기」 · 카드 기억률 줄', () => {
  it('보기 탭 · 연습 탭 부품이 없다', () => {
    expect(prefs.LEVEL_WORD_VIEWS).toBeUndefined();
    expect(screen).not.toMatch(/lw-tabs|switchView|PracticeIntro|PracticeBar|PracticeDone|onPractice|prefs\.view/);
    const areas = fs.readFileSync('src/components/levels/word/WordAreas.jsx', 'utf8');
    expect(areas).not.toMatch(/export function (PracticeIntro|PracticeBar|PracticeDone)/);
    expect(css).not.toMatch(/\.lw-tabs|\.lw-practice|\.lw-two|\.lw-one__solo|\.lw-card__solo/);
  });
  it('끝 화면 — 전체 훑어보기는 늘 끝 화면 단추(몫에서 멈춘 날도, 레벨을 다 한 날도) · 소리 확인 단추는 없다', () => {
    const counts = { 1: 1, 2: 0, 3: 3, 4: 1 };
    const full = wrap(<OneWordDone graded={5} tomorrow={2} counts={counts} onNext={() => {}} nextLabel="JLPT N2" onList={() => {}} onBrowse={() => {}} />);
    expect([...full.matchAll(/<button[^>]*>([^<]+)<\/button>/g)].map((m) => m[1])).toEqual(['계속 진행', '리스트로', '전체 훑어보기']);
    const capped = wrap(<OneWordDone graded={5} tomorrow={2} counts={counts} more={10} perDay={10} started={10} onMore={() => {}} onBrowse={() => {}} />);
    expect(capped).toContain('>전체 훑어보기</button>');
    expect(full).not.toContain('소리로 확인할 단어');
    expect(screen).toContain('onMore={moreNew} onBrowse={() => setBrowsing(true)} />;');
    // 훑어보기에서 나오는 길 — 머리 단추 · Esc
    expect(screen).toContain('<button type="button" className="lw-btn" onClick={() => setBrowsing(false)} aria-keyshortcuts="Escape">학습으로</button>');
    expect(screen).toContain("if (event.key === 'Escape') { event.preventDefault(); h.leaveBrowse(); }");
  });
  it('카드 기억률 줄 — 켜진 종류마다 한 칸(단어 → 뜻 · 뜻 → 단어 · 듣기) · 단어 → 뜻 칸이 기준', () => {
    const html = renderToStaticMarkup(<AreaRow areas={[{ kind: 'recognition', state: 'hit', recall: 0.93 }, { kind: 'production', state: 'miss', recall: 0 },
      { kind: 'listening', state: 'new', recall: 0 }]} next="2일 후 복습" />);
    expect(html).toContain('aria-label="카드 기억 확률" style="--n:3"');
    expect([...html.matchAll(/aria-label="([^"]+)"/g)].map((m) => m[1]).slice(1)).toEqual(['단어 → 뜻 맞힘 93%', '뜻 → 단어 놓침 0%', '듣기 처음 0%']);
    expect(html).toContain('data-main="true"');
    const one = renderToStaticMarkup(<AreaRow areas={[{ kind: 'recognition', state: 'new', recall: 0 }]} />);
    expect(one).toContain('style="--n:1"');
    expect(one).not.toMatch(/문장|소리/);
    expect(css).toContain('.lw-areas{display:grid;grid-template-columns:repeat(var(--n,3),minmax(0,1fr));gap:6px}');
    expect(screen).toMatch(/return cardKinds\.map\(\(kind\) => \{/);
  });
});
