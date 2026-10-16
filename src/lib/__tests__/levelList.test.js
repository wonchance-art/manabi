import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween.js';
import { levelListData, levelTileCounts, ZH_POS_GROUPS } from '../levelListData.js';
import { LEVEL_LIST_LANGS, shortMeaning, levelWordKey, matchesLevelQuery, splitKnown, levelLabel, levelPill, levelListHref, jaHeadMode,
  LEVEL_PEEK_CLOSE_MS, LEVEL_PEEK_MS, LEVEL_VIEWS, normalizeLevelPrefs, levelProgress, pinyinSyllables, writeLevelSnapshot, readLevelSnapshot,
  levelResumeCard, LEVEL_SNAPSHOT_KEY } from '../levelList.js';
import { knownWordSetOf, normalizeKnownWord } from '../knownWordControl.js';
import { exclusionWord } from '../vocabularyExclusion.js';
import { JAPANESE_VOCAB_REF } from '../japaneseVocabRegistry.js';
import { countBunkei as countJaBunkei } from '../../content/japanese/index.js';
import { countBunkei as countZhBunkei, getVocab as getZhVocab, ZH_LEVEL_META } from '../../content/chinese/index.js';
import { loadZhHskLevels, zhHskLevelOf } from '../zhHskLevel.js';
import { legacyTextbookTarget, learnerHref } from '../bookNavigation.js';

// 계약: 레벨별 단어 · 문형 목록(LEVEL-LIST-AJ-001 — 인계 #1337 6119208984 · 보완 6146777048, 오너 승인 2026-10-12·13 KST).
// ⑴ 숫자는 데이터에서 센다(타일 = 목록) ⑵ 중국어 단어 = 우리 사전 ∩ HSK 2026 그 급수 ⑶ 뷰어 ↔ 목록 아는 단어 대조 양방향
// ⑷ 뜻 줄임 · 표기 규칙 ⑸ 저장은 action:'save'만 · 예문 안 붙임 · 보관함 링크 0.

const ROOT = process.cwd();
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const total = (data) => data.groups.reduce((n, g) => n + g.entries.length, 0);

describe('⑴ 숫자 = 데이터 개수', () => {
  it('타일 숫자는 목록 개수와 같고, 문형은 countBunkei와 같다', async () => {
    for (const lang of ['japanese', 'chinese']) {
      const tiles = await levelTileCounts(lang);
      expect(tiles.map((t) => t.levelKey)).toEqual(LEVEL_LIST_LANGS[lang].levels);
      for (const t of tiles) {
        expect(t.vocab, `${lang} ${t.levelKey}`).toBe(total(await levelListData(lang, 'vocab', t.levelKey)));
        expect(t.bunkei, `${lang} ${t.levelKey}`).toBe(total(await levelListData(lang, 'bunkei', t.levelKey)));
        expect(t.bunkei).toBe((lang === 'japanese' ? countJaBunkei : countZhBunkei)(t.levelKey));
        expect(t.vocab).toBeGreaterThan(0);
      }
    }
  });

  it('일본어 단어 = 레지스트리 그대로(표기 중복만 하나로)', async () => {
    for (const key of LEVEL_LIST_LANGS.japanese.levels) {
      const data = await levelListData('japanese', 'vocab', key);
      expect(total(data)).toBeLessThanOrEqual(JAPANESE_VOCAB_REF.countVocab(key));
      expect(total(data)).toBeGreaterThan(JAPANESE_VOCAB_REF.countVocab(key) * 0.98);
      expect(data.groups.map((g) => g.name)).toEqual(JAPANESE_VOCAB_REF.getVocab(key).themes.map((t) => t.name).filter((n) => data.groups.some((g) => g.name === n)));
    }
  });

  it('없는 레벨 · 언어 · 종류는 null(404)', async () => {
    for (const [lang, kind, level] of [['japanese', 'vocab', 'ot'], ['chinese', 'vocab', 'life'], ['english', 'vocab', 'a1'], ['japanese', 'grammar', 'n5'], ['chinese', 'bunkei', 'n5']]) {
      expect(await levelListData(lang, kind, level), `${lang}/${kind}/${level}`).toBeNull();
    }
    expect(await levelListData('japanese', 'vocab', 'N5')).not.toBeNull(); // 대소문자 무관
  });
});

