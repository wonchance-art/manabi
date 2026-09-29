import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import TeachingWord from '../src/components/classroom/TeachingWord';
import ViewerPreview from '../src/components/viewer/ViewerPreview';
import {viewerDefaults} from '../src/lib/viewerPreferences';
import {highRiskWordCases} from './fixtures/teaching-word-cases.mjs';
import '../src/index.css';
import '../src/components/viewer/reader-controls.css';
import '../src/components/classroom/teaching-word.css';
function Fixture(){const [mask,setMask]=useState(7),[card,setCard]=useState(false);window.setWordQuality=(mask,card)=>{setMask(mask);setCard(card);};const display={showReading:!!(mask&1),showHun:!!(mask&2),showMeaning:!!(mask&4),appearance:card?'card':'plain'};return <main data-mask={mask} data-card={card} style={{padding:16,background:'#f7f5f0',color:'#292d2b','--reader-ink':'#292d2b','--reader-muted':'#68716b','--reader-paper':'#fff','--reader-accent':'#486b59'}}><h1 style={{fontSize:20}}>언어 표시 · 검수용 입력</h1>{highRiskWordCases.map(entry=><section key={entry.id} data-case={entry.id} style={{padding:12,marginBottom:12,background:'#fff',boxShadow:card?'inset 0 0 0 1px #bfc6c0':'none',borderRadius:10}}><h2 style={{fontSize:14,marginBottom:12}}>{entry.id} · {entry.text}</h2><div className="viewer-layout" style={{padding:'24px 0',minHeight:0,height:'auto'}}><ViewerPreview language={entry.language} settings={{...viewerDefaults(entry.language),pronDisplay:display.showReading?'all':'none'}} tokens={[{text:entry.text,furigana:entry.reading}]}/></div><TeachingWord entry={entry} language={entry.language} display={display}/><TeachingWord entry={entry} language={entry.language} display={display} presentation/></section>)}</main>;}
createRoot(document.getElementById('root')).render(<Fixture/>);
