import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import {renderToStaticMarkup} from 'react-dom/server';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {describe,expect,it} from 'vitest';
import ViewerGlyphColumn from '../../components/viewer/ViewerGlyphColumn';
import ViewerJapaneseMore from '../../components/viewer/ViewerJapaneseMore';
import {ViewerUiLocaleContext} from '../viewerLocaleContext';
import {t,VIEWER_MESSAGE_LOCALES} from '../viewerMessages';
import {glyphRows} from '../glyphColumn';
import {sliceBetween} from './helpers/sliceBetween.js';

/**
 * 계약: 뷰어 v2 AE-R3 PR ② 화면 조각 — 자형 열(正 · 日)과 「더 알아보기 · 일본어로는」 줄(설계서 §2·§5·§7.3·§12).
 * 정적 렌더(그리기 전 폭 판정·정렬은 e2e viewer-word-card가 실글꼴 없이 기하로 잰다).
 */
const readData=f=>JSON.parse(fs.readFileSync(path.join(process.cwd(),'src/lib/data',f),'utf8'));
const trad=readData('hanjaTrad.json');
const jaWords=readData('jaWords.json');
const labels={zheng:'대만 정체',ja:'일본어 표기'};
const renderColumn=(word,dictEntry)=>{const rows=glyphRows({word,tradTable:trad,dictEntry,jaTable:jaWords});return renderToStaticMarkup(<ViewerGlyphColumn word={word} zheng={rows.zheng} ja={rows.ja} cardKey={word} labels={labels}/>);};
const renderMore=(props,locale='ko')=>{const client=new QueryClient();const markup=renderToStaticMarkup(<QueryClientProvider client={client}><ViewerUiLocaleContext.Provider value={locale}><ViewerJapaneseMore word="老师" meaning="선생님" pos="명사" jaTable={jaWords} {...props}/></ViewerUiLocaleContext.Provider></QueryClientProvider>);const fetching=client.isFetching();client.clear();return {markup,fetching};};
const text=html=>html.replace(/<[^>]+>/g,'');

describe('자형 열 — 정본 예(眼前 = 日만 · 壮观 = 둘 다 · 尽量 = 正만)',()=>{
  it('壮观: 正 壯觀(두 글자 모두 다름) · 日 壮観 そうかん(観만 다름) — 라벨 正·日, lang 표식',()=>{
    const html=renderColumn('壮观');
    expect(html).toContain('lang="zh-Hant-TW"');
    expect(html).toContain('lang="ja"');
    expect(text(html)).toBe('正壯觀日壮観そうかん');
    const zheng=sliceBetween(html,'reader-card-glyph__row--zheng','reader-card-glyph__row--ja');
    const ja=sliceBetween(html,'reader-card-glyph__row--ja');
    expect(zheng.match(/is-diff/g)).toHaveLength(2);
    expect(ja.match(/is-diff/g)).toHaveLength(1);
    expect(ja.match(/is-same/g)).toHaveLength(1);
    expect(html).toContain('aria-label="대만 정체"');
    expect(html).toContain('aria-label="일본어 표기"');
  });
  it('眼前: 正 줄 없음, 日 眼前 がんぜん(다른 글자 0)',()=>{
    const html=renderColumn('眼前');
    expect(html).not.toContain('reader-card-glyph__row--zheng');
    expect(text(html)).toBe('日眼前がんぜん');
    expect(html).not.toContain('is-diff');
  });
  it('尽量: 正 儘量만 · 日 줄 없음',()=>{
    const html=renderColumn('尽量');
    expect(text(html)).toBe('正儘量');
    expect(html).not.toContain('reader-card-glyph__row--ja');
  });
  it('正·日이 모두 숨으면 아무것도 그리지 않는다',()=>{
    expect(renderToStaticMarkup(<ViewerGlyphColumn word="你" zheng={null} ja={null} cardKey="你" labels={labels}/>)).toBe('');
  });
  it('「AI」 표가 없다',()=>{
    for(const w of ['壮观','眼前','尽量','体育场'])expect(renderColumn(w)).not.toMatch(/\bAI\b/);
  });
});