describe('⑵ 중국어 단어 = 우리 사전 ∩ HSK 2026 급수', () => {
  it('각 레벨의 단어는 2026 표 급수가 그 레벨이고, 우리 사전에 있으며, 두 레벨에 겹치지 않는다', async () => {
    const table = await loadZhHskLevels();
    const dict = new Set(ZH_LEVEL_META.flatMap((m) => (getZhVocab(m.key)?.themes || []).flatMap((t) => t.words.map((w) => w.zh))));
    const seen = new Map();
    for (const key of LEVEL_LIST_LANGS.chinese.levels) {
      const data = await levelListData('chinese', 'vocab', key);
      for (const e of data.groups.flatMap((g) => g.entries)) {
        expect(zhHskLevelOf(e.word, table), e.word).toBe(Number(key.slice(1)));
        expect(dict.has(e.word), e.word).toBe(true);
        expect(seen.has(e.key), `${e.word}: ${seen.get(e.key)} · ${key}`).toBe(false);
        seen.set(e.key, key);
      }
    }
    // 우리 사전에 있는 1~6급 2026 단어는 전부 어느 레벨에 나온다(빠짐 0).
    const expected = [...dict].filter((w) => [1, 2, 3, 4, 5, 6].includes(zhHskLevelOf(w, table)));
    expect(expected.filter((w) => !seen.has(levelWordKey(w)))).toEqual([]);
  });

  it('묶음은 품사 순서 고정, 묶음 안은 병음 순', async () => {
    const data = await levelListData('chinese', 'vocab', 'H1');
    const names = ZH_POS_GROUPS.map((g) => g.name);
    expect(data.groups.map((g) => g.name)).toEqual(names.filter((n) => data.groups.some((g) => g.name === n)));
    const plain = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/gi, '').toLowerCase();
    for (const g of data.groups) {
      const keys = g.entries.map((e) => plain(e.reading));
      expect(keys).toEqual([...keys].sort((a, b) => a.localeCompare(b)));
    }
  });

  it('급수 조회는 화면 표시 정본 하나(zhHskLevel.js) — 표 파일을 따로 읽지 않는다', () => {
    const src = read('src/lib/levelListData.js');
    expect(src).toContain("import { loadZhHskLevels, zhHskLevelOf } from './zhHskLevel';");
    expect(src).not.toContain('zhHsk2026Level');
    expect(read('src/lib/zhHskLevel.js')).not.toMatch(/from 'react'/); // 서버 조립이 들이는 모듈 — react 훅은 useZhHskLevels.js
  });
});

describe('⑶ 아는 단어 대조 — 뷰어 ↔ 레벨 목록 양방향', () => {
  const viewerIsKnown = (set, token) => set.has(normalizeKnownWord(token.text)) || set.has(exclusionWord(token)); // ViewerPage 2586행과 같은 식

  it('목록에서 제외한 단어(대조 키)는 뷰어의 활용형 토큰에서도 아는 단어다', () => {
    const rows = [{ lang: 'ja', word_text: levelWordKey('食べる') }, { lang: 'zh', word_text: levelWordKey('学习') }];
    expect(viewerIsKnown(knownWordSetOf(rows, [], 'ja'), { text: '食べた', base_form: '食べる' })).toBe(true);
    expect(viewerIsKnown(knownWordSetOf(rows, [], 'zh'), { text: '学习' })).toBe(true);
    expect(viewerIsKnown(knownWordSetOf(rows, [], 'zh'), { text: '食べる' })).toBe(false); // 언어가 다르면 별개
  });

  it('뷰어에서 표시한 단어(exclusionWord = 기본형)는 목록에서 숨는다', () => {
    const marked = [{ lang: 'ja', word_text: exclusionWord({ text: '会いました', base_form: '会う' }) }];
    const entries = [{ key: levelWordKey('会う；逢う') }, { key: levelWordKey('〜さん') }, { key: levelWordKey('行く') }];
    const { shown, known } = splitKnown(entries, knownWordSetOf(marked, [], 'ja'));
    expect(known.map((e) => e.key)).toEqual(['会う']);
    expect(shown.map((e) => e.key)).toEqual(['さん', '行く']);
  });

  it('대조 키 = 레지스트리 중복 제거와 같은 정규화(첫 표기 · 〜 제거 · 공백 제거 · NFC)', () => {
    expect(levelWordKey(' 〜について ')).toBe('について');
    expect(levelWordKey('会う；逢う')).toBe('会う');
    expect(levelWordKey('お 茶')).toBe('お茶');
    expect(levelWordKey('\u30ab\u3099')).toBe('\u30ac'); // カ + 결합 탁점 → ガ
  });
});

