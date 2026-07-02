/**
 * 공부 모드 재료 조립 (서버 전용).
 * study/page.jsx의 서버 재료 조립을 그대로 옮겨 재사용한다 —
 * 세션 진입(page)과 내일 문단 프리페치(api/study-paragraph)가 같은 로직을 공유한다.
 * 콘텐츠 레지스트리(refLangs)를 import하므로 서버(라우트·서버 컴포넌트)에서만 쓴다.
 */

import { getRefLang } from '@/content/refLangs';
import { refMain, refPron } from '@/views/refShared';
import { buildChapterQuiz } from '@/lib/refQuiz';
import { composeSession, buildWarmupItems } from '@/lib/studySession';
import { computeRung, computeEwma, dialFromEwma } from '@/lib/skillRung';
import { levelBand } from '@/lib/writingPrompts';
import { THEMES } from '@/lib/studyParagraph';

/** 배열에서 대략 고르게 n개 샘플 (요청마다 달라지도록 랜덤 시작점) */
function sample(arr, n) {
  if (!arr?.length) return [];
  const out = [];
  const start = Math.floor(Math.random() * arr.length);
  for (let i = 0; i < arr.length && out.length < n; i++) {
    out.push(arr[(start + i * 7) % arr.length]);
  }
  return [...new Set(out)].slice(0, n);
}

/**
 * due 어휘·문법·새 챕터·독해·rung·dial·오늘의 문단 재료를 한 번에 조립.
 * @param {object} supabase - RLS가 걸린 사용자 토큰 클라이언트
 * @param {string} userId
 * @param {string} lang - REF_LANGS 키 (호출 측에서 검증)
 * @param {{horizonHours?: number}} opts - 프리페치는 36(미리 due될 것까지 당겨봄)
 * @returns {Promise<{session, paragraphMaterials, level, band, canGenerate}>}
 */
