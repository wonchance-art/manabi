'use client';
import {useId,useRef,useState} from 'react';
import ViewerModal from './ViewerModal';
import {fontChoices} from '../../lib/viewerPreferences';
import ViewerPreview from './ViewerPreview';
import {READING_PRESETS,PRESET_META,presetActive,TTS_RATES} from '../../lib/readingSheet';
import {supportsPatterns} from '../../lib/patternIndex';
import {stepCpm} from '../../lib/readingPacer';
import {t,translateViewerText,VIEWER_LOCALE_OPTIONS} from '../../lib/viewerMessages';
import {viewerDefaults} from '../../lib/viewerPreferences';
import {viewerLanguageInfo} from '../../lib/viewerLanguage';

function Icon({name}) {
  const paths={type:'M4 19 10 5l6 14M6 14h8M17 19l3-8 3 8M18 16h4',display:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',pace:'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M8 12h8',detail:'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6',help:'M12 16v.01M9.5 9a2.5 2.5 0 1 1 3.8 2.1c-.9.5-1.3 1-1.3 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20',light:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5',sepia:'M6 3h12v18H6ZM9 8h6M9 12h6M9 16h3',dark:'M20 14a8 8 0 0 1-10-10 8 8 0 1 0 10 10'};
  return <svg className="reader-settings__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]||paths.detail}/></svg>;
}
function Help({children,uiLocale='ko'}) {
  return <details className="reader-settings__help"><summary aria-label={t(uiLocale,'설정 도움말')} title={t(uiLocale,'설정 도움말')}><Icon name="help"/></summary><div>{children}</div></details>;
}
function More({children,uiLocale='ko',count=0}) {
  return <details className="reader-settings__more"><summary><Icon name="detail"/><span>{t(uiLocale,'세부 설정')}</span>{count>0&&<span className="reader-settings__changed" aria-label={t(uiLocale,'{count}개 설정 변경됨',{count})}>{count}</span>}</summary>{children}</details>;
}
// 쓸 수 없는 옵션의 이유 한 줄(AD-R2 Aa) — 컨트롤이 aria-describedby로 가리킨다.
function Reason({id,children}) {
  return <small id={id} className="reader-setting-reason">{children}</small>;
}

