/**
 * 아는 단어 표시 — 커버리지와 복습 제외가 같은 표기를 읽는다(2026-10-02 오너 정정).
 * 표시/해제의 DB 트리거가 복습 보호 상태를 동기화하고 원래 단어·SRS·이력은 보존한다.
 * 합류 지점은 materialFit 호출부의 인덱스 합집합뿐(엔진 시그니처 무변경).
 * 실패·게스트·마이그레이션 미적용은 조용히(버튼·정밀화만 비활성 — 무해성).
 */
import { supabase } from './supabase';
import { encounterLookupLang } from './refVocabLookup';

/** 표기 언어 코드 — 만남 기록과 같은 매핑('Japanese'→'ja' 등). 미지원 언어는 null. */
export function knownWordsLang(materialLang) {
  return encounterLookupLang(materialLang);
}

/** 내 '이미 앎' 표기 전체(언어 무관 — 서재 커버리지용) 또는 한 언어. */
export async function fetchKnownWords(userId, langCode) {
  return loadKnownWords(supabase, userId, langCode);
}
export async function loadKnownWords(client, userId, langCode) {
  const rows = [];
  for (let offset = 0; ; offset += 200) {
    let query = client.from('user_known_words').select('word_text, lang').eq('user_id', userId);
    if (langCode) query = query.eq('lang', langCode);
    const { data, error } = await query.order('lang').order('word_text').range(offset, offset + 199);
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < 200) return rows;
  }
}

/**
 * 담김 인덱스({surfaces, bases})에 '이미 앎' 표기를 합집합 — materialFit 호출부용
 * 순수 함수. 원본 Set은 변경하지 않는다. 표기는 surfaces·bases 양쪽에 넣는다
 * (known은 표기 단위 등록이라 base 대조도 같은 문자열로 커버).
 */
export function mergeKnownIntoIndex(saved, knownRows) {
  const surfaces = new Set(saved?.surfaces || []);
  const bases = new Set(saved?.bases || []);
  for (const r of knownRows || []) {
    const w = r?.word_text;
    if (!w) continue;
    surfaces.add(w);
    bases.add(w);
  }
  return { surfaces, bases };
}

export async function markKnown(userId, langCode, wordText) {
  const { error } = await supabase
    .from('user_known_words')
    .upsert({ user_id: userId, lang: langCode, word_text: wordText }, {
      onConflict: 'user_id,lang,word_text',
      ignoreDuplicates: true,
    });
  if (error) throw error;
}

export async function unmarkKnown(userId, langCode, wordText) {
  const keys = Array.isArray(wordText) ? wordText : [wordText];
  if (!keys.length) return;
  const { error } = await supabase
    .from('user_known_words')
    .delete()
    .eq('user_id', userId)
    .eq('lang', langCode)
    .in('word_text', keys);
  if (error) throw error;
}
