import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {describe,expect,it} from 'vitest';
import ViewerJapaneseMore from '../../components/viewer/ViewerJapaneseMore';
import ViewerReferenceExample from '../../components/viewer/ViewerReferenceExample';
import {ViewerUiLocaleContext} from '../viewerLocaleContext';
import {t,VIEWER_MESSAGE_LOCALES} from '../viewerMessages';

describe('visible inspector information preserves meaning and explicit requests',()=>{
  // AE-R3 PR② 개정(설계서 §5 — 일본어 대조 블록 → 더 알아보기 「일본어로는」 줄): 사전 결과는 접힘 없이 바로 보이고 조회를 시작하지 않는다.
  it.each(VIEWER_MESSAGE_LOCALES)('shows the cached Japanese equivalent without initiating a lookup in %s',locale=>{
    const client=new QueryClient();
    const markup=renderToStaticMarkup(<QueryClientProvider client={client}><ViewerUiLocaleContext.Provider value={locale}><ViewerJapaneseMore userId="owner" word="学校" meaning="학교" pos="명사" jaTable={null} dictEntry={{meanings:[{meaning:'학교',pos:'명사',ja:{form:'学校'}}]}}/></ViewerUiLocaleContext.Provider></QueryClientProvider>);
    expect(markup).toMatch(/^<p\b/);
    expect(markup).not.toContain('<details');
    expect(markup).toContain(t(locale,'일본어로는'));
    expect(markup).toContain('lang="ja"');
    expect(client.isFetching()).toBe(0);
    client.clear();
  });
  it.each(VIEWER_MESSAGE_LOCALES)('shows another dictionary sense with its explicit label in %s',uiLocale=>{
    const meaning='다른 뜻';
    const markup=renderToStaticMarkup(<ViewerReferenceExample visible matches={false} meaning={meaning} uiLocale={uiLocale}><p lang="zh-Hans">学校</p></ViewerReferenceExample>);
    expect(markup).toMatch(/^<section\b/);
    expect(markup).not.toContain('<details');
    expect(markup).toContain(t(uiLocale,'사전의 다른 뜻 · {meaning}',{meaning}));
    expect(markup).toContain('<p lang="zh-Hans">学校</p>');
  });
});