// disabled면 저장값과 무관하게 꺼진 채 보인다(「꺼진 채 흐리게」). 저장값은 쓰지 않으므로 그대로 남는다.
function Toggle({label,note,checked,onChange,disabled=false,reason,uiLocale='ko',children}) {
  const reasonId=`${useId()}reason`;
  label=uiLocale==='ko'?label:t(uiLocale,label);
  note=note&&uiLocale!=='ko'?t(uiLocale,note):note;
  return <div className="reader-setting-toggle"><label><b>{label}</b><input aria-label={label} type="checkbox" checked={disabled?false:checked} disabled={disabled} aria-describedby={reason?reasonId:undefined} onChange={e=>onChange(e.target.checked)}/></label>{note&&<Help uiLocale={uiLocale}><small>{note}</small></Help>}{reason&&<Reason id={reasonId}>{reason}</Reason>}{children}</div>;
}
// help(「?」 도움말)는 이름 줄 오른쪽에 둔다 — 따로 한 줄(44px)을 차지하지 않게.
function Choices({label,value,items,onChange,uiLocale='ko',shortLabel,symbols,className='',disabled=false,reason,help}) {
  const reasonId=`${useId()}reason`;
  const fullLabel=uiLocale==='ko'?label:t(uiLocale,label);
  const name=<b>{shortLabel?t(uiLocale,shortLabel):fullLabel}</b>;
  return <div className={`reader-setting-choices ${className}${disabled?' reader-setting-choices--off':''}`}>{help?<div className="reader-setting-choices__head">{name}{help}</div>:name}<div role="group" aria-label={fullLabel} aria-describedby={reason?reasonId:undefined}>{items.map(([v,name])=><button type="button" key={v} aria-label={name} title={name} aria-pressed={value===v} disabled={disabled} onClick={()=>onChange(v)}>{symbols?.[v]??name}</button>)}</div>{reason&&<Reason id={reasonId}>{reason}</Reason>}</div>;
}
function Slider({label,value,min,max,step=1,onChange,display,uiLocale='ko'}) {
  label=uiLocale==='ko'?label:t(uiLocale,label);
  const set=v=>onChange(Math.max(min,Math.min(max,Math.round(v*10000)/10000)));
  return <div className="reader-setting-range"><label>{label}<output>{display??value}</output><span><button type="button" aria-label={t(uiLocale,'{label} 줄이기',{label})} disabled={value<=min} onClick={()=>set(value-step)}>−</button><input aria-label={label} type="range" value={value} min={min} max={max} step={step} onChange={e=>set(Number(e.target.value))}/><button type="button" aria-label={t(uiLocale,'{label} 늘리기',{label})} disabled={value>=max} onClick={()=>set(value+step)}>+</button></span></label></div>;
}
// 언어 선택 상자 — 보이는 짧은 이름(화면·설명)은 접근 이름(화면 언어·설명 언어) 안에 든다.
// 선택지는 화면 언어와 무관한 자기 이름이다(「한국어 · 简体中文 · 繁體中文」).
function LocaleSelect({label,shortLabel,value,onChange,uiLocale,disabled=false,describedBy}) {
  return <label className="reader-setting-select"><span>{t(uiLocale,shortLabel)}</span><select aria-label={t(uiLocale,label)} value={value} disabled={disabled} aria-describedby={describedBy} onChange={e=>onChange(e.target.value)}>{VIEWER_LOCALE_OPTIONS.map(([locale,name])=><option key={locale} value={locale}>{name}</option>)}</select></label>;
}
// 범례는 옵션이 꺼져 있어도 보인다(켜기 전에 무엇이 보일지 알려 준다). 상태 견본은 본문과 같은 클래스를
// 「단어 상태」 범위(reader-area--hl)에서 그린다 — 본문 표시 규칙이 바뀌면 범례도 같이 바뀐다.
function StateLegend({theme,uiLocale}) {
  return <p className={`reader-settings__legend reader-area--${theme} reader-area--hl`}>{[['new','새 단어'],['saved','학습 중'],['due','복습']].map(([state,label])=><span key={state} className={`word-token word-token--${state}`}><span className="surface">{t(uiLocale,label)}</span></span>)}</p>;
}
function ToneLegend({uiLocale}) {
  return <p className="reader-settings__tones">{['ā','á','ǎ','à'].map((mark,i)=><span key={mark}><span className={`rt-an pinyin-tone--${i+1}`}>{mark}</span>{t(uiLocale,'{tone}성',{tone:i+1})}</span>)}</p>;
}
// A text slot keeps the Korean JSX default while other locales use one whole message.
function LocaleText({uiLocale='ko',message,values,children}) {
  return uiLocale==='ko'?children:t(uiLocale,message,values);
}
export default function ViewerSettings({settings:s,language,languageSettings,onClose,keepPosition,previewTokens=[],paceTargetCpm,paceEstimate,myCpm,patternNote,ttsSupported,fontStatus,initialTab='type'}) {
  const snapshot=useRef(s.snapshot());
  const localeSnapshot=useRef(languageSettings?{uiLocale:languageSettings.uiLocale,explanationLocale:languageSettings.explanationLocale}:null);
  const [tab,setTab]=useState(initialTab),[preview,setPreview]=useState(true);
  const explanationReasonId=`${useId()}reason`;
  const uiLocale=languageSettings?.uiLocale||'ko';
  const tr=(key,values)=>t(uiLocale,key,values);
  const choices=items=>items.map(([value,label])=>[value,translateViewerText(uiLocale,label)]);
  const set=(key,value)=>keepPosition(()=>s['set'+key[0].toUpperCase()+key.slice(1)](value));
  const undo=()=>keepPosition(()=>{s.restore(snapshot.current);if(localeSnapshot.current){languageSettings.setUiLocale(localeSnapshot.current.uiLocale);languageSettings.setExplanationLocale(localeSnapshot.current.explanationLocale);}});
  const tabs=[['type',tr('글자·배경')],['display',tr('학습 표시')],['pace',tr('읽기 진행')]];
  const tabNames={type:tr('글자'),display:tr('표시'),pace:tr('읽기')};
  const defaults=viewerDefaults(language);
  const changed=keys=>keys.filter(key=>s[key]!==defaults[key]).length;
  const phonetic=language==='Chinese'||language==='Japanese';
  // 설명 언어가 하나뿐인 자료(중국어·일본어 등은 한국어 설명만)는 설명 상자를 꺼진 채 실제로 쓰는 언어를 보인다
  // (ViewerPage effectiveExplanationLocale과 같은 판정). 저장된 설명 언어는 쓰지 않으므로 그대로 남는다.
  const explanationLocales=viewerLanguageInfo(language)?.explanationLocales??['ko'];
  const singleExplanation=explanationLocales.length<2;
  const shownExplanation=explanationLocales.includes(languageSettings?.explanationLocale)?languageSettings.explanationLocale:'ko';
  const paceBasis=s.paceCpm?tr('직접 정한 목표'):myCpm?(uiLocale==='ko'?`읽기 기록 ${myCpm}자/분 기준 제안`:tr('읽기 기록 {cpm}자/분 기준 제안',{cpm:myCpm})):tr('이 언어의 기본 목표');
  return <ViewerModal uiLocale={uiLocale} title={tr('읽기 설정')} onClose={onClose} className="reader-settings" footer={<><button type="button" onClick={()=>keepPosition(()=>s.resetTab(tab))}>{tr('이 탭 기본값')}</button><button type="button" onClick={undo}>{tr('이번 변경 되돌리기')}</button></>}>
    <div role="tablist" aria-label={tr('설정 분류')} className="reader-settings__tabs" onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const i=tabs.findIndex(([id])=>id===tab);const next=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;setTab(tabs[next][0]);e.currentTarget.children[next].focus();}}>
      {tabs.map(([id,name])=><button key={id} role="tab" aria-label={name} title={name} id={`reading-tab-${id}`} aria-controls={`reading-pane-${id}`} aria-selected={tab===id} tabIndex={tab===id?0:-1} onClick={()=>setTab(id)}><Icon name={id}/><span>{tabNames[id]}</span></button>)}
    </div>
    <button className="reader-preview-toggle" aria-label={tr('현재 문장 미리보기 {action}',{action:tr(preview?'접기':'펼치기')})} title={tr('현재 문장 미리보기 {action}',{action:tr(preview?'접기':'펼치기')})} aria-expanded={preview} onClick={()=>setPreview(v=>!v)}><Icon name="display"/></button>
    {preview&&<ViewerPreview settings={s} language={language} tokens={previewTokens}/>}
    {(s.storageError||languageSettings?.storageError)&&<p role="status" className="reader-settings__warning">{tr('이 브라우저에 저장하지 못했어요. 현재 화면에는 적용되어 있어요.')}</p>}
    <section role="tabpanel" id={`reading-pane-${tab}`} aria-labelledby={`reading-tab-${tab}`}>
      {tab==='type'&&<>
        <Slider uiLocale={uiLocale} label="본문 크기" value={s.fontSize} min={0.8} max={3} step={0.05} display={`${Math.round(s.fontSize*16)}px`} onChange={v=>set('fontSize',v)}/>
        <Choices label="배경" className="reader-settings__themes" symbols={Object.fromEntries(['light','sepia','dark'].map(name=>[name,<Icon key={name} name={name}/>]))} uiLocale={uiLocale} value={s.theme} items={choices([['light','밝게'],['sepia','종이'],['dark','어둡게']])} onChange={v=>set('theme',v)}/>
        {s.fontFamily==='serif'&&fontStatus!=='ready'&&<p role="status">{tr(fontStatus==='error'?'명조를 불러오지 못해 고딕으로 표시하고 있어요.':'명조 글꼴을 불러오는 중이에요.')}</p>}
        <More uiLocale={uiLocale} count={changed(['pinyinSize','lineGap','charGap','fontFamily'])}>
        {language==='Chinese'&&<Slider uiLocale={uiLocale} label="병음 크기" value={s.pinyinSize} min={0.75} max={1} step={0.0625} display={`${Math.round(s.pinyinSize*16)}px`} onChange={v=>set('pinyinSize',v)}/>}
        <Slider uiLocale={uiLocale} label="줄 사이" value={s.lineGap} min={10} max={60} display={`${s.lineGap}px`} onChange={v=>set('lineGap',v)}/>
        <Slider uiLocale={uiLocale} label="글자 사이" value={s.charGap} min={0} max={1} step={0.05} display={`${Math.round(s.charGap*16)}px`} onChange={v=>set('charGap',v)}/>
        <Choices label="서체" uiLocale={uiLocale} value={s.fontFamily} items={choices(fontChoices(language))} onChange={v=>set('fontFamily',v)}/>
        </More>
      </>}
      {/* 「표시」 탭은 평평하다 — 접힌 묶음 없이 모든 옵션과 범례를 펼쳐 두고, 맨 아래에 언어 선택 상자 둘(AD-R2 Aa). */}
      {tab==='display'&&<>
        <Choices label="읽기 모드" uiLocale={uiLocale} value={PRESET_META.find(m=>presetActive(m.key,s))?.key||'custom'} items={choices(PRESET_META.map(m=>[m.key,m.name]))} onChange={name=>keepPosition(()=>{s.restore({...READING_PRESETS[name],showToneColors:language==='Chinese'&&READING_PRESETS[name].showToneColors});})}
          help={<Help uiLocale={uiLocale}><p className="reader-setting-note">{tr('{preset} · 문장 집중도 함께 바뀝니다. 소리와 자동 진행은 시작하지 않아요.',{preset:tr(PRESET_META.find(m=>presetActive(m.key,s))?'프리셋':'사용자 설정')})}</p></Help>}/>
        {phonetic&&<Choices label="발음 표기" uiLocale={uiLocale} value={s.pronDisplay} items={choices([['all','전체'],['unknown','새 단어만'],['none','숨김']])} onChange={v=>set('pronDisplay',v)}
          help={<Help uiLocale={uiLocale}><p className="reader-setting-note">{tr('새 단어만: 저장한 단어와 이미 앎 기록의 발음을 가려요.')}</p></Help>}/>}
        <Toggle label="단어 상태" uiLocale={uiLocale} note="새 단어는 파란 밑줄, 저장한 단어 · 복습할 단어는 색 띠로 구분해요" checked={s.wordStateHl} onChange={v=>set('wordStateHl',v)}><StateLegend theme={s.theme} uiLocale={uiLocale}/></Toggle>
        {/* 성조 색상은 발음을 숨겨도 단어창 표제어·글자 탐색 병음을 칠하므로 쓸 수 있는 옵션이다. */}
        {language==='Chinese'&&<><Toggle label="성조 색상" uiLocale={uiLocale} note="병음의 성조 부호는 유지하고 색을 더해요" checked={s.showToneColors} onChange={v=>set('showToneColors',v)}><ToneLegend uiLocale={uiLocale}/></Toggle><Toggle label="한자 대조" uiLocale={uiLocale} note="단어 카드에 한국 한자 훈음을 더해요" checked={s.showHanjaKo} onChange={v=>set('showHanjaKo',v)}/></>}
        {supportsPatterns(language)
          ?<><Toggle label="문법 표시" uiLocale={uiLocale} note="회색 밑줄은 관련 문형 후보예요. 탭해서 확인하세요." checked={s.showPatterns} onChange={v=>set('showPatterns',v)}/><Choices label="문법 표시 범위" uiLocale={uiLocale} value={s.patternFilter} items={choices([['all','전체'],['due','복습할 것'],['weak','약한 것']])} onChange={v=>set('patternFilter',v)} disabled={!s.showPatterns} reason={s.showPatterns?null:tr('문법 표시를 켜면 고를 수 있어요')}/><p className="reader-setting-note">{translateViewerText(uiLocale,patternNote)}</p></>
          :<Toggle label="문법 표시" uiLocale={uiLocale} checked={false} disabled reason={tr('이 언어는 아직 문형 자료가 없어요')} onChange={()=>{}}/>}
        {languageSettings&&<section className="reader-settings__languages" aria-label={tr('언어 설정')}>
          <div className="reader-settings__language-row">
            <LocaleSelect label="화면 언어" shortLabel="화면" uiLocale={uiLocale} value={uiLocale} onChange={value=>keepPosition(()=>languageSettings.setUiLocale(value))}/>
            <LocaleSelect label="설명 언어" shortLabel="설명" uiLocale={uiLocale} value={shownExplanation} disabled={singleExplanation} describedBy={singleExplanation?explanationReasonId:undefined} onChange={value=>keepPosition(()=>languageSettings.setExplanationLocale(value))}/>
          </div>
          {singleExplanation&&<Reason id={explanationReasonId}>{tr('이 자료의 설명 언어는 한국어로 제공돼요.')}</Reason>}
        </section>}
      </>}
      {tab==='pace'&&<>
        <Toggle label="문장 집중" uiLocale={uiLocale} note="읽는 문장은 선명하게, 주변 문장은 흐리게 표시해요" checked={s.focusMode} onChange={v=>set('focusMode',v)}/>
        {ttsSupported&&<Choices label="재생 속도" className="reader-settings__rates" uiLocale={uiLocale} value={s.ttsRate} items={Object.entries(TTS_RATES).map(([key,r])=>[key,r.label])} onChange={v=>set('ttsRate',v)}/>}
        <More uiLocale={uiLocale} count={changed(['autoPace','paceCpm','paceStep','autoSpeakOnClick'])}>
        <Toggle label="자동 진행 허용" uiLocale={uiLocale} note="본문의 ‘자동 진행 시작’을 눌러야 이동해요" checked={s.autoPace} onChange={v=>set('autoPace',v)}/>
        {s.autoPace&&<><div className="reader-setting-choices"><b>{tr('목표 속도 · {cpm}자/분',{cpm:paceTargetCpm})}</b><div><button aria-label={tr('느리게')} onClick={()=>s.restore({paceCpm:stepCpm(paceTargetCpm,-1),paceStep:0})}>− {tr('느리게')}</button><button aria-label={tr('빠르게')} onClick={()=>s.restore({paceCpm:stepCpm(paceTargetCpm,1),paceStep:0})}>{tr('빠르게')} +</button></div></div><details><summary>{tr('속도의 기준')}</summary>{paceEstimate?.thisSec!=null&&<p>{tr('이 문장 약 {seconds}초',{seconds:paceEstimate.thisSec})}</p>}{paceEstimate?.avgSec!=null&&<p>{tr('문장 평균 약 {seconds}초',{seconds:paceEstimate.avgSec})}</p>}<p><LocaleText uiLocale={uiLocale} message="{basis} · 훈련 단계 {step}" values={{basis:paceBasis,step:s.paceStep}}>{paceBasis} · 훈련 단계 {s.paceStep}</LocaleText></p><p>{tr('자동 진행 속도는 읽기 실력이나 이해도 기록이 아니에요.')}</p><button onClick={()=>s.restore({paceCpm:null,paceStep:0})}>{tr('기본 제안으로')}</button></details></>}
        {ttsSupported&&<Toggle label="단어 선택 시 발음" uiLocale={uiLocale} checked={s.autoSpeakOnClick} onChange={v=>set('autoSpeakOnClick',v)}/>}
        </More>
      </>}
    </section>
  </ViewerModal>;
}