describe('⑷ 표기 규칙', () => {
  it('뜻은 괄호 앞까지, 12자 이하 괄호만 남긴다', () => {
    expect(shortMeaning('안녕하세요 (아침 인사)')).toBe('안녕하세요 (아침 인사)');
    expect(shortMeaning('안녕하세요 (낮 인사 — 원래 「今日は(오늘은)…」의 앞만 남은 인사)')).toBe('안녕하세요');
    expect(shortMeaning('A는 ~하다 (형용사 술어, 是 없이 很으로)')).toBe('A는 ~하다');
    expect(shortMeaning('고맙습니다')).toBe('고맙습니다');
    expect(shortMeaning('(제품의) 모델')).toBe('(제품의) 모델');
    expect(shortMeaning('(우산을) 쓰다, (손을) 뻗다')).toBe('(우산을) 쓰다, (손을) 뻗다'); // 짧은 괄호 뒤 뜻은 지우지 않는다
    expect(shortMeaning('닿다, 이르다 (시간·장소에 도착한다는 뜻으로 넓게 써요)')).toBe('닿다, 이르다');
  });

  it('일본어 N5 · N4 가나 먼저, N3부터 위 읽기 · 이름과 주소', () => {
    expect(['N5', 'N4', 'N3', 'N2', 'N1'].map(jaHeadMode)).toEqual(['kana', 'kana', 'ruby', 'ruby', 'ruby']);
    expect([levelLabel('H1'), levelPill('H1'), levelLabel('N5'), levelPill('n3')]).toEqual(['HSK 1', '1', 'N5', 'N3']);
    expect(levelListHref('chinese', 'bunkei', 'H1')).toBe('/chinese/bunkei/h1');
  });

  it('찾기 — 표제어 · 읽기(가타카나 · 성조 무시) · 뜻', () => {
    const e = { word: '学生', reading: 'xuésheng', meaning: '학생' };
    expect(['学', 'xuesheng', 'xué', '학생'].every((q) => matchesLevelQuery(e, q))).toBe(true);
    expect(matchesLevelQuery({ word: 'パン', reading: 'パン', meaning: '빵' }, 'ぱん')).toBe(true);
    expect(matchesLevelQuery(e, '선생')).toBe(false);
  });

  it('문형 항목에는 explain · contrast · 챕터 링크가 없다(읽기 전용)', async () => {
    for (const lang of ['japanese', 'chinese']) {
      const data = await levelListData(lang, 'bunkei', LEVEL_LIST_LANGS[lang].levels[0]);
      for (const e of data.groups.flatMap((g) => g.entries)) {
        expect(Object.keys(e).sort()).toEqual(['conn', 'exs', 'key', 'ko', 'note', 'pattern']);
      }
    }
  });
});

