import data from "../../../../data/throw-lab/rich-catalogue.json";

/** Source-file examples: always open the actual files through Add data, never a canned picture. */
export type RichLabExample = {
  id:string;title:string;group:string;description:string;
  idealFirstView:string;whatToTry:string;caveat:string;
  files:{name:string;path:string;rows:number;bytes:number}[];
  expectedRecords:number;expectedLinks:number;stats:string;observations:string[];
  geography:{label:string;cities:number;countries:string[]};
};

export const RICH_LAB_EXAMPLES:readonly RichLabExample[]=data.examples;

export function richLabExample(id:string):RichLabExample|undefined {
  return RICH_LAB_EXAMPLES.find(item=>item.id===id);
}
