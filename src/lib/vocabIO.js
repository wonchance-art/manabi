// 단어장 데이터 입출력 — Supabase fetch · CSV/Anki 가져오기·내보내기
import { supabase } from './supabase';
import { detectLangConfident, hasCjkText } from './constants';
import { cacheVocabSnapshot, getCachedVocabSnapshot } from './offlineCache';
import { calculateFSRS } from './fsrs';

/**
 * 저장용 word_text 정규화 — item_key(=user_vocabulary.word_text) 통일 규약.
 *
 * 정책(plan-v3 §3-B, P1 어휘 저장 규약 통일):
 *  - 분석기가 기본형을 제공하면 **기본형(base)** 을, 아니면 **surface(활용형)** 을 저장한다.
 *  - 같은 단어의 활용형들(食べた·食べます…)이 서로 다른 word_text로 흩어지지 않게 하여
 *    rung/워밍업/예보가 한 단어를 하나의 기억으로 보게 한다.
 *  - 언어별 base 가용성: JA=kuromoji basic_form, EN=wink-lemmatizer lemma,
 *    FR/ZH=분석기가 base를 주면 그것, 없으면 surface 폴백.
 *  - ListenLabPage.saveUnit의 현행 `base || surface` 방식과 동일 의미(동작 불변).
 *
 * @param {{ surface?: string, base?: string }} [param]
 * @returns {string} 저장할 word_text
 */
export function normalizeWordText({ surface, base } = {}) {
  return base || surface || '';
}

/** 출처 문장 저장 상한 — 세 곳이 각자 `slice(0, 200)`을 적고 있었다. */
export const SOURCE_SENTENCE_MAX = 200;

/**
 * 저장 옵션 정본.
 *
 * `ignoreDuplicates: true`가 정본인 이유: 같은 단어를 다시 담는 건 **이미 있는 기억을
 * 덮어쓰라는 뜻이 아니다**. 빼면 나중에 담은 얄팍한 페이로드(예: /quick의 뜻 한 줄)가
 * 먼저 담긴 풍부한 것(참조 덱의 어원·한자)을 밀어낼 수 있고, 결과가 **담은 순서에**
 * 좌우된다. 실측: 8개 저장 경로 중 5곳은 이미 이 옵션을 쓰고 3곳이 빠져 있었다.
 */
export const VOCAB_UPSERT = Object.freeze({ onConflict: 'user_id,word_text', ignoreDuplicates: true });

/**
 * 분석된 토큰 → `user_vocabulary` 행. **저장 경로가 하나의 모양을 갖게 하는 정본**이다.
 *
 * ── 왜 필요했나 (실측)
 *
 * `user_vocabulary` 쓰기 경로가 **11개**였고 페이로드가 갈려 있었다. 그중 진짜 버그는
 * 하나였다 — `PdfViewerPage`·`QuickPage`가 `word_text`에 **surface(활용형)** 를 넣는데
 * `ViewerPage`는 **base(기본형)** 를 넣는다. `onConflict: 'user_id,word_text'`는 키가
 * 다르면 못 막으므로, 같은 단어를 두 문으로 담으면 **행이 둘로 갈리고 복습이 두 번 온다**
 * (뷰어의 `isTokenSaved`가 surface·base 양쪽을 봐서 화면상으로는 저장된 듯 보인다).
 *
 * `normalizeWordText`는 이미 있었는데 **7개 토큰 저장 경로 중 2곳만** 쓰고 있었다 —
 * 없던 건 규약이 아니라 그걸 강제하는 조립 지점이다.
 *
 * @param {{userId, surface, base, meaning, pos, reading, language,
 *          sourceSentence?, sourceMaterialId?, sourceRef?, now?}} p
 */
