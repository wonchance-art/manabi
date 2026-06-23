// 단어장 데이터 입출력 — Supabase fetch · CSV/Anki 가져오기·내보내기
import { supabase } from './supabase';

export async function fetchVocab(userId) {
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

  // DB에도 반영 (fire-and-forget)
  if (needsUpdate.length > 0) {
    Promise.all(needsUpdate.map(u =>
      supabase.from('user_vocabulary').update({ language: u.language }).eq('id', u.id)
    )).catch(() => {});
  }

  // 시리즈 필터용 source material titles 별도 fetch (실패해도 vocab은 그대로)
  try {
    const sourceIds = [...new Set(result.map(v => v.source_material_id).filter(Boolean))];
    if (sourceIds.length > 0) {
      const titlesMap = new Map();
      const CHUNK = 30;
      for (let i = 0; i < sourceIds.length; i += CHUNK) {
        const slice = sourceIds.slice(i, i + CHUNK);
        const { data: mats } = await supabase
          .from('reading_materials')
          .select('id, title')
          .in('id', slice);
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
