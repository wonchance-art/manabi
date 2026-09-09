'use client';
import {splitRuby} from '../../lib/splitRuby';
import {pronHiddenFor} from '../../lib/readingSheet';
import {pinyinToneClass} from '../../lib/pinyinTone';
import {readerFontFamily} from '../../lib/viewerPreferences';

// No token identifiers, handlers or reading observers: this is display-only.
export default function ViewerPreview({settings:s,language,tokens=[]}) {
  const phonetic=language==='Chinese'||language==='Japanese';
  const example=language==='Chinese'?'今天一起读书。':language==='Japanese'?'いっしょに読みましょう。':language==='French'?'Lisez à votre rythme.':'Read at your own pace.';
  return <div className={`reader-settings__preview reader-area--${s.theme}${s.wordStateHl?' reader-area--hl':''}`} lang={language==='Chinese'?'zh-Hans':language==='Japanese'?'ja':language==='French'?'fr':'en'} style={{fontSize:`${s.fontSize}rem`,fontFamily:readerFontFamily(language,s.fontFamily),gap:`${s.lineGap}px ${s.charGap}rem`,'--char-gap':`${s.charGap}rem`,'--pinyin-size':`${s.pinyinSize}rem`}}>
    {(tokens.length?tokens:[{text:example}]).map((token,i)=>{
      const segments=phonetic&&token.furigana?splitRuby(token.text,token.furigana):null;
      const hidden=pronHiddenFor(s.pronDisplay,{isSaved:!!token.previewSaved,isKnown:!!token.previewKnown});
      const classes=['word-token',token.previewSaved&&'word-token--saved',token.previewDue&&'word-token--due',s.wordStateHl&&token.previewHighlight,token.previewPicked&&'word-token--picked'].filter(Boolean).join(' ');
      return <span key={i} className={classes}><span className={`surface${hidden?' surface--furi-off':''}`}>
        {segments?segments.map((seg,j)=>seg.kanji?<ruby key={j} data-pinyin={seg.pinyin?'1':undefined} data-yomi={seg.pinyin?undefined:'1'}>{seg.kanji}<span className={['rt-an',s.showToneColors&&seg.pinyin?pinyinToneClass(seg.reading):''].filter(Boolean).join(' ')}>{seg.reading}</span></ruby>:<span key={j}>{seg.plain}</span>):token.text}
      </span></span>;
    })}
  </div>;
}
