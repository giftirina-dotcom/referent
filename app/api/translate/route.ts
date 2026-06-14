import { buildTranslationMessages, type AiAction } from "@/lib/ai-actions";
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

    const messages = buildTranslationMessages(article, action);
    const result = await chatCompletion(messages);

    return NextResponse.json({ result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось перевести статью.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