/**
 * W R1 저장 등급(오너 확정 2026-09-02, #1077 5504298889) — 라벨·순서·CSS 접미사는 복습 화면
 * ScoreSection과 **동일**해야 한다(saveGrade 계약이 VocabReview 소스와 대조). 같은 이름이
 * 같은 값이면 충돌이 처리되는 게 아니라 존재하지 않는다. 부제는 ts-fsrs 기본 파라미터의
 * 첫 간격 실측(1일·1일·2일·8일)에 「다시」 특례(오늘)를 얹은 값.
 */
export const SAVE_GRADES = Object.freeze([
  Object.freeze({ grade: 1, key: '1', label: '다시', sub: '오늘 또', cls: 'again' }),
  Object.freeze({ grade: 2, key: '2', label: '어려움', sub: '내일', cls: 'hard' }),
  Object.freeze({ grade: 3, key: '3', label: '알맞음', sub: '2일 뒤', cls: 'good' }),
  Object.freeze({ grade: 4, key: '4', label: '쉬움', sub: '8일 뒤', cls: 'easy' }),
]);

/**
 * 등급 → 초기 SRS 상태. 변환은 calculateFSRS 재사용(손계산 금지) — 첫 등급이 D(난이도)를
 * 영구히 정한다(1 다시 6.41 · 4 쉬움 1.00, 2회차부터 20배 차이). 「다시」 특례: 최소 간격
 * 1일 반올림 때문에 1·2가 둘 다 「내일」이 되어 구분이 없으므로 S·D는 FSRS 값 그대로 두고
 * next_review_at만 오늘(now) — Anki 학습 단계(당일 재등장)의 대용이자 현행 저장 동작의 보존.
 * last_reviewed_at은 세우지 않는다: 저장은 첫 만남이지 회상이 아니고, 세우면 복습 카드가
 * 되어 한도 없는 큐로 직행한다(「쉬움」 500개면 8일 뒤 500개).
 */
export function gradeToInitialStats(grade, now = () => new Date().toISOString()) {
  const stats = calculateFSRS(grade, undefined);
  return grade === 1 ? { ...stats, next_review_at: now() } : stats;
}

export function buildVocabRow({
  userId, surface, base, meaning, pos, reading, language,
  sourceSentence, sourceMaterialId, sourceRef, grade, now = () => new Date().toISOString(),
}) {
  const text = normalizeWordText({ surface, base });
  return {
    user_id: userId,
    word_text: text,
    // base_form은 **항상 채운다** — 뷰어의 저장 판정이 surface·base 두 집합을 다 보므로,
    // 비면 그 단어가 다른 문에서 "안 담긴 것"으로 보인다.
    base_form: base || surface || '',
    meaning: meaning || '',
    pos: pos || '',
    furigana: reading || '',       // 영어는 IPA, 중국어는 병음 — 같은 컬럼(리더와 동일)
    language: language || 'Japanese',
    // 항상 싣는다. `ignoreDuplicates`라 갱신은 없고 **삽입 때만** 쓰이므로, 컬럼 기본값이
    // 무엇이든 결과가 같다(기본값을 확인할 수 없는 테이블이라 이 편이 안전하다).
    // 등급(W R1)이 오면 초기 SRS 상태까지; 없으면(인라인 목록 원탭 등 10경로) 현행 그대로.
    ...(grade ? gradeToInitialStats(grade, now) : { next_review_at: now() }),
    ...(sourceSentence ? { source_sentence: String(sourceSentence).slice(0, SOURCE_SENTENCE_MAX) } : {}),
    ...(sourceMaterialId ? { source_material_id: sourceMaterialId } : {}),
    ...(sourceRef ? { source_ref: sourceRef } : {}),
  };
}

/**
 * 단어장 조회 — 온라인이면 언제나 네트워크가 정본이고(계약 6), 성공분을 오프라인용
 * 스냅샷으로 남긴다(사용자 조작 0). 네트워크가 죽었을 때만 스냅샷으로 폴백한다.
 * 스냅샷 행은 next_review_at을 포함하므로 '오늘 due'가 여기서 파생된다(v2-N R1).
 * 반환 배열에는 열거 불가 __offline 표식을 달아 UI가 안내를 띄운다 — 배열 원소·순회
 * 결과는 온라인과 완전히 같아 소비처는 무개입이다.
 */
