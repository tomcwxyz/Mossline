"use client";

import type {ExploreQuestion,ExploreQuestionId}
  from "../lib/explore-questions";

/** A compact orientation strip, not a separate explorer. Every choice
 * leads to an existing view or evidence tool for this same source graph.
 */
export function ExploreQuestions({questions,onChoose}:{
  questions:ExploreQuestion[];onChoose:(id:ExploreQuestionId)=>void;
}){
  return <section className="explore-questions" aria-label="Explore by question">
    <div className="explore-questions-heading">
      <h2>What would you like to understand?</h2>
      <p>Choose a question to explore the records you have. No new claims are generated.</p>
    </div>
    <div className="explore-question-options">
      {questions.map(({id,question,description})=>
        <button type="button" key={id} onClick={()=>onChoose(id)}
          aria-label={question}>
          <strong>{question}</strong>
          <span>{description}</span>
          <span className="explore-question-arrow" aria-hidden="true">↗</span>
        </button>)}
    </div>
  </section>;
}
