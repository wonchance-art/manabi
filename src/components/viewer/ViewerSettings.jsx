'use client';
import {useRef,useState} from 'react';
import ViewerModal from './ViewerModal';
import {fontChoices} from '../../lib/viewerPreferences';
import ViewerPreview from './ViewerPreview';
import {READING_PRESETS,PRESET_META,presetActive,pronRevealAvailable,TTS_RATES} from '../../lib/readingSheet';
import {supportsPatterns} from '../../lib/patternIndex';
import {stepCpm} from '../../lib/readingPacer';

function Toggle({label,note,checked,onChange,disabled=false}) {
  return <label className="reader-setting-toggle"><span><b>{label}</b>{note&&<small>{note}</small>}</span><input type="checkbox" checked={checked} disabled={disabled} onChange={e=>onChange(e.target.checked)}/></label>;
}
function Choices({label,value,items,onChange}) {
  return <div className="reader-setting-choices"><b>{label}</b><div role="group" aria-label={label}>{items.map(([v,name])=><button type="button" key={v} aria-pressed={value===v} onClick={()=>onChange(v)}>{name}</button>)}</div></div>;
}
function Slider({label,value,min,max,step=1,onChange,display}) {
  const set=v=>onChange(Math.max(min,Math.min(max,Math.round(v*10000)/10000)));
  return <div className="reader-setting-range"><label>{label}<output>{display??value}</output><span><button type="button" aria-label={`${label} 줄이기`} disabled={value<=min} onClick={()=>set(value-step)}>−</button><input aria-label={label} type="range" value={value} min={min} max={max} step={step} onChange={e=>set(Number(e.target.value))}/><button type="button" aria-label={`${label} 늘리기`} disabled={value>=max} onClick={()=>set(value+step)}>+</button></span></label></div>;
}
export default function ViewerSettings({settings:s,language,onClose,keepPosition,previewTokens=[],paceTargetCpm,paceEstimate,myCpm,patternNote,ttsSupported,fontStatus,onPreset}) {
  const snapshot=useRef(s.snapshot());
  const [tab,setTab]=useState('type'),[preview,setPreview]=useState(true);
  const set=(key,value)=>keepPosition(()=>s['set'+key[0].toUpperCase()+key.slice(1)](value));
  const tabs=[['type','글자·배경'],['display','학습 표시'],['pace','읽기 진행']];
  const phonetic=language==='Chinese'||language==='Japanese';
  return <ViewerModal title="읽기 설정" onClose={onClose} className="reader-settings" footer={<><button onClick={()=>keepPosition(()=>s.resetTab(tab))}>이 탭 기본값</button><button onClick={()=>keepPosition(()=>s.restore(snapshot.current))}>이번 변경 되돌리기</button></>}>
    <div role="tablist" aria-label="설정 분류" className="reader-settings__tabs" onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const i=tabs.findIndex(([id])=>id===tab);const next=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;setTab(tabs[next][0]);e.currentTarget.children[next].focus();}}>
      {tabs.map(([id,name])=><button key={id} role="tab" id={`reading-tab-${id}`} aria-controls={`reading-pane-${id}`} aria-selected={tab===id} tabIndex={tab===id?0:-1} onClick={()=>setTab(id)}>{name}</button>)}
    </div>
    <button className="reader-preview-toggle" aria-expanded={preview} onClick={()=>setPreview(v=>!v)}>현재 문장 미리보기 {preview?'접기':'펼치기'}</button>
    {preview&&<ViewerPreview settings={s} language={language} tokens={previewTokens}/>}
    {s.storageError&&<p role="status" className="reader-settings__warning">이 브라우저에 저장하지 못했어요. 현재 화면에는 적용되어 있어요.</p>}
    <section role="tabpanel" id={`reading-pane-${tab}`} aria-labelledby={`reading-tab-${tab}`}>
      {tab==='type'&&<>
        <Slider label="본문 크기" value={s.fontSize} min={0.8} max={3} step={0.05} display={`${Math.round(s.fontSize*16)}px`} onChange={v=>set('fontSize',v)}/>
        {language==='Chinese'&&<Slider label="병음 크기" value={s.pinyinSize} min={0.75} max={1} step={0.0625} display={`${Math.round(s.pinyinSize*16)}px`} onChange={v=>set('pinyinSize',v)}/>}
        <Slider label="줄 사이" value={s.lineGap} min={10} max={60} display={`${s.lineGap}px`} onChange={v=>set('lineGap',v)}/>
        <Slider label="글자 사이" value={s.charGap} min={0} max={1} step={0.05} display={`${Math.round(s.charGap*16)}px`} onChange={v=>set('charGap',v)}/>
        <Choices label="서체" value={s.fontFamily} items={fontChoices(language)} onChange={v=>set('fontFamily',v)}/>
        {s.fontFamily==='serif'&&fontStatus!=='ready'&&<p role="status">{fontStatus==='error'?'명조를 불러오지 못해 고딕으로 표시하고 있어요.':'명조 글꼴을 불러오는 중이에요.'}</p>}
        <Choices label="배경" value={s.theme} items={[['light','밝게'],['sepia','종이'],['dark','어둡게']]} onChange={v=>set('theme',v)}/>
      </>}
      {tab==='display'&&<>
        <Choices label="읽기 모드" value={PRESET_META.find(m=>presetActive(m.key,s))?.key||'custom'} items={PRESET_META.map(m=>[m.key,m.name])} onChange={name=>keepPosition(()=>{onPreset?.();s.restore({...READING_PRESETS[name],showToneColors:language==='Chinese'&&READING_PRESETS[name].showToneColors});})}/>
        <p className="reader-setting-note">{PRESET_META.find(m=>presetActive(m.key,s))?'프리셋':'사용자 설정'} · 문장 집중도 함께 바뀝니다. 소리와 자동 진행은 시작하지 않아요.</p>
        {phonetic&&<><Choices label="발음 표기" value={s.pronDisplay} items={[['all','전체'],['unknown','새 단어만'],['none','숨김']]} onChange={v=>set('pronDisplay',v)}/><p className="reader-setting-note">새 단어만: 저장한 단어와 이미 앎 기록의 발음을 가려요.</p><Toggle label="탭하면 발음 보기" note="첫 탭은 발음, 다음 탭은 뜻 카드" checked={s.pronReveal} disabled={!pronRevealAvailable(s.pronDisplay)} onChange={v=>set('pronReveal',v)}/></>}
        <Toggle label="단어 상태" note="새 단어 · 저장한 단어 · 복습할 단어를 구분해요" checked={s.wordStateHl} onChange={v=>set('wordStateHl',v)}/>
        <details><summary>성조·문법·한자 표시</summary>
          {language==='Chinese'&&<><Toggle label="성조 색상" note="병음의 성조 부호는 유지하고 색을 더해요" checked={s.showToneColors} onChange={v=>set('showToneColors',v)}/><Toggle label="한자 대조" note="단어 카드에 한국 한자 훈음을 더해요" checked={s.showHanjaKo} onChange={v=>set('showHanjaKo',v)}/></>}
          {supportsPatterns(language)&&<><Toggle label="문법 표시" note="밑줄은 관련 문형 후보예요. 탭해서 확인하세요." checked={s.showPatterns} onChange={v=>set('showPatterns',v)}/>{s.showPatterns&&<Choices label="문법 표시 범위" value={s.patternFilter} items={[['all','전체'],['due','복습할 것'],['weak','약한 것']]} onChange={v=>set('patternFilter',v)}/>}<p className="reader-setting-note">{patternNote}</p></>}
        </details>
      </>}
      {tab==='pace'&&<>
        <Toggle label="문장 집중" note="읽는 문장을 표시하고 주변 문장도 읽을 수 있게 유지해요" checked={s.focusMode} onChange={v=>set('focusMode',v)}/>
        <Toggle label="자동 진행 허용" note="본문의 ‘자동 진행 시작’을 눌러야 이동해요" checked={s.autoPace} onChange={v=>set('autoPace',v)}/>
        {s.autoPace&&<><div className="reader-setting-choices"><b>목표 속도 · {paceTargetCpm}자/분</b><div><button aria-label="느리게" onClick={()=>s.restore({paceCpm:stepCpm(paceTargetCpm,-1),paceStep:0})}>− 느리게</button><button aria-label="빠르게" onClick={()=>s.restore({paceCpm:stepCpm(paceTargetCpm,1),paceStep:0})}>빠르게 +</button></div></div><details><summary>속도의 기준</summary>{paceEstimate?.thisSec!=null&&<p>이 문장 약 {paceEstimate.thisSec}초</p>}{paceEstimate?.avgSec!=null&&<p>문장 평균 약 {paceEstimate.avgSec}초</p>}<p>{s.paceCpm?'직접 정한 목표':myCpm?`읽기 기록 ${myCpm}자/분 기준 제안`:'이 언어의 기본 목표'} · 훈련 단계 {s.paceStep}</p><p>자동 진행 속도는 읽기 실력이나 이해도 기록이 아니에요.</p><button onClick={()=>s.restore({paceCpm:null,paceStep:0})}>기본 제안으로</button></details></>}
        {ttsSupported&&<><Toggle label="단어 선택 시 발음" checked={s.autoSpeakOnClick} onChange={v=>set('autoSpeakOnClick',v)}/><Choices label="재생 속도" value={s.ttsRate} items={Object.entries(TTS_RATES).map(([key,r])=>[key,r.label])} onChange={v=>set('ttsRate',v)}/></>}
      </>}
    </section>
  </ViewerModal>;
}
