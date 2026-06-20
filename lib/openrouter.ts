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

/** Таймаут OpenRouter для шага «промпт иллюстрации» (мс). */
export const ILLUSTRATION_PROMPT_TIMEOUT_MS = 240_000;

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

type ChatCompletionMessage = {
  content?: string | null | Array<{ type?: string; text?: string }>;
  reasoning?: string | null;
  reasoning_content?: string | null;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: ChatCompletionMessage;
  }>;
  error?: {
    message?: string;
  };
};

function extractMessageContent(message?: ChatCompletionMessage): string | null {
  if (!message) {
    return null;
  }

  if (typeof message.content === "string") {
    const text = message.content.trim();
    if (text) {
      return text;
    }
  }

  if (Array.isArray(message.content)) {
    const text = message.content
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("")
      .trim();

    if (text) {
      return text;
    }
  }

  for (const field of [message.reasoning, message.reasoning_content]) {
    if (typeof field === "string") {
      const text = field.trim();
      if (text) {
        return text;
      }
    }
  }

  return null;
}

/** Лимит по умолчанию: без max_tokens OpenRouter резервирует до 65536 и может вернуть 402. */
export const DEFAULT_MAX_TOKENS = 4096;

async function requestChatCompletion(
  apiKey: string,
  messages: ChatMessage[],
  model: string,
  timeoutMs: number,
  maxTokens: number,
) {
  const response = await fetch(`${OPENROUTER_URL}/chat/completions`, {
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
      max_tokens: maxTokens,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const data = (await response.json()) as ChatCompletionResponse;

  if (!response.ok) {
    throw new AiServiceError(
      friendlyAiErrorMessage(response.status, data.error?.message),
    );
  }

  return extractMessageContent(data.choices?.[0]?.message);
}

export async function chatCompletion(
  messages: ChatMessage[],
  model = DEEPSEEK_MODEL,
  timeoutMs = OPENROUTER_TIMEOUT_MS,
  maxTokens = DEFAULT_MAX_TOKENS,
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new AiServiceError(
      friendlyAiErrorMessage(undefined, "OPENROUTER_API_KEY не задан"),
    );
  }

  try {
    let content = await requestChatCompletion(
      apiKey,
      messages,
      model,
      timeoutMs,
      maxTokens,
    );

    if (!content) {
      content = await requestChatCompletion(
        apiKey,
        messages,
        model,
        timeoutMs,
        maxTokens,
      );
    }

    if (!content) {
      throw new AiServiceError(
        friendlyAiErrorMessage(undefined, "OpenRouter не вернул текст ответа"),
      );
    }

    return content;
  } catch (error) {
    if (error instanceof AiServiceError) {
      throw error;
    }

    throw new AiServiceError(
      friendlyAiErrorMessage(undefined, String(error)),
    );
  }
}
