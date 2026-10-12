// Browser-only reading preferences. No learning records or document data live here.
export const VIEWER_PREF_KEY = 'viewer_preferences_v2';
// readerView(쪽 넘김·스크롤, READER-PAGED-001)는 기기의 읽는 방식이라 언어와 무관하게 하나다 — 원본 리더도 같은 값을 읽는다.
export const COMMON_KEYS = ['theme', 'ttsRate', 'readerView'];
export const TAB_KEYS = {
  type: ['fontSize', 'pinyinSize', 'lineGap', 'charGap', 'fontFamily', 'theme', 'readerView'],
  display: ['pronDisplay', 'wordStateHl', 'showToneColors', 'showHanjaKo', 'showPatterns', 'patternFilter'],
  pace: ['focusMode', 'autoPace', 'paceCpm', 'paceStep', 'autoSpeakOnClick', 'ttsRate'],
};
export function fontChoices(language) {
  if (language === 'Chinese') return [['sans', '고딕'], ['serif', '명조']];
  if (language === 'Japanese') return [['sans', '고딕']];
  return [['sans', 'Noto Sans'], ['inter', 'Inter']];
}
// 띄어쓰기가 없는 일본어·중국어는 글자 간격 0이 기본(오너 2026-10-12). 옛 기본 0.25가 저장값으로 남아 있으면
// (writeViewerPreferences는 만지지 않은 값까지 저장한다) 한 번만 0으로 읽는다 — 표식(cjkGap0)은 새 판이 그 언어를
// 저장할 때 붙어, 그 뒤에 사용자가 고른 0.25는 그대로 둔다. 다른 값·다른 언어는 손대지 않는다.
const GAPLESS = ['Japanese', 'Chinese'], OLD_GAP = 0.25, GAP_MARK = 'cjkGap0';
export function viewerDefaults(language) {
  return {fontSize:1.6, pinyinSize:0.75, lineGap:15, charGap:GAPLESS.includes(language) ? 0 : OLD_GAP, theme:'sepia', fontFamily:'sans',
    pronDisplay:'all', autoSpeakOnClick:false, ttsRate:'normal', showHanjaKo:false,
    showToneColors:false, focusMode:false, wordStateHl:false, showPatterns:false, patternFilter:'all',
    autoPace:false, paceCpm:null, paceStep:0, readerView:'paged'};
}
const ranges = {fontSize:[0.8,3],pinyinSize:[0.75,1],lineGap:[10,60],charGap:[0,1],paceCpm:[10,2000],paceStep:[0,20]};
const enums = {readerView:['paged','scroll'],theme:['light','sepia','dark'],ttsRate:['slow','normal','fast'],pronDisplay:['all','unknown','none'],patternFilter:['all','due','weak']};
export function validateViewerPreferences(input, language) {
  const values = viewerDefaults(language);
  for (const key of Object.keys(values)) {
    const value = input?.[key];
    if (key === 'fontFamily') {
      const normalized = value === "'Inter'" ? 'inter' : value;
      if (fontChoices(language).some(([v]) => v === normalized)) values[key] = normalized;
    } else if (ranges[key]) {
      const [min,max] = ranges[key];
      if (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max && (key !== 'paceStep' || Number.isInteger(value))) values[key] = value;
    } else if (enums[key]?.includes(value) || (typeof values[key] === 'boolean' && typeof value === 'boolean')) values[key] = value;
  }
  return values;
}
export function readViewerPreferences(storage, language) {
  const read = key => { try { return JSON.parse(storage?.getItem(key) ?? 'null'); } catch { return null; } };
  const stored = read(VIEWER_PREF_KEY);
  const oldGap = values => GAPLESS.includes(language) && values.charGap === OLD_GAP && !(Array.isArray(stored?.[GAP_MARK]) && stored[GAP_MARK].includes(language)) ? {...values, charGap:0} : values;
  if (stored?.version === 2 && stored.languages?.[language]) return validateViewerPreferences(oldGap({...stored.languages[language], ...stored.common}), language);
  const legacy = Object.fromEntries(Object.keys(viewerDefaults(language)).map(key => [key, read('viewer_'+key)]));
  if (!enums.pronDisplay.includes(legacy.pronDisplay)) legacy.pronDisplay = read('viewer_showFurigana') === false ? 'none' : 'all';
  return validateViewerPreferences(oldGap({...legacy, ...(stored?.version === 2 ? stored.common : {})}), language);
}
export function writeViewerPreferences(storage, language, values) {
  let previous;
  try { previous = JSON.parse(storage.getItem(VIEWER_PREF_KEY)); } catch { previous = null; }
  const valid = validateViewerPreferences(values, language);
  const common = Object.fromEntries(COMMON_KEYS.map(k => [k,valid[k]]));
  const specific = Object.fromEntries(Object.entries(valid).filter(([k]) => !COMMON_KEYS.includes(k)));
  const marked = [...new Set([...(Array.isArray(previous?.[GAP_MARK]) ? previous[GAP_MARK] : []), ...(GAPLESS.includes(language) ? [language] : [])])];
  storage.setItem(VIEWER_PREF_KEY, JSON.stringify({version:2,common,languages:{...(previous?.version === 2 ? previous.languages : {}),[language]:specific},...(marked.length ? {[GAP_MARK]:marked} : null)}));
}
/** 원본 리더처럼 언어가 정해지지 않은 화면이 읽는 공통 보기 값. 저장값이 없거나 깨졌으면 기본(쪽 넘김). */
export function readReaderView(storage) {
  try { const stored = JSON.parse(storage?.getItem(VIEWER_PREF_KEY) ?? 'null'); return enums.readerView.includes(stored?.common?.readerView) ? stored.common.readerView : 'paged'; }
  catch { return 'paged'; }
}
export function readerFontFamily(language, choice) {
  if (language === 'Korean') return choice === 'inter' ? "var(--font-inter), var(--font-noto-kr), 'Noto Sans KR', sans-serif" : "var(--font-noto-kr), 'Noto Sans KR', sans-serif";
  if (language === 'Chinese') return choice === 'serif' ? "var(--font-reader-serif, var(--font-noto-sc)), var(--font-noto-sc), serif" : "var(--font-noto-sc), 'Noto Sans SC', sans-serif";
  if (language === 'Japanese') return "var(--font-noto-jp), 'Noto Sans JP', sans-serif";
  return choice === 'inter' ? 'var(--font-inter), sans-serif' : 'var(--font-noto-sans), sans-serif';
}
