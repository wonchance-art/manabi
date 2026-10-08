import { titleFromBody } from './materialTitle';
import { createImportAttempt, saveImportOnce } from './materialImport';
import { LEARNING_LANGUAGES } from './learningSources';
import { VIEWER_LANGUAGES, canonicalViewerLocale, textReadingSupported, viewerLanguageInfo } from './viewerLanguage';
import { HANGUL_RE, KO_LINE_THRESHOLD } from './bilingualSplit';
import { HAN, KANA } from './constants';

export const SOURCE_BUCKET = 'material-originals';
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_BODY_CHARS = 200000;
export const MAX_ATTACHMENTS = 5;
export const MAX_LINKS = 10;
// 자료 언어 목록은 따로 들지 않는다 — 정본 LEARNING_LANGUAGES를 언어 등록부 순서(일·중·영·프·한)로 쓴다.
// 목록 두 벌이 한국어 누락(KO-COMPOSER-001, 2026-10-08)의 원인이었다. 수준(LEVELS) 4언어 상수와는 별개다.
export const COMPOSER_LANGUAGES = Object.freeze(Object.keys(VIEWER_LANGUAGES).filter(language => LEARNING_LANGUAGES.includes(language)));

/** 한국어 선택지는 계정의 배포 계약(useLearningCapabilities)이 확인됐을 때만. 확인 중·실패면 숨긴다. */
export const koreanStudyReady = korean => korean?.save === true && !korean.isLoading && !korean.isError;

/** 「공부할 언어」 선택지 — 텍스트 읽기 조건(MaterialEntry와 같은 textReadingSupported) + 한국어는 계정 확인. */
export function studyLanguages(koreanReady) {
  return COMPOSER_LANGUAGES.filter(language => textReadingSupported(viewerLanguageInfo(language))
    && (language !== 'Korean' || koreanReady === true));
}
export const studyLanguageLabel = language => viewerLanguageInfo(language)?.labelKo || language;

/** 한국어 학습 행 메타 — 기존 한국어 가져오기(MaterialAddPage 한국어 분기)와 같은 키·값. 다른 언어는 그대로. */
export function koreanStudyMetadata(language, explanationLocale) {
  return language === 'Korean' ? { level: '', explanationLocale: canonicalViewerLocale(explanationLocale) || 'ko' } : {};
}

const LETTER_RE = /\p{L}/u;
const GUESS_SAMPLE = 4000;
/**
 * 글자 종류로만 언어를 짐작한다(모델 호출 없음). 글자의 60%(KO_LINE_THRESHOLD) 이상을 차지하는 문자가 있을 때만 답한다.
 * 한글 → 한국어, 가나가 있는 한자·가나 글 → 일본어, 가나 없는 한자 글 → 중국어. 라틴은 영·프가 갈리지 않아 짐작하지 않는다.
 */
export function guessStudyLanguage(text, languages = COMPOSER_LANGUAGES) {
  let letters = 0, hangul = 0, kana = 0, han = 0;
  for (const ch of String(text || '').slice(0, GUESS_SAMPLE)) {
    if (!LETTER_RE.test(ch)) continue;
    letters += 1;
    if (HANGUL_RE.test(ch)) hangul += 1;
    else if (KANA.test(ch)) kana += 1;
    else if (HAN.test(ch)) han += 1;
  }
  if (!letters) return '';
  const guess = hangul / letters >= KO_LINE_THRESHOLD ? 'Korean'
    : (kana + han) / letters >= KO_LINE_THRESHOLD ? (kana ? 'Japanese' : 'Chinese') : '';
  return languages.includes(guess) ? guess : '';
}

/** 본문이 바뀌면 언어 칩을 다시 짐작한다. 사용자가 고른 값(선택 해제 포함)·편집 중인 자료의 저장된 언어는 덮지 않는다. */
export function guessedLanguagePatch(draft, languages, { editing = false } = {}) {
  if (editing || draft.languageChosen || (draft.language && !draft.languageGuessed)) return null;
  const language = guessStudyLanguage(draft.body, languages);
  if (language === (draft.language || '') && !!language === !!draft.languageGuessed) return null;
  return { language, languageGuessed: !!language };
}

