import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { Graph } from "tinygraph-ts";

import { initDb } from "./db.js";
import {
  EmbedNode,
  GradeNode,
  QANode,
  RetrieveNode,
  StoreNode,
  type QueryState,
  type StoreState,
} from "./nodes.js";

const app = new Hono();

async function embed(input: string) {
  const graph = new Graph<StoreState>();

  await initDb();
  const inputTrimmed = input
    .toString()
    .split("\n")
    .filter((v) => v)
    .join("\n");

  return await graph
    .node("embed", new EmbedNode("store"))
    .node("store", new StoreNode())
    .edge("embed", "store")
    .setStart("embed")
    .run({
      embed: { documents: [inputTrimmed] },
    });
}

async function retrieve(query: string) {
  const graph = new Graph<QueryState>();
  await initDb();

  return await graph
    .node("embed", new EmbedNode("retrieve"))
    .node("retrieve", new RetrieveNode())
    .node("grader", new GradeNode())
    .node("answer", new QANode())
    .edge("embed", "retrieve")
    .edge("retrieve", "grader")
    .edge("grader", "answer")
    .setStart("embed")
    .run({
      embed: { documents: [query] },
    });
}

app.post("/embed", async (c) => {
  const body = await c.req.parseBody();
  const f = body["file"];

  if (f instanceof File == false) {
    return c.json({ e: "No file uploaded in formdata" });
  }

  const fStr = await f.text();

  return await embed(fStr)
    .then(() => {
      return c.json({ e: "Document embedded successfully" });
    })
    .catch(() => {
      return c.json({ e: "Failed to embed document." });
    });
});

app.get("/query", async (c) => {
  const query = c.req.query("query");
  return await retrieve(query!)
    .then((v) => {
      return c.json({ response: v.llmOut });
    })
    .catch(() => {
      return c.json({ response: "Something went wrong. Try again. " });
    });
});

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => console.log(`Server is running on http://localhost:${info.port}`),
);
