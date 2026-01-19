# TinyGraph-ts - RAG Example

This is an example of how TinyGraph is used to build small systems very rapidly. The example here includes:

- OpenAI Node.js SDK
- PGLite - A handy, embedded Postgres instance that supports `pgvector` extension.
- Hono for a light REST API layer.

## Getting Started

```
cp .env.template .env

# Edit the .env as necessary.

npm install
npm start
```

This will:

- Compile everything.
- Start persistent, local PGLite in the `./db` directory.
- Start the server on `http://localhost:3000`.

In my case, I run LMStudio, so the `.env` needs no modifications other than which embedding models and LLMs you prefer.

## Usage

There are only two endpoints:

- POST `embed` - Accepts `multipart/form-data` with file aptly named `file` in some text format (MD is ideal).
- GET `query` - Accepts a parameter `query`.

## Note

This is meant as an example of capabilities, not a feature-complete reference-set.

- Keeping things simple and fewer dependencies, no tokenizer is used. By default, chunking is based off characters. You can edit the call by finding this symbol: `chunk(text: string, maxChars: number = 2048, overlap: number = 256)`.
- If you use an embedding model that has dimensions different than 384 (which will error), remove the `db` folder, search and modify: `embedding vector(384)` to 768 for example. Re-embed and search.
- Need fewer documents? Search and modify: `LIMIT 10` to whatever you see fit.