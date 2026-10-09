import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import ViewerSettings from '../viewer/ViewerSettings';
import {sliceBetween} from '../../lib/__tests__/helpers/sliceBetween.js';
import {viewerDefaults,validateViewerPreferences,TAB_KEYS,COMMON_KEYS} from '../../lib/viewerPreferences';
import {t,VIEWER_MESSAGE_LOCALES} from '../../lib/viewerMessages';

function render({locale='ko',language='Chinese',values={},storageError=false,fontStatus='ready',tab,explanationLocale='ko'}={}) {
  const settings={...viewerDefaults(language),...values,storageError};
  return renderToStaticMarkup(createElement(ViewerSettings,{
    language,settings:{...settings,snapshot:()=>({...settings})},
    languageSettings:{uiLocale:locale,explanationLocale,setUiLocale:()=>{},setExplanationLocale:()=>{}},
    keepPosition:callback=>callback(),onClose:()=>{},fontStatus,ttsSupported:true,initialTab:tab,
    previewTokens:[{text:'这里',furigana:'这[zhè]里[lǐ]'}],
  }));
}
const panel=html=>sliceBetween(html,'role="tabpanel"','<footer');
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
// <select aria-label="…" …>…</select> 한 덩어리 — 속성 순서와 무관하게 이름으로 찾는다.
const select=(html,label)=>html.match(new RegExp(`<select[^>]*aria-label="${escape(label)}"[^>]*>[\\s\\S]*?</select>`))?.[0];

