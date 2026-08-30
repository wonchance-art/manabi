// 단어장 데이터 입출력 — Supabase fetch · CSV/Anki 가져오기·내보내기
import { supabase } from './supabase';
import { cacheVocabSnapshot, getCachedVocabSnapshot } from './offlineCache';

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

  // language가 비어있는 기존 단어에 자동 감지 적용
  const needsUpdate = [];
  const result = (data || []).map(v => {
    if (v.language) return v;
    const isJa = /[぀-ヿ一-鿿]/.test(v.word_text);
    const lang = isJa ? 'Japanese' : 'English';
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
    const isJa = /[぀-ヿ一-鿿]/.test(text);
    const isFr = !isJa && /[àâçéèêëîïôùûüœæ]/i.test(text);
    return {
      user_id: userId,
      word_text: text,
      furigana: furigana.trim(),
      meaning: meaning.trim(),
      pos: pos.trim(),
      next_review_at: now,
      language: isJa ? 'Japanese' : isFr ? 'French' : 'English',
      base_form: isJa ? text : text.toLowerCase(),
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
