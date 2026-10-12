'use client';
import {splitRuby} from '../../lib/splitRuby';
import {pronHiddenFor} from '../../lib/readingSheet';
import {pinyinToneClass} from '../../lib/pinyinTone';
import {readerFontFamily} from '../../lib/viewerPreferences';
import {useRef} from 'react';
import {zhKinsokuMarks,zhKinsokuStyle} from '../../lib/zhGrid';
import {ZhText,useZhGridRuns} from './ZhText';

// No token identifiers, handlers or reading observers: this is display-only.
export default function ViewerPreview({settings:s,language,tokens=[]}) {
  const phonetic=language==='Chinese'||language==='Japanese';
  const zh=language==='Chinese',ref=useRef(null);
  useZhGridRuns(ref,zh);
  const example=language==='Korean'?'':language==='Chinese'?'今天一起读书。':language==='Japanese'?'いっしょに読みましょう。':language==='French'?'Lisez à votre rythme.':'Read at your own pace.';
  const shown=tokens.length?tokens:[{text:example}];
  // Same grid as the body (ZH-GRID-001): no gap between words, per-cell spacing, 禁则 hold on closing marks.
  const marks=zh?zhKinsokuMarks(shown.map((_,i)=>i),i=>shown[i]):null;
  return <div ref={ref} className={`reader-settings__preview reader-area--${s.theme}${s.wordStateHl?' reader-area--hl':''}`} lang={language==='Korean'?'ko':language==='Chinese'?'zh-Hans':language==='Japanese'?'ja':language==='French'?'fr':'en'} style={{fontSize:`${s.fontSize}rem`,fontFamily:language==='Korean'?"var(--font-noto-kr, 'Noto Sans KR'), sans-serif":readerFontFamily(language,s.fontFamily),gap:`var(--preview-row-gap) ${zh?0:s.charGap}rem`,'--char-gap':`${s.charGap}rem`,'--pinyin-size':`${s.pinyinSize}rem`,'--preview-row-gap':`max(${s.lineGap}px, var(--hl-row-gap-min, 0px))`,'--preview-rows':s.fontSize>2?1:2}}>
    {shown.map((token,i)=>{
      const segments=phonetic&&token.furigana?splitRuby(token.text,token.furigana):null;
      const hidden=pronHiddenFor(s.pronDisplay,{isSaved:!!token.previewSaved,isKnown:!!token.previewKnown});
      const classes=['word-token',token.previewSaved&&'word-token--saved',token.previewDue&&'word-token--due',s.wordStateHl&&token.previewHighlight,token.previewPicked&&'word-token--picked'].filter(Boolean).join(' ');
      return <span key={i} className={classes} style={zhKinsokuStyle(marks?.get(i))||undefined}><span className={`surface${hidden?' surface--furi-off':''}`}>
        {segments?segments.map((seg,j)=>seg.kanji?<ruby key={j} data-pinyin={seg.pinyin?'1':undefined} data-yomi={seg.pinyin?undefined:'1'}>{zh&&!seg.pinyin?<ZhText text={seg.kanji}/>:seg.kanji}<span className={['rt-an',s.showToneColors&&seg.pinyin?pinyinToneClass(seg.reading):''].filter(Boolean).join(' ')}>{seg.reading}</span></ruby>:zh?<ZhText key={j} text={seg.plain}/>:<span key={j}>{seg.plain}</span>):zh?<ZhText text={token.text}/>:token.text}
      </span></span>;
    })}
  </div>;
}
