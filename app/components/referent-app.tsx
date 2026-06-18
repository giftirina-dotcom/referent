"use client";

import BlogContent from "./blog-content";
import { Alert } from "./ui/alert";
import {
  AiServiceError,
  ArticleUnavailableError,
  isAiServiceError,
  isArticleUnavailableError,
} from "@/lib/article-errors";
import {
  AI_TIMEOUT_ERROR_MESSAGE,
  ARTICLE_LOAD_ERROR_MESSAGE,
  ARTICLE_PARSE_ERROR_MESSAGE,
  GENERIC_ACTION_ERROR_MESSAGE,
  GENERIC_AI_ERROR_MESSAGE,
  VALIDATION_EMPTY_URL_MESSAGE,
  VALIDATION_INVALID_URL_MESSAGE,
} from "@/lib/client-error-messages";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

type Action = "summary" | "theses" | "telegram";

type ParsedArticle = {
  date: string | null;
  title: string | null;
  content: string | null;
};

const ACTIONS: { id: Action; label: string; title: string }[] = [
  {
    id: "summary",
    label: "О чем статья?",
    title: "Сгенерировать краткое содержание статьи на русском",
  },
  {
    id: "theses",
    label: "Тезисы",
    title: "Извлечь основные тезисы из статьи",
  },
  {
    id: "telegram",
    label: "Пост для Telegram",
    title: "Подготовить пост для публикации в Telegram",
  },
];

const ACTION_BUTTON_STYLES: Record<
  Action,
  { default: string; active: string }
> = {
  summary: {
    default:
      "border border-green-300 bg-green-200 text-green-950 hover:bg-green-300",
    active: "border border-green-400 bg-green-400 text-green-950 shadow-sm",
  },
  theses: {
    default:
      "border border-orange-300 bg-orange-200 text-orange-950 hover:bg-orange-300",
    active: "border border-orange-400 bg-orange-400 text-orange-950 shadow-sm",
  },
  telegram: {
    default:
      "border border-purple-300 bg-purple-200 text-purple-950 hover:bg-purple-300",
    active: "border border-purple-400 bg-purple-400 text-purple-950 shadow-sm",
  },
};

const RESULT_BADGES: Record<Action, string> = {
  summary: "Краткое содержание",
  theses: "Тезисы",
  telegram: "Пост для Telegram",
};

/** Таймаут ожидания ответа /api/translate в браузере (мс). */
const TRANSLATE_CLIENT_TIMEOUT_MS = 180_000;

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const CLEAR_BUTTON_CLASS =
  "w-full rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto";

const COPY_BUTTON_CLASS =
  "w-full rounded-xl border border-sky-300 bg-sky-100 px-4 py-2.5 text-sm font-medium text-sky-900 transition hover:bg-sky-200 sm:w-auto";

const COPIED_BUTTON_CLASS =
  "w-full rounded-xl border border-amber-300 bg-amber-100 px-4 py-2.5 text-sm font-medium text-amber-950 transition sm:w-auto";

const ACTION_BUTTON_BASE =
  "w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 md:w-auto";

function ResultBox({
  title,
  badge,
  loading,
  loadingText,
  emptyText,
  filled,
  sectionRef,
  headerActions,
  children,
}: {
  title: string;
  badge?: string;
  loading?: boolean;
  loadingText?: string;
  emptyText: string;
  filled?: boolean;
  sectionRef?: RefObject<HTMLElement | null>;
  headerActions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section
      ref={sectionRef}
      aria-live="polite"
      className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 sm:p-5"
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h2 className="text-lg font-medium text-zinc-900">{title}</h2>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          {headerActions}
          {badge ? (
            <span className="w-fit rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
              {badge}
            </span>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-36 items-center justify-center gap-3 text-zinc-500">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-sky-600" />
          <span>{loadingText}</span>
        </div>
      ) : filled ? (
        children
      ) : (
        <div className="flex min-h-36 items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500 sm:px-6">
          {emptyText}
        </div>
      )}
    </section>
  );
}

