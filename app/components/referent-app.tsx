"use client";

import BlogContent from "./blog-content";
import { FormEvent, useState } from "react";

type Action = "summary" | "theses" | "telegram";

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
  summary: "Краткое содержание",
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

export default function ReferentApp() {
  const [url, setUrl] = useState("");
  const [activeAction, setActiveAction] = useState<Action | null>(null);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
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
    setLoading(true);
    setResult("");

    try {
      const response = await fetch("/api/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: trimmedUrl, action }),
      });

      const data = (await response.json()) as { result?: string; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось обработать статью.");
      }

      setResult(data.result ?? "");
    } catch (parseError) {
      const message =
        parseError instanceof Error
          ? parseError.message
          : "Не удалось обработать статью.";
      setError(message);
      setResult("");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void handleAction(activeAction ?? "summary");
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
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

        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-800">Выберите действие</p>
          <div className="flex flex-wrap gap-3">
            {ACTIONS.map((action) => {
              const isActive = activeAction === action.id;

              return (
                <button
                  key={action.id}
                  type="button"
                  disabled={loading}
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

      <section
        aria-live="polite"
        className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium text-zinc-900">Результат</h2>
          {activeAction ? (
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
              {ACTION_LABELS[activeAction]}
            </span>
          ) : null}
        </div>

        {loading ? (
          <div className="flex min-h-48 items-center justify-center gap-3 text-zinc-500">
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-sky-600" />
            <span>Парсинг и перевод статьи...</span>
          </div>
        ) : result ? (
          <BlogContent content={result} />
        ) : (
          <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-6 text-center text-sm text-zinc-500">
            Результат появится здесь после выбора действия.
          </div>
        )}
      </section>
    </div>
  );
}
