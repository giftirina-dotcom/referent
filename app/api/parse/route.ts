import { fetchAndParseArticle } from "@/lib/parse-article";
import { ArticleUnavailableError } from "@/lib/article-errors";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: string };
    const url = body.url?.trim();

    if (!url) {
      return NextResponse.json(
        { error: "URL не указан." },
        { status: 400 },
      );
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Некорректный URL." },
        { status: 400 },
      );
    }

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return NextResponse.json(
        { error: "Поддерживаются только http:// и https://." },
        { status: 400 },
      );
    }

    const article = await fetchAndParseArticle(parsedUrl.toString());

    return NextResponse.json(article);
  } catch (error) {
    if (error instanceof ArticleUnavailableError) {
      return NextResponse.json(
        { error: error.message, code: "unavailable" },
        { status: 422 },
      );
    }

    const message =
      error instanceof Error ? error.message : "Не удалось распарсить статью.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
