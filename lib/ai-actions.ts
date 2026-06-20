import type { ParsedArticle } from "@/lib/parse-article";

export type AiAction = "translate" | "summary" | "theses" | "telegram";

/** Лимит ответа OpenRouter по типу задачи (без max_tokens API резервирует до 65536 токенов). */
export const MAX_OUTPUT_TOKENS: Record<AiAction, number> = {
  summary: 1200,
  theses: 2500,
  telegram: 1500,
  translate: 16_000,
};

export type BuildMessagesOptions = {
  sourceUrl?: string;
};

const MAX_CONTENT_LENGTH = 12_000;

const MARKDOWN_FORMAT =
  "Форматируй ответ в Markdown: один заголовок первого уровня (#), подзаголовки (##), абзацы, списки (-). Не используй кодовые блоки.";

const ACTION_LABELS: Record<AiAction, string> = {
  translate: "Полный перевод",
  summary: "Краткое содержание",
  theses: "Тезисы",
  telegram: "Пост для Telegram",
};

const RUSSIAN_ONLY_RULE =
  "Весь ответ строго на русском языке. Заголовок # — перевод заголовка статьи на русский; запрещено копировать английский Title без перевода.";

const SYSTEM_PROMPTS: Record<AiAction, string> = {
  translate:
    "Ты профессиональный переводчик. Переводи статью полностью на русский язык. Отвечай только переводом в Markdown, без комментариев и пояснений.",
  summary:
    `Ты редактор. Сделай краткий пересказ статьи на русском языке. ${RUSSIAN_ONLY_RULE} НЕ переводи статью целиком — только сжатое изложение смысла. Отвечай только кратким содержанием в Markdown, без лишних разделов.`,
  theses:
    `Ты редактор. Выдели ключевые тезисы статьи на русском языке. ${RUSSIAN_ONLY_RULE} НЕ переводи и не пересказывай статью целиком — только список главных мыслей. Отвечай только тезисами в Markdown.`,
  telegram:
    "Ты SMM-редактор. Напиши готовый пост для публикации в Telegram на русском языке по материалу статьи. Пост обязательно начинается с цепляющего заголовка на русском. НЕ переводи статью целиком — только готовый пост. Отвечай только текстом поста, без пояснений от себя.",
};

const ACTION_INSTRUCTIONS: Record<AiAction, string> = {
  translate: `${MARKDOWN_FORMAT}\n\nПереведи статью на русский язык полностью.\n\nСтруктура:\n# перевод заголовка\n\nтекст перевода абзацами, сохраняя структуру оригинала.`,
  summary: `${MARKDOWN_FORMAT}\n\n${RUSSIAN_ONLY_RULE}\n\nСделай краткий пересказ статьи на русском (2–5 предложений). Без полного перевода текста.\n\nСтруктура:\n# заголовок статьи на русском (перевод Title, не копия)\n\n## О чём статья\n\nкраткий пересказ: главная мысль, контекст и выводы своими словами.\n\nЗапрещено: английский текст в заголовке #, полный перевод, разделы «Тезисы», «Перевод», комментарии вроде «Вот краткое содержание».`,
  theses: `${MARKDOWN_FORMAT}\n\n${RUSSIAN_ONLY_RULE}\n\nВыдели ключевые тезисы статьи на русском. Без полного перевода и без пересказа абзацами.\n\nСтруктура:\n# заголовок статьи на русском (перевод Title, не копия)\n\n## Тезисы\n\n5–10 маркированных пунктов (-). Каждый тезис — одно законченное предложение с главной мыслью.\n\nЗапрещено: английский текст в заголовке # и в тезисах, полный перевод, раздел «О чём статья», готовый пост для Telegram.`,
  telegram: `Напиши готовый пост для Telegram на русском (до 1000 символов).\n\nСтруктура (все пункты обязательны):\n1. **Заголовок** — первая строка поста, цепляющий, на русском (можно emoji); выдели **жирным**\n2. Пустая строка\n3. Короткий вводный абзац (2–3 предложения)\n4. 2–4 ключевых пункта списком (• или -)\n5. По желанию: вопрос или призыв к обсуждению\n6. В конце обязательно: «Источник: {URL}»\n\nТребования:\n- Пост всегда начинается с заголовка — без заголовка пост неполный\n- Не переводи статью целиком\n- Пост готов к публикации, живой стиль для соцсети\n- Используй **жирный** текст и переносы строк; без Markdown-заголовков # и ##\n- Не превышай 1000 символов\n\nЗапрещено: полный перевод, Markdown-заголовки #/##, пост без заголовка, пояснения от модели.`,
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

function buildTelegramInstruction(sourceUrl?: string) {
  const urlHint = sourceUrl?.trim()
    ? `Подставь в конец поста точную ссылку: Источник: ${sourceUrl.trim()}`
    : "Если URL источника не указан, добавь в конце строку «Источник:» без выдуманной ссылки.";

  return `${ACTION_INSTRUCTIONS.telegram}\n\n${urlHint}`;
}

function buildUserContent(
  action: AiAction,
  articleText: string,
  sourceUrl?: string,
) {
  const instruction =
    action === "telegram"
      ? buildTelegramInstruction(sourceUrl)
      : ACTION_INSTRUCTIONS[action];

  return `Задача: ${ACTION_LABELS[action]}\n\n${instruction}\n\n---\n\nИсходная статья:\n${articleText}`;
}

export function buildTranslationMessages(
  article: ParsedArticle,
  action: AiAction,
  options?: BuildMessagesOptions,
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
      content: buildUserContent(action, articleText, options?.sourceUrl),
    },
  ];
}