/** 「저장하고 공부하기」 — 쓰기 노트·본문 없는 첨부/링크 자료에는 두지 않는다. 본문과 고를 수 있는 언어가 있어야 켜진다. */
export function composerStudyState(draft, languages, { note = false } = {}) {
  const body = !!draft.body.trim();
  if (note || (!body && (draft.files.length || draft.links.length))) return { visible: false, ready: false, reason: '' };
  const reason = !body ? '본문이 있어야 공부할 수 있어요' : !languages.includes(draft.language) ? '공부할 언어를 골라 주세요' : '';
  return { visible: true, ready: !reason, reason };
}

export function composerOf(material) {
  const value = material?.processed_json?.metadata?.composer;
  return value?.version === 1 ? value : null;
}

export function shouldReadComposerOriginal(material, params) {
  if (!composerOf(material)) return false;
  if (composerOf(material).role === 'study') return false;
  const learningRequest = params.get('study') === '1' || params.has('sourceToken') || params.has('sourceText') || params.has('sourceContext');
  return !learningRequest || !material.raw_text?.trim() || !COMPOSER_LANGUAGES.includes(material.processed_json?.metadata?.language);
}

export function normalizeSourceUrl(value) {
  let url;
  try { url = new URL(String(value).trim()); } catch { throw new Error('https://로 시작하는 전체 주소를 넣어 주세요.'); }
  if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new Error('로그인 정보가 없는 http 또는 https 주소를 넣어 주세요.');
  }
  if (url.href.length > 2048) throw new Error('주소가 너무 길어요. 2,048자 이내로 넣어 주세요.');
  return url.href;
}

export function newComposerDraft(id) {
  return { version: 1, id, title: '', body: '', files: [], links: [], language: '', frozen: false, savedId: null };
}

// Entry-point hints are deliberately absent: a note-menu visit does not determine content type.
export function composerTitle(draft) {
  return draft.title.trim() || titleFromBody(draft.body) || draft.files[0]?.name.replace(/\.(pdf|epub)$/i, '') ||
    (draft.links[0] ? new URL(draft.links[0]).hostname : '제목 없는 자료');
}

export function validateComposer(draft) {
  if (!draft.body.trim() && !draft.files.length && !draft.links.length) throw new Error('글을 쓰거나 파일·링크를 추가해 주세요.');
  if (draft.title.length > 240) throw new Error('제목은 240자 이내로 적어 주세요.');
  if (draft.body.length > MAX_BODY_CHARS) throw new Error('본문은 20만 자까지 저장할 수 있어요.');
  if (draft.files.length > MAX_ATTACHMENTS) throw new Error('파일은 한 자료에 5개까지 추가할 수 있어요.');
  if (draft.links.length > MAX_LINKS) throw new Error('링크는 한 자료에 10개까지 추가할 수 있어요.');
  draft.links.forEach(normalizeSourceUrl);
}

