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
import { computeEwma, dialFromEwma, computeWeakness, deriveVocabRungs } from '@/lib/skillRung';
// deriveVocabRungs는 콘텐츠 무의존 순수 함수라 skillRung으로 이전됐다.
// 기존 import 경로(테스트·과거 소비처) 호환 위해 re-export — studyMaterials 공개 API 불변.
export { deriveVocabRungs };
import { levelBand } from '@/lib/writingPrompts';
import { THEMES } from '@/lib/studyParagraph';

/**
 * dial==='easy'면 문단 재료의 신규 학습(newPattern·newWords)을 비운다 — 과부하 방어 밸브.
 * 복습 재료(duePatterns/dueWords)는 손대지 않는다.
 * @param {'easy'|'normal'|'hard'} dial
 * @param {{pattern: string, patternKo: string}|null} newPattern
 * @param {Array} newWords
 * @returns {{newPattern: object|null, newWords: Array}}
 */
export function gateNewMaterialsByDial(dial, newPattern, newWords) {
  return dial === 'easy' ? { newPattern: null, newWords: [] } : { newPattern, newWords };
}

/**
 * 관심사 그룹 → THEMES 매핑 (온보딩 4택). 그룹키는 쿠키 study_interest 값이며
 * StudyOnboarding.jsx의 카드 key와 일치해야 한다. 10개 THEMES를 3/2/3/2로 나눈다.
 */
export const INTEREST_GROUPS = {
  daily:  { label: '일상·관계', themes: ['일상', '가족과 친구', '감정'] },
  travel: { label: '여행·모험', themes: ['여행', '날씨와 계절'] },
  food:   { label: '음식·취미', themes: ['음식', '쇼핑', '취미'] },
  work:   { label: '일·학교', themes: ['학교', '계획'] },
};

/**
 * 오늘의 주제 선택 — 최근 주제(recent)를 피하고, 관심사 그룹이 있으면 그 그룹 테마를 70% 가중.
 * 랜덤은 주입 가능(rnd)해 결정적 테스트가 된다. 그룹이 없거나 미매핑이면 기존 로테이션과 동일.
 * @param {string[]} themes - 전체 THEMES
 * @param {string[]} recent - 회피할 최근 테마(avoidThemes)
 * @param {string|null} interestGroup - INTEREST_GROUPS 키
 * @param {() => number} rnd - [0,1) 난수원 (기본 Math.random)
 * @returns {string|null}
 */
export function pickTheme(themes, recent = [], interestGroup = null, rnd = Math.random) {
  const all = Array.isArray(themes) ? themes.filter(Boolean) : [];
  if (!all.length) return null;
  const avoid = new Set((recent || []).filter(Boolean));
  const base = all.filter(t => !avoid.has(t));
  const pool = base.length ? base : all;                 // 전부 회피되면 전체에서

  const group = interestGroup ? INTEREST_GROUPS[interestGroup] : null;
  if (group) {
    const groupThemes = group.themes.filter(t => all.includes(t));
    const groupAvoided = groupThemes.filter(t => !avoid.has(t));
    const gp = groupAvoided.length ? groupAvoided : groupThemes;
    // 70% 가중 — 그룹 안에서 우선 고르고, 나머지 30%는 전체 로테이션.
    if (gp.length && rnd() < 0.7) return gp[Math.floor(rnd() * gp.length)];
  }
  return pool[Math.floor(rnd() * pool.length)];
}

/**
 * 콜드스타트 판정 — 이 언어 학습 이력이 사실상 0인지(추가 쿼리 없이 이미 조회된 행에서 유도).
 * ① 이 언어 레지스트리 챕터 slug에 해당하는 진행 행 0개
 * ② 이 언어 어휘 0개
 * ③ 리뷰 이벤트 3개 미만
 * @param {Array} progressRows - user_ref_progress (이 lang)
 * @param {Array} vocabRows - user_vocabulary (이 lang) 표본
 * @param {Array} reviewEventRows - review_events (이 lang) 표본
 * @param {Set<string>|string[]} chapterSlugs - ref.ALL_CHAPTERS의 slug 집합
 * @returns {boolean}
 */
