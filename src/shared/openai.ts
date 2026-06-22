import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import "dotenv/config";
import { type ZodObject, type ZodRawShape } from "zod";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function llmCall<T extends ZodRawShape>(
  prompt: string,
  schema: ZodObject<T>,
  system?: string,
  model = "gpt-4.1",
): Promise<ReturnType<ZodObject<T>["parse"]>> {
  const messages: OpenAI.ChatCompletionMessageParam[] = [];
  if (system) {
    messages.push({ role: "system", content: system });
  }
  messages.push({ role: "user", content: prompt });

  const response = await client.beta.chat.completions.parse({
    model,
    max_tokens: 4096,
    temperature: 0.1,
    messages,
    response_format: zodResponseFormat(schema, "output"),
  });

  const parsed = response.choices[0].message.parsed;
  if (!parsed) throw new Error("No parsed output in response");
  return parsed;
}
