import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import ViewerSettings from '../viewer/ViewerSettings';
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
