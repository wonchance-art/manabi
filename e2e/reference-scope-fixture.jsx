// Standalone test host; never imported by a production route.
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import ViewerJapaneseReference from '../src/components/viewer/ViewerJapaneseReference';
const queryClient=new QueryClient({defaultOptions:{queries:{retry:false}}});
function Host(){
 const [value,setValue]=useState({userId:'teacher',word:'研究',meaning:'연구',pos:'명사',jaTable:{}});
 window.selectReference=patch=>setValue(current=>({...current,...patch}));
 return <main><h1>{value.word} · {value.meaning} · {value.pos}</h1><ViewerJapaneseReference {...value}/></main>;
}
createRoot(document.getElementById('root')).render(<QueryClientProvider client={queryClient}><Host/></QueryClientProvider>);
