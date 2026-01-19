import { type Ctx, type Node } from "tinygraph-ts";
import YAML from "yaml";

import { insertEmbedding, searchEmbedding, type SearchResult } from "./db.js";
import { GRADE_PROMPT, llmEmbed, llmText, QA_NODE } from "./llm.js";

// For putting embeddings in the vector DB.
export type StoreState = {
  embed: EmbedResult;
};

// For results in/out of the vector DB.
export type QueryState = {
  embed: EmbedResult;
  searchRes?: SearchResult[];
  llmOut?: string;
};

type EmbeddingAndChunk = {
  text: string;
  embed: number[];
};

export type EmbedResult = {
  documents: string[] | string;
  embedded?: EmbeddingAndChunk[];
};

/**
 * Chunks and embed document in PGLite. Can be composed into
 * both store and retrieval workflows.
 *
 * - Outputs to state `embed`
 * - Transitions to constructor parameter `transition`.
 */
export class EmbedNode implements Node<StoreState | QueryState> {
  constructor(private transition: string) {}

  private chunk(text: string, maxChars: number = 2048, overlap: number = 256) {
    let startIndex = 0;
    let chunks: string[] = [];
    const centerLen = maxChars - overlap; // With both overlaps we will exceed maxChars
    const overlapHalf = Math.floor(overlap / 2);

    while (startIndex < text.length) {
      const endIndex = startIndex + centerLen + overlap;

      if (startIndex < 1) {
        chunks.push(text.slice(0, endIndex));
        startIndex = endIndex;
        continue;
      }

      const overlapIdx = Math.max(0, startIndex - overlapHalf);
      const overlapStr = text.substring(overlapIdx, overlapIdx + overlapHalf);
      const nextSpace = overlapStr.indexOf(" ");
      const slice = text.slice(startIndex - overlapHalf + nextSpace, endIndex);
      slice.trim().length > 0 && chunks.push(slice.trim());
      startIndex = endIndex;
    }

    return chunks;
  }

  public async next(state: Ctx<StoreState>) {
    let chunksToEmb: string[] = [];
    for (const doc of state.embed.documents) {
      const chunks = this.chunk(doc);
      if (chunks.length < 1) continue;
      chunksToEmb = [...chunksToEmb, ...chunks];
    }

    const chunks = await llmEmbed(chunksToEmb);
    const embeddings = {
      embedded: chunks,
      documents: state.embed.documents,
    };

    return {
      context: {
        embed: embeddings,
      },
      transition: this.transition,
    };
  }
}

/**
 * Searches PGLite vector DB with embedding of input documents.
 *
 * - Outputs state to `searchRes`.
 * - Transitions to `grader`
 */
export class RetrieveNode implements Node<QueryState> {
  public async next(state: Ctx<QueryState>) {
    const search = state.embed.documents;
    const embedded = await llmEmbed(search);
    const searchRes = await searchEmbedding(embedded[0]!.embed);

    return {
      context: {
        embed: {
          chunks: embedded,
          documents: search,
        },
        searchRes,
      },
      transition: "grader",
    };
  }
}

/**
 * Stores embeddings in PGLite and ends graph.
 */
export class StoreNode implements Node<StoreState> {
  public async next(state: Ctx<StoreState>) {
    for (let emb of state.embed.embedded!) {
      await insertEmbedding(emb.text, emb.embed);
    }
  }
}

/**
 * Uses LLM to grade relevancy on search results.
 *
 * - Output state to `searchRes` which overwrites existing with filtered
 * version by relevance.
 * - Transitions to `answer` (QA Node)
 */
export class GradeNode implements Node<QueryState> {
  public async next(state: Ctx<QueryState>) {
    const prompt = state.embed.documents[0]!;
    const prompts = state.searchRes!.map(
      (d) => `Document:\n${d.text}Prompt:\n${prompt}`,
    );
    const res = await Promise.all(
      prompts.map(async (p) => await llmText(GRADE_PROMPT, p)),
    );
    const parsed: { relevant: boolean }[] = res.map((r) => YAML.parse(r));
    const searchRes = state.searchRes!.filter((_, i) => parsed[i]?.relevant);
    return {
      context: { searchRes },
      transition: "answer",
    };
  }
}

/**
 * Uses LLM to response given graded search results.
 *
 * Outputs to `llmOut`.
 */
export class QANode implements Node<QueryState> {
  public async next(state: Ctx<QueryState>) {
    const userPrompt = state.embed.documents[0]!;
    const docs = state.searchRes!.map((d) => d.text);

    const docsStr = docs.map((d) => `Document:\n${d}\n\n`);
    const output = await llmText(QA_NODE, `${docsStr}\nQuestion:${userPrompt}`);
    return { context: { llmOut: output } };
  }
}