export async function fetchVocab(userId) {
  try {
    const rows = await fetchVocabFromNetwork(userId);
    // fire-and-forget이되 **완전히** 격리한다 — 동기 throw든 rejection이든 캐시 실패가
    // 아래 catch로 새면 네트워크 성공분이 폴백 경로로 빠진다(계약 4·6 동시 위반).
    Promise.resolve().then(() => cacheVocabSnapshot(userId, rows)).catch(() => {});
    return rows;
  } catch (err) {
    const cached = await getCachedVocabSnapshot(userId);
    if (!cached) throw err;             // 캐시가 없으면 기존 에러 경로 그대로(계약 5)
    return Object.defineProperty(cached, '__offline', { value: true, enumerable: false });
  }
}

async function fetchVocabFromNetwork(userId) {
  // 단어 본체는 무조건 fetch — JOIN 실패 시에도 단어장이 비어 보이지 않게
  const { data, error } = await supabase
    .from('user_vocabulary')
    .select('*')
    .eq('user_id', userId)
    .order('next_review_at', { ascending: true });
  if (error) throw error;

  // language가 비어 있는 옛 행 backfill.
  //
  // ⚠ 여기서 **추측을 DB에 박으면 안 된다.** 예전에는 이 자리에 `detectLang`의 복제
  // (`/[가나·한자]/ ? 'Japanese' : 'English'`)가 있었고, 그 답을 그대로 UPDATE했다 —
  // 옛 중국어 행이 단어장을 한 번 여는 것만으로 `Japanese`로 굳었고(프랑스어는
  // `English`), 원래 언어를 모르니 **되돌릴 수도 없었다.**
  //
  // 이제 확신할 때만 채운다(`detectLangConfident`: 가나·프랑스어 발음부호). 못 가르는
  // 행은 `language`를 **비운 채 둔다** — 화면은 `detectLang` 기본값으로 그리고(예전과
  // 같은 모양), DB에는 아무것도 쓰지 않는다. 다음에 사용자가 그 단어를 다시 담으면
  // 저장 경로가 진짜 언어를 싣는다.
  const needsUpdate = [];
  const result = (data || []).map(v => {
    if (v.language) return v;
    const lang = detectLangConfident(v.word_text);
    if (!lang) return v;                      // 애매하면 손대지 않는다(쓰기 0)
    needsUpdate.push({ id: v.id, language: lang });
    return { ...v, language: lang };
  });

  // DB에도 반영 (fire-and-forget) — 언어별 일괄 UPDATE(행당 개별 요청이던 N+1의 배치화)
  if (needsUpdate.length > 0) {
    const idsByLang = new Map();
    for (const u of needsUpdate) {
      if (!idsByLang.has(u.language)) idsByLang.set(u.language, []);
      idsByLang.get(u.language).push(u.id);
    }
    Promise.all([...idsByLang.entries()].map(([language, ids]) =>
      supabase.from('user_vocabulary').update({ language }).in('id', ids)
    )).catch(() => {});
  }

  // 시리즈 필터용 source material titles 별도 fetch (실패해도 vocab은 그대로)
  try {
    const sourceIds = [...new Set(result.map(v => v.source_material_id).filter(Boolean))];
    if (sourceIds.length > 0) {
      const titlesMap = new Map();
      const CHUNK = 30;
      // 청크 병렬 조회 — 순차 await는 출처가 많을수록 로드가 선형으로 늘었다(쿼리 다이어트)
      const chunks = [];
      for (let i = 0; i < sourceIds.length; i += CHUNK) chunks.push(sourceIds.slice(i, i + CHUNK));
      const chunkResults = await Promise.all(chunks.map((slice) =>
        supabase.from('reading_materials').select('id, title').in('id', slice)
      ));
      for (const { data: mats } of chunkResults) {
        for (const m of (mats || [])) titlesMap.set(m.id, m.title);
      }
      for (const v of result) {
        if (v.source_material_id && titlesMap.has(v.source_material_id)) {
          v.reading_materials = { title: titlesMap.get(v.source_material_id) };
        }
      }
    }
  } catch {}

  return result;
}

