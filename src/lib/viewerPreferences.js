// Browser-only reading preferences. No learning records or document data live here.
export const VIEWER_PREF_KEY = 'viewer_preferences_v2';
export const COMMON_KEYS = ['theme', 'ttsRate'];
export const TAB_KEYS = {
  type: ['fontSize', 'pinyinSize', 'lineGap', 'charGap', 'fontFamily', 'theme'],
  display: ['pronDisplay', 'pronReveal', 'wordStateHl', 'showToneColors', 'showHanjaKo', 'showPatterns', 'patternFilter'],
  pace: ['focusMode', 'autoPace', 'paceCpm', 'paceStep', 'autoSpeakOnClick', 'ttsRate'],
};
export function fontChoices(language) {
  if (language === 'Chinese') return [['sans', '고딕'], ['serif', '명조']];
  if (language === 'Japanese') return [['sans', '고딕']];
  return [['sans', 'Noto Sans'], ['inter', 'Inter']];
}
export function viewerDefaults(language) {
  return {fontSize:1.6, pinyinSize:0.75, lineGap:15, charGap:0.25, theme:'sepia', fontFamily:'sans',
    pronDisplay:'all', pronReveal:false, autoSpeakOnClick:false, ttsRate:'normal', showHanjaKo:false,
    showToneColors:false, focusMode:false, wordStateHl:false, showPatterns:false, patternFilter:'all',
    autoPace:false, paceCpm:null, paceStep:0};
}
const ranges = {fontSize:[0.8,3],pinyinSize:[0.75,1],lineGap:[10,60],charGap:[0,1],paceCpm:[10,2000],paceStep:[0,20]};
const enums = {theme:['light','sepia','dark'],ttsRate:['slow','normal','fast'],pronDisplay:['all','unknown','none'],patternFilter:['all','due','weak']};
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
  if (stored?.version === 2 && stored.languages?.[language]) return validateViewerPreferences({...stored.languages[language], ...stored.common}, language);
  const legacy = Object.fromEntries(Object.keys(viewerDefaults(language)).map(key => [key, read('viewer_'+key)]));
  if (!enums.pronDisplay.includes(legacy.pronDisplay)) legacy.pronDisplay = read('viewer_showFurigana') === false ? 'none' : 'all';
  return validateViewerPreferences({...legacy, ...(stored?.version === 2 ? stored.common : {})}, language);
}
export function writeViewerPreferences(storage, language, values) {
  let previous;
  try { previous = JSON.parse(storage.getItem(VIEWER_PREF_KEY)); } catch { previous = null; }
  const valid = validateViewerPreferences(values, language);
  const common = Object.fromEntries(COMMON_KEYS.map(k => [k,valid[k]]));
  const specific = Object.fromEntries(Object.entries(valid).filter(([k]) => !COMMON_KEYS.includes(k)));
  storage.setItem(VIEWER_PREF_KEY, JSON.stringify({version:2,common,languages:{...(previous?.version === 2 ? previous.languages : {}),[language]:specific}}));
}
export function readerFontFamily(language, choice) {
  if (language === 'Chinese') return choice === 'serif' ? "var(--font-reader-serif, var(--font-noto-sc)), var(--font-noto-sc), serif" : "var(--font-noto-sc), 'Noto Sans SC', sans-serif";
  if (language === 'Japanese') return "var(--font-noto-jp), 'Noto Sans JP', sans-serif";
  return choice === 'inter' ? 'var(--font-inter), sans-serif' : 'var(--font-noto-sans), sans-serif';
}
