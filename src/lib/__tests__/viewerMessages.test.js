import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {VIEWER_MESSAGES,VIEWER_MESSAGE_LOCALES,VIEWER_LOCALE_OPTIONS,t,translateViewerText} from '../viewerMessages';
import {viewerDefaults} from '../viewerPreferences';
import ViewerSettings from '../../components/viewer/ViewerSettings';
import ViewerPreview from '../../components/viewer/ViewerPreview';
import ViewerBottomSheet from '../../components/ViewerBottomSheet';

const variables=value=>[...value.matchAll(/\{([a-zA-Z][\w]*)\}/g)].map(match=>match[1]).sort();
describe('viewer message contract',()=>{
  it('has the same nonempty keys and interpolation variables in all three locales',()=>{
    const keys=Object.keys(VIEWER_MESSAGES.ko).sort();
    expect(VIEWER_MESSAGE_LOCALES).toEqual(['ko','zh-CN','zh-TW']);
    for(const locale of VIEWER_MESSAGE_LOCALES){
      expect(Object.keys(VIEWER_MESSAGES[locale]).sort()).toEqual(keys);
      for(const key of keys){
        expect(VIEWER_MESSAGES[locale][key].trim()).not.toBe('');
        expect(variables(VIEWER_MESSAGES[locale][key])).toEqual(variables(VIEWER_MESSAGES.ko[key]));
      }
    }
  });
  it('covers each migrated static ViewerPage label without the legacy fallback',()=>{
    const source=readFileSync(new URL('../../views/ViewerPage.jsx',import.meta.url),'utf8');
    const literals=[...source.matchAll(/\bvt\(("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g)];
    expect(literals.length).toBeGreaterThan(0);
    for(const [,literal] of literals){
      const key=literal.startsWith('"')?JSON.parse(literal):literal.slice(1,-1);
      expect(Object.hasOwn(VIEWER_MESSAGES.ko,key),`Untranslated viewer label: ${key}`).toBe(true);
    }
  });
  it('preserves every Korean source label verbatim',()=>{
    for(const [key,value] of Object.entries(VIEWER_MESSAGES.ko))expect(value).toBe(key);
    expect(t('ko','목표 속도 · {cpm}자/분',{cpm:120})).toBe('목표 속도 · 120자/분');
  });
  it('uses explicit Taiwan terms and native locale choices',()=>{
    expect(t('zh-TW','읽기 설정')).toBe('閱讀設定');
    expect(t('zh-TW','저장')).toBe('儲存');
    expect(t('zh-TW','문법 표시')).toBe('文法標示');
    // AD-R2 Aa — 표기 통일 「한국어 · 简体中文 · 繁體中文」(정본 §5 Aa).
    expect(VIEWER_LOCALE_OPTIONS).toEqual([['ko','한국어'],['zh-CN','简体中文'],['zh-TW','繁體中文']]);
  });
  it('rejects unsupported locales, missing keys and missing substitutions',()=>{
    expect(()=>t('zh-Hant','저장')).toThrow(/Unsupported/);
    expect(()=>t('en','저장')).toThrow(/Unsupported/);
    expect(()=>t('zh-CN','unregistered')).toThrow(/Unknown/);
    expect(()=>t('zh-TW','{label} 줄이기')).toThrow(/Missing/);
    expect(t('zh-TW','{label} 줄이기',{label:'文字$&<>'})).toBe('減少文字$&<>');
    expect(()=>t('ko','toString')).toThrow(/Unknown/);
  });
  it('only falls back at the explicit legacy boundary and reports uncovered labels',()=>{
    const missing=[];
    expect(translateViewerText('zh-TW','미번역 문구',{},item=>missing.push(item))).toBe('미번역 문구');
    expect(missing).toEqual([{locale:'zh-TW',key:'미번역 문구'}]);
    expect(translateViewerText('zh-CN','저장')).toBe('保存');
  });
});

describe('shared viewer locale rendering',()=>{
  it.each(VIEWER_MESSAGE_LOCALES)('keeps language selectors separate and preserves Korean source in %s',locale=>{
    const token=Object.freeze({id:'same-token',text:'학교에',meaning:'學校',furigana:null});
    const tokens=Object.freeze([token]);
    const defaults=viewerDefaults('Korean');
    const markup=renderToStaticMarkup(createElement(ViewerSettings,{
      settings:{...defaults,snapshot:()=>defaults},language:'Korean',
      languageSettings:{uiLocale:locale,explanationLocale:'ko',setUiLocale:()=>{},setExplanationLocale:()=>{}},
      previewTokens:tokens,keepPosition:callback=>callback(),onClose:()=>{},
      initialTab:'display', // AD-R2 Aa: 언어 선택은 「표시」 탭 맨 아래(정본 §5 Aa)
    }));
    expect(markup).toContain(`aria-label="${t(locale,'화면 언어')}"`);
    expect(markup).toContain(`aria-label="${t(locale,'설명 언어')}"`);
    expect(markup).toContain(`aria-label="${t(locale,'읽기 설정')}" lang="${locale}"`);
    expect(markup).toContain('lang="ko"');
    expect(markup).toContain('학교에');
    expect(markup).toContain('Noto Sans KR');
    expect(markup).not.toContain('단어장');
    expect(tokens[0]).toBe(token);
  });
  it('does not substitute English example content for empty Korean preview',()=>{
    const markup=renderToStaticMarkup(createElement(ViewerPreview,{settings:viewerDefaults('Korean'),language:'Korean'}));
    expect(markup).toContain('lang="ko"');
    expect(markup).not.toContain('Read at your own pace');
  });
  it.each(VIEWER_MESSAGE_LOCALES)('retains inspector tab identity and localizes accessible labels in %s',locale=>{
    const markup=renderToStaticMarkup(createElement(ViewerBottomSheet,{uiLocale:locale,leftActive:true,rightActive:true}));
    expect(markup).toContain('id="inspector-word-tab"');
    expect(markup).toContain('id="inspector-sentence-tab"');
    expect(markup).toContain(`aria-label="${t(locale,'읽기 보조 패널')}"`);
    expect(markup).toContain(`aria-label="${t(locale,'문장 번역')}"`);
  });
});
