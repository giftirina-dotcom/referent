import {
  ArticleUnavailableError,
  ARTICLE_PARSE_ERROR_MESSAGE,
  throwForFetchFailure,
  throwForHttpStatus,
} from "@/lib/article-errors";
import * as cheerio from "cheerio";

export type ParsedArticle = {
  date: string | null;
  title: string | null;
  content: string | null;
};

const CONTENT_SELECTORS = [
  "article",
  '[role="article"]',
  "#mw-content-text",
  ".mw-parser-output",
  ".post-content",
  ".entry-content",
  ".article-content",
  ".article-body",
  ".post-body",
  ".story-body",
  ".content",
  ".post",
  "main",
];

const REMOVABLE_SELECTORS =
  "script, style, nav, footer, aside, header, form, noscript, iframe, svg, .sidebar, .comments, .comment, .advertisement, .ad, .social-share, .related-posts";

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function extractElementText($: cheerio.CheerioAPI, element: Parameters<cheerio.CheerioAPI>[0]) {
  const clone = $(element).clone();
  clone.find(REMOVABLE_SELECTORS).remove();
  return normalizeText(clone.text());
}

function pickLongestText(
  $: cheerio.CheerioAPI,
  nodes: ReturnType<cheerio.CheerioAPI>,
) {
  let bestText = "";

  nodes.each((_, element) => {
    const text = extractElementText($, element);
    if (text.length > bestText.length) {
      bestText = text;
    }
  });

  return { text: bestText || null };
}

function extractTitle($: cheerio.CheerioAPI) {
  const candidates = [
    $('meta[property="og:title"]').attr("content"),
    $('meta[name="twitter:title"]').attr("content"),
    $("article h1").first().text(),
    $("main h1").first().text(),
    $("h1").first().text(),
    $("title").text(),
  ];

  for (const candidate of candidates) {
    const normalized = normalizeText(candidate ?? "");
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function extractDateFromJsonLd($: cheerio.CheerioAPI) {
  const scripts = $('script[type="application/ld+json"]');

  for (const script of scripts.toArray()) {
    const raw = $(script).html();
    if (!raw) {
      continue;
    }

    try {
      const data = JSON.parse(raw) as unknown;
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        if (!item || typeof item !== "object") {
          continue;
        }

        const record = item as Record<string, unknown>;
        const dateValue =
          record.datePublished ??
          record.dateCreated ??
          record.uploadDate ??
          (record["@graph"] as Record<string, unknown>[] | undefined)?.find(
            (node) =>
              typeof node.datePublished === "string" ||
              typeof node.dateCreated === "string",
          )?.datePublished;

        if (typeof dateValue === "string" && dateValue.trim()) {
          return dateValue.trim();
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

function extractDate($: cheerio.CheerioAPI) {
  const metaCandidates = [
    $('meta[property="article:published_time"]').attr("content"),
    $('meta[name="article:published_time"]').attr("content"),
    $('meta[property="og:updated_time"]').attr("content"),
    $('meta[name="pubdate"]').attr("content"),
    $('meta[name="publish-date"]').attr("content"),
    $('meta[name="date"]').attr("content"),
    $('meta[itemprop="datePublished"]').attr("content"),
  ];

  for (const candidate of metaCandidates) {
    const normalized = normalizeText(candidate ?? "");
    if (normalized) {
      return normalized;
    }
  }

  const timeCandidate = normalizeText($("time[datetime]").first().attr("datetime") ?? "");
  if (timeCandidate) {
    return timeCandidate;
  }

  return extractDateFromJsonLd($);
}

function extractContent($: cheerio.CheerioAPI) {
  for (const selector of CONTENT_SELECTORS) {
    const nodes = $(selector);
    if (nodes.length === 0) {
      continue;
    }

    const { text } = pickLongestText($, nodes);
    if (text && text.length >= 120) {
      return text;
    }
  }

  const paragraphs = $("p")
    .map((_, element) => normalizeText($(element).text()))
    .get()
    .filter((text) => text.length >= 40);

  if (paragraphs.length > 0) {
    return paragraphs.join("\n\n");
  }

  return null;
}

export function parseArticleHtml(html: string): ParsedArticle {
  const $ = cheerio.load(html);

  return {
    date: extractDate($),
    title: extractTitle($),
    content: extractContent($),
  };
}

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,ru;q=0.8",
};

/** Общий таймаут загрузки страницы (мс). */
const FETCH_TIMEOUT_MS = 60_000;

/** Таймаут установки TCP-соединения (мс). По умолчанию в Node.js — 10 с, этого мало для многих сайтов. */
const CONNECT_TIMEOUT_MS = 45_000;

const FETCH_ATTEMPTS = 3;

const RETRY_DELAY_MS = 1_500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type UndiciFetch = typeof globalThis.fetch;

type FetchClient = {
  fetch: UndiciFetch;
  dispatcher?: unknown;
};

async function loadFetchClient(): Promise<FetchClient> {
  try {
    const undici = (await import(
      /* webpackIgnore: true */ "undici"
    )) as {
      fetch: UndiciFetch;
      Agent: new (options?: {
        connectTimeout?: number;
        headersTimeout?: number;
        bodyTimeout?: number;
      }) => unknown;
    };

    return {
      fetch: undici.fetch,
      dispatcher: new undici.Agent({
        connectTimeout: CONNECT_TIMEOUT_MS,
        headersTimeout: FETCH_TIMEOUT_MS,
        bodyTimeout: FETCH_TIMEOUT_MS,
      }),
    };
  } catch {
    return { fetch: globalThis.fetch };
  }
}

function isRetriableFetchError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  const cause = error.cause;
  const causeCode =
    cause && typeof cause === "object" && "code" in cause
      ? String(cause.code)
      : "";

  return (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("fetch failed") ||
    causeCode.includes("TIMEOUT") ||
    causeCode.includes("ECONNRESET") ||
    causeCode.includes("ECONNREFUSED")
  );
}

async function fetchArticleHtml(url: string, client: FetchClient) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await client.fetch(url, {
        headers: BROWSER_HEADERS,
        redirect: "follow",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        ...(client.dispatcher ? { dispatcher: client.dispatcher } : {}),
      });

      if (!response.ok) {
        throwForHttpStatus(response.status);
      }

      return await response.text();
    } catch (error) {
      lastError = error;

      if (attempt < FETCH_ATTEMPTS && isRetriableFetchError(error)) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }

      if (isRetriableFetchError(error) || error instanceof TypeError) {
        throwForFetchFailure();
      }

      throw error;
    }
  }

  if (isRetriableFetchError(lastError) || lastError instanceof TypeError) {
    throwForFetchFailure();
  }

  throw lastError;
}

export async function fetchAndParseArticle(url: string): Promise<ParsedArticle> {
  const client = await loadFetchClient();
  const html = await fetchArticleHtml(url, client);
  const article = parseArticleHtml(html);

  if (!article.title && !article.content) {
    throw new ArticleUnavailableError(ARTICLE_PARSE_ERROR_MESSAGE);
  }

  return article;
}
