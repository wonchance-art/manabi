import {describe,it,expect} from 'vitest';
import {VIEWER_PREF_KEY,readViewerPreferences,writeViewerPreferences,validateViewerPreferences,viewerDefaults,fontChoices} from '../viewerPreferences';
import {pinyinCellWidth,PINYIN_MEASURE_SYLLABLES} from '../pinyinLayout';
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
});
