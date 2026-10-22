import type {Core} from "cytoscape";

/** Shared navigation behaviour for the two Cytoscape-based network views.
 * The full WebGL/canvas renderer has a different camera model and remains
 * independent until a viewport adapter can respect its large-graph limits.
 */
export const VIEWPORT_BUTTON_ZOOM_FACTOR=1.3;

export function nextViewportZoom(
  current:number,factor:number,min:number,max:number
):number{
  if(!Number.isFinite(current)||!Number.isFinite(factor)||factor<=0||
    !Number.isFinite(min)||!Number.isFinite(max)||min<=0||max<min)
    throw Error("Invalid graph viewport zoom");
  return Math.min(max,Math.max(min,current*factor));
}
export function centreViewportPan(
  point:{x:number;y:number},width:number,height:number,zoom:number
):{x:number;y:number}{
  return {x:width/2-point.x*zoom,y:height/2-point.y*zoom};
}

/** Preserve the mouse-free zoom controls in both small and grouped networks. */
export function zoomCytoscapeAtCentre(cy:Core,factor:number):void{
  const level=nextViewportZoom(cy.zoom(),factor,cy.minZoom(),cy.maxZoom());
  cy.zoom({level,renderedPosition:{x:cy.width()/2,y:cy.height()/2}});
}

/** Select an entity by bringing it into view without modifying graph data.
 * Call only for a *new* selection, not on every graph repaint or zoom gesture.
 */
export function focusCytoscapeNode(
  cy:Core,id:string,desiredZoom=1.6,duration=280
):boolean{
  const node=cy.getElementById(id);
  if(!node.length)return false;
  const point=node.position();
  const zoom=Math.max(cy.zoom(),Math.min(desiredZoom,cy.maxZoom()));
  cy.stop();
  cy.animate({pan:centreViewportPan(point,cy.width(),cy.height(),zoom),zoom},{duration});
  return true;
}