describe('minimal reader settings keep essential controls and recoverable preferences',()=>{
  it.each(VIEWER_MESSAGE_LOCALES)('keeps accessible language/theme/size controls in %s',locale=>{
    const html=render({locale});
    for(const label of ['본문 크기','밝게','종이','어둡게'])expect(html).toContain(`aria-label="${t(locale,label)}"`);
    expect(html).toContain('min="0.8" max="3" step="0.05"');
    expect(html).toContain('aria-pressed="true"');
    // AD-R2 Aa — 언어는 「표시」 탭 맨 아래 선택 상자 둘(정본 §5 Aa, 설계 §6.1 viewerSettingsMinimal ①).
    const display=render({locale,tab:'display'});
    for(const label of ['화면 언어','설명 언어'])expect(select(display,t(locale,label)),label).toBeTruthy();
    // 표기 통일 「한국어 · 简体中文 · 繁體中文」 — 화면 언어와 무관한 자기 이름(endonym).
    const ui=select(display,t(locale,'화면 언어'));
    expect([...ui.matchAll(/<option[^>]*value="([^"]+)"[^>]*>([^<]+)<\/option>/g)].map(m=>[m[1],m[2]])).toEqual([['ko','한국어'],['zh-CN','简体中文'],['zh-TW','繁體中文']]);
    expect(ui).toMatch(new RegExp(`value="${escape(locale)}" selected=""`));
    expect(display).not.toContain('中文（简体）');expect(display).not.toContain('繁體中文（台灣）');
  });

  it.each(VIEWER_MESSAGE_LOCALES)('labels the footer with visible words, not icons, in %s',locale=>{
    const footer=sliceBetween(render({locale}),'<footer','</footer>');
    // 「이 탭 기본값」「이번 변경 되돌리기」가 보이는 글자다(정본 §5 Aa ④). 아이콘·aria-label 대체 없음.
    for(const label of ['이 탭 기본값','이번 변경 되돌리기'])expect(footer).toMatch(new RegExp(`<button[^>]*>${escape(t(locale,label))}</button>`));
    expect(footer).not.toContain('<svg');
  });

  it('puts the tabs at the very top of the dialog body (no language block above them)',()=>{
    for(const tab of ['type','display','pace']){
      const html=render({tab});
      expect(html).toContain('<div class="reader-modal__body"><div role="tablist"');
      expect(html.indexOf('role="tablist"')).toBeLessThan(html.indexOf('reader-preview-toggle'));
    }
    expect(render({tab:'type'})).not.toContain('<select');
    expect(render({tab:'pace'})).not.toContain('<select');
  });

  it('keeps secondary font/layout controls in a closed disclosure without dropping stored values',()=>{
    const html=render({values:{pinyinSize:1,charGap:.7,lineGap:45}});
    const start=html.indexOf('<details class="reader-settings__more">');
    expect(start).toBeGreaterThan(-1);
    const more=html.slice(start);
    expect(more).toContain('aria-label="3개 설정 변경됨"');
    expect(more).toContain('aria-label="병음 크기"');
    expect(more).toContain('value="45"');
    expect(more).toContain('value="0.7"');
    expect(html.slice(0,start)).toContain('aria-label="본문 크기"');
    expect(html.slice(0,start)).toContain('aria-label="종이"');
    expect(html).not.toContain('화면과 설명 언어는 각각 바꿀 수 있어요.');
  });

  it('keeps storage and font failures outside collapsed details',()=>{
    const html=render({storageError:true,fontStatus:'error',values:{fontFamily:'serif'}});
    const more=html.indexOf('<details class="reader-settings__more">');
    for(const label of ['이 브라우저에 저장하지 못했어요. 현재 화면에는 적용되어 있어요.','명조를 불러오지 못해 고딕으로 표시하고 있어요.']) {
      expect(html.indexOf(label)).toBeGreaterThan(-1);
      expect(html.indexOf(label)).toBeLessThan(more);
    }
  });

  it('exposes disclosure and icon actions with accessible names instead of long visible buttons',()=>{
    const html=render();
    expect(html).toContain('<summary><svg');
    expect(html).toContain('세부 설정');
    expect(html).toContain('aria-label="글자·배경"');
    expect(html).toContain('aria-label="현재 문장 미리보기 접기"');
    expect(html).toContain('aria-hidden="true"');
  });
});

// AD-R2 Aa — 「표시」 탭은 평평하다(정본 §5 Aa ②, 설계 §6.1 ③). R0 버그 10의 「바뀐 개수 뱃지」는 그 묶음과 함께
// 사라진다 — 목적(보이지 않는 곳의 변경을 세지 않는다)은 숨기는 곳 자체가 없어져 해소된다.
describe('flat display tab',()=>{
  const source=readFileSync(new URL('../viewer/ViewerSettings.jsx',import.meta.url),'utf8');
  it('has no collapsed group: every display option is in the panel itself',()=>{
    for(const language of ['Chinese','Japanese','Korean','English']){
      const html=panel(render({language,tab:'display'}));
      expect(html,language).not.toContain('reader-settings__more');
      expect(html,language).not.toContain('reader-settings__changed');
      // 남는 <details>는 「?」 도움말뿐이다 — 옵션을 숨기지 않는다.
      const details=[...html.matchAll(/<details[^>]*>/g)].map(m=>m[0]);
      expect(details.every(tag=>tag==='<details class="reader-settings__help">'),`${language}: ${details}`).toBe(true);
    }
    const zh=panel(render({tab:'display'}));
    for(const label of ['읽기 모드','발음 표기','단어 상태','성조 색상','한자 대조','문법 표시','문법 표시 범위'])expect(zh).toContain(`aria-label="${label}"`);
    expect(sliceBetween(source,"{tab==='display'","{tab==='pace'")).not.toContain('<More');
    expect(source).not.toContain('displayDetailKeys');
  });

  it('shows legends next to their options, always, in the same classes as the text',()=>{
    for(const wordStateHl of [false,true]){
      const html=panel(render({tab:'display',values:{wordStateHl,theme:'dark'}}));
      // 상태 견본 = 본문과 같은 클래스(word-token--new/saved/due)를 --hl 범위에서 그린다 — 본문 표시가 바뀌면(AD-R2 ② 밑줄) 범례도 따라간다.
      const legend=html.match(/<p class="reader-settings__legend reader-area--dark reader-area--hl"[^>]*>[\s\S]*?<\/p>/)?.[0];
      expect(legend,`wordStateHl ${wordStateHl}`).toBeTruthy();
      expect([...legend.matchAll(/class="word-token (word-token--\w+)"/g)].map(m=>m[1])).toEqual(['word-token--new','word-token--saved','word-token--due']);
      for(const label of ['새 단어','학습 중','복습'])expect(legend).toContain(`>${label}</span>`);
      expect(legend).not.toContain('data-tid');expect(legend).not.toContain('data-source-token');
      // 성조 견본 4개 — 본문 병음과 같은 pinyin-tone--N 클래스(색은 --tone-N 토큰).
      expect([...html.matchAll(/class="rt-an (pinyin-tone--\d)"/g)].map(m=>m[1])).toEqual(['pinyin-tone--1','pinyin-tone--2','pinyin-tone--3','pinyin-tone--4']);
      expect(html.indexOf('reader-settings__legend')).toBeGreaterThan(html.indexOf('aria-label="단어 상태"'));
      expect(html.indexOf('pinyin-tone--1')).toBeGreaterThan(html.indexOf('aria-label="성조 색상"'));
    }
    expect(panel(render({language:'Japanese',tab:'display'}))).not.toContain('pinyin-tone--');
  });

  it('keeps the language row last in the display tab',()=>{
    const html=panel(render({tab:'display'}));
    expect(html.indexOf('aria-label="화면 언어"')).toBeGreaterThan(html.indexOf('aria-label="문법 표시 범위"'));
    expect(html.indexOf('aria-label="설명 언어"')).toBeGreaterThan(html.indexOf('aria-label="화면 언어"'));
  });
});

// AD-R2 Aa — 쓸 수 없는 옵션은 꺼진 채 흐리게 두고 이유를 적는다(정본 §5 Aa, 설계 Q6·Q7 제안값).
describe('unavailable options',()=>{
  const reasonOf=(html,id)=>html.match(new RegExp(`id="${escape(id)}"[^>]*>([^<]+)<`))?.[1];
  it('disables the grammar range while grammar marks are off, with a reason, and keeps the stored range',()=>{
    const off=panel(render({tab:'display',values:{showPatterns:false,patternFilter:'due'}}));
    const group=off.match(/<div role="group" aria-label="문법 표시 범위"[^>]*>[\s\S]*?<\/div>/)[0];
    expect([...group.matchAll(/<button[^>]*>/g)].every(m=>/ disabled=""/.test(m[0]))).toBe(true);
    expect(group).toMatch(/aria-label="복습할 것"[^>]*aria-pressed="true"/);
    const described=group.match(/aria-describedby="([^"]+)"/)[1];
    expect(reasonOf(off,described)).toBe('문법 표시를 켜면 고를 수 있어요');
    const on=panel(render({tab:'display',values:{showPatterns:true}}));
    expect(on.match(/<div role="group" aria-label="문법 표시 범위"[^>]*>[\s\S]*?<\/div>/)[0]).not.toContain('disabled=""');
    expect(on).not.toContain('문법 표시를 켜면 고를 수 있어요');
  });

  it('disables grammar marks for a language without pattern data, shown off even if stored on',()=>{
    for(const language of ['Korean','English']){
      const html=panel(render({language,tab:'display',values:{showPatterns:true}}));
      const box=html.match(/<input aria-label="문법 표시"[^>]*>/)[0];
      expect(box,language).toContain('disabled=""');
      expect(box,language).not.toContain('checked=""');
      expect(reasonOf(html,box.match(/aria-describedby="([^"]+)"/)[1])).toBe('이 언어는 아직 문형 자료가 없어요');
      expect(html).not.toContain('aria-label="문법 표시 범위"');
    }
    const zh=panel(render({tab:'display'})).match(/<input aria-label="문법 표시"[^>]*>/)[0];
    expect(zh).not.toContain('disabled=""');
  });

  it('keeps tone colours usable while pinyin is hidden — they still colour the word card headword',()=>{
    const box=panel(render({tab:'display',values:{pronDisplay:'none',showToneColors:true}})).match(/<input aria-label="성조 색상"[^>]*>/)[0];
    expect(box).not.toContain('disabled=""');expect(box).toContain('checked=""');
  });

  it.each(VIEWER_MESSAGE_LOCALES)('disables the explanation language when the material has one explanation language (%s)',locale=>{
    const zh=render({locale,language:'Chinese',tab:'display',explanationLocale:'zh-TW'});
    const box=select(zh,t(locale,'설명 언어'));
    expect(box).toMatch(/^<select[^>]* disabled=""/);
    expect(box).toMatch(/value="ko" selected=""/); // 실제로 쓰이는 설명 언어(한국어)를 보인다 — 저장값(zh-TW)은 건드리지 않는다
    expect(reasonOf(zh,box.match(/aria-describedby="([^"]+)"/)[1])).toBe(t(locale,'이 자료의 설명 언어는 한국어로 제공돼요.'));
    expect(select(zh,t(locale,'화면 언어'))).not.toContain('disabled=""');
    const ko=select(render({locale,language:'Korean',tab:'display',explanationLocale:'zh-TW'}),t(locale,'설명 언어'));
    expect(ko).not.toContain('disabled=""');expect(ko).toMatch(/value="zh-TW" selected=""/);
  });
});

// 설정 저장 경로·키는 그대로다(설계 §7 PR③ 합격 「설정 키 추가·삭제 0」, 정본 §0.2 viewerDefaults 불변).
describe('stored preferences are untouched by the Aa layout',()=>{
  it('keeps the exact key set, tab key groups and defaults',()=>{
    expect(TAB_KEYS).toEqual({
      type:['fontSize','pinyinSize','lineGap','charGap','fontFamily','theme'],
      display:['pronDisplay','wordStateHl','showToneColors','showHanjaKo','showPatterns','patternFilter'],
      pace:['focusMode','autoPace','paceCpm','paceStep','autoSpeakOnClick','ttsRate'],
    });
    expect(COMMON_KEYS).toEqual(['theme','ttsRate']);
    for(const language of ['Chinese','Japanese','Korean','English'])expect(viewerDefaults(language)).toEqual({fontSize:1.6,pinyinSize:0.75,lineGap:15,charGap:0.25,theme:'sepia',fontFamily:'sans',
      pronDisplay:'all',autoSpeakOnClick:false,ttsRate:'normal',showHanjaKo:false,
      showToneColors:false,focusMode:false,wordStateHl:false,showPatterns:false,patternFilter:'all',
      autoPace:false,paceCpm:null,paceStep:0});
  });
  it('round-trips a value hidden behind an unavailable option (range while grammar is off, grammar in Korean)',()=>{
    expect(validateViewerPreferences({showPatterns:false,patternFilter:'weak'},'Chinese').patternFilter).toBe('weak');
    expect(validateViewerPreferences({showPatterns:true},'Korean').showPatterns).toBe(true);
  });
  it('renders without calling a setter (opening Aa writes nothing)',()=>{
    const calls=[];
    const settings={...viewerDefaults('Chinese'),showPatterns:false,patternFilter:'due'};
    const proxy=new Proxy({...settings,snapshot:()=>({...settings})},{get:(o,k)=>typeof k==='string'&&/^(set|restore|resetTab)/.test(k)?(...a)=>calls.push([k,a]):o[k]});
    for(const initialTab of ['type','display','pace'])renderToStaticMarkup(createElement(ViewerSettings,{language:'Korean',settings:proxy,initialTab,
      languageSettings:{uiLocale:'ko',explanationLocale:'zh-TW',setUiLocale:(...a)=>calls.push(['ui',a]),setExplanationLocale:(...a)=>calls.push(['ex',a])},keepPosition:cb=>cb(),onClose:()=>{}}));
    expect(calls).toEqual([]);
  });
});