describe('⑹ O · X 빠른 암기 보기 옵션(LEVEL-OX-AN-001)', () => {
  it('보기 탭: 하나만 고른다 — 전체 · 단어 · 문장 · 뜻 · 소리, 카드를 누르면 10초 동안 전부', () => {
    expect(LEVEL_VIEWS.map((v) => v.label)).toEqual(['전체', '글자', '문장', '뜻', '소리']); // 「단어」 → 「글자」(위 줄 목록 종류 「단어」와 겹침 — 디자인 검토 A안)
    expect(LEVEL_PEEK_MS).toBe(10_000);
  });

  it('펼치기(4판): 다시 누르면 접기 · 10초 뒤 접기 · 접힘 움직임은 CSS와 같은 길이 · 움직임 줄이기면 즉시', () => {
    const page = read('src/views/LevelListPage.jsx');
    const css = read('src/components/levels/level-list.css');
    expect(sliceBetween(page, 'const togglePeek = ', ';\n')).toContain("peekRef.current.get(key)?.phase === 'open' ? closePeek(key) : openPeek(key)");
    expect(sliceBetween(page, 'const openPeek = ', '\n  }, [')).toContain('setTimeout(() => closePeek(key), LEVEL_PEEK_MS)');
    const close = sliceBetween(page, 'const closePeek = ', '\n  }, [');
    expect(close).toContain("(prefers-reduced-motion: reduce)");
    expect(close).toContain('LEVEL_PEEK_CLOSE_MS');
    expect(LEVEL_PEEK_CLOSE_MS).toBe(200);
    expect(css).toContain('animation:lv-close .2s ease-in');
    expect(css).toMatch(/@keyframes lv-open\{from\{grid-template-rows:0fr/);
    expect(css).toMatch(/prefers-reduced-motion:reduce\)\{\.lv-reveal,[^}]*animation:none/);
  });

  it('저장된 설정 검증: 보기 전체 · 훈음 켬 · 한자 대조 · 숨기기 끔이 기본, 모르는 값은 버린다', () => {
    expect(normalizeLevelPrefs(null)).toEqual({ view: 'all', hideKnown: false, hun: true, glyph: false, tone: false }); // 성조 색은 옵트인(오너 2026-08-19)
    expect(normalizeLevelPrefs({ view: 'grade', hideKnown: true, hun: 'yes', glyph: true }))
      .toEqual({ view: 'all', hideKnown: true, hun: true, glyph: true, tone: false });
    expect(normalizeLevelPrefs({ view: 'audio' }).view).toBe('audio');
  });

  it('⚙ 설정: 아는 단어 숨기기는 늘, 훈음 · 한자 대조는 중국어만 — 스위치(role switch)', () => {
    const page = read('src/views/LevelListPage.jsx');
    const panel = sliceBetween(page, '<div className="lv-settings" id="lv-settings">', '</div>}');
    expect(panel).toContain("['hideKnown', '아는 단어 숨기기'");
    expect(panel).toMatch(/\.\.\.\(zhVocab \? \[\['hun', '훈음'.*\['glyph', '한자 대조'/);
    expect(panel).toContain('role="switch"');
  });

  it('화면 배선: 채점 · 입력창 없음, O = 아는 단어 토글, X = 저장(아는 단어면 먼저 풀고), 훈음 · 正日은 뷰어 부품', () => {
    const page = read('src/views/LevelListPage.jsx');
    expect(page).not.toMatch(/<input(?![^>]*type="search")|<textarea|grade/);
    expect(sliceBetween(page, 'const markO = ', ';\n')).toContain('knownSet.has(entry.key) ? unmark(entry.key) : exclude(entry)');
    const markX = sliceBetween(page, 'const markX = ', '\n  };');
    expect(markX).toContain('return save(entry);');
    expect(markX).toContain('pendingStudy.current = entry;');
    expect(page).toContain("import { hunRubyCells } from '@/lib/viewerHunRuby';");
    expect(page).toContain("import HunCell from '@/components/viewer/HunCell';");
    expect(page).toContain("import { glyphRows } from '@/lib/glyphColumn';");
    expect(page).not.toMatch(/hanjaReadingsOf|zhengForm/); // 새 조회 경로 금지 — 뷰어 함수만
  });
});

describe('⑸ 저장 · 제외 · 링크 배선', () => {
  const page = read('src/views/LevelListPage.jsx');

  it('저장은 FSRS 직접 추가(action:\'save\')만 — user_vocabulary 직접 쓰기 없음, 예문 안 붙임', () => {
    expect(page).toContain("client.save({ action: 'save', accountId: userId, operationId: newId(), cardId: newId(), vocabulary })");
    expect(page).not.toMatch(/\.(upsert|insert|update)\(/);
    expect(page).not.toMatch(/from\(['"]user_vocabulary/);
    const vocab = sliceBetween(page, 'const vocabulary = {', '};');
    expect([...vocab.matchAll(/(\w+):/g)].map((m) => m[1])).toEqual(['language', 'word_text', 'base_form', 'meaning', 'furigana', 'pos']);
  });

  it('제외 = 아는 단어 표시(useKnownWords), 되돌리기 = 해제 — 로그인 전에는 둘 다 안내만', () => {
    expect(page).toContain('known.mutation.mutate({ lang: conf.langCode, wordText: entry.key, known: true });');
    expect(page).toContain('known: false');
    expect(page).toMatch(/if \(!userId\) return loginToast\('로그인하면 단어를 저장할 수 있어요'\);/);
    expect(page).toMatch(/if \(!userId\) return loginToast\('로그인하면 아는 단어로 옮길 수 있어요'\);/);
  });

  it('서버 조립 모듈은 클라이언트에 들어가지 않는다', () => {
    for (const f of ['src/views/LevelListPage.jsx', 'src/components/levels/LevelTiles.jsx', 'src/components/books/Bookshelf.jsx']) {
      expect(read(f), f).not.toContain('levelListData');
    }
  });

  it('화면 어디에도 문법 챕터 · 보관함 링크가 없고, 열린 주소는 학습자 링크로 통과한다', () => {
    for (const f of ['src/views/LevelListPage.jsx', 'src/components/levels/LevelTiles.jsx']) {
      expect(read(f), f).not.toMatch(/grammar|legacy-textbooks|ArchiveLink/);
    }
    for (const lang of ['japanese', 'chinese']) for (const kind of ['vocab', 'bunkei']) for (const key of LEVEL_LIST_LANGS[lang].levels) {
      const href = levelListHref(lang, kind, key);
      expect(legacyTextbookTarget(href), href).toBeNull();
      expect(learnerHref(href)).toBe(href);
    }
  });
});

describe('⑹ 진도 · 이어 하기 · 성조 색(LEVEL-FLOW-001 — 디자인 검토 2026-10-16 KST, 오너 「숫자가 대거 적히면 시선이 분산」)', () => {
  const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

  it('진도: 아는 쪽이 먼저 — 저장돼 있어도 아는 단어면 아는 쪽으로만 센다', () => {
    const entries = ['a', 'b', 'c', 'd'].map((key) => ({ key }));
    expect(levelProgress(entries, new Set(['a', 'b']), new Set(['b', 'c']))).toEqual({ total: 4, known: 2, studying: 1, left: 1 });
    expect(levelProgress([], null, null)).toEqual({ total: 0, known: 0, studying: 0, left: 0 });
  });

  it('병음 음절: 글자 수와 맞을 때만 가른다 — n · ng 뒤 모음은 「\'」 없으면 앞 자음을 성모로', () => {
    expect(pinyinSyllables('xuéxí', 2)).toEqual(['xué', 'xí']);
    expect(pinyinSyllables('píngguǒ', 2)).toEqual(['píng', 'guǒ']);
    expect(pinyinSyllables('dàngāo', 2)).toEqual(['dàn', 'gāo']); // 蛋糕 — 「dàng|āo」가 아니다
    expect(pinyinSyllables('Xī\'ān', 2)).toEqual(['Xī', 'ān']);
    expect(pinyinSyllables('tiān ānmén', 3)).toEqual(['tiān', 'ān', 'mén']);
    expect(pinyinSyllables('xuéxí', 3)).toBeNull(); // 儿화 · 다음자 등 수가 안 맞으면 색 없이
    expect(pinyinSyllables('', 1)).toBeNull();
  });

  it('성조 색은 기본 끔(옵트인 — 오너 확정 2026-08-19)', () => {
    expect(normalizeLevelPrefs({}).tone).toBe(false);
    expect(normalizeLevelPrefs({ tone: true }).tone).toBe(true);
  });

  it('이어 하기 사본: 레벨마다 쌓고 마지막 레벨 · 보기를 남긴다 — 깨진 값은 버린다', () => {
    const st = memory();
    writeLevelSnapshot(st, 'chinese', 'h1', { known: 182, studying: 47, total: 832, left: 603, view: 'meaning', at: 1 });
    writeLevelSnapshot(st, 'chinese', 'h2', { known: 3, studying: 0, total: 900, left: 897, view: 'all', at: 2 });
    const snap = readLevelSnapshot(st, 'chinese');
    expect(snap.last).toEqual({ level: 'H2', view: 'all' });
    expect(snap.levels.H1).toMatchObject({ known: 182, studying: 47, total: 832 });
    expect(readLevelSnapshot(st, 'japanese')).toBeNull();
    st.setItem(LEVEL_SNAPSHOT_KEY, JSON.stringify({ chinese: { last: { level: '<x>' }, levels: {} } }));
    expect(readLevelSnapshot(st, 'chinese')).toBeNull();
    st.setItem(LEVEL_SNAPSHOT_KEY, '{');
    expect(readLevelSnapshot(st, 'chinese')).toBeNull();
  });

  it('배움 입구 카드: 마지막 레벨로 · 자세한 개수는 여기에만 · 기록 없으면 1급부터 그대로', () => {
    const st = memory();
    writeLevelSnapshot(st, 'chinese', 'h1', { known: 1182, studying: 47, total: 1832, view: 'all', at: 1 });
    expect(levelResumeCard(readLevelSnapshot(st, 'chinese'))).toEqual({ href: '/chinese/vocab/h1', title: 'HSK 1 단어',
      chips: ['알아요 1,182 / 1,832', '공부 중 47'], meta: '이어 하기 ↗' });
    writeLevelSnapshot(st, 'chinese', 'h3', { known: 0, studying: 0, total: 900, view: 'all', at: 2 });
    expect(levelResumeCard(readLevelSnapshot(st, 'chinese')).chips).toEqual(['알아요 0 / 900']);
    expect(levelResumeCard(null)).toBeNull();
  });
});
