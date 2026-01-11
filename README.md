# TinyGraph

TL;DR: [Skip to example](#example).

Feel free to fork and modify as you see fit (MIT baby). No hard feelings if this doesn't float your boat. 
The idea is to have something good enough for prod, but fast enough for POC.

## Background

This project exists out of the sheer frustration from overengineering. At this point, I have had more projects than I can count on one hand that require at a minimum, a **directed graph**. Time and time again this has caused my teams, and myself, to search for libraries that implement robust solutions that often add additional infrastructure, maintenance, code/technical debt, money, etc. The idea behind this project is so have a stupidly simple API you can keep in your head and that can serve as a starting point for any additional requirements you may have.

- Want to build a persistent pipeline? Get to it.
- Want to use LLMs? No issue, just add a `callLLM` method.
- Port to another language? Even tiny LLMs can one-shot this.
- Want to use agents? Cool, pass the available transitions to your LLM and have it determine where to go.
- Want a diagram? Add a small method to output to Mermaid.
- Want a more out-of-the-box capable tool? Be my guest.

## API

Again, the API is dead simple. However, it is opinionated.

In terms of public API:

- `Graph<T>` - Takes a generic of the graph state.
- `node(name, Node)` - Adds a node to the graph.
- `edge(name1, name2)` - Creates an unidirectional edge from `name1` to `name2`.
- `setStart(name)` - Sets entry point. Runs after all nodes are added.
- `run(initialCtx?)` - Runs until a node outputs no transition or error occurs.

Each `Node` implements one function: `next` which can accept the current context and available transitions.

**Optional**:
- `step(ctx?)` - Steps through graph call by call. Pass initial context, recommended only for debugging.]

### Note

This library has one dependency: `debug`. Use `DEBUG=graph node <your command>` if you want to see internal operations of the graph.

### Opinionated Design

1. Nodes patch state. You only output what you need to mutate. I shouldn't have `...state` everywhere.
2. Nodes are object-oriented rather than functional. This lends well to separating into separate files. Feel free to add any helper methods.
3. If you do not return anything, the graph is complete. I am an advocate for, "your framework should not save you." You throw an error? You get its output. I should not have to *add* traceability to see my own code execution results.
4. Edges are explicit by string. It may seem verbose, but I would prefer verbose and readable over opaque abstractions/helpers.
5. Bound by generic of the graph state. Some people hate `?` and `!`, but you should know when something exists versus something *may* exist.


## Example

```ts
import { Graph, type Node, type Ctx } from "./index.js";

// fetch.ts
class FetchNode implements Node<State> {
  async next(state: Ctx<State>) {
    console.log("Made to fetch!");
    const r = await fetch(state.site as string).then((response) =>
      response.json()
    );

    return {
      context: { json: r },
      transition: "log",
    };
  }
}
// log.ts
class LogNode implements Node<State> {
  async next(state: Ctx<State>) {
    console.log(`User ID: ${state.json?.userId}`);
    // Note: No transition returned, ends the graph here.
  }
}
// index.ts
// Define type-safe graph. `site` is required to run so it is guranteed to exist,
// but the result is *not* if an error occurs or `FetchNode` has not been run.
type State = {
  json?: {
    userId: number;
    id: number;
    title: string;
    completed: boolean;
  };
  site: string;
};

const graphRes = new Graph<State>()
  .node("fetch", new FetchNode())
  .node("log", new LogNode())
  .edge("fetch", "log")
  .setStart("fetch")
  .run({ site: "https://jsonplaceholder.typicode.com/todos/1" });

console.log(await graphRes);

```