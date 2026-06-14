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