export function deriveColdStart(progressRows, vocabRows, reviewEventRows, chapterSlugs) {
  const slugSet = chapterSlugs instanceof Set ? chapterSlugs : new Set(chapterSlugs || []);
  const progressCount = (progressRows || []).filter(r => slugSet.has(r.slug)).length;
  return progressCount === 0
    && (vocabRows || []).length === 0
    && (reviewEventRows || []).length < 3;
}

/**
 * 연재 아크 유도 — 가장 최근 used 문단 1행에서 다음 화를 이어갈지 판정(순수 함수).
 * 계속 조건: arcSummary 존재 && used_at(없으면 created_at) 7일 이내 && episode < 10 && 약점 모드 아님.
 * 첫 화는 materials.episode가 없어 1로 간주 → 다음은 2화. 10화까지 이어지고 그 뒤엔 새 이야기.
 * 불충족(첫 화·오래됨·10화 완결·arcSummary 부재·weekly) 시 null → 독립 문단.
 * @param {{paragraph?: object, materials?: object, used_at?: string, created_at?: string}|null} latestUsedRow
 * @param {{now?: number, weekly?: boolean}} opts
 * @returns {{prevArc: string, episode: number}|null}
 */
export function deriveArc(latestUsedRow, { now = Date.now(), weekly = false } = {}) {
  if (weekly || !latestUsedRow) return null;
  const arcSummary = latestUsedRow.paragraph?.arcSummary;
  if (typeof arcSummary !== 'string' || !arcSummary.trim()) return null;
  const prevEpisode = Number(latestUsedRow.materials?.episode) || 1; // episode 부재 → 1화로 간주
  if (prevEpisode >= 10) return null;                                 // 10화 완결 → 새 이야기
  const tsRaw = latestUsedRow.used_at || latestUsedRow.created_at;
  const ts = tsRaw ? new Date(tsRaw).getTime() : NaN;
  if (!Number.isFinite(ts) || now - ts > 7 * 86400000) return null;   // 7일 경과 → 새 이야기
  const out = { prevArc: arcSummary.trim(), episode: prevEpisode + 1 };
  // 공동 작가 — 직전 행에 사용자가 정한 다음 전개(루브릭 ≥2점)가 있으면 소재로 실어 보낸다.
  // ≥2점만·소재 한정은 저장 시점(StudySessionPage)과 주입 시점(buildParagraphPrompt) 양쪽에서 지킨다.
  const un = latestUsedRow.paragraph?.userNext;
  if (un && typeof un.text === 'string' && un.text.trim() && Number(un.score) >= 2) {
    out.userNext = un.text.trim();
  }
  return out;
}

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

/** KST 기준 이번 주 월요일 0시의 UTC 밀리초 */
function kstWeekStartMs(nowMs = Date.now()) {
  const kst = new Date(nowMs + 9 * 3600 * 1000);
  const dow = kst.getUTCDay();                        // 0=일 … 6=토
  const daysSinceMon = (dow + 6) % 7;
  // Date.UTC(...)는 'KST 자정을 UTC인 척'한 값 → 9h를 빼 실제 UTC 순간으로 되돌린다.
  return Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate())
    - daysSinceMon * 86400000 - 9 * 3600 * 1000;
}

/** KST 기준 일요일인가 */
function isKstSunday(nowMs = Date.now()) {
  return new Date(nowMs + 9 * 3600 * 1000).getUTCDay() === 0;
}

/**
 * 주간 약점 세션 재료 — KST 일요일이고 이번 주 '약점 복습' 세션이 아직 없을 때만.
 * 최근 14일 review_events(호출자가 조회한 400건 재사용)에서 오답률 가중 약점 상위를
 * vocab≤3·grammar≤2로 재료화한다. 약점 항목 2개 미만이거나 조회 실패면 null(일반 세션).
 * @returns {Promise<{duePatterns: Array, dueWords: Array}|null>}
 */
