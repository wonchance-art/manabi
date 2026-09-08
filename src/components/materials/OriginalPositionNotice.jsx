import {createPortal} from 'react-dom';
import {positionLabel,positionSourceKey} from '@/lib/originalReadingPosition';

export default function OriginalPositionNotice({sync,sources,onAccept}){
 const {state}=sync;
 const available=state.remote&&sources.some(source=>positionSourceKey(source)===state.remote.source_key);
 let text=state.phase==='loading'?'읽던 위치를 확인하고 있어요…':state.phase==='saving'?'읽던 위치를 저장하고 있어요…':state.phase==='offline'?'연결되면 읽던 위치를 다시 동기화할 수 있어요.':state.phase==='unavailable'?'원본이 바뀌었거나 읽던 위치에 접근할 수 없어요.':state.pending?'이 기기의 읽던 위치를 보관했어요.':'읽던 위치가 계정에 저장됩니다.';
 if(state.phase==='conflict')text=available?`다른 곳에서 ${positionLabel(state.remote)}의 위치를 저장했어요.`:'다른 곳에서 읽던 위치가 바뀌었어요.';
 const floating=['conflict','offline','unavailable'].includes(state.phase);
 const content=<aside className={`original-position-notice${state.phase==='conflict'?' is-conflict':''}${floating?' is-floating manabi-app':''}`}  aria-label="읽던 위치 동기화">
  <p aria-live={['conflict','offline','unavailable'].includes(state.phase)?'polite':'off'}>{text}{!state.localAvailable&&state.ready&&<small>이 브라우저에서는 오프라인 위치를 보관할 수 없어요.</small>}</p>
  {state.phase==='conflict'&&<div>{available&&<button type="button" onClick={onAccept}>그곳에서 이어 읽기</button>}<button type="button" onClick={sync.keep}>현재 위치 유지</button></div>}
  {state.phase==='offline'&&<button type="button" onClick={sync.retry}>동기화 다시 시도</button>}
  {state.phase==='unavailable'&&<button type="button" onClick={()=>window.location.reload()}>최신 원본 불러오기</button>}
 </aside>;
 return floating&&typeof document!=='undefined'?<><aside className="original-position-notice" aria-hidden="true"><p>읽던 위치를 확인해 주세요.</p></aside>{createPortal(content,document.body)}</>:content;
}
