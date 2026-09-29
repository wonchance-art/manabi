// Isolated synthetic host: no production route imports this file.
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import ViewerMeaningChoices from '../src/components/viewer/ViewerMeaningChoices';
import '../src/index.css';
import '../src/components/web/web-shell.css';
import '../src/components/viewer/reader-controls.css';
const queryClient=new QueryClient({defaultOptions:{queries:{retry:false}}});
function Host(){
 const [value,setValue]=useState({userId:'owner',materialId:'qa-material',tokenId:'id_1_2',word:'东道主',surface:'东道主',meaning:'주최국',pos:'명사',sentence:'今天我请客，我来当东道主。',canApply:true,dictEntry:{meanings:[{meaning:'주최국',pos:'명사'},{meaning:'주인',pos:'명사'}]}});
 window.meaningQA={select:patch=>setValue(current=>({...current,...patch})),invalidate:()=>queryClient.invalidateQueries(),userId:value.userId};
 return <div className="manabi-app"><main className="viewer-layout" style={{'--book-main':'var(--zh)','--book-wash':'var(--bg-secondary)',display:'block'}}><article className="word-detail-card" style={{maxWidth:400,margin:'30px auto',padding:20,background:'var(--reader-paper)'}}>
 <h1 lang="zh-Hans">{value.word}</h1><p data-testid="current-meaning">{value.meaning}</p>
 <ViewerMeaningChoices {...value} onRetryDictionary={()=>setValue(current=>({...current,dictError:false}))} onApply={async(correction,target)=>{
  const response=await fetch('/qa-save',{method:'POST',body:JSON.stringify({correction,target})});if(!response.ok)throw Error('save');
  setValue(current=>({...current,...correction}));
 }}/><button type="button">다음 단어</button></article></main></div>;
}
createRoot(document.getElementById('root')).render(<QueryClientProvider client={queryClient}><Host/></QueryClientProvider>);