async function fetchArticle(url: string): Promise<ParsedArticle> {
  let response: Response;

  try {
    response = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
  } catch {
    throw new ArticleUnavailableError(ARTICLE_LOAD_ERROR_MESSAGE);
  }

  const article = (await response.json()) as ParsedArticle & {
    error?: string;
    code?: string;
  };

  if (!response.ok) {
    if (article.code === "unavailable") {
      throw new ArticleUnavailableError(
        article.error === ARTICLE_PARSE_ERROR_MESSAGE
          ? ARTICLE_PARSE_ERROR_MESSAGE
          : ARTICLE_LOAD_ERROR_MESSAGE,
      );
    }

    throw new ArticleUnavailableError(ARTICLE_LOAD_ERROR_MESSAGE);
  }

  return article;
}

export default function ReferentApp() {
  const [url, setUrl] = useState("");
  const [activeAction, setActiveAction] = useState<Action | null>(null);
  const [resultBadge, setResultBadge] = useState<string | null>(null);
  const [resultIsNotice, setResultIsNotice] = useState(false);
  const [resultNoticeKind, setResultNoticeKind] = useState<"article" | "ai" | null>(
    null,
  );
  const [result, setResult] = useState("");
  const [loadingParse, setLoadingParse] = useState(false);
  const [loadingTranslate, setLoadingTranslate] = useState(false);
  const [error, setError] = useState("");
  const [copyLabel, setCopyLabel] = useState("Копировать");
  const requestIdRef = useRef(0);
  const resultSectionRef = useRef<HTMLElement>(null);
  const copyResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function resetAll() {
    requestIdRef.current += 1;

    if (copyResetTimerRef.current) {
      clearTimeout(copyResetTimerRef.current);
      copyResetTimerRef.current = null;
    }

    setUrl("");
    setActiveAction(null);
    setResultBadge(null);
    setResultIsNotice(false);
    setResultNoticeKind(null);
    setCopyLabel("Копировать");
    setResult("");
    setLoadingParse(false);
    setLoadingTranslate(false);
    setError("");
  }

  async function copyResult() {
    if (!result) {
      return;
    }

    try {
      await navigator.clipboard.writeText(result);
      setCopyLabel("Скопировано");

      if (copyResetTimerRef.current) {
        clearTimeout(copyResetTimerRef.current);
      }

      copyResetTimerRef.current = setTimeout(() => {
        setCopyLabel("Копировать");
        copyResetTimerRef.current = null;
      }, 2000);
    } catch {
      setError("Не удалось скопировать текст. Попробуйте выделить и скопировать вручную.");
    }
  }

  useEffect(() => {
    if (result && !resultIsNotice) {
      resultSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result, resultIsNotice]);

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current) {
        clearTimeout(copyResetTimerRef.current);
      }
    };
  }, []);

  function validateUrl() {
    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      setError(VALIDATION_EMPTY_URL_MESSAGE);
      return null;
    }

    if (!isValidUrl(trimmedUrl)) {
      setError(VALIDATION_INVALID_URL_MESSAGE);
      return null;
    }

    setError("");
    return trimmedUrl;
  }

  async function runAction(action: Action) {
    const trimmedUrl = validateUrl();
    if (!trimmedUrl) {
      return;
    }

    const requestId = ++requestIdRef.current;

    setError("");
    setActiveAction(action);
    setResultBadge(RESULT_BADGES[action]);
    setResult("");
    setResultIsNotice(false);
    setResultNoticeKind(null);
    setCopyLabel("Копировать");
    setLoadingParse(true);

    try {
      const article = await fetchArticle(trimmedUrl);
      if (requestId !== requestIdRef.current) {
        return;
      }

      setLoadingParse(false);
      setLoadingTranslate(true);

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        TRANSLATE_CLIENT_TIMEOUT_MS,
      );

      let response: Response;

      try {
        response = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            article,
            action,
            ...(action === "telegram" ? { sourceUrl: trimmedUrl } : {}),
          }),
          signal: controller.signal,
        });
      } catch (fetchError) {
        if (
          fetchError instanceof DOMException &&
          fetchError.name === "AbortError"
        ) {
          throw new AiServiceError(AI_TIMEOUT_ERROR_MESSAGE);
        }

        throw new AiServiceError(GENERIC_AI_ERROR_MESSAGE);
      } finally {
        clearTimeout(timeoutId);
      }

      const data = (await response.json()) as {
        result?: string;
        error?: string;
        code?: string;
      };

      if (requestId !== requestIdRef.current) {
        return;
      }

      if (!response.ok) {
        if (data.code === "ai_error") {
          throw new AiServiceError(data.error ?? GENERIC_AI_ERROR_MESSAGE);
        }

        throw new AiServiceError(GENERIC_AI_ERROR_MESSAGE);
      }

      setResultIsNotice(false);
      setResultNoticeKind(null);
      setResult(data.result ?? "");
    } catch (actionError) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      if (isArticleUnavailableError(actionError)) {
        setResultBadge(null);
        setResultIsNotice(true);
        setResultNoticeKind("article");
        setResult(actionError.message);
        return;
      }

      if (isAiServiceError(actionError)) {
        setResultIsNotice(true);
        setResultNoticeKind("ai");
        setResult(actionError.message);
        return;
      }

      setError(GENERIC_ACTION_ERROR_MESSAGE);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoadingParse(false);
        setLoadingTranslate(false);
      }
    }
  }

  const isBusy = loadingParse || loadingTranslate;

  const processStatus = loadingParse
    ? "Загружаю статью…"
    : loadingTranslate
      ? "Обрабатываю с помощью ИИ…"
      : null;

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-5 sm:gap-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-balance text-zinc-900 sm:text-3xl">
          Референт-переводчик с ИИ-обработкой
        </h1>
        <p className="text-sm text-pretty text-zinc-600 sm:text-base">
          Вставьте ссылку на англоязычную статью и выберите, что нужно
          сгенерировать.
        </p>
      </header>

      <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:space-y-6 sm:p-6">
        <div className="min-w-0 space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="article-url"
              className="block text-sm font-medium text-zinc-800"
            >
              URL статьи
            </label>
            <input
              id="article-url"
              type="url"
              inputMode="url"
              placeholder="Введите URL статьи, например: https://example.com/article"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              className="w-full min-w-0 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 sm:text-sm"
              autoComplete="url"
            />
            <p className="text-xs text-zinc-500">
              Укажите ссылку на англоязычную статью.
            </p>
            {error ? (
              <Alert title="Проверьте ссылку" variant="destructive">
                {error}
              </Alert>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-zinc-800">Выберите действие</p>
              <button
                type="button"
                title="Сбросить поле URL, результат, ошибки и состояния"
                onClick={resetAll}
                className={CLEAR_BUTTON_CLASS}
              >
                Очистить
              </button>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:flex-wrap">
              {ACTIONS.map((action) => {
                const isActive = activeAction === action.id;

                return (
                  <button
                    key={action.id}
                    type="button"
                    title={action.title}
                    disabled={isBusy}
                    onClick={() => void runAction(action.id)}
                    className={`${ACTION_BUTTON_BASE} ${
                      isActive
                        ? ACTION_BUTTON_STYLES[action.id].active
                        : ACTION_BUTTON_STYLES[action.id].default
                    }`}
                  >
                    {action.label}
                  </button>
                );
              })}
            </div>
          </div>

          {processStatus ? (
            <div
              aria-live="polite"
              className="flex items-center gap-2.5 rounded-lg border border-sky-100 bg-sky-50/80 px-4 py-2.5 text-sm text-sky-800"
            >
              <span className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600" />
              <span className="min-w-0 text-pretty">{processStatus}</span>
            </div>
          ) : null}

          <ResultBox
            title="Результат"
            badge={resultBadge ?? undefined}
            filled={Boolean(result)}
            sectionRef={resultSectionRef}
            emptyText="Здесь появится результат перевода."
            headerActions={
              result ? (
                <button
                  type="button"
                  title="Скопировать результат в буфер обмена"
                  onClick={() => void copyResult()}
                  className={
                    copyLabel === "Скопировано"
                      ? COPIED_BUTTON_CLASS
                      : COPY_BUTTON_CLASS
                  }
                >
                  {copyLabel}
                </button>
              ) : null
            }
          >
            {result ? (
              resultIsNotice ? (
                <Alert
                  title={
                    resultNoticeKind === "ai"
                      ? "Ошибка обработки"
                      : result === ARTICLE_PARSE_ERROR_MESSAGE
                        ? "Текст не найден"
                        : "Статья недоступна"
                  }
                  variant={resultNoticeKind === "ai" ? "destructive" : "warning"}
                >
                  {result}
                </Alert>
              ) : (
                <BlogContent content={result} />
              )
            ) : null}
          </ResultBox>
        </div>
      </div>
    </div>
  );
}