async function buildWeaknessMaterials(supabase, userId, lang, ref, reviewEventRows) {
  const nowMs = Date.now();
  if (!isKstSunday(nowMs)) return null;
  const weekStartIso = new Date(kstWeekStartMs(nowMs)).toISOString();

  // 이번 주에 이미 약점 세션이 있었는지 — 조회 실패(null)면 약점 모드 포기.
  let already = null;                                 // null=조회실패, true=있음, false=없음
  await supabase.from('study_paragraphs')
    .select('id')
    .eq('user_id', userId).eq('lang', lang).eq('theme', '약점 복습')
    .gte('created_at', weekStartIso).limit(1)
    .then(({ data, error }) => { already = error ? null : (data || []).length > 0; }, () => { already = null; });
  if (already !== false) return null;                 // 실패거나 이미 있음 → 일반 세션

  // 최근 14일 약점 집계 (오답이 있는 것만)
  const sinceMs = nowMs - 14 * 86400000;
  const weak = computeWeakness(reviewEventRows, { sinceMs, cap: 20 }).filter(w => w.wrong > 0);
  const weakVocab = weak.filter(w => w.source === 'vocab').slice(0, 3);
  // grammar 약점 후보에서 인트로 레벨(OT/A0) 챕터 제외 — 복습 대상이 아니다
  const weakGrammar = weak
    .filter(w => w.source === 'grammar')
    .filter(w => {
      const ch = ref.getChapter(w.item_key)?.chapter;
      return ch && !ref.isIntroLevel(ch.level);
    })
    .slice(0, 2);
  if (weakVocab.length + weakGrammar.length < 2) return null;

  // vocab 약점 → user_vocabulary 행 (dueWords 형태)
  let dueWords = [];
  if (weakVocab.length) {
    const words = weakVocab.map(w => w.item_key);
    await supabase.from('user_vocabulary')
      .select('id, word_text, meaning, furigana, interval, ease_factor, repetitions, next_review_at')
      .eq('user_id', userId).eq('language', lang)
      .in('word_text', words)
      .then(({ data }) => {
        const byWord = new Map((data || []).map(r => [r.word_text, r]));
        dueWords = weakVocab
          .map(w => byWord.get(w.item_key))
          .filter(r => r && r.meaning)
          .map(r => ({ word: r.word_text, meaning: r.meaning, row: r }));
      }, () => {});
  }

  // grammar 약점 → 챕터 첫 pattern 섹션 (duePatterns 형태). grammar_review 있으면 그 srs.
  let duePatterns = [];
  if (weakGrammar.length) {
    const slugs = weakGrammar.map(w => w.item_key);
    let srsBySlug = new Map();
    await supabase.from('grammar_review')
      .select('*')
      .eq('user_id', userId).eq('lang', lang)
      .in('slug', slugs)
      .then(({ data }) => {
        srsBySlug = new Map((data || []).map(row => [row.slug, row]));
      }, () => {});
    duePatterns = weakGrammar.map(w => {
      const slug = w.item_key;
      const ch = ref.getChapter(slug)?.chapter;
      const sec = ch?.sections?.find(s => s.pattern);
      if (!sec) return null;
      const row = srsBySlug.get(slug);
      const srs = row
        ? { lang: row.lang, slug: row.slug, interval: row.interval, ease_factor: row.ease_factor, repetitions: row.repetitions, next_review_at: row.next_review_at }
        : { lang, slug };
      return {
        pattern: sec.pattern,
        patternKo: sec.patternKo || '',
        srs,
        meta: { slug, title: ch.title, level: ch.level, order: ch.order, href: `${ref.base}/grammar/${slug}` },
      };
    }).filter(Boolean);
  }

  if (dueWords.length + duePatterns.length < 2) return null;
  return { duePatterns, dueWords };
}

/**
 * due 어휘·문법·새 챕터·독해·rung·dial·오늘의 문단 재료를 한 번에 조립.
 * @param {object} supabase - RLS가 걸린 사용자 토큰 클라이언트
 * @param {string} userId
 * @param {string} lang - REF_LANGS 키 (호출 측에서 검증)
 * @param {{horizonHours?: number}} opts - 프리페치는 36(미리 due될 것까지 당겨봄)
 * @returns {Promise<{session, paragraphMaterials, level, band, canGenerate}>}
 */
