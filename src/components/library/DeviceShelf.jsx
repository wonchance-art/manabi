'use client';
// 끊긴 서재의 「이 기기에 받아 둔 자료」(OFFLINE-SWEEP-001 P1, 2026-10-24 KST). 끊긴 채 연 서재는 읽던 곳 · 폴더 · 목록 세 칸이 모두
// 「불러오지 못했어요」였고, 이 기기에 남은 자료(뷰어 자동 기록 · 받아두기)로 갈 길이 없었다(주소를 알면 뷰어는 기기 사본으로 열렸다).
// 그 세 칸 대신 지금 계정의 기기 사본 목록(listDeviceMaterials — 계정 경계 OFFLINE-ACCOUNT-SCOPE-001)과 실패 안내 한 줄을 보인다.
// 행은 서재 행과 같은 모양 · 같은 링크(LibraryReaderLink → 뷰어 → fetchMaterial의 기기 사본 폴백)다 — 새 여는 길을 만들지 않는다.
// 팀 사본(sharedStore · local:)은 팀 페이지가 끊긴 채 자기 목록을 보여 준다(「오프라인 — 받아 둔 사본만 열려요.」) — 여기서 다시 모으지 않는다.
import {useEffect,useState,useSyncExternalStore} from 'react';
import {langNameKo} from '@/lib/constants';
import {encounterLookupLang} from '@/lib/refVocabLookup';
import {listDeviceMaterials} from '@/lib/offlineCache';
import {isNetworkError} from '@/lib/errorMessage';
import LibraryReaderLink from '@/components/web/LibraryReaderLink';
import {LibraryCover} from './LibraryRow';

function subscribeOnline(change){
 window.addEventListener('online',change);window.addEventListener('offline',change);
 return()=>{window.removeEventListener('online',change);window.removeEventListener('offline',change);};
}
/** 브라우저가 끊겼다고 말하나(navigator.onLine === false). 서버 그림 · 첫 하이드레이션은 연결됨으로 본다(같은 트리). */
export function useBrowserOffline(){
 return useSyncExternalStore(subscribeOnline,()=>navigator.onLine===false,()=>false);
}

/**
 * 세 칸 대신 이 목록을 보일까(목록 쿼리 결과 · 브라우저 끊김). 그릴 목록이 없을 때만 — 받아 둔 목록이 있는 채 끊기면 그대로 둔다(연결된 화면 ·
 * CLS 무변화). 브라우저가 끊겼다고 하면 첫 받기 실패를 기다리지 않고, 「연결됨」인데 응답을 못 받은 실패(거짓 연결)도 같은 목록으로 간다.
 */
export function deviceShelfShown(list,offline){
 return !list.data&&(offline||(!!list.isError&&isNetworkError(list.error)));
}

/** 목록 그림(rows: null = 기기 기록을 읽는 중). */
export function DeviceShelfView({rows,onRetry}){
 return <>
  <section className="shelf-device" aria-labelledby="shelf-device-title">
   <div className="shelf-section-heading"><h2 id="shelf-device-title">이 기기에 받아 둔 자료</h2></div>
   {rows?.length>0&&<><ul className="shelf-rows">{rows.map(row=><li key={String(row.id)} className="shelf-row"><div className="shelf-row-main"><LibraryReaderLink className="shelf-row-link" href={`/viewer/${encodeURIComponent(row.id)}`}><LibraryCover row={{language:row.language,target_kind:'material'}}/><div className="shelf-row-copy"><h3 lang={encounterLookupLang(row.language)||undefined}>{row.title||'제목 없는 자료'}</h3><small>{row.language?langNameKo(row.language):'언어 미지정'} · {row.pinned?'받아둠':'최근 연 자료'}</small></div></LibraryReaderLink></div></li>)}</ul><p className="shelf-muted">연결 없이 열 수 있어요.</p></>}
   {rows&&!rows.length&&<p className="shelf-muted">아직 이 기기에 받아 둔 자료가 없어요. 연결된 동안 연 자료는 이 기기에 남아요.</p>}
  </section>
  <div className="shelf-query-error" role="status"><p>서재 목록을 불러오지 못했어요. 연결되면 다시 불러와요.</p><button onClick={onRetry}>다시 시도</button></div>
 </>;
}

export default function DeviceShelf({ownerId,onRetry}){
 const [rows,setRows]=useState(null);
 useEffect(()=>{let alive=true;listDeviceMaterials(ownerId).then(list=>{if(alive)setRows(list);});return()=>{alive=false;};},[ownerId]);
 return <DeviceShelfView rows={rows} onRetry={onRetry}/>;
}
