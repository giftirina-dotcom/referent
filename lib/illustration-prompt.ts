import type { ParsedArticle } from "@/lib/parse-article";

const MAX_CONTENT_LENGTH = 12_000;

function buildArticlePayload(article: ParsedArticle) {
  const parts = [
    article.title ? `Title: ${article.title}` : null,
    article.date ? `Date: ${article.date}` : null,
    article.content ? `Content:\n${article.content}` : null,
  ].filter(Boolean);

  const payload = parts.join("\n\n");

  if (payload.length <= MAX_CONTENT_LENGTH) {
    return payload;
  }

  return `${payload.slice(0, MAX_CONTENT_LENGTH)}\n\n[Text truncated due to length limit]`;
}

export function buildIllustrationPromptMessages(article: ParsedArticle) {
  const articleText = buildArticlePayload(article);

  if (!articleText.trim()) {
    throw new Error("Не удалось извлечь текст статьи для иллюстрации.");
  }

  return [
    {
      role: "system" as const,
      content:
        "You are an art director. Based on the article, write one detailed English prompt for a text-to-image model. " +
        "Describe a single scene that captures the article's main theme. Include style, mood, lighting, and composition. " +
        "Reply with the prompt only — no markdown, quotes, labels, or explanations.",
    },
    {
      role: "user" as const,
      content: `Create an image generation prompt for this article:\n\n${articleText}`,
    },
  ];
}

export function normalizeIllustrationPrompt(raw: string): string {
  return raw
    .replace(/^```(?:\w+)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

export function buildFallbackIllustrationPrompt(article: ParsedArticle): string {
  const theme = article.title?.trim() || "current news article";
  return (
    `Editorial illustration capturing the main theme of "${theme}", ` +
    "single symbolic scene, thoughtful atmosphere, cinematic lighting, " +
    "rich colors, detailed digital art, no text, no watermark"
  );
}