export async function assembleStudyMaterials(supabase, userId, lang, { horizonHours = 0 } = {}) {
  const ref = getRefLang(lang);
  // due 기준 시각 — 프리페치는 now + horizonHours 로 미리 당겨 조회.
  const dueIso = new Date(Date.now() + horizonHours * 3600 * 1000).toISOString();

  // ── 재료 조회 (병렬) ──
  const [{ data: dueVocabRows }, { data: vocabPoolRows }, { data: dueGrammarRows }, { data: progressRows }, { data: reviewEventRows }] = await Promise.all([
    supabase.from('user_vocabulary')
      .select('id, word_text, meaning, furigana, language, interval, ease_factor, repetitions, next_review_at')
      .eq('user_id', userId).eq('language', lang)
      .lte('next_review_at', dueIso)
      .order('next_review_at', { ascending: true }).limit(3),
    supabase.from('user_vocabulary')
      .select('meaning')
      .eq('user_id', userId).eq('language', lang).limit(60),
    supabase.from('grammar_review')
      .select('*')
      .eq('user_id', userId).eq('lang', lang)
      .lte('next_review_at', dueIso)
      .order('next_review_at', { ascending: true }).limit(2),
    supabase.from('user_ref_progress')
      .select('slug, passed')
      .eq('user_id', userId).eq('lang', lang),
    supabase.from('review_events')
      .select('source, item_key, correct, detail, created_at')
      .eq('user_id', userId).eq('lang', lang)
      .order('created_at', { ascending: false }).limit(400),
  ]);

  const passed = new Set((progressRows || []).filter(r => r.passed).map(r => r.slug));

  // ── 숙련 rung · 난이도 다이얼 유도 (review_events 순수 함수) ──
  const eventsAsc = (reviewEventRows || []).slice().reverse();
  const vocabRungs = {};
  for (const w of dueVocabRows || []) {
    const evs = eventsAsc
      .filter(e => e.item_key === w.word_text)
      .map(e => ({ qtype: e.detail?.qtype, correct: !!e.correct }));
    vocabRungs[w.word_text] = computeRung(evs);
  }
  const gradedEvents = eventsAsc.map(e => ({ correct: !!e.correct }));
  const ewma = computeEwma(gradedEvents);
  const dial = dialFromEwma(ewma, 20, gradedEvents.length);

  // ── 문법 due → 미니 퀴즈 ──
  const grammarDue = (dueGrammarRows || []).map(row => {
    const found = ref.getChapter(row.slug);
    if (!found) return null;
    const q = buildChapterQuiz(found.chapter, ref, { maxMeaning: 1, maxApply: 1, maxProduce: 0 });
    const items = [...q.meaning, ...q.apply];
    if (!items.length) return null;
    return {
      srs: { lang: row.lang, slug: row.slug, interval: row.interval, ease_factor: row.ease_factor, repetitions: row.repetitions, next_review_at: row.next_review_at },
      meta: { slug: row.slug, title: found.chapter.title, level: found.chapter.level, order: found.chapter.order, href: `${ref.base}/grammar/${row.slug}` },
      items,
    };
  }).filter(Boolean);

  // ── 다음 새 챕터 — 커리큘럼 순서에서 첫 미통과·퀴즈 가능 챕터 ──
  let newChapter = null;
  for (const ch of ref.ALL_CHAPTERS) {
    if (passed.has(ch.slug)) continue;
    const q = buildChapterQuiz(ch, ref, { maxMeaning: 2, maxApply: 1, maxProduce: 0 });
    const items = [...q.meaning, ...q.apply];
    if (items.length < 2) continue;                    // 퀴즈 못 만드는 챕터(카나 등)는 건너뜀
    const patternSec = ch.sections.find(s => s.pattern);
    newChapter = {
      meta: { lang, slug: ch.slug, title: ch.title, level: ch.level, order: ch.order, href: `${ref.base}/grammar/${ch.slug}` },
      teach: patternSec ? {
        pattern: patternSec.pattern,
        patternKo: patternSec.patternKo || '',
        examples: (patternSec.examples || []).slice(0, 2).map(ex => ({ main: refMain(ex), pron: refPron(ex), ko: ex.ko })),
      } : null,
      items: items.slice(0, 3),
    };
    break;
  }

  // ── 독해 소재 — 현재 레벨 문형 예문 ──
  const level = newChapter?.meta.level || grammarDue[0]?.meta.level || ref.LEVEL_META[0]?.key;
  const band = levelBand(lang, level);
  const bunkei = ref.getBunkei?.(level);
  const exPool = (bunkei?.themes || [])
    .flatMap(t => t.items || [])
    .flatMap(i => [i.ex, i.ex2])
    .filter(ex => ex && ex.ko && refMain(ex))
    .map(ex => ({ main: refMain(ex), pron: refPron(ex), ko: ex.ko }));
  const reading = sample(exPool, 4);
  const koPool = sample(exPool, 24).map(e => e.ko);

  // ── 어휘 보기 풀 — 내 단어장 뜻 + 부족하면 레벨 어휘 사전 뜻 ──
  const meaningPool = [...new Set((vocabPoolRows || []).map(r => r.meaning).filter(Boolean))];
  const levelVocabWords = (ref.getVocab(level)?.themes || []).flatMap(t => t.words || []);
  if (meaningPool.length < 8) {
    levelVocabWords.slice(0, 40).forEach(w => {
      if (w?.ko) meaningPool.push(w.ko);
    });
  }

  // ── 워밍업 재료 — 최근(24~72h) 정답 어휘로 즉시 시작할 인지형 2문항 ──
  // 문단 AI 생성 레이턴시를 가리기 위한 것. due 어휘와 겹치면 제외한다.
  const dueWordSet = new Set((dueVocabRows || []).map(r => r.word_text).filter(Boolean));
  const nowMs = Date.now();
  const warmLo = nowMs - 72 * 3600 * 1000;
  const warmHi = nowMs - 24 * 3600 * 1000;
  const warmupCandidates = [];
  const warmSeen = new Set();
  for (const e of reviewEventRows || []) {          // 최신순(desc)
    if (warmupCandidates.length >= 2) break;
    if (e.source !== 'vocab' || !e.correct || !e.item_key) continue;
    const t = new Date(e.created_at).getTime();
    if (!(t >= warmLo && t <= warmHi)) continue;
    if (warmSeen.has(e.item_key) || dueWordSet.has(e.item_key)) continue;
    warmSeen.add(e.item_key);
    warmupCandidates.push(e.item_key);
  }
  // 후보 단어의 뜻·후리가나 조회 (추가 1쿼리 — user+lang 필터, 방어적)
  let warmupVocabRows = [];
  if (warmupCandidates.length) {
    await supabase.from('user_vocabulary')
      .select('word_text, meaning, furigana')
      .eq('user_id', userId).eq('language', lang)
      .in('word_text', warmupCandidates)
      .then(({ data }) => { warmupVocabRows = data || []; }, () => {});
  }
  // 콜드스타트 폴백 — 이력이 없으면 레벨 사전 단어로 (SRS 미반영)
  const warmupFallback = sample(levelVocabWords, 12)
    .map(w => ({ word_text: refMain(w), meaning: w.ko || '', furigana: refPron(w) || null }))
    .filter(w => w.word_text && w.meaning && !dueWordSet.has(w.word_text))
    .slice(0, 4);
  const warmup = buildWarmupItems(reviewEventRows || [], warmupVocabRows, meaningPool, dueWordSet, warmupFallback);

  // 폴백 세션 — 문단 생성 실패 시 그대로 사용
  const session = composeSession({
    vocab: dueVocabRows || [],
    meaningPool,
    grammarDue,
    newChapter,
    reading,
    koPool,
    vocabRungs,
    dial,
  });

  // ── 오늘의 문단 재료 — 새 문법·새 어휘·복습 문법·복습 어휘를 한 문단으로 ──
  const { data: myWordRows } = await supabase
    .from('user_vocabulary')
    .select('word_text')
    .eq('user_id', userId).eq('language', lang).limit(800);
  const myWordList = (myWordRows || []).map(r => r.word_text).filter(Boolean);
  const myWords = new Set(myWordList);
  const newWords = sample(levelVocabWords, 30)
    .map(w => ({ word: refMain(w), meaning: w.ko || '', pron: refPron(w) || '' }))
    .filter(w => w.word && w.meaning && !myWords.has(w.word))
    .slice(0, 2);

  // 복습 문법의 대표 패턴 (챕터 첫 pattern 섹션)
  const duePatternsForPara = grammarDue.slice(0, 2).map(g => {
    const ch = ref.getChapter(g.srs.slug)?.chapter;
    const sec = ch?.sections?.find(s => s.pattern);
    return sec ? { pattern: sec.pattern, patternKo: sec.patternKo || '', srs: g.srs, meta: g.meta } : null;
  }).filter(Boolean);

  // ── 기지어 제약 재료 — 이미 아는 단어 30개(있으면) / 콜드스타트는 레벨 사전 40개 ──
  const knownWords = sample(myWordList, 30);
  const whitelistWords = sample(levelVocabWords, 40).map(w => refMain(w)).filter(Boolean);

  // ── 주제 로테이션 — 최근 study_paragraphs 3행 theme을 피해 하나 고름 (테이블 부재 시 빈 배열) ──
  let avoidThemes = [];
  await supabase.from('study_paragraphs')
    .select('theme')
    .eq('user_id', userId).eq('lang', lang)
    .order('created_at', { ascending: false }).limit(3)
    .then(({ data }) => {
      avoidThemes = (data || []).map(r => r.theme).filter(Boolean);
    }, () => {});
  const themePool = THEMES.filter(t => !avoidThemes.includes(t));
  const pool = themePool.length ? themePool : THEMES;
  const theme = pool[Math.floor(Math.random() * pool.length)];

  const paragraphMaterials = {
    language: lang,
    level,
    newPattern: newChapter?.teach ? { pattern: newChapter.teach.pattern, patternKo: newChapter.teach.patternKo } : null,
    newChapter: newChapter?.meta || null,
    duePatterns: duePatternsForPara,
    dueWords: (dueVocabRows || []).slice(0, 3).map(r => ({ word: r.word_text, meaning: r.meaning, row: r })),
    newWords,
    knownWords,
    whitelistWords,
    theme,
    avoidThemes,
  };
  // 재료가 문법도 단어도 없으면 문단 생성 스킵 (폴백 세션만)
  const canGenerate = !!(paragraphMaterials.newPattern || paragraphMaterials.duePatterns.length || paragraphMaterials.dueWords.length);

  return { session, paragraphMaterials, warmup, level, band, dial, canGenerate };
}
