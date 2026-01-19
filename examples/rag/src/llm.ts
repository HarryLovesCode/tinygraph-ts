import "dotenv/config";
import OpenAI from "openai";

export const GRADE_PROMPT = `
You are an expert document grader. You will receive a document and prompt
then decide if the document is relevant to the prompt. Depending on its
relevance, output ONLY YAML with single, boolean field "relevant".

Do NOT use backticks.`;

export const QA_NODE = `
You are an expert question answerer. You will receive several documents
and a question, then determine how the best response to give to the user
grounded in these findings. Respond directly to the user. Be helpful,
detailed, and truthful.`;

const client = new OpenAI({
  baseURL: process.env.OPENAI_BASE_URL,
  apiKey: process.env.OPENAI_API_KEY,
});

export async function llmText(systemPrompt: string, userPrompt: string) {
  const out = await client.chat.completions.create({
    model: process.env.OPENAI_LLM_MODEL!,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  return out.choices[0]?.message.content || "";
}

export async function llmEmbed(input: string[] | string) {
  const inp = Array.isArray(input) ? input : [input];
  const out = await client.embeddings.create({
    input: inp,
    model: process.env.OPENAI_EMBED_MODEL!,
    encoding_format: "float",
  });

  const vec = inp.map((v, i) => ({
    text: v,
    embed: out.data[i]!.embedding,
  }));

  return vec;
}
