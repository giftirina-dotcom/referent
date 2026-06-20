import {
  buildFallbackIllustrationPrompt,
  buildIllustrationPromptMessages,
  normalizeIllustrationPrompt,
} from "@/lib/illustration-prompt";
import { AiServiceError, isAiServiceError, normalizeAiServiceError } from "@/lib/article-errors";
import { generateImageFromPrompt } from "@/lib/huggingface";
import type { ParsedArticle } from "@/lib/parse-article";
import {
  chatCompletion,
  ILLUSTRATION_PROMPT_TIMEOUT_MS,
} from "@/lib/openrouter";
import { NextResponse } from "next/server";

/** Генерация промпта и изображения может занимать несколько минут. */
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      article?: ParsedArticle;
    };
    const article = body.article;

    if (!article?.content && !article?.title) {
      return NextResponse.json(
        { error: "Нет данных статьи для иллюстрации." },
        { status: 400 },
      );
    }

    const messages = buildIllustrationPromptMessages(article);
    let prompt: string;

    try {
      const rawPrompt = await chatCompletion(
        messages,
        undefined,
        ILLUSTRATION_PROMPT_TIMEOUT_MS,
        600,
      );
      prompt = normalizeIllustrationPrompt(rawPrompt);
    } catch (error) {
      const aiError = normalizeAiServiceError(error);
      const canFallback =
        isAiServiceError(error) &&
        aiError.message.includes("не вернул текст ответа");

      if (!canFallback) {
        throw aiError;
      }

      prompt = buildFallbackIllustrationPrompt(article);
    }

    if (!prompt) {
      prompt = buildFallbackIllustrationPrompt(article);
    }

    const { dataUrl, mimeType } = await generateImageFromPrompt(prompt);

    return NextResponse.json({
      prompt,
      image: dataUrl,
      mimeType,
    });
  } catch (error) {
    const aiError = normalizeAiServiceError(error);
    console.error("Illustration route error:", error);

    return NextResponse.json(
      { error: aiError.message, code: "ai_error" },
      { status: 503 },
    );
  }
}
