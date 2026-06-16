export class ArticleUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArticleUnavailableError";
  }
}

export function isArticleUnavailableError(
  error: unknown,
): error is ArticleUnavailableError {
  return error instanceof ArticleUnavailableError;
}

export class AiServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiServiceError";
  }
}

export function isAiServiceError(error: unknown): error is AiServiceError {
  return error instanceof AiServiceError;
}

export function isResultNoticeError(
  error: unknown,
): error is ArticleUnavailableError | AiServiceError {
  return isArticleUnavailableError(error) || isAiServiceError(error);
}

export function friendlyAiErrorMessage(
  status?: number,
  rawMessage?: string,
): string {
  if (status === 429) {
    return "Слишком много запросов к ИИ. Подождите минуту и попробуйте снова.";
  }

  if (status === 401 || status === 403) {
    return "Не удалось подключиться к сервису ИИ. Проверьте ключ API в файле .env.local.";
  }

  if (status !== undefined && status >= 500) {
    return "Сервис ИИ временно недоступен. Попробуйте позже.";
  }

  const raw = rawMessage?.toLowerCase() ?? "";

  if (raw.includes("openrouter_api_key") || raw.includes("не задан")) {
    return "Сервис ИИ не настроен: ключ API не задан. Проверьте файл .env.local.";
  }

  if (raw.includes("не вернул текст")) {
    return "ИИ не вернул текст ответа. Попробуйте ещё раз или выберите другую статью.";
  }

  if (raw.includes("abort") || raw.includes("timeout") || raw.includes("timed out")) {
    return "ИИ слишком долго отвечает. Попробуйте более короткую статью или повторите позже.";
  }

  return "Не удалось получить ответ от ИИ. Попробуйте ещё раз.";
}

function friendlyFetchMessage(status: number) {
  if (status === 403 || status === 401) {
    return "К этой статье нет доступа. Сайт не отдаёт текст автоматически — попробуйте другую ссылку.";
  }

  if (status === 404) {
    return "Статья не найдена. Проверьте ссылку: возможно, страница удалена или адрес указан с опечаткой.";
  }

  if (status >= 500) {
    return "Сайт сейчас недоступен. Попробуйте позже или выберите другую статью.";
  }

  return "Не получилось открыть эту статью. Попробуйте другую ссылку.";
}

export function throwForHttpStatus(status: number): never {
  throw new ArticleUnavailableError(friendlyFetchMessage(status));
}

export function throwForFetchFailure(): never {
  throw new ArticleUnavailableError(
    "Не удалось связаться с сайтом. Проверьте интернет и попробуйте ещё раз.",
  );
}
