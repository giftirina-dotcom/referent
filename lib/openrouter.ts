import {
  AiServiceError,
  friendlyAiErrorMessage,
} from "@/lib/article-errors";

const OPENROUTER_URL =
  process.env.OPENAI_BASE_URL?.replace(/\/$/, "") ??
  "https://openrouter.ai/api/v1";

export const DEEPSEEK_MODEL = "deepseek/deepseek-chat-v3-0324";

/** Таймаут ожидания ответа от OpenRouter (мс). */
export const OPENROUTER_TIMEOUT_MS = 120_000;

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

export async function chatCompletion(
  messages: ChatMessage[],
  model = DEEPSEEK_MODEL,
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new AiServiceError(
      friendlyAiErrorMessage(undefined, "OPENROUTER_API_KEY не задан"),
    );
  }

  let response: Response;

  try {
    response = await fetch(`${OPENROUTER_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Referent",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(OPENROUTER_TIMEOUT_MS),
    });
  } catch (error) {
    throw new AiServiceError(
      friendlyAiErrorMessage(undefined, String(error)),
    );
  }

  const data = (await response.json()) as ChatCompletionResponse;

  if (!response.ok) {
    throw new AiServiceError(
      friendlyAiErrorMessage(response.status, data.error?.message),
    );
  }

  const content = data.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new AiServiceError(
      friendlyAiErrorMessage(undefined, "OpenRouter не вернул текст ответа"),
    );
  }

  return content;
}
