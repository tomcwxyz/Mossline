/**
 * Drag-to-connect recognises an intentional pointer gesture, not an ordinary
 * click or camera pan. This never creates an edit itself: the person still
 * confirms what the connection means in the shared relationship form.
 */
export const CONNECT_DRAG_THRESHOLD = 7;

export function movedToConnect(start:{x:number;y:number},point:{x:number;y:number}) {
  return Math.hypot(point.x-start.x,point.y-start.y)>CONNECT_DRAG_THRESHOLD;
}

export function dragConnection(from:string,to:string|null,moved:boolean,active:boolean) {
  if(!active||!moved||!to||from===to)return null;
  return {from,to};
}
