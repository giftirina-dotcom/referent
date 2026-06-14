import type { ParsedArticle } from "@/lib/parse-article";

export type AiAction = "translate" | "summary" | "theses" | "telegram";

const MAX_CONTENT_LENGTH = 12_000;

const MARKDOWN_FORMAT =
  "Форматируй ответ в Markdown: один заголовок первого уровня (#), подзаголовки (##), абзацы, списки (-). Не используй кодовые блоки.";

const ACTION_INSTRUCTIONS: Record<AiAction, string> = {
  translate: `${MARKDOWN_FORMAT}\n\nПереведи статью на русский язык полностью. Структура ответа:\n# перевод заголовка\n\nтекст перевода абзацами, сохраняя структуру оригинала.`,
  summary: `${MARKDOWN_FORMAT}\n\nПереведи статью на русский язык. Структура ответа:\n# перевод заголовка\n\nтекст перевода абзацами\n\n## О чём статья\n\n2–4 предложения с кратким описанием.`,
  theses: `${MARKDOWN_FORMAT}\n\nПереведи статью на русский язык. Структура ответа:\n# перевод заголовка\n\n## Перевод\n\nтекст перевода абзацами\n\n## Тезисы\n\nмаркированный список ключевых мыслей.`,
  telegram: `${MARKDOWN_FORMAT}\n\nПереведи статью на русский и составь пост для Telegram (до 1000 символов). Структура:\n# цепляющий заголовок\n\nкороткий вводный абзац\n\n- 2–3 ключевых пункта`,
};

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

  return `${payload.slice(0, MAX_CONTENT_LENGTH)}\n\n[Текст обрезан из-за ограничения длины]`;
}

export function buildTranslationMessages(
  article: ParsedArticle,
  action: AiAction,
) {
  const articleText = buildArticlePayload(article);

  if (!articleText.trim()) {
    throw new Error("Не удалось извлечь текст статьи для перевода.");
  }

  return [
    {
      role: "system" as const,
      content:
        "Ты профессиональный переводчик и редактор. Отвечай только на русском языке. Сохраняй смысл оригинала, пиши естественно и понятно. Всегда используй Markdown-разметку.",
    },
    {
      role: "user" as const,
      content: `${ACTION_INSTRUCTIONS[action]}\n\n${articleText}`,
    },
  ];
}