// 간단한 CSV 파서 (따옴표 이스케이프 처리)
function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (inQuote) {
      if (ch === '"' && next === '"') { cell += '"'; i++; }
      else if (ch === '"') inQuote = false;
      else cell += ch;
    } else {
      if (ch === '"') inQuote = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (ch === '\r') { /* skip */ }
      else cell += ch;
    }
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c && c.trim()));
}

/**
 * CSV 파일 → vocab 행 배열
 * 지원 포맷: 우리 exportCSV 형식 ["단어","후리가나","의미","품사","다음 복습","안정도","난이도"]
 *          또는 최소 2열 (단어, 의미)
 */
export function csvToVocabRows(text, userId) {
  const rows = parseCSV(text);
  if (rows.length === 0) return [];

  const header = rows[0].map(h => h.trim().toLowerCase());
  const hasHeader = header.some(h => /단어|word|meaning|의미/.test(h));
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const now = new Date().toISOString();
  return dataRows.map(r => {
    const [word, furigana = '', meaning = '', pos = ''] = r;
    if (!word?.trim()) return null;
    const text = word.trim();
    // CSV에는 언어 칸이 없다. 그래도 **추측을 저장하지는 않는다** — 확신할 때만 싣고,
    // 못 가르면 비워 둔다(화면은 `detectLang` 기본값으로 그린다). 예전에는 여기서도
    // ja/fr/en 3트랙으로 단정해 **중국어 CSV가 통째로 일본어로 저장**됐다.
    const lang = detectLangConfident(text);
    return {
      user_id: userId,
      word_text: text,
      furigana: furigana.trim(),
      meaning: meaning.trim(),
      pos: pos.trim(),
      next_review_at: now,
      ...(lang ? { language: lang } : {}),
      // 소문자화는 **표기** 판단이다(언어가 아니다) — `Tシャツ`의 `T`를 지키려고 가른다.
      base_form: hasCjkText(text) ? text : text.toLowerCase(),
    };
  }).filter(Boolean);
}

export function exportCSV(vocab) {
  const header = ['단어', '후리가나', '의미', '품사', '다음 복습', '안정도(S)', '난이도(D)'];
  const rows = vocab.map(v => [
    v.word_text,
    v.furigana || '',
    v.meaning || '',
    v.pos || '',
    new Date(v.next_review_at).toLocaleDateString('ko-KR'),
    (v.interval ?? 0).toFixed(1),
    (v.ease_factor ?? 0).toFixed(1),
  ]);
  const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `anatomy_vocab_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Anki 가져오기 호환 TSV (.txt) — Front | Back | Tags 3열
export function exportAnki(vocab) {
  const escape = (s) => String(s ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, '<br>');
  const lines = [
    '#separator:tab',
    '#html:true',
    '#columns:Front\tBack\tTags',
  ];
  for (const v of vocab) {
    const isJa = v.language === 'Japanese' && v.furigana;
    const front = isJa
      ? `${escape(v.word_text)}<br><small>${escape(v.furigana)}</small>`
      : escape(v.word_text);
    const back = [
      `<b>${escape(v.meaning || '')}</b>`,
      v.pos ? `<small>${escape(v.pos)}</small>` : '',
      v.source_sentence ? `<hr><i>${escape(v.source_sentence)}</i>` : '',
    ].filter(Boolean).join('<br>');
    const tags = ['anatomy-studio', v.language ? v.language.toLowerCase() : '', v.pos ? v.pos.replace(/\s+/g, '_') : '']
      .filter(Boolean).join(' ');
    lines.push(`${front}\t${back}\t${tags}`);
  }
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `anatomy_vocab_anki_${new Date().toISOString().split('T')[0]}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
