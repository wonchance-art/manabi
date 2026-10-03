import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import TokenPosLabel from '../TokenPosLabel';
import {ViewerUiLocaleProvider} from '../../lib/viewerLocaleContext';
import {POS_CANON_ALL} from '../../lib/server/posCanon';
import {t,VIEWER_MESSAGE_LOCALES} from '../../lib/viewerMessages';

const render=(locale,token)=>renderToStaticMarkup(<ViewerUiLocaleProvider value={locale}><TokenPosLabel token={token}/></ViewerUiLocaleProvider>);
describe('viewer POS display locale',()=>{
  it('preserves default Korean markup without requiring a provider',()=>{
    const token=Object.freeze({pos:'동사',pos_all:'동사·명사'});
    expect(render('ko',token)).toBe(renderToStaticMarkup(<TokenPosLabel token={token}/>));
    expect(render('ko',{pos:' 동사 · 명사 '})).toBe(' 동사 · 명사 ');
    expect(render('ko',token)).toContain('title="이 문장에서는 동사로 쓰였어요"');
  });
  it.each(VIEWER_MESSAGE_LOCALES)('translates every canonical POS at display time in %s',locale=>{
    for(const pos of POS_CANON_ALL){
      const token=Object.freeze({pos});
      expect(render(locale,token)).toBe(t(locale,pos));
      expect(token.pos).toBe(pos);
    }
  });
  it.each(['zh-CN','zh-TW'])('keeps canonical selection, ordering and corrections while displaying %s',locale=>{
    const token=Object.freeze({id:'same-token',pos:'양사',pos_all:'동사·명사',text:'本',meaning:'user meaning'});
    const snapshot=JSON.stringify(token);
    const html=render(locale,token);
    expect(html).toContain(`font-weight:700">${t(locale,'양사')}`);
    expect(html).toContain(`opacity:0.5">${t(locale,'동사')}`);
    expect(html).toContain(`opacity:0.5">${t(locale,'명사')}`);
    expect(html.indexOf(`>${t(locale,'양사')}<`)).toBeLessThan(html.indexOf(`>${t(locale,'동사')}<`));
    expect(html).toContain(`title="${t(locale,'이 문장에서는 {pos}로 쓰였어요',{pos:t(locale,'양사')})}"`);
    expect(JSON.stringify(token)).toBe(snapshot);
  });
  it.each(VIEWER_MESSAGE_LOCALES)('continues to hide unknown POS instead of translating arbitrary content in %s',locale=>{
    expect(render(locale,{pos:'학교에'})).toBe('');
    expect(render(locale,{pos:'학교에',pos_all:'학교에·<script>'})).toBe('');
    expect(render(locale,null)).toBe('');
    expect(render(locale,{pos:'동사',pos_all:'동사·喝咖啡'})).toBe(t(locale,'동사'));
  });
  it('localizes multiple canonical POS fragments without changing the stored combined field',()=>{
    const token=Object.freeze({pos:' 동사 · 명사 '});
    expect(render('zh-TW',token)).toBe('動詞·名詞');
    expect(token.pos).toBe(' 동사 · 명사 ');
  });
  it('uses Taiwan terminology for pronouns, prepositions and conjunctions',()=>{
    expect(render('zh-TW',{pos:'대명사'})).toBe('代名詞');
    expect(render('zh-TW',{pos:'전치사'})).toBe('介系詞');
    expect(render('zh-TW',{pos:'접속사'})).toBe('連接詞');
  });
});
