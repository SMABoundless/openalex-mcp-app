// Getting the text of an open peer review.
//
// OpenAlex records that a review exists and links to it, but does not hold its
// text in a usable way: the "full text" it stores for a review is often the
// article that was reviewed, or empty. Two publishers serve each review's text
// from their own API, free, keyed by the review's DOI:
//
//   eLife            DOI 10.7554/eLife.<article>.<version>.sa<n>
//   Review Commons   DOI 10.15252/rc.<number>, served by EMBO's Early Evidence Base
//
// Only those two fixed hosts (and doi.org, to follow one Review Commons
// redirect) are ever contacted. Nothing but the DOI is sent.
import { titleSimilarity } from "./references.js";
import { markupToText, teiBodyText, teiTitle } from "./text.js";

const ELIFE_API = "https://prod--epp.elifesciences.org/api/preprints";
const EEB_HOST = "eeb.embo.org";
const EEB_API = `https://${EEB_HOST}/api/v1/doi`;

const TIMEOUT_MS = 10_000;
const MAX_BYTES = 3_000_000;

// ============================================
// Recognising a review's DOI
// ============================================

/** "10.7554/elife.106896.2.sa3" -> the article and version whose record holds that review. */
export function elifeReviewRef(doi: string | null | undefined): { article: string; version: string } | null {
  const match = bareDoi(doi).match(/^10\.7554\/elife\.(\d+)\.(\d+)\.sa\d+$/i);
  return match ? { article: match[1], version: match[2] } : null;
}

export function isReviewCommonsDoi(doi: string | null | undefined): boolean {
  return /^10\.15252\/rc\.\d+$/i.test(bareDoi(doi));
}

/** A DOI without its resolver prefix, lower-cased. */
export function bareDoi(doi: string | null | undefined): string {
  return (doi ?? "").trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").toLowerCase();
}

// ============================================
// Reading the publishers' responses
// ============================================

interface TextItem { doi?: unknown; text?: unknown }

function textOf(item: unknown, doi: string): string | null {
  if (item == null || typeof item !== "object") return null;
  const { doi: itemDoi, text } = item as TextItem;
  if (typeof itemDoi !== "string" || bareDoi(itemDoi) !== doi) return null;
  return typeof text === "string" && text.trim() !== "" ? text : null;
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

/** Finds one review in eLife's record of an article version. Its text is HTML. */
export function findElifeReview(record: unknown, doi: string): string | null {
  const target = bareDoi(doi);
  const review = (record as { article?: { peerReview?: Record<string, unknown> } } | null)?.article?.peerReview;
  if (!review) return null;
  for (const item of [...asList(review.evaluationSummary), ...asList(review.reviews), ...asList(review.authorResponse)]) {
    const text = textOf(item, target);
    if (text) return markupToText(text);
  }
  return null;
}

/** Finds one review in Early Evidence Base's record of a preprint. Its text is Markdown. */
export function findReviewCommonsReview(record: unknown, doi: string): string | null {
  const target = bareDoi(doi);
  const first = Array.isArray(record) ? record[0] : record;
  const process = (first as { review_process?: Record<string, unknown> } | null)?.review_process;
  if (!process) return null;
  for (const item of [...asList(process.reviews), ...asList(process.response), ...asList(process.annot)]) {
    const text = textOf(item, target);
    if (text) return text.trim();
  }
  return null;
}

/** The preprint DOI in the Early Evidence Base address a Review Commons DOI redirects to. */
export function preprintDoiFromRedirect(location: string | null | undefined): string | null {
  if (!location) return null;
  let url: URL;
  try {
    url = new URL(location);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== EEB_HOST) return null;
  const match = url.pathname.match(/^\/doi\/(10\.\d{4,9}\/[^\s?#]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

// ============================================
// Judging the text OpenAlex stores
// ============================================

/** Shorter than this, a stored "full text" is a title page or an extraction failure */
const MIN_STORED_TEXT = 200;

/**
 * Decides whether the full text OpenAlex stores for a review is the review.
 * For many publishers it is the reviewed article instead, which shows in the
 * document's title; for others the extraction came out empty.
 */
export function judgeStoredText(tei: string, reviewedTitle: string): { text: string | null; problem: string | null } {
  const text = teiBodyText(tei);
  if (text.length < MIN_STORED_TEXT) {
    return { text: null, problem: "The text OpenAlex stores for this review is empty." };
  }
  const title = teiTitle(tei);
  if (title && reviewedTitle && titleSimilarity(reviewedTitle, title) >= 0.8 && titleSimilarity(title, reviewedTitle) >= 0.8) {
    return { text: null, problem: "The text OpenAlex stores for this review is the reviewed article, not the review." };
  }
  return { text, problem: null };
}

// ============================================
// Fetching
// ============================================

async function getExternal(url: string, redirect: "error" | "manual", accept: string): Promise<Response> {
  return fetch(url, {
    redirect,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "Accept": accept, "User-Agent": "openalex-mcp-app/1.0.0" }
  });
}

async function getJson(url: string): Promise<unknown> {
  const response = await getExternal(url, "error", "application/json");
  if (!response.ok) throw new Error(`status ${response.status}`);
  const declared = Number.parseInt(response.headers.get("content-length") ?? "", 10);
  if (Number.isFinite(declared) && declared > MAX_BYTES) throw new Error("response too large");
  const body = await response.text();
  if (body.length > MAX_BYTES) throw new Error("response too large");
  return JSON.parse(body);
}

export interface PublisherText {
  text: string | null;
  source: "elife" | "review_commons";
  /** Why there is no text, when there is none */
  problem: string | null;
}

/**
 * Fetches a review's text from its publisher, when the publisher is one that
 * serves it. Returns null for any other publisher. `cache` lets the reviews of
 * one article share a single request.
 */
export async function fetchPublisherText(
  doi: string | null | undefined,
  cache: Map<string, Promise<unknown>> = new Map()
): Promise<PublisherText | null> {
  const once = (url: string): Promise<unknown> => {
    let pending = cache.get(url);
    if (!pending) {
      pending = getJson(url);
      cache.set(url, pending);
    }
    return pending;
  };

  const elife = elifeReviewRef(doi);
  if (elife) {
    try {
      const text = findElifeReview(await once(`${ELIFE_API}/${elife.article}v${elife.version}`), doi!);
      return { text, source: "elife", problem: text ? null : "eLife's record of this article does not include this review." };
    } catch {
      return { text: null, source: "elife", problem: "eLife's service could not be reached for this review." };
    }
  }

  if (isReviewCommonsDoi(doi)) {
    try {
      // The Review Commons DOI redirects to the reviewed preprint's page, which names the preprint
      // Asking doi.org for JSON would send it to Crossref's metadata instead of the page
      const redirect = await getExternal(`https://doi.org/${bareDoi(doi)}`, "manual", "text/html");
      await redirect.body?.cancel().catch(() => {});
      const preprint = preprintDoiFromRedirect(redirect.headers.get("location"));
      if (!preprint) {
        return { text: null, source: "review_commons", problem: "This Review Commons review does not lead to a preprint record." };
      }
      const text = findReviewCommonsReview(await once(`${EEB_API}/${preprint}`), doi!);
      return {
        text,
        source: "review_commons",
        problem: text ? null : "Early Evidence Base's record of the preprint does not include this review."
      };
    } catch {
      return { text: null, source: "review_commons", problem: "Early Evidence Base could not be reached for this review." };
    }
  }

  return null;
}
