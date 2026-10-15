// 레벨별 단어 · 문형 목록 화면(LEVEL-LIST-AJ-001) — 서버 렌더 마크업 계약.
// 서버 렌더는 계정 상태(저장됨 · 아는 단어 · 듣기)를 그리지 않는다 → 브라우저 첫 렌더와 같다(하이드레이션 불일치 0, 수용 기준 8).
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({ usePathname: () => '/japanese/vocab/n5' }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/lib/useTTS', () => ({ useTTS: () => ({ speak: () => {}, supported: true }) }));
vi.mock('@/lib/useKnownWords', () => ({ useKnownWords: () => ({ rows: [], isPendingWord: () => false, mutation: { mutate: () => {} } }) }));

const { default: LevelListPage, VocabCard } = await import('../LevelListPage.jsx');
const { levelListData } = await import('../../lib/levelListData.js');
const { default: LevelTiles } = await import('../../components/levels/LevelTiles.jsx');

const { levelCardShows } = await import('../../lib/levelList.js');
const { hunRubyCells } = await import('../../lib/viewerHunRuby.js');
const { glyphRows } = await import('../../lib/glyphColumn.js');
const tables = {
  koTable: (await import('../../lib/data/hanjaKo.json')).default,
  hunTable: (await import('../../lib/data/hanjaHun.json')).default,
  tradTable: (await import('../../lib/data/hanjaTrad.json')).default,
};
const jaTable = (await import('../../lib/data/jaWords.json')).default;
const render = async (lang, kind, level) => renderToStaticMarkup(<LevelListPage {...await levelListData(lang, kind, level)} />);
const count = (html, needle) => html.split(needle).length - 1;

describe('단어 목록', () => {
  it('N5: 가나 먼저 크게 + 한자 작게, 카드마다 [O][X] 순서 · 이름표 · 출처 한 줄', async () => {
    const html = await render('japanese', 'vocab', 'n5');
    expect(html).toContain('<h1>N5 단어</h1>');
    expect(html).toMatch(/<span class="lv-hw" lang="ja">[ぁ-ゖァ-ヺー]+<\/span><span class="lv-kj" lang="ja">[^<]*[一-龯][^<]*<\/span>/);
    // 처음엔 150개만(전: 950개 전부 → 후: 150개 + 「더 보기」 — smoke e2e N3 DOM 예산). 묶음 제목 개수는 전체 기준.
    const cards = count(html, 'class="lv-entry"');
    expect(cards).toBe(150);
    expect(html).toContain('더 보기 · 800개 남음');
    expect(count(html, 'aria-label="안다 — 아는 단어로" title="안다"')).toBe(cards);
    expect(count(html, 'aria-label="모른다 — 공부 중인 단어로" title="모른다"')).toBe(cards);
    expect(html.indexOf('lv-fab--o')).toBeLessThan(html.indexOf('lv-fab--x'));
    expect(html).not.toMatch(/lv-fab--(ex|save)|뜻 가리기|<input(?![^>]*type="search")/); // 옛 [제외][저장] · 뜻 가리기 · 채점 입력창 0
    // 보기: [전체] │ [단어][문장] [의미] [듣기] + 아는 단어 숨기기 — 처음엔 전체만 눌림, 일본어에는 훈음 · 한자 대조 없음
    const opts = [...html.matchAll(/<button type="button" class="lv-opt[^"]*" aria-pressed="(true|false)">([^<]+)/g)].map((m) => `${m[2]}:${m[1]}`);
    expect(opts).toEqual(['전체:true', '단어:false', '문장:false', '의미:false', '듣기:false', '아는 단어 숨기기:false']);
    expect(html).not.toContain('class="lv-veil');
    expect(html).toContain('<p class="lv-src">출처 open-anki-jlpt-decks</p>');
  });

  it('N3: 한자 위 읽기(루비) — 가나 먼저 아님', async () => {
    const html = await render('japanese', 'vocab', 'n3');
    expect(html).toMatch(/<span class="lv-hw" lang="ja"><ruby>[^<]+<rt>/);
    expect(html).not.toContain('class="lv-kj"');
  });

  it('중국어: 병음은 옆 · 아래 작은 줄, 위 읽기 없음 · 2026 급수 기준 출처', async () => {
    const html = await render('chinese', 'vocab', 'h1');
    expect(html).toContain('<h1>HSK 1 단어</h1>');
    expect(html).toMatch(/<span class="lv-hw" lang="zh-CN">[^<]+<\/span><span class="lv-py">/);
    expect(html).toContain('class="lv-ex__py"');
    expect(html).not.toContain('<ruby>');
    expect(html).toContain('中文水平考试 HSK 考试大纲');
    // 중국어만 훈음(기본 켬) · 한자 대조(기본 끔) — 서버 렌더는 표가 없어 훈음 줄 0(하이드레이션 같음)
    expect(html).toMatch(/aria-pressed="true">훈음<\/button><button type="button" class="lv-opt lv-opt--check" aria-pressed="false">한자 대조</);
    expect(html).not.toContain('word-fit__hun');
  });

  it('레벨 알약 · 탭 · 「← 교재」 — 보관함 · 문법 링크 0', async () => {
    const html = await render('chinese', 'vocab', 'h2');
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toContain('/lessons?lang=Chinese');
    expect(new Set(hrefs.filter((h) => /^\/chinese\/vocab\/h[1-6]$/.test(h))).size).toBe(6); // 알약 6 + 「단어」 탭
    expect(hrefs).toContain('/chinese/bunkei/h2');
    expect(hrefs.filter((h) => /grammar|legacy/.test(h))).toEqual([]);
    expect(html).toMatch(/<a aria-current="page" aria-label="HSK 2" href="\/chinese\/vocab\/h2">2<\/a>|<a href="\/chinese\/vocab\/h2" aria-current="page" aria-label="HSK 2">2<\/a>/);
  });
});

describe('단어 카드 — 보기 옵션 · 10초 보기 · 훈음 · 正日(LEVEL-OX-AN-001)', () => {
  const entry = { key: '学习', word: '学习', reading: 'xuéxí', meaning: '배우다, 공부하다', fullMeaning: '배우다', pos: '동사',
    ex: { text: '我在学习汉语。', reading: 'wǒ zài xuéxí hànyǔ.', ko: '나는 중국어를 공부하고 있다.' } };
  const card = (cues, extra = {}) => renderToStaticMarkup(<VocabCard entry={entry} lang="chinese" levelKey="h1" show={levelCardShows(cues, extra.peek)}
    onPeek={() => {}} speak={() => {}} hunCells={hunRubyCells(entry.word, tables, { glyphPx: 27, hunPx: 12 })}
    glyph={extra.glyph ? glyphRows({ word: entry.word, tradTable: tables.tradTable, jaTable }) : null}
    known={!!extra.known} studying={!!extra.studying} saving={false} pendingKnown={false} onO={() => {}} onX={() => {}} />);

  it('전체: 글자마다 훈음(정체 꼴로 찾기 — 学→學 배울 학) · 뜻 · 예문 · 듣기, 가린 칸 0', () => {
    const html = card([]);
    expect([...html.matchAll(/data-label="([^"]+)"/g)].map((m) => m[1])).toEqual(['배울 학', '익힐 습']);
    expect(html).toContain('배우다, 공부하다');
    expect(html).toContain('나는 중국어를 공부하고 있다.');
    expect(count(html, 'aria-label="듣기"')).toBe(1);
    expect(html).not.toMatch(/lv-veil|data-hidden/);
  });

  it('[단어]: 표제어 · 예문 본문만, 뜻 · 번역은 가린 칸 / [의미]: 뜻 · 번역만, 표제어 · 훈음 · 예문 본문은 가림', () => {
    const word = card(['word']);
    expect(word).toContain('data-label="배울 학"');
    expect(word).toContain('我在学习汉语。');
    expect(word).not.toMatch(/배우다, 공부하다|나는 중국어를/);
    expect(count(word, 'aria-label="가린 내용 10초 보기"')).toBe(1);
    expect(word).not.toContain('aria-label="듣기"');
    const meaning = card(['meaning']);
    expect(meaning).toContain('배우다, 공부하다');
    expect(meaning).toContain('나는 중국어를 공부하고 있다.');
    expect(meaning).not.toMatch(/学习|data-label|我在/);
    expect(meaning).toContain('lv-veil lv-veil--word');
  });

  it('[문장]: 예문 본문만(표제어 가림) / [듣기]: 듣기 버튼만, 나머지 가림 / 10초 보기면 전부', () => {
    const sentence = card(['sentence']);
    expect(sentence).toContain('我在学习汉语。');
    expect(sentence).not.toMatch(/data-label|배우다/);
    const audio = card(['audio']);
    expect(audio).toContain('aria-label="듣기"');
    expect(audio).not.toMatch(/学习|배우다|我在|나는/);
    expect(count(audio, 'aria-label="가린 내용 10초 보기"')).toBe(2);
    expect(card(['audio'], { peek: true })).toBe(card([]));
  });

  it('[O][X]: 아는 단어면 O만 눌림(점선 카드), 공부 중이면 X만 눌림', () => {
    const pressed = (html) => [...html.matchAll(/lv-fab--(o|x)[^"]*" aria-pressed="(true|false)"/g)].map((m) => `${m[1]}:${m[2]}`);
    expect(pressed(card([]))).toEqual(['o:false', 'x:false']);
    expect(pressed(card([], { known: true, studying: true }))).toEqual(['o:true', 'x:false']);
    expect(card([], { known: true })).toContain('data-known="true"');
    expect(pressed(card([], { studying: true }))).toEqual(['o:false', 'x:true']);
  });

  it('한자 대조(옵션): 正 대만 정체 · 日 일본어 표기 한 줄 — 뷰어 glyphRows 그대로', () => {
    expect(card([])).not.toContain('lv-glyph');
    const html = card([], { glyph: true });
    expect(html).toContain('<b aria-label="대만 정체">正</b><span lang="zh-TW">學習</span>');
    expect(html).toContain('<b aria-label="일본어 표기">日</b><span lang="ja">学習</span><small lang="ja">がくしゅう</small>');
    expect(card(['meaning'], { glyph: true })).not.toContain('lv-glyph'); // 의미만 볼 때는 표제어와 함께 가린다
  });
});

describe('문형 목록', () => {
  it('읽기 전용 — 저장 · 번호 · 캡션 · 펼치기 0, note 없는 문형엔 주의 줄 0', async () => {
    const data = await levelListData('chinese', 'bunkei', 'h1');
    const html = renderToStaticMarkup(<LevelListPage {...data} />);
    expect(html).toContain('<h1>HSK 1 문형</h1>');
    expect(html).not.toMatch(/lv-fab|저장|<details|<ol|예문<\/|lv-toc/);
    const pats = data.groups.flatMap((g) => g.entries);
    expect(count(html, 'class="lv-pat"')).toBe(pats.length);
    expect(count(html, 'class="lv-note"')).toBe(pats.filter((p) => p.note).length);
    expect(count(html, 'class="lv-formula"')).toBe(pats.filter((p) => p.conn).length);
    expect(html).toContain('class="lv-chips"');
  });
});

describe('한자 목록(HANZI-TAB-AL-001)', () => {
  const TONE = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/;
  it('HSK 1 한자: 세 번째 탭 · 글자만(병음 · 뜻 0) · 묶음 목차 · 시작 버튼', async () => {
    const data = await levelListData('chinese', 'hanzi', 'h1');
    const html = renderToStaticMarkup(<LevelListPage {...data} />);
    expect(html).toContain('<h1>HSK 1 한자</h1>');
    const tabs = [...html.matchAll(/<nav class="lv-tabs"[^>]*>(.*?)<\/nav>/g)][0][1];
    expect([...tabs.matchAll(/>([^<]+)<\/a>/g)].map((m) => m[1])).toEqual(['단어', '문형', '한자']);
    expect(html).not.toMatch(TONE);
    const table = (await import('../../lib/data/zhHanzi/H1.json')).default;
    const glosses = Object.values(table.chars).flatMap((c) => c.rd.flatMap((r) => r.s.map((x) => x.g)));
    expect(glosses.filter((g) => [...g].length >= 2 && html.includes(g))).toEqual([]); // 한 글자 뜻(소 · 나)은 화면 문구와 겹쳐 뺀다
    expect(count(html, 'class="hz-cell')).toBe(data.groups[0].entries.length);
    expect(html).toContain('>문법 글자<');
    expect(html).toContain('넘기며 확인 <small>');
    expect(html).not.toContain('모름만'); // 로그인 전 · 표시 0
    expect(html).not.toContain('class="lv-search"');
    // 알약: 한자 탭이 있는 급수(1 · 2)는 한자로, 없는 급수(3–6)는 단어로 — 없는 주소(404) 0
    const pills = [...html.matchAll(/href="(\/chinese\/[a-z]+\/h\d)" aria-label="HSK \d"|aria-label="HSK \d" href="(\/chinese\/[a-z]+\/h\d)"/g)].map((m) => m[1] || m[2]);
    expect(pills).toEqual(['/chinese/hanzi/h1', '/chinese/hanzi/h2', '/chinese/vocab/h3', '/chinese/vocab/h4', '/chinese/vocab/h5', '/chinese/vocab/h6']);
  });

  it('한자 탭은 HSK 1–2급만 — 3급 이상 · 일본어에는 없다', async () => {
    expect(await render('chinese', 'vocab', 'h1')).toContain('href="/chinese/hanzi/h1"');
    expect(await render('chinese', 'vocab', 'h3')).not.toContain('/chinese/hanzi/');
    expect(await levelListData('chinese', 'hanzi', 'h3')).toBeNull();
    expect(await levelListData('japanese', 'hanzi', 'n5')).toBeNull();
  });
});

describe('책장 타일', () => {
  it('레벨 + 「단어 N / 문형 N」 두 줄, 숫자는 넘겨받은 값(천 단위 쉼표)', () => {
    const html = renderToStaticMarkup(<LevelTiles language="Chinese" tiles={[{ levelKey: 'H1', vocab: 300, bunkei: 77 }, { levelKey: 'H6', vocab: 1384, bunkei: 59 }]} />);
    expect(html).toContain('<span class="lv-tile__lv">HSK 1</span>');
    expect(html).toContain('href="/chinese/vocab/h6"');
    expect(html).toContain('단어<b>1,384</b>');
    expect(html).toContain('문형<b>77</b>');
    expect(html).not.toContain('→');
    expect(renderToStaticMarkup(<LevelTiles language="English" tiles={[{ levelKey: 'A1', vocab: 1, bunkei: 1 }]} />)).toBe('');
  });
});
