"use client";

import BlogContent from "./blog-content";
import {
  ArticleUnavailableError,
  isArticleUnavailableError,
} from "@/lib/article-errors";
import { useRef, useState, type ReactNode } from "react";

type Action = "summary" | "theses" | "telegram";

type ParsedArticle = {
  date: string | null;
  title: string | null;
  content: string | null;
};

const ACTIONS: { id: Action; label: string }[] = [
  { id: "summary", label: "О чем статья?" },
  { id: "theses", label: "Тезисы" },
  { id: "telegram", label: "Пост для Telegram" },
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

const RESULT_BADGES: Record<Action | "translate", string> = {
  translate: "Перевод",
  summary: "Краткое содержание",
  theses: "Тезисы",
  telegram: "Пост для Telegram",
};

const ACTION_STUBS: Record<Action, string> = {
  summary: "Краткое содержание статьи — функция в разработке.",
  theses: "Тезисы статьи — функция в разработке.",
  telegram: "Пост для Telegram — функция в разработке.",
};

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function ResultBox({
  title,
  badge,
  loading,
  loadingText,
  emptyText,
  filled,
  children,
}: {
  title: string;
  badge?: string;
  loading?: boolean;
  loadingText?: string;
  emptyText: string;
  filled?: boolean;
  children?: ReactNode;
}) {
  return (
    <section
      aria-live="polite"
      className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 sm:p-5"
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-medium text-zinc-900">{title}</h2>
        {badge ? (
          <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
            {badge}
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="flex min-h-36 items-center justify-center gap-3 text-zinc-500">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-sky-600" />
          <span>{loadingText}</span>
        </div>
      ) : filled ? (
        children
      ) : (
        <div className="flex min-h-36 items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-6 text-center text-sm text-zinc-500">
          {emptyText}
        </div>
      )}
    </section>
  );
}

async function fetchArticle(url: string): Promise<ParsedArticle> {
  const response = await fetch("/api/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  const article = (await response.json()) as ParsedArticle & {
    error?: string;
    code?: string;
  };

  if (!response.ok) {
    if (article.code === "unavailable" && article.error) {
      throw new ArticleUnavailableError(article.error);
    }

    throw new Error(article.error ?? "Не удалось распарсить статью.");
  }

  return article;
}

export default function ReferentApp() {
  const [url, setUrl] = useState("");
  const [activeAction, setActiveAction] = useState<Action | null>(null);
  const [resultBadge, setResultBadge] = useState<string | null>(null);
  const [resultIsNotice, setResultIsNotice] = useState(false);
  const [result, setResult] = useState("");
  const [loadingParse, setLoadingParse] = useState(false);
  const [loadingTranslate, setLoadingTranslate] = useState(false);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);

  function validateUrl() {
    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      setError("Введите URL англоязычной статьи.");
      return null;
    }

    if (!isValidUrl(trimmedUrl)) {
      setError("Укажите корректный URL, начинающийся с http:// или https://.");
      return null;
    }

    setError("");
    return trimmedUrl;
  }

  function handleActionStub(action: Action) {
    if (isBusy) {
      return;
    }

    setError("");
    setActiveAction(action);
    setResultBadge(RESULT_BADGES[action]);
    setResultIsNotice(true);
    setResult(ACTION_STUBS[action]);
  }

  async function runTranslation() {
    const trimmedUrl = validateUrl();
    if (!trimmedUrl) {
      return;
    }

    const requestId = ++requestIdRef.current;

    setError("");
    setActiveAction(null);
    setResultBadge(RESULT_BADGES.translate);
    setResult("");
    setResultIsNotice(false);
    setLoadingParse(true);

    try {
      const article = await fetchArticle(trimmedUrl);
      if (requestId !== requestIdRef.current) {
        return;
      }

      setLoadingParse(false);
      setLoadingTranslate(true);

      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ article, action: "translate" }),
      });

      const data = (await response.json()) as {
        result?: string;
        error?: string;
      };

      if (requestId !== requestIdRef.current) {
        return;
      }

      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось перевести статью.");
      }

      setResultIsNotice(false);
      setResult(data.result ?? "");
    } catch (actionError) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      if (isArticleUnavailableError(actionError)) {
        setResultBadge(null);
        setResultIsNotice(true);
        setResult(actionError.message);
        return;
      }

      const message =
        actionError instanceof Error
          ? actionError.message
          : "Не удалось обработать статью.";
      setError(message);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoadingParse(false);
        setLoadingTranslate(false);
      }
    }
  }

  const isBusy = loadingParse || loadingTranslate;

  const loadingText = loadingParse
    ? "Загрузка и разбор статьи..."
    : "Перевод и обработка через AI...";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
          Референт-переводчик с ИИ-обработкой
        </h1>
        <p className="text-zinc-600">
          Вставьте ссылку на англоязычную статью и выберите, что нужно
          сгенерировать.
        </p>
      </header>

      <div className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="article-url"
              className="block text-sm font-medium text-zinc-800"
            >
              URL англоязычной статьи
            </label>
            <input
              id="article-url"
              type="url"
              inputMode="url"
              placeholder="https://example.com/article"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              autoComplete="url"
            />
            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            disabled={isBusy}
            onClick={() => void runTranslation()}
            className="w-full rounded-xl bg-red-500 px-4 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Перевести
          </button>

          <div className="space-y-3">
            <p className="text-sm font-medium text-zinc-800">Выберите действие</p>
            <div className="flex flex-wrap gap-3">
              {ACTIONS.map((action) => {
                const isActive = activeAction === action.id;

                return (
                  <button
                    key={action.id}
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleActionStub(action.id)}
                    className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
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

          <ResultBox
            title="Результат"
            badge={resultBadge ?? undefined}
            loading={isBusy}
            filled={Boolean(result)}
            loadingText={loadingText}
            emptyText="Здесь появится результат перевода."
          >
            {result ? (
              resultIsNotice ? (
                <div className="flex min-h-36 items-center justify-center rounded-xl border border-amber-100 bg-amber-50/80 px-6 py-8 text-center text-sm leading-7 text-zinc-700">
                  {result}
                </div>
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
