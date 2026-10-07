import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import ViewerSettings,{displayDetailKeys} from '../viewer/ViewerSettings';
import {supportsPatterns} from '../../lib/patternIndex';
import {sliceBetween} from '../../lib/__tests__/helpers/sliceBetween.js';
import {viewerDefaults} from '../../lib/viewerPreferences';
import {t,VIEWER_MESSAGE_LOCALES} from '../../lib/viewerMessages';

function render({locale='ko',language='Chinese',values={},storageError=false,fontStatus='ready'}={}) {
  const settings={...viewerDefaults(language),...values,storageError};
  return renderToStaticMarkup(createElement(ViewerSettings,{
    language,settings:{...settings,snapshot:()=>({...settings})},
    languageSettings:{uiLocale:locale,explanationLocale:'ko',setUiLocale:()=>{},setExplanationLocale:()=>{}},
    keepPosition:callback=>callback(),onClose:()=>{},fontStatus,ttsSupported:true,
    previewTokens:[{text:'这里',furigana:'这[zhè]里[lǐ]'}],
  }));
}

describe('minimal reader settings keep essential controls and recoverable preferences',()=>{
  it.each(VIEWER_MESSAGE_LOCALES)('keeps accessible language/theme/size controls in %s',locale=>{
    const html=render({locale});
    for(const label of ['화면 언어','설명 언어','본문 크기','밝게','종이','어둡게','이 탭 기본값','이번 변경 되돌리기']) {
      expect(html).toContain(`aria-label="${t(locale,label)}"`);
    }
    expect(html).toContain('aria-label="繁體中文（台灣）"');
    expect(html).toContain('aria-label="中文（简体）"');
    expect(html).toContain('min="0.8" max="3" step="0.05"');
    expect(html).toContain('aria-pressed="true"');
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

// VIEWER-R0-BUGS-001 버그 10 — 「성조·문법·한자 표시」 개수는 그 묶음 안에 그려지는 항목만 센다.
// 읽기 진행 탭의 문장 집중(focusMode), 묶음 위의 발음 표기·단어 상태, 제거된 탭 공개는 묶음 밖이다.
describe('display detail change count',()=>{
  const source=readFileSync(new URL('../viewer/ViewerSettings.jsx',import.meta.url),'utf8');
  const group=sliceBetween(source,'label="성조·문법·한자 표시"',"{tab==='pace'");
  it('counts exactly the keys rendered inside the group, per language and visibility',()=>{
    expect(displayDetailKeys('Chinese',viewerDefaults('Chinese'))).toEqual(['showToneColors','showHanjaKo','showPatterns']);
    expect(displayDetailKeys('Chinese',{...viewerDefaults('Chinese'),showPatterns:true})).toEqual(['showToneColors','showHanjaKo','showPatterns','patternFilter']);
    expect(displayDetailKeys('Japanese',viewerDefaults('Japanese'))).toEqual(supportsPatterns('Japanese')?['showPatterns']:[]);
    for(const language of ['Chinese','Japanese','Korean','English']){
      const keys=displayDetailKeys(language,{...viewerDefaults(language),showPatterns:true});
      for(const outside of ['focusMode','pronDisplay','wordStateHl','autoPace'])expect(keys).not.toContain(outside);
      // 세는 키는 모두 묶음 안에서 set('<key>',…)로 그려진다 — 렌더와 개수가 갈리지 않는다.
      for(const key of keys)expect(group).toContain(`set('${key}',v)`);
    }
    expect(group).toContain('count={changed(displayDetailKeys(language,s))}');
    expect(sliceBetween(group,'label="성조·문법·한자 표시"','</More>')).not.toContain("set('focusMode'");
  });
  it('a changed setting outside the group never raises its badge',()=>{
    const d=viewerDefaults('Chinese');
    const s={...d,focusMode:true,pronDisplay:'none',wordStateHl:true};
    expect(displayDetailKeys('Chinese',s).filter(k=>s[k]!==d[k])).toEqual([]);
    const t2={...s,showToneColors:true,patternFilter:'due'};
    expect(displayDetailKeys('Chinese',t2).filter(k=>t2[k]!==d[k])).toEqual(['showToneColors']); // 문법 표시가 꺼져 범위는 안 보인다
  });
});
