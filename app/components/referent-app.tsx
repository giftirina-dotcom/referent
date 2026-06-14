"use client";

import BlogContent from "./blog-content";
import { FormEvent, useState, type ReactNode } from "react";

type Action = "summary" | "theses" | "telegram";

type ParsedArticle = {
  date: string | null;
  title: string | null;
  content: string | null;
};

type LoadingStage = "idle" | "parsing" | "translating";

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

const ACTION_LABELS: Record<Action, string> = {
  summary: "Перевод + описание",
  theses: "Тезисы",
  telegram: "Пост для Telegram",
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
  children,
}: {
  title: string;
  badge?: string;
  loading?: boolean;
  loadingText?: string;
  emptyText: string;
  children?: ReactNode;
}) {
  return (
    <section
      aria-live="polite"
      className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6"
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
      ) : children ? (
        children
      ) : (
        <div className="flex min-h-36 items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-6 text-center text-sm text-zinc-500">
          {emptyText}
        </div>
      )}
    </section>
  );
}

export default function ReferentApp() {
  const [url, setUrl] = useState("");
  const [activeAction, setActiveAction] = useState<Action | null>(null);
  const [parseResult, setParseResult] = useState("");
  const [translateResult, setTranslateResult] = useState("");
  const [loadingStage, setLoadingStage] = useState<LoadingStage>("idle");
  const [error, setError] = useState("");

  async function handleAction(action: Action) {
    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      setError("Введите URL англоязычной статьи.");
      return;
    }

    if (!isValidUrl(trimmedUrl)) {
      setError("Укажите корректный URL, начинающийся с http:// или https://.");
      return;
    }

    setError("");
    setActiveAction(action);
    setParseResult("");
    setTranslateResult("");
    setLoadingStage("parsing");

    try {
      const parseResponse = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmedUrl }),
      });

      const article = (await parseResponse.json()) as ParsedArticle & {
        error?: string;
      };

      if (!parseResponse.ok) {
        throw new Error(article.error ?? "Не удалось распарсить статью.");
      }

      setParseResult(JSON.stringify(article, null, 2));
      setLoadingStage("translating");

      const translateResponse = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ article, action }),
      });

      const translation = (await translateResponse.json()) as {
        result?: string;
        error?: string;
      };

      if (!translateResponse.ok) {
        throw new Error(translation.error ?? "Не удалось перевести статью.");
      }

      setTranslateResult(translation.result ?? "");
    } catch (actionError) {
      const message =
        actionError instanceof Error
          ? actionError.message
          : "Не удалось обработать статью.";
      setError(message);
      setParseResult("");
      setTranslateResult("");
    } finally {
      setLoadingStage("idle");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void handleAction(activeAction ?? "summary");
  }

  const isLoading = loadingStage !== "idle";

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

      <form onSubmit={handleSubmit} className="space-y-6">
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

          <ResultBox
            title="Парсинг"
            loading={loadingStage === "parsing"}
            loadingText="Загрузка и разбор статьи..."
            emptyText="Здесь появится JSON с датой, заголовком и текстом статьи."
          >
            {parseResult ? (
              <div className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-50 p-4 font-mono text-xs leading-6 text-zinc-800 sm:text-sm">
                {parseResult}
              </div>
            ) : null}
          </ResultBox>

          <ResultBox
            title="Перевод"
            badge={activeAction ? ACTION_LABELS[activeAction] : undefined}
            loading={loadingStage === "translating"}
            loadingText="Перевод и обработка через AI..."
            emptyText="Здесь появится перевод и результат выбранного действия."
          >
            {translateResult ? <BlogContent content={translateResult} /> : null}
          </ResultBox>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-800">Выберите действие</p>
          <div className="flex flex-wrap gap-3">
            {ACTIONS.map((action) => {
              const isActive = activeAction === action.id;

              return (
                <button
                  key={action.id}
                  type="button"
                  disabled={isLoading}
                  onClick={() => void handleAction(action.id)}
                  className={`rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
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
      </form>
    </div>
  );
}