export async function prepareComposerFile(file) {
  if (!file.size || file.size > MAX_FILE_BYTES) throw new Error('파일은 각각 50MB 이하이며 비어 있지 않아야 해요.');
  const extension = file.name.split('.').pop().toLowerCase();
  if (!['pdf', 'epub'].includes(extension)) throw new Error('PDF 또는 EPUB 파일을 추가해 주세요.');
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (extension === 'pdf' && new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') throw new Error('이 파일은 PDF 형식이 아니에요.');
  if (extension === 'epub' && (bytes[0] !== 0x50 || bytes[1] !== 0x4b)) throw new Error('이 파일은 EPUB 형식이 아니에요.');
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const hash = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  return { hash, kind: extension, name: file.name, size: file.size,
    type: extension === 'pdf' ? 'application/pdf' : 'application/epub+zip', blob: file };
}

export function attachmentPath(ownerId, attemptId, file) {
  return `${ownerId}/${attemptId}/${file.hash}.${file.kind}`;
}

export function composerRow(ownerId, draft, { explanationLocale } = {}) {
  validateComposer(draft);
  const language = COMPOSER_LANGUAGES.includes(draft.language) ? draft.language : null;
  const assets = draft.files.map(file => ({ kind: file.kind, name: file.name, size: file.size,
    hash: file.hash, path: attachmentPath(ownerId, draft.id, file) }));
  return { owner_id: ownerId, visibility: 'private', title: composerTitle(draft), raw_text: draft.body,
    processed_json: { sequence: [], dictionary: {}, last_idx: -1, status: 'saved', metadata: {
      language, ...koreanStudyMetadata(language, explanationLocale),
      composer: { version: 1, hasBody: !!draft.body.trim(), excerpt: draft.body.trim().slice(0, 120), assets, links: draft.links.map(normalizeSourceUrl) },
    } } };
}

// The immutable hash path is both the retry identity and the original's version.
// Never upsert: an existing object is confirmed before skipping an interrupted upload.
export async function uploadOriginal(client, ownerId, draft, file) {
  const folder = `${ownerId}/${draft.id}`;
  const name = `${file.hash}.${file.kind}`;
  const bucket = client.storage.from(SOURCE_BUCKET);
  const existing = await bucket.list(folder, { search: name, limit: 10 });
  if (existing.error) throw existing.error;
  if (existing.data?.some(item => item.name === name && Number(item.metadata?.size) === file.size)) return;
  if (!file.blob) throw new Error('DRAFT_FILE_MISSING');
  const result = await bucket.upload(`${folder}/${name}`, file.blob, { contentType: file.type, upsert: false });
  if (!result.error) return;
  // Another tab, or a successful upload whose reply was lost, can own this same path.
  const check = await bucket.list(folder, { search: name, limit: 10 });
  if (!check.error && check.data?.some(item => item.name === name && Number(item.metadata?.size) === file.size)) return;
  throw result.error;
}

export function createComposerSave(ownerId, draft, options = {}) {
  const attempt = createImportAttempt(composerRow(ownerId, draft, options), draft.id);
  // Always reconcile first, including after a browser refresh. The partial unique index
  // also protects simultaneous tabs; reconciliation alone cannot serialize an insert.
  attempt.uncertain = true;
  return { attempt, draft, ownerId, pending: null };
}

export async function saveComposerOnce(client, save, onStage = () => {}) {
  if (save.pending) return save.pending;
  save.pending = (async () => {
    onStage('저장 기록을 확인하고 있어요…');
    const prior = await client.from('reading_materials').select('id').eq('owner_id', save.ownerId)
      .eq('processed_json->metadata->>importAttempt', save.draft.id).limit(1);
    if (prior.error) throw prior.error;
    if (prior.data?.[0]?.id) return { ...save.attempt.row, id: prior.data[0].id };
    for (const [index, file] of save.draft.files.entries()) {
      onStage(`원본을 보관하고 있어요… ${index + 1} / ${save.draft.files.length}`);
      await uploadOriginal(client, save.ownerId, save.draft, file);
    }
    onStage('서재에 저장하고 있어요…');
    try { return await saveImportOnce(client, save.attempt); } catch (error) {
      if (error?.code !== '23505') throw error;
      return saveImportOnce(client, save.attempt);
    }
  })();
  try { return await save.pending; } finally { save.pending = null; }
}

export function safeAssetPath(material, asset) {
  const attemptId = material?.processed_json?.metadata?.importAttempt;
  if (!material?.owner_id || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(attemptId || '') || !/^[a-f0-9]{64}$/.test(asset?.hash || '') || !['pdf', 'epub'].includes(asset?.kind)) return null;
  const expected = attachmentPath(material.owner_id, attemptId, asset);
  return asset.path === expected ? expected : null;
}

export function composerError(error) {
  if (error?.message === 'DRAFT_FILE_MISSING') return '초안의 파일을 복구하지 못했어요. 이 초안을 처음 작성한 탭에서 다시 저장해 주세요.';
  if (/bucket|schema cache|42P01|23514|42501/i.test(`${error?.message} ${error?.code}`)) return '저장소 연결을 확인하지 못했어요. 초안을 유지했으니 잠시 후 다시 저장해 주세요.';
  return '저장을 완료했는지 확인하지 못했어요. 다시 저장하면 같은 요청을 확인하며 중복으로 만들지 않아요.';
}

export async function removeComposerOriginals(client, material) {
  const current = material.document_json?.version === 1 ? material.document_json : {};
  const paths = [...new Set([...(composerOf(material)?.assets || []), ...(current.assets || []), ...(current.retainedAssets || [])]
    .map(asset => safeAssetPath(material, asset)).filter(Boolean))];
  if (!paths.length) return;
  const { error } = await client.storage.from(SOURCE_BUCKET).remove(paths);
  if (error) throw error;
}
