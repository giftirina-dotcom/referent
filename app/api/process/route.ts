import { buildTranslationMessages, type AiAction } from "@/lib/ai-actions";
import { chatCompletion } from "@/lib/openrouter";
import { fetchAndParseArticle } from "@/lib/parse-article";
import { NextResponse } from "next/server";

const VALID_ACTIONS = new Set<AiAction>(["summary", "theses", "telegram"]);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: string; action?: string };
    const url = body.url?.trim();
    const action = body.action as AiAction;

    if (!url) {
      return NextResponse.json({ error: "URL не указан." }, { status: 400 });
    }

    if (!action || !VALID_ACTIONS.has(action)) {
      return NextResponse.json(
        { error: "Не указано действие." },
        { status: 400 },
      );
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: "Некорректный URL." }, { status: 400 });
    }

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return NextResponse.json(
        { error: "Поддерживаются только http:// и https://." },
        { status: 400 },
      );
    }

    const article = await fetchAndParseArticle(parsedUrl.toString());
    const messages = buildTranslationMessages(article, action);
    const result = await chatCompletion(messages);

    return NextResponse.json({ result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось обработать статью.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
