import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";

const db = new PGlite("./db", {
  extensions: { vector },
});

export type SearchResult = {
  id: number;
  text: string;
  embedding: string;
};

export async function initDb() {
  // Register extension
  await db.sql`CREATE EXTENSION IF NOT EXISTS vector`;
  // Init DB
  await db.sql`CREATE TABLE IF NOT EXISTS items (id bigserial PRIMARY KEY, text TEXT, embedding vector(384))`;
  await db.sql`CREATE INDEX ON items USING hnsw (embedding vector_cosine_ops)`;
}

export async function insertEmbedding(text: string, emb: number[]) {
  await db.sql`INSERT INTO items (text, embedding) VALUES (${text}, ${`${JSON.stringify(
    emb,
  )}`})`;
}

export async function searchEmbedding(emb: number[]): Promise<SearchResult[]> {
  const out =
    await db.sql`SELECT * FROM items ORDER BY embedding <-> ${JSON.stringify(
      emb,
    )} LIMIT 10`;

  return out.rows as SearchResult[];
}
