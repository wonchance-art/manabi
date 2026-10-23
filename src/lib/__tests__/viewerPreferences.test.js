import {describe,it,expect} from 'vitest';
import {TAB_KEYS,VIEWER_PREF_KEY,readViewerPreferences,writeViewerPreferences,validateViewerPreferences,viewerDefaults,fontChoices} from '../viewerPreferences';
import {pinyinCellWidth,PINYIN_MEASURE_SYLLABLES} from '../pinyinLayout';
import {READING_PRESETS,presetActive} from '../readingSheet';
const storage=(entries={})=>{const data=new Map(Object.entries(entries));return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
describe('viewer preferences migration and isolation',()=>{
 it('uses paper only when unset; keeps explicitly saved dark and legacy valid size',()=>{
  expect(readViewerPreferences(storage(),'Chinese').theme).toBe('sepia');
  expect(readViewerPreferences(storage({viewer_theme:'"dark"',viewer_fontSize:'0.8'}),'Chinese')).toMatchObject({theme:'dark',fontSize:.8});
 });
 it('preserves hidden legacy reading and resolves phantom Chinese fonts to SC',()=>{
  const old=storage({viewer_showFurigana:'false',viewer_fontFamily:'"\'Inter\'"'});
  expect(readViewerPreferences(old,'Chinese')).toMatchObject({pronDisplay:'none',fontFamily:'sans'});
  expect(readViewerPreferences(old,'English').fontFamily).toBe('inter');
 });
 it('stores common theme but keeps typography per language, leaving old keys untouched',()=>{
  const store=storage({viewer_fontSize:'2'});
  writeViewerPreferences(store,'Chinese',{...viewerDefaults('Chinese'),theme:'dark',fontFamily:'serif',fontSize:2.5});
  writeViewerPreferences(store,'English',{...readViewerPreferences(store,'English'),fontFamily:'inter',fontSize:1.2});
  expect(readViewerPreferences(store,'Chinese')).toMatchObject({fontFamily:'serif',fontSize:2.5,theme:'dark'});
  expect(readViewerPreferences(store,'English')).toMatchObject({fontFamily:'inter',fontSize:1.2});
  expect(store.getItem('viewer_fontSize')).toBe('2');expect(JSON.parse(store.getItem(VIEWER_PREF_KEY)).version).toBe(2);
 });
 it('validates every range, enum and boolean; corrupt JSON remains readable',()=>{
  expect(validateViewerPreferences({fontSize:-3,pinyinSize:9,lineGap:Infinity,charGap:'1',paceCpm:0,paceStep:1.5,theme:'red',pronReveal:'false'},'Chinese')).toEqual(viewerDefaults('Chinese'));
  expect(readViewerPreferences(storage({[VIEWER_PREF_KEY]:'{broken'}),'Chinese')).toEqual(viewerDefaults('Chinese'));
  expect(()=>writeViewerPreferences({getItem:()=>null,setItem:()=>{throw Error('quota');}},'Chinese',viewerDefaults('Chinese'))).toThrow('quota');
 });
 // Y 설계 ③(#1077 5548350811) — 제거한 「탭하면 발음 보기」(pronReveal)의 저장값은 읽지 않고,
 // 같은 묶음의 다른 설정·다른 언어·공통 값은 그대로 둔다. 다음 쓰기에서 그 키만 빠진다.
 it('ignores a stored pronReveal while preserving every other saved preference',()=>{
  const saved={fontSize:2.2,pinyinSize:1,lineGap:30,charGap:.5,fontFamily:'serif',zhScript:'hant',pronDisplay:'unknown',pronReveal:true,autoSpeakOnClick:true,
   showHanjaKo:true,showToneColors:true,focusMode:true,wordStateHl:true,showPatterns:true,patternFilter:'due',autoPace:true,paceCpm:300,paceStep:2};
  const store=storage({[VIEWER_PREF_KEY]:JSON.stringify({version:2,common:{theme:'dark',ttsRate:'fast'},languages:{Chinese:saved,Japanese:{pronDisplay:'none',pronReveal:true,fontSize:1.2}}})});
  const read=readViewerPreferences(store,'Chinese');
  expect(read).not.toHaveProperty('pronReveal');
  const {pronReveal:_dropped,...rest}=saved;
  expect(read).toEqual({...rest,theme:'dark',ttsRate:'fast',readerView:'paged'});
  expect(Object.keys(viewerDefaults('Chinese'))).not.toContain('pronReveal');
  writeViewerPreferences(store,'Chinese',{...read,showHanjaKo:false});
  const after=JSON.parse(store.getItem(VIEWER_PREF_KEY));
  expect(after.languages.Chinese).not.toHaveProperty('pronReveal');
  expect(after.languages.Chinese).toMatchObject({...rest,showHanjaKo:false});
  expect(after.languages.Japanese).toEqual({pronDisplay:'none',pronReveal:true,fontSize:1.2}); // 다른 언어 원본은 건드리지 않는다
  expect(readViewerPreferences(store,'Japanese')).toMatchObject({pronDisplay:'none',fontSize:1.2});
  expect(readViewerPreferences(store,'Japanese')).not.toHaveProperty('pronReveal');
 });
 it('an old recall-preset combination stays as plain user settings (no preset is lit)',()=>{
  const old={pronDisplay:'unknown',pronReveal:true,wordStateHl:true,focusMode:false,showToneColors:false};
  const read=readViewerPreferences(storage({[VIEWER_PREF_KEY]:JSON.stringify({version:2,languages:{Chinese:old}})}),'Chinese');
  expect(read).toMatchObject({pronDisplay:'unknown',wordStateHl:true,focusMode:false,showToneColors:false});
  expect(Object.keys(READING_PRESETS).filter(name=>presetActive(name,read))).toEqual([]);
  expect(presetActive('immerse',{...read,...READING_PRESETS.immerse})).toBe(true);
  expect(presetActive('study',{...read,...READING_PRESETS.study})).toBe(true);
 });
 // ZH-GRID-001(오너 2026-10-12 「일본어 중국어는 띄어쓰기 없으니 간격도 없는 걸로 디폴트」): 기본 간격 0, 옛 기본 0.25 저장값은 한 번만 0으로.
 it('defaults the character gap to 0 for Japanese and Chinese only',()=>{
  for(const language of ['Japanese','Chinese'])expect(viewerDefaults(language).charGap).toBe(0);
  for(const language of ['English','French','Korean'])expect(viewerDefaults(language).charGap).toBe(0.25);
 });
 // 훈음(오너 2026-10-23 KST 「이름 훈음 + 기본 켬」): 중국어 기본 켬, 옛 기본 false 저장값은 표식(hunOn) 전까지 한 번만 켬으로.
 it('reads a stored old default showHanjaKo false as on for Chinese until the new version saves it; a later off stays off',()=>{
  const v2=(languages,extra={})=>storage({[VIEWER_PREF_KEY]:JSON.stringify({version:2,common:{},languages,...extra})});
  expect(readViewerPreferences(storage(),'Chinese').showHanjaKo).toBe(true);
  const store=v2({Chinese:{showHanjaKo:false,fontSize:2},Japanese:{showHanjaKo:false}});
  expect(readViewerPreferences(store,'Chinese')).toMatchObject({showHanjaKo:true,fontSize:2});
  expect(readViewerPreferences(store,'Japanese').showHanjaKo).toBe(false);
  writeViewerPreferences(store,'Chinese',{...readViewerPreferences(store,'Chinese'),showHanjaKo:false});
  const saved=JSON.parse(store.getItem(VIEWER_PREF_KEY));
  expect(saved.hunOn).toEqual(['Chinese']);expect(saved.languages.Chinese.showHanjaKo).toBe(false);
  expect(readViewerPreferences(store,'Chinese').showHanjaKo).toBe(false);
  const ja=storage();writeViewerPreferences(ja,'Japanese',viewerDefaults('Japanese'));
  expect(JSON.parse(ja.getItem(VIEWER_PREF_KEY)).hunOn).toBeUndefined();
 });
 it('reads a stored old default 0.25 as 0 for ja/zh until the new version saves that language; keeps chosen values and English',()=>{
  const v2=(languages,extra={})=>storage({[VIEWER_PREF_KEY]:JSON.stringify({version:2,common:{theme:'dark'},languages,...extra})});
  const store=v2({Chinese:{charGap:.25,fontSize:2},Japanese:{charGap:.25},English:{charGap:.25}});
  expect(readViewerPreferences(store,'Chinese')).toMatchObject({charGap:0,fontSize:2,theme:'dark'});
  expect(readViewerPreferences(store,'Japanese').charGap).toBe(0);
  expect(readViewerPreferences(store,'English').charGap).toBe(.25);
  // Any other stored value is the user's choice.
  expect(readViewerPreferences(v2({Chinese:{charGap:.5},Japanese:{charGap:0.3}}),'Chinese').charGap).toBe(.5);
  expect(readViewerPreferences(v2({Chinese:{charGap:.5},Japanese:{charGap:0.3}}),'Japanese').charGap).toBe(.3);
  // Saving Chinese writes 0 and the marker for Chinese only; Japanese still migrates on its own, its stored entry untouched.
  writeViewerPreferences(store,'Chinese',readViewerPreferences(store,'Chinese'));
  const saved=JSON.parse(store.getItem(VIEWER_PREF_KEY));
  expect(saved.cjkGap0).toEqual(['Chinese']);expect(saved.languages.Chinese.charGap).toBe(0);
  expect(saved.languages.Japanese).toEqual({charGap:.25});expect(readViewerPreferences(store,'Japanese').charGap).toBe(0);
  // The marker prevents re-migration: 0.25 chosen after the change stays 0.25.
  writeViewerPreferences(store,'Chinese',{...readViewerPreferences(store,'Chinese'),charGap:.25});
  expect(readViewerPreferences(store,'Chinese').charGap).toBe(.25);
  expect(readViewerPreferences(v2({Japanese:{charGap:.25}},{cjkGap0:['Japanese']}),'Japanese').charGap).toBe(.25);
  // Writing English adds no marker and English keeps 0.25.
  const en=storage();writeViewerPreferences(en,'English',viewerDefaults('English'));
  expect(JSON.parse(en.getItem(VIEWER_PREF_KEY))).not.toHaveProperty('cjkGap0');expect(readViewerPreferences(en,'English').charGap).toBe(.25);
  // Legacy per-key storage predates the change: its 0.25 is the old default too.
  expect(readViewerPreferences(storage({viewer_charGap:'0.25'}),'Chinese').charGap).toBe(0);
  expect(readViewerPreferences(storage({viewer_charGap:'0.25'}),'English').charGap).toBe(.25);
 });
 it('does not advertise unloaded KR fonts as Chinese choices',()=>{
  expect(fontChoices('Chinese')).toEqual([['sans','고딕'],['serif','명조']]);expect(fontChoices('Japanese')).toHaveLength(1);
 });
});
describe('pinyin width',()=>{
 it('uses a finite vetted syllable set; body or longest reading wins with a safety gap',()=>{
  const seen=[];expect(pinyinCellWidth(s=>{seen.push(s);return s.length*7;},24)).toBe(44);
  expect(seen).toEqual(PINYIN_MEASURE_SYLLABLES);expect(pinyinCellWidth(()=>10,48)).toBe(50);
 });
 it('invalid measurements cannot poison CSS width',()=>{expect(pinyinCellWidth(()=>NaN,26)).toBe(28);});
 it('zhScript(번체로 읽기, LIT-SRC-WS-1) — 기본 간체 · hans/hant만 · 글자 탭에 속한다',()=>{
  expect(viewerDefaults('Chinese').zhScript).toBe('hans');
  expect(validateViewerPreferences({zhScript:'hant'},'Chinese').zhScript).toBe('hant');
  expect(validateViewerPreferences({zhScript:'traditional'},'Chinese').zhScript).toBe('hans');
  expect(TAB_KEYS.type).toContain('zhScript');
 });
});
