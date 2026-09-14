const tools=[['selection','선택','M5 3l13 8-6 2-3 6z'],['freedraw','펜','M4 16L15 5l4 4L8 20H4zm9-9 4 4'],['eraser','지우개','m4 14 9-10 7 7-8 9H9zm4 2 4 4M12 20h9'],['text','글자','M5 5h14M12 5v15M8 20h8'],['arrow','화살표','M4 20 20 4M10 4h10v10'],['laser','레이저','M5 19 15 9m-2-5h6v6M4 4v3M2.5 5.5h3']];
export default function BoardTools({active,onTool,onStyle,open,onToggle}) {
  return <div className="board-tools" role="toolbar" aria-label="필기 도구">
    {tools.map(([type,label,path])=><button key={type} type="button" aria-label={label} title={label} aria-pressed={active===type} onClick={()=>onTool(type)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path}/></svg><span>{label}</span></button>)}
    <div className="board-style-picker"><button aria-expanded={open} onClick={onToggle}>선·색</button>{open&&<div className="board-style-options" role="group" aria-label="펜과 선택한 요소의 선 설정">
      <span>색상</span><div>{[['ink','먹색'],['accent','언어 색'],['red','붉은색'],['gold','겨자색']].map(([key,label])=><button key={key} className={`board-swatch board-swatch--${key}`} aria-label={label} onClick={()=>onStyle('strokeColor',key)}/>)}</div>
      <span>굵기</span><div>{[[1,'가는 선'],[2,'보통 선'],[4,'굵은 선']].map(([value,label])=><button key={value} onClick={()=>onStyle('strokeWidth',value)}>{label}</button>)}</div>
      <span>도형</span><div>{[['rectangle','네모'],['ellipse','원'],['line','직선'],['hand','화면 이동']].map(([type,label])=><button key={type} onClick={()=>onTool(type)}>{label}</button>)}</div>
    </div>}</div>
  </div>;
}