describe('더 알아보기 · 일본어로는 — 사전 diff/warn은 내용, 없으면 요청 버튼(로그인), 「AI」 표 없음',()=>{
  it.each(VIEWER_MESSAGE_LOCALES)('老师(diff 先生 せんせい) → 「일본어로는 先生 せんせい」 — 조회 0 (%s)',locale=>{
    const {markup,fetching}=renderMore({userId:'u1',dictEntry:{meanings:[{meaning:'선생님',pos:'명사',ja:{form:'先生',yomi:'せんせい',diff:true,warn:null}}]}},locale);
    expect(markup).toContain(t(locale,'일본어로는'));
    expect(markup).toContain('<strong lang="ja">先生</strong>');
    expect(markup).toContain('lang="ja" class="reader-card-learn__ja-yomi">せんせい<');
    expect(markup).not.toContain('<button');
    expect(markup).not.toMatch(/\bAI\b/);
    expect(fetching).toBe(0);
  });
  it('汽车(diff 自動車 · warn 기차) → 같은 줄에 경고',()=>{
    const {markup}=renderMore({word:'汽车',meaning:'자동차',userId:'u1',dictEntry:{meanings:[{meaning:'자동차',pos:'명사',ja:{form:'自動車',yomi:'じどうしゃ',diff:true,warn:'기차'}}]}});
    expect(text(markup)).toContain('自動車');
    expect(text(markup)).toContain(t('ko','같은 한자 표기는 일본어에서 ‘{meaning}’라는 뜻이에요.',{meaning:'기차'}));
  });
  it('사전 결과가 없으면 로그인 사용자에게만 [✦ 일본어로는?] — 누르기 전 조회 0, 게스트는 아무것도 없다',()=>{
    const owner=renderMore({word:'尽量',meaning:'되도록',userId:'u1',dictEntry:null});
    expect(owner.markup).toContain('reader-card-learn__ask');
    expect(text(owner.markup)).toBe(t('ko','✦ 일본어로는?'));
    expect(owner.fetching).toBe(0);
    expect(renderMore({word:'尽量',meaning:'되도록',userId:null,dictEntry:null}).markup).toBe('');
  });
  it('수기 동형이의어(回复 ↔ 回復 회복) — 게스트에게도 경고 줄, 로그인이면 경고 + [✦ 일본어로는?], 日 줄은 없다',()=>{
    const guest=renderMore({word:'回复',meaning:'답장하다',userId:null,dictEntry:null});
    expect(text(guest.markup)).toBe(t('ko','일본어 {form}는 ‘{meaning}’',{form:'回復',meaning:'회복'}));
    const owner=renderMore({word:'回复',meaning:'답장하다',userId:'u1',dictEntry:null});
    expect(owner.markup).toContain('reader-card-learn__ask');
    expect(text(owner.markup)).toContain('회복');
    // 사전 행이 같은 표기를 같은 단어로 적어도 경고를 붙인다
    const dict=renderMore({word:'回复',meaning:'답장하다',userId:'u1',dictEntry:{meanings:[{meaning:'답장하다',pos:'동사',ja:{form:'回復',yomi:'かいふく'}}]}});
    expect(text(dict.markup)).toContain('‘회복’');
    expect(renderColumn('回复')).not.toContain('reader-card-glyph__row--ja');
  });
  it('사전 행을 아직 받는 중이면 버튼을 미리 세우지 않는다(1초 안 칸에 스피너·버튼 깜빡임 0)',()=>{
    expect(renderMore({word:'尽量',meaning:'되도록',userId:'u1',dictEntry:undefined,dictLoading:true}).markup).toBe('');
  });
});
