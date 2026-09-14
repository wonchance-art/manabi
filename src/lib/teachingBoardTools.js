const QUICK_TOOLS=new Set(['selection','freedraw','eraser']);

// A first tap always selects a tool. Repeating it opens its settings, except
// when returning from the textbook: that tap should reveal the usable board.
export function quickBoardToolAction(tool,{activeTool,layout,menu}) {
  if(!QUICK_TOOLS.has(tool))return null;
  if(layout==='reader'||activeTool!==tool)return 'select';
  return menu==='tools'?'close':'settings';
}
