import {projectUkLocation,readAtlasLocation,
  type GraphDocument} from "@mossline/graph-core";

/** Questions are routes into existing source-backed tools, not AI-generated
 * conclusions or implied claims about what the data proves.
 */
export type ExploreQuestionId="find"|"connections"|"trace"|"places";
export type ExploreQuestion={
  id:ExploreQuestionId;question:string;description:string;
};

/** The large-network worker supports full-source search, but not the
 * in-memory five-hop path form. Never offer a route the current UI hides.
 */
export function exploreQuestions(graph:GraphDocument,workerBacked:boolean):ExploreQuestion[]{
  const questions:ExploreQuestion[]=[{
    id:"find",question:"Who or what is in this network?",
    description:workerBacked?
      "Search the complete source network, including grouped entities.":
      "Find a person, organisation, project or other recorded entity."
  }];
  const organisations=graph.nodes.filter(n=>n.type==="organisation").length;
  if(organisations>=2&&graph.edges.length>0)questions.push({
    id:"connections",question:"Which organisations are connected?",
    description:"Explore recorded links and clearly labelled shared associations."
  });
  if(!workerBacked&&graph.nodes.length>=2&&
    graph.edges.some(edge=>!edge.inferred))questions.push({
    id:"trace",question:"How are two things linked?",
    description:"Follow a path using recorded relationships, not assumptions."
  });
  if(graph.nodes.some(node=>{
    const coordinate=readAtlasLocation(node);
    return coordinate!==null&&projectUkLocation(coordinate)!==null;
  }))questions.push({
    id:"places",question:"Where is this happening?",
    description:"Explore UK locations explicitly recorded in the source data."
  });
  return questions;
}
