import type { ParsedArticle } from "@/lib/parse-article";

export type AiAction = "translate" | "summary" | "theses" | "telegram";

const MAX_CONTENT_LENGTH = 12_000;

const MARKDOWN_FORMAT =
  "Форматируй ответ в Markdown: один заголовок первого уровня (#), подзаголовки (##), абзацы, списки (-). Не используй кодовые блоки.";

const ACTION_LABELS: Record<AiAction, string> = {
  translate: "Полный перевод",
  summary: "Краткое содержание",
  theses: "Тезисы",
  telegram: "Пост для Telegram",
};

const SYSTEM_PROMPTS: Record<AiAction, string> = {
  translate:
    "Ты профессиональный переводчик. Переводи статью полностью на русский язык. Отвечай только переводом, без комментариев.",
  summary:
    "Ты редактор. Сделай краткий пересказ статьи на русском языке. НЕ переводи статью целиком — только сжатое изложение смысла. Отвечай только кратким содержанием.",
  theses:
    "Ты редактор. Выдели ключевые тезисы статьи на русском языке. НЕ переводи и не пересказывай статью целиком — только список главных мыслей. Отвечай только тезисами.",
  telegram:
    "Ты SMM-редактор. Напиши готовый пост для публикации в Telegram на русском языке по материалу статьи. НЕ переводи статью целиком — только готовый пост. Отвечай только текстом поста.",
};

const ACTION_INSTRUCTIONS: Record<AiAction, string> = {
  translate: `${MARKDOWN_FORMAT}\n\nПереведи статью на русский язык полностью.\n\nСтруктура:\n# перевод заголовка\n\nтекст перевода абзацами, сохраняя структуру оригинала.`,
  summary: `${MARKDOWN_FORMAT}\n\nСделай краткий пересказ статьи на русском (2–5 предложений). Без полного перевода текста.\n\nСтруктура:\n# перевод заголовка\n\n## О чём статья\n\nкраткий пересказ: главная мысль, контекст и выводы своими словами.`,
  theses: `${MARKDOWN_FORMAT}\n\nВыдели ключевые тезисы статьи на русском. Без полного перевода и без пересказа абзацами.\n\nСтруктура:\n# перевод заголовка\n\n## Тезисы\n\n5–10 маркированных пунктов. Каждый тезис — одно законченное предложение с главной мыслью.`,
  telegram: `Напиши готовый пост для Telegram на русском (до 1000 символов).\n\nТребования:\n- Не переводи статью целиком\n- Пост должен быть готов к публикации\n- Цепляющий заголовок (можно с emoji)\n- Короткий вводный абзац (2–3 предложения)\n- 2–4 ключевых пункта списком\n- В конце — вопрос или призыв к обсуждению\n\nИспользуй простую разметку Telegram: **жирный**, переносы строк, списки через «•». Без заголовков #.`,
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
      content: SYSTEM_PROMPTS[action],
    },
    {
      role: "user" as const,
      content: `Задача: ${ACTION_LABELS[action]}\n\n${ACTION_INSTRUCTIONS[action]}\n\n---\n\nИсходная статья:\n${articleText}`,
    },
  ];
}
