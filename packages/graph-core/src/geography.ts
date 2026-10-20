import type { GraphDocument, GraphNode } from "./schema";

/** Source coordinates only. Kumu geo and mapx/mapy are NOT geocoding substitutes. */
export type AtlasCoordinate = {latitude:number;longitude:number};
export type AtlasPlacement = {nodeId:string;label:string;type:GraphNode["type"];latitude:number;longitude:number;x:number;y:number};
export const UK_ATLAS_BOUNDS = {west:-11.5,east:4,south:49,north:60.5} as const;
export const UK_ATLAS_SIZE = {width:960,height:720} as const;

/** Coordinates must be provided explicitly by the data source, never inferred from names.
 *  'Atlas location' takes precedence. Generic CSV/JSON data may use common latitude/longitude columns.
 */
const numericPart=(value:unknown):number|null=>{
  if(typeof value==="number")return Number.isFinite(value)?value:null;
  if(typeof value!=="string"||
    !/^[+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)$/.test(value.trim()))return null;
  const number=Number(value.trim());
  return Number.isFinite(number)?number:null;
};
const coordinatePair=(lat:unknown,lon:unknown):AtlasCoordinate|null=>{
  const latitude=numericPart(lat),longitude=numericPart(lon);
  if(latitude===null||longitude===null||
    latitude < -90||latitude > 90||longitude < -180||longitude > 180)return null;
  return {latitude,longitude};
};
export function readAtlasLocation(node:GraphNode):AtlasCoordinate|null {
  const properties=node.properties??{};
  if(Object.prototype.hasOwnProperty.call(properties,"Atlas location")){
    const value=properties["Atlas location"];
    if(typeof value!=="string")return null;
    const pieces=value.split(",");
    return pieces.length===2?coordinatePair(pieces[0],pieces[1]):null;
  }
  for(const [latitudeField,longitudeField] of [
    ["Latitude","Longitude"],["latitude","longitude"],["lat","lon"],
    ["lat","lng"],["Lat","Lon"],["Lat","Long"]
  ]){
    if(Object.prototype.hasOwnProperty.call(properties,latitudeField) &&
      Object.prototype.hasOwnProperty.call(properties,longitudeField)){
      return coordinatePair(properties[latitudeField],properties[longitudeField]);
    }
  }
  return null;
}

/**
 * An intentionally bounded UK regional projection, using the same projection
 * for the Natural Earth land shapes and source-record pins. Outside-range
 * positions are skipped rather than clipped to misleading boundary points.
 * This atlas is regional and approximate, not a survey-grade basemap.
 */
export function projectUkLocation(coordinate:AtlasCoordinate):{x:number;y:number}|null {
  const {west,east,south,north}=UK_ATLAS_BOUNDS;
  const {latitude,longitude}=coordinate;
  if(latitude<south||latitude>north||longitude<west||longitude>east)return null;
  return {
    x:(longitude-west)/(east-west)*UK_ATLAS_SIZE.width,
    y:(north-latitude)/(north-south)*UK_ATLAS_SIZE.height
  };
}
export type AtlasCoverage = {
  placed:AtlasPlacement[];
  withoutLocation:GraphNode[];
  outsideArea:GraphNode[];
};
/** Never alter or synthesize location data for source records. */
export function buildUkAtlas(graph:GraphDocument):AtlasCoverage {
  const placed:AtlasPlacement[]=[],withoutLocation:GraphNode[]=[],outsideArea:GraphNode[]=[];
  for(const node of graph.nodes){
    const coordinate=readAtlasLocation(node);
    if(!coordinate){withoutLocation.push(node);continue;}
    const position=projectUkLocation(coordinate);
    if(!position){outsideArea.push(node);continue;}
    placed.push({nodeId:node.id,label:node.label,type:node.type,
      ...coordinate,...position});
  }
  return {placed,withoutLocation,outsideArea};
}
