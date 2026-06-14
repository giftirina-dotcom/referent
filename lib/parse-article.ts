import {
  ArticleUnavailableError,
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

export async function fetchAndParseArticle(url: string): Promise<ParsedArticle> {
  let response: Response;

  try {
    response = await fetch(url, {
      headers: BROWSER_HEADERS,
      redirect: "follow",
    });
  } catch {
    throwForFetchFailure();
  }

  if (!response.ok) {
    throwForHttpStatus(response.status);
  }

  const html = await response.text();
  const article = parseArticleHtml(html);

  if (!article.title && !article.content) {
    throw new ArticleUnavailableError(
      "На этой странице не удалось найти текст статьи. Возможно, нужен другой URL.",
    );
  }

  return article;
}
