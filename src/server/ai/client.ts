import "server-only";
import OpenAI from "openai";

export const model = process.env.OPENAI_MODEL ?? "gpt-5-nano";

export function createOpenAIClient(): OpenAI {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}
