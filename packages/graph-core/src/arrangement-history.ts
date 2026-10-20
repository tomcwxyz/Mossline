/** View-only graph coordinates and bounded undo/redo for manual canvas movement.
 *  None of these functions may mutate imported source nodes or relationships.
 */
export type LayoutPositions = Record<string,{x:number;y:number}>;
export type LayoutHistory = {past:LayoutPositions[];future:LayoutPositions[]};
export const emptyLayoutHistory=():LayoutHistory=>({past:[],future:[]});
const clone=(positions:LayoutPositions):LayoutPositions=>
  Object.fromEntries(Object.entries(positions).map(([id,point])=>[id,{...point}]));
export function sameLayout(a:LayoutPositions,b:LayoutPositions):boolean {
  const ids=Object.keys(a);
  return ids.length===Object.keys(b).length &&
    ids.every(id=>b[id]?.x===a[id].x && b[id]?.y===a[id].y);
}
export function recordLayoutMovement(history:LayoutHistory,
  before:LayoutPositions,after:LayoutPositions):LayoutHistory {
  if(sameLayout(before,after))return history;
  return {past:[...history.past.slice(-19),clone(before)],future:[]};
}
export function undoLayoutMovement(history:LayoutHistory,current:LayoutPositions):
  {history:LayoutHistory;positions:LayoutPositions}|null {
  if(!history.past.length)return null;
  return {positions:clone(history.past[history.past.length-1]),
    history:{past:history.past.slice(0,-1),future:[clone(current),...history.future].slice(0,20)}};
}
export function redoLayoutMovement(history:LayoutHistory,current:LayoutPositions):
  {history:LayoutHistory;positions:LayoutPositions}|null {
  if(!history.future.length)return null;
  return {positions:clone(history.future[0]),
    history:{past:[...history.past.slice(-19),clone(current)],future:history.future.slice(1)}};
}
