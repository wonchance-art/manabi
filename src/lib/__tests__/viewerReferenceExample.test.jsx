import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import ViewerReferenceExample from '../../components/viewer/ViewerReferenceExample';
import {t,VIEWER_MESSAGE_LOCALES} from '../viewerMessages';

describe('dictionary example disclosure and sense boundaries',()=>{
  it.each(VIEWER_MESSAGE_LOCALES)('reveals a matching example with its parent alone in %s',uiLocale=>{
    const markup=renderToStaticMarkup(<details><summary>{t(uiLocale,'예문·관련 표현')}</summary><ViewerReferenceExample matches meaning="학교" uiLocale={uiLocale}><p lang="zh-Hans">我去学校。</p></ViewerReferenceExample></details>);
    expect(markup.match(/<details\b/g)).toHaveLength(1);
    expect(markup).toContain(`aria-label="${t(uiLocale,'사전 예문')}"`);
    expect(markup).toContain('<p lang="zh-Hans">我去学校。</p>');
  });
  it.each(VIEWER_MESSAGE_LOCALES)('keeps another sense explicit and initially closed in %s',uiLocale=>{
    const meaning='다른 뜻 · $&';
    const markup=renderToStaticMarkup(<ViewerReferenceExample matches={false} meaning={meaning} uiLocale={uiLocale}><p>정본 예문</p></ViewerReferenceExample>);
    expect(markup).toMatch(/^<details\b/);
    expect(markup).not.toMatch(/<details[^>]*\bopen(?:=|\s|>)/);
    expect(markup).toContain(t(uiLocale,'사전의 다른 뜻 · {meaning}',{meaning}).replace('&','&amp;'));
    expect(markup).toContain('<p>정본 예문</p>');
  });
});
