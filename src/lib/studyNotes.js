import {BOARD_LANGUAGES, emptyBoard, validateBoard, expressionOf} from './teachingBoard';
import {readCard} from './teachingBoardCard';
import {sameContent} from './classCopyModel';
import {isStudyNote} from './studyNoteIdentity';
import {recognitionResult} from './noteRecognition';
export {isStudyNote};

export const NOTE_LIMIT = 3 * 1024 * 1024;
export const NOTE_CANDIDATE_LIMIT = 300;
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const clean = (value, limit) => String(value || '').normalize('NFC').trim().slice(0, limit);
const field = (value, limit) => String(value || '').normalize('NFC').slice(0, limit);
export const noteScope = (owner, id) => JSON.stringify(['personal-study-note', owner, String(id)]);
export const sameStudyNote = (a,b) => (clean(a.title,200)||'새 학습 노트') === (clean(b.title,200)||'새 학습 노트') && sameContent(a.document,b.document);

export function newStudyNote(id, pageId, language = 'Japanese') {
  return {version: 1, key: id, language, board: emptyBoard(pageId), candidates: [], origin: null};
}

export function validateStudyNote(input) {
  if (!input || input.version !== 1 || !uuid.test(input.key) || !BOARD_LANGUAGES.includes(input.language)) throw new Error('노트 정보를 확인해 주세요.');
  if (JSON.stringify(input).length > NOTE_LIMIT) throw new Error('노트가 커졌어요. 백업한 뒤 새 노트에서 이어 주세요.');
  const board = validateBoard(input.board), pages = new Set(board.pages.map(page => page.id));
  if (!Array.isArray(input.candidates) || input.candidates.length > NOTE_CANDIDATE_LIMIT) throw new Error('정리할 표현은 노트마다 300개까지 보관할 수 있어요.');
  const ids = new Set();
  const candidates = input.candidates.map(value => {
    if (!value || !uuid.test(value.id) || ids.has(value.id) || !pages.has(value.pageId)) throw new Error('표현의 노트 위치를 확인해 주세요.');
    ids.add(value.id);
    return {id: value.id, pageId: value.pageId, elementIds: Array.isArray(value.elementIds) ? value.elementIds.filter(id => typeof id === 'string').slice(0, 500) : [],
      original: field(value.original, 2000), text: field(value.text, 300), base: field(value.base, 300), reading: field(value.reading, 500), meaning: field(value.meaning, 2000),
      language: BOARD_LANGUAGES.includes(value.language) ? value.language : input.language, originKey: clean(value.originKey, 500),
      reviewed: value.reviewed === true, excluded: value.excluded === true,
      ...(value.recognition?.source==='gemini' && /^[a-f0-9]{64}$/.test(value.recognition.fingerprint||'') ? {recognition:{source:'gemini',fingerprint:value.recognition.fingerprint,uncertain:value.recognition.uncertain!==false,choices:recognitionResult({expressions:[{original:value.original||value.text,choices:value.recognition.choices}]})[0]?.choices||[]}} : {}),
      ...(uuid.test(value.vocabularyId || '') ? {vocabularyId: value.vocabularyId} : {})};
  });
  const origin = input.origin && /^\d{1,19}$/.test(String(input.origin.materialId)) ? {materialId: String(input.origin.materialId), title: clean(input.origin.title, 200)} : null;
  const note = {version: 1, key: input.key, language: input.language, board, candidates, origin};
  if (new TextEncoder().encode(JSON.stringify(note)).length > NOTE_LIMIT) throw new Error('노트가 커졌어요. 백업한 뒤 새 노트에서 이어 주세요.');
  return note;
}

export function noteFromMaterial(material) {
  if (!isStudyNote(material)) throw new Error('개인 필기 노트를 찾지 못했어요.');
  return validateStudyNote(material.processed_json.metadata.studyNote.document);
}

export function noteText(note) {
  return note.board.pages.map(page => page.elements.filter(el => !el.isDeleted && el.type === 'text').map(el => el.text).join('\n')).join('\n\n').slice(0, 100000);
}

export function noteMaterialRow(ownerId, title, note, revision) {
  const document = validateStudyNote(note);
  return {owner_id: ownerId, visibility: 'private', direction: 'write', title: clean(title, 200) || '새 학습 노트', raw_text: noteText(document),
    processed_json: {sequence: [], dictionary: {}, last_idx: -1, status: 'note', metadata: {
      language: document.language, importAttempt: document.key, studyNote: {version: 1, revision, document},
    }}};
}

// Structured words and typed/Scribble text are local inputs. Freehand strokes
// remain untouched; this routine does not claim to recognize handwriting.
export function collectNoteExpressions(note, randomId = () => crypto.randomUUID()) {
  const result = [];
  for (const page of note.board.pages) {
    const elements = page.elements.filter(el => !el.isDeleted);
    for (const el of elements) {
      const card = expressionOf(el) && readCard(el, elements);
      const values = card ? [{text: card.text, reading: card.reading, meaning: card.meaning, language: card.language, original: card.text}]
        : el.type === 'text' && !el.customData?.manabiField ? String(el.text).split('\n').filter(line => line.trim()).map(line => {
          const [text, ...gloss] = line.split(/\s*(?:→|＝|=|\t|\s[:：]\s)\s*/);
          return {text: text.trim(), reading: '', meaning: gloss.join(' · ').trim(), language: note.language, original: line};
        }) : [];
      values.forEach((value, index) => {
        if (!value.text || value.text.length > 300 || !/[\p{L}\p{N}]/u.test(value.text)) return;
        result.push({id: randomId(), pageId: page.id, elementIds: [el.id], originKey: `element:${page.id}:${el.id}:${index}:${value.original.slice(0, 150)}`,
          original: value.original, text: value.text, base: '', reading: value.reading || '', meaning: value.meaning || '', language: value.language,
          reviewed: false, excluded: false});
      });
    }
  }
  return result;
}

// Reanalysis never erases a learner's edits, exclusions, or acknowledged saves.
export function mergeNoteCandidates(existing, incoming) {
  const result = [...existing], keys = new Set(existing.map(row => row.originKey));
  for (const row of incoming) {
    if (!row.originKey || keys.has(row.originKey)) continue;
    if (result.length >= NOTE_CANDIDATE_LIMIT) throw new Error('정리 목록이 300개를 넘어요. 새 노트로 나눠 주세요.');
    keys.add(row.originKey); result.push(row);
  }
  return result;
}

export function noteCandidatePayload(materialId, row) {
  if (!row.reviewed || row.excluded || !row.text.trim() || !row.meaning.trim()) throw new Error('표기와 뜻을 확인한 표현만 담을 수 있어요.');
  return {word: {word_text: row.text, base_form: row.base || row.text, furigana: row.reading, meaning: row.meaning, language: row.language},
    source: {kind: 'reading', materialId: String(materialId), noteCandidateId: row.id}};
}
