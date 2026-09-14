import {BoardIconButton} from './BoardIcon';
const tools=[['selection','선택'],['freedraw','펜'],['eraser','지우개'],['text','글자'],['arrow','화살표'],['laser','레이저']];
export default function BoardTools({active,style,onTool,onStyle}) {
  return <div className="board-tools" role="toolbar" aria-label="필기 도구">
    <div className="board-icon-grid">{tools.map(([type,label])=><BoardIconButton key={type} icon={type} label={label} aria-pressed={active===type} onClick={()=>onTool(type)}/>)}</div>
    <div className="board-style-options" role="group" aria-label="펜과 선택한 요소의 선 설정">
      <span>색상</span><div>{[['ink','먹색'],['accent','언어 색'],['red','붉은색'],['gold','겨자색']].map(([key,label])=><button type="button" key={key} className={`board-swatch board-swatch--${key}`} aria-label={label} title={label} aria-pressed={style?.color===key} onClick={()=>onStyle('strokeColor',key)}/>)}</div>
      <span>굵기</span><div>{[[1,'가는 선'],[2,'보통 선'],[4,'굵은 선']].map(([value,label])=><button type="button" key={value} aria-label={label} title={label} aria-pressed={style?.width===value} onClick={()=>onStyle('strokeWidth',value)}><svg width="28" height="16" aria-hidden="true"><path d="M2 8h24" stroke="currentColor" strokeWidth={value} strokeLinecap="round"/></svg></button>)}</div>
      <span>도형·이동</span><div>{[['rectangle','네모'],['ellipse','원'],['line','직선'],['hand','화면 이동']].map(([type,label])=><BoardIconButton key={type} icon={type} label={label} aria-pressed={active===type} onClick={()=>onTool(type)}/>)}</div>
    </div>
  </div>;
}