export async function assembleStudyMaterials(supabase, userId, lang, { horizonHours = 0, interestGroup = null } = {}) {
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

  // ── 콜드스타트 — 추가 쿼리 없이 이미 조회한 행에서만 유도(온보딩 표시 근거) ──
  const chapterSlugs = new Set(ref.ALL_CHAPTERS.map(c => c.slug));
  const coldStart = deriveColdStart(progressRows, vocabPoolRows, reviewEventRows, chapterSlugs);

  // ── 숙련 rung · 난이도 다이얼 유도 (review_events 순수 함수) ──
  const eventsAsc = (reviewEventRows || []).slice().reverse();
  const vocabRungs = deriveVocabRungs(eventsAsc, dueVocabRows);
  // 다이얼은 채점 문항만 본다 — ui(행동 계측)·dict(자가 채점)는 정답률 신호가 아니다 (§4.9 무간섭 보장).
  const gradedEvents = eventsAsc.filter(e => e.source !== 'ui' && e.source !== 'dict').map(e => ({ correct: !!e.correct }));
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
    if (ref.isIntroLevel(ch.level)) continue;          // 인트로 레벨(OT/A0)은 공부 모드 커리큘럼 대상 아님
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
  // 폴백 레벨 — 인트로(LEVEL_META[0])가 아닌 첫 정규 레벨로(독해·어휘 사전 소재가 인트로가 되지 않게)
  const level = newChapter?.meta.level || grammarDue[0]?.meta.level || ref.LEVEL_META[1]?.key || ref.LEVEL_META[0]?.key;
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
  // 오답 우선 워밍업(buildWarmupItems)에 맞춰 오답·정답을 가리지 않고 후보를 모은다(행 조회용).
  const warmupCandidates = [];
  const warmSeen = new Set();
  for (const e of reviewEventRows || []) {          // 최신순(desc)
    if (warmupCandidates.length >= 10) break;
    if (e.source !== 'vocab' || !e.item_key) continue;
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

  // ── 연재 — 가장 최근 used 문단 1행에서 다음 화를 이어갈지 판정 (테이블 부재 시 null → 새 이야기) ──
  let latestUsedRow = null;
  await supabase.from('study_paragraphs')
    .select('paragraph, materials, used_at, created_at')
    .eq('user_id', userId).eq('lang', lang).eq('status', 'used')
    .order('used_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false }).limit(1)
    .then(({ data }) => { latestUsedRow = (data && data[0]) || null; }, () => {});
  // 관심사 그룹(쿠키)이 있으면 그 그룹 테마를 70% 가중, 없으면 기존 로테이션 그대로.
  const theme = pickTheme(THEMES, avoidThemes, interestGroup);

  // ── 주간 약점 세션 — KST 일요일·이번 주 미실시면 신규 0·약점 재료로 대체 ──
  const weakness = await buildWeaknessMaterials(supabase, userId, lang, ref, reviewEventRows || []);

  // 약점 세션이 아니면 직전 화를 이어 연재. 충족 시 prevArc·episode(prev+1)를 재료에 실어 보낸다.
  const arc = deriveArc(latestUsedRow, { now: Date.now(), weekly: !!weakness });

  const paragraphMaterials = weakness ? {
    language: lang,
    level,
    newPattern: null,                                // 신규 0 — 헷갈린 것에 집중
    newChapter: null,
    duePatterns: weakness.duePatterns,
    dueWords: weakness.dueWords,
    newWords: [],
    knownWords,
    whitelistWords,
    theme: '약점 복습',
    avoidThemes,
    weekly: true,
  } : {
    language: lang,
    level,
    ...gateNewMaterialsByDial(
      dial,
      newChapter?.teach ? { pattern: newChapter.teach.pattern, patternKo: newChapter.teach.patternKo } : null,
      newWords
    ),
    newChapter: newChapter?.meta || null,
    duePatterns: duePatternsForPara,
    dueWords: (dueVocabRows || []).slice(0, 3).map(r => ({ word: r.word_text, meaning: r.meaning, row: r })),
    knownWords,
    whitelistWords,
    theme,
    avoidThemes,
    ...(arc ? { prevArc: arc.prevArc, episode: arc.episode } : {}),
    ...(arc?.userNext ? { userNext: arc.userNext } : {}),
  };
  // 재료가 문법도 단어도 없으면 문단 생성 스킵 (폴백 세션만)
  const canGenerate = !!(paragraphMaterials.newPattern || paragraphMaterials.duePatterns.length || paragraphMaterials.dueWords.length);

  return { session, paragraphMaterials, warmup, level, band, dial, canGenerate, coldStart };
}
