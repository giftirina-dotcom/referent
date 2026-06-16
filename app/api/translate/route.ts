import { buildTranslationMessages, type AiAction } from "@/lib/ai-actions";
import { AiServiceError } from "@/lib/article-errors";
import type { ParsedArticle } from "@/lib/parse-article";
import { chatCompletion } from "@/lib/openrouter";
import { NextResponse } from "next/server";

const VALID_ACTIONS = new Set<AiAction>([
  "translate",
  "summary",
  "theses",
  "telegram",
]);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      article?: ParsedArticle;
      action?: string;
      sourceUrl?: string;
    };
    const action = body.action as AiAction;
    const article = body.article;

    if (!article?.content && !article?.title) {
      return NextResponse.json(
        { error: "Нет данных статьи для перевода." },
        { status: 400 },
      );
    }

    if (!action || !VALID_ACTIONS.has(action)) {
      return NextResponse.json(
        { error: "Не указано действие." },
        { status: 400 },
      );
    }

    const messages = buildTranslationMessages(article, action, {
      sourceUrl: body.sourceUrl?.trim() || undefined,
    });
    const result = await chatCompletion(messages);

    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof AiServiceError) {
      return NextResponse.json(
        { error: error.message, code: "ai_error" },
        { status: 503 },
      );
    }

    const message =
      error instanceof Error ? error.message : "Не удалось перевести статью.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
