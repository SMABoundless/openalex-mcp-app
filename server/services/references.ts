// Matching citations to OpenAlex works.
//
// A reference with an identifier (DOI, PMID, PMCID, OpenAlex ID) is looked up directly.
// A free-text citation is harder: searching for the whole string rarely puts the
// right work first, because author names, journal and page numbers drown out the
// title. So the title is picked out of the citation, searched for on its own, and
// each candidate is scored by how much of its title appears in the citation.
//
// Everything in this file is pure (no network), so it can be tested directly.
import type { ReferenceStatus, WorkOutput } from "../output-types.js";

// ============================================
// Reading a reference
// ============================================

export type ReferenceIdKind = "doi" | "pmid" | "pmcid" | "openalex_id";

export interface ParsedReference {
  /** The identifier found in the reference, if any, in the form the API accepts. */
  id: { kind: ReferenceIdKind; value: string } | null;
  /** True when the reference is more than a bare identifier, so its title can be checked. */
  hasText: boolean;
}

const DOI_PATTERN = /\b10\.\d{4,9}\/[^\s"'<>]+/i;
const OPENALEX_PATTERN = /^(?:https?:\/\/openalex\.org\/)?(W\d+)$/i;
const PMID_LABELLED = /\bpmid:?\s*(\d{4,9})\b/i;
const PMID_BARE = /^\d{6,9}$/;
const PMCID_PATTERN = /\b(?:pmcid:?\s*)?(PMC\d{3,9})\b/i;

/** Finds an identifier in a reference. A DOI inside a longer citation is picked out. */
export function parseReference(raw: string): ParsedReference {
  const text = raw.trim();

  const openalex = text.match(OPENALEX_PATTERN);
  if (openalex) return { id: { kind: "openalex_id", value: openalex[1].toUpperCase() }, hasText: false };

  const doi = text.match(DOI_PATTERN);
  if (doi) {
    // Sentence punctuation after a DOI is not part of it
    const value = doi[0].replace(/[.,;:)\]]+$/, "");
    const rest = text.replace(doi[0], " ").replace(/https?:\/\/(dx\.)?doi\.org\/?/gi, " ").replace(/\bdoi:?/gi, " ");
    return { id: { kind: "doi", value }, hasText: words(rest).length >= 3 };
  }

  const pmcid = text.match(PMCID_PATTERN);
  if (pmcid) {
    return { id: { kind: "pmcid", value: pmcid[1].toUpperCase() }, hasText: words(text.replace(pmcid[0], " ")).length >= 3 };
  }

  if (PMID_BARE.test(text)) return { id: { kind: "pmid", value: text }, hasText: false };
  const pmid = text.match(PMID_LABELLED);
  if (pmid) {
    return { id: { kind: "pmid", value: pmid[1] }, hasText: words(text.replace(pmid[0], " ")).length >= 3 };
  }

  return { id: null, hasText: true };
}

// ============================================
// Comparing text
// ============================================

/** Lower-case, accents removed, punctuation turned into spaces. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** The words of a text that are longer than one character. */
export function words(text: string): string[] {
  return normalizeText(text).split(" ").filter(w => w.length > 1);
}

// Words too common to tell one title from another
const STOP_WORDS = new Set([
  "an", "the", "of", "and", "in", "on", "for", "to", "with", "by", "from", "at", "as", "is", "are", "or"
]);

/** The distinct words of a title that carry meaning. */
export function significantWords(text: string): Set<string> {
  return new Set(words(text).filter(w => !STOP_WORDS.has(w)));
}

// Publishers append notes such as "(Retracted article. See vol 375, pg 445, 2010)"
// to a title, or put "RETRACTED:" in front of it. Nobody cites those words.
const TITLE_NOTE = /\s*[([][^()[\]]*\bretract[^()[\]]*[)\]]\s*$|^\s*retract(?:ed|ion)(?:\s+article)?\s*[:—–-]\s*/gi;

/** A title without any retraction note the publisher attached to it. */
export function titleWithoutNotes(title: string): string {
  return title.replace(TITLE_NOTE, "").trim() || title;
}

/** True when the title itself says the work was retracted. */
export function titleSaysRetracted(title: string): boolean {
  return /^\s*retracted\b|[([]\s*retracted\b/i.test(title);
}

/** How many of a title's significant words appear in the citation, and out of how many. */
export function titleOverlap(title: string, citation: string): { shared: number; total: number } {
  const titleWords = significantWords(titleWithoutNotes(title));
  const citationWords = new Set(words(citation));
  let shared = 0;
  for (const w of titleWords) if (citationWords.has(w)) shared++;
  return { shared, total: titleWords.size };
}

/** The share of a title's significant words that appear in the citation, 0-1. */
export function titleSimilarity(title: string, citation: string): number {
  const { shared, total } = titleOverlap(title, citation);
  return total === 0 ? 0 : shared / total;
}

/** Four-digit years mentioned in a citation. */
export function yearsIn(citation: string): number[] {
  return (citation.match(/\b(1[5-9]\d\d|20\d\d)\b/g) ?? []).map(Number);
}

// ============================================
// Picking the title out of a citation
// ============================================

const INITIALS = /^(?:[A-Z]\.?-?){1,3},?$/;
const AUTHOR_FILLER = new Set(["et", "al", "and", "&"]);

/** True when a piece of a citation looks like a list of author names. */
function looksLikeAuthors(piece: string): boolean {
  const parts = piece.split(/\s+/);
  const initials = parts.filter(p => INITIALS.test(p) || AUTHOR_FILLER.has(p.toLowerCase().replace(/[.,]/g, ""))).length;
  const commas = (piece.match(/,/g) ?? []).length;
  return initials / parts.length > 0.25 || commas / parts.length > 0.3;
}

/**
 * The pieces of a citation most likely to be its title, best guess first:
 * anything in quotation marks, then the longest pieces that do not look like
 * an author list.
 */
export function titleCandidates(citation: string): string[] {
  const quoted = [...citation.matchAll(/["“]([^"”]{10,})["”]/g)].map(m => m[1].trim().replace(/[.,;:]+$/, ""));

  const pieces = citation
    .split(/(?<=[a-z0-9)\]])[.?!]\s+|\s*["“”]\s*|\(\d{4}[a-z]?\)[.,:]?\s*|;\s+/)
    .map(p => p.trim().replace(/^[\s.,;:]+|[\s.,;:]+$/g, ""))
    .filter(p => p.split(/\s+/).length >= 3)
    .map(p => ({ text: p, authors: looksLikeAuthors(p), length: p.split(/\s+/).length }))
    .sort((a, b) => Number(a.authors) - Number(b.authors) || b.length - a.length)
    .map(p => p.text);

  return [...new Set([...quoted, ...pieces])];
}

/** A title made safe to use as a filter value: commas, pipes and colons separate filters. */
export function titleSearchValue(title: string): string {
  return normalizeText(title);
}

// ============================================
// Judging a candidate
// ============================================

export interface Judgement {
  status: ReferenceStatus;
  similarity: number;
  notes: string[];
}

/** A title needs at least this many significant words before a match on it means much. */
const MIN_TITLE_WORDS = 3;
const LIKELY_SIMILARITY = 0.9;
const POSSIBLE_SIMILARITY = 0.6;

function surname(name: string): string | null {
  const parts = normalizeText(name).split(" ").filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : null;
}

/** True when the surname of any listed author appears in the citation. */
function authorAppears(work: WorkOutput, citation: string): boolean {
  const citationWords = new Set(normalizeText(citation).split(" "));
  return work.authors.some(a => {
    const s = surname(a.name);
    return s != null && s.length > 1 && citationWords.has(s);
  });
}

/** Whether the work's year is within one of a year in the citation; null when the citation gives no year. */
function yearAgrees(work: WorkOutput, citation: string): boolean | null {
  const years = yearsIn(citation);
  if (years.length === 0 || work.publication_year == null) return null;
  return years.some(y => Math.abs(y - work.publication_year!) <= 1);
}

/**
 * How well a work found by searching matches a free-text citation.
 * "likely" needs nearly all of the title in the citation, plus an author's
 * surname, and a year that agrees when the citation gives one.
 */
export function judgeSearchCandidate(work: WorkOutput, citation: string): Judgement {
  const { shared, total } = titleOverlap(work.title, citation);
  const similarity = total === 0 ? 0 : shared / total;
  const author = authorAppears(work, citation);
  const year = yearAgrees(work, citation);
  const longEnough = total >= MIN_TITLE_WORDS;

  // A partial match on only a couple of words ("Prof. Smith's Paper") is noise
  const tooThin = shared < MIN_TITLE_WORDS && similarity < 1;
  if (similarity < POSSIBLE_SIMILARITY || tooThin) return { status: "not_found", similarity, notes: [] };

  const notes: string[] = [];
  if (similarity < LIKELY_SIMILARITY) notes.push("The title only partly matches the citation.");
  if (!longEnough) notes.push("The title is very short, so the match is weak evidence.");
  if (!author) notes.push("None of the work's first authors is named in the citation.");
  if (year === false) notes.push(`The citation's year differs from the work's (${work.publication_year}).`);

  const likely = similarity >= LIKELY_SIMILARITY && longEnough && author && year !== false;
  return { status: likely ? "likely" : "possible", similarity, notes };
}

/**
 * Checks a work found by its identifier against the rest of the citation.
 * A DOI that resolves to a differently titled work is a common sign of a
 * mistyped or invented reference.
 */
export function judgeIdentifiedWork(work: WorkOutput, citation: string, hasText: boolean): Judgement {
  if (!hasText) return { status: "matched", similarity: 1, notes: [] };
  const similarity = titleSimilarity(work.title, citation);
  if (similarity >= POSSIBLE_SIMILARITY) return { status: "matched", similarity, notes: [] };
  return {
    status: "possible",
    similarity,
    notes: ["The identifier resolves to this work, but its title does not match the citation text."]
  };
}

/** Orders search candidates so the best match for the citation comes first. */
export function bestCandidate(
  candidates: WorkOutput[],
  citation: string
): { work: WorkOutput; judgement: Judgement } | null {
  const rank: Record<ReferenceStatus, number> = { matched: 3, likely: 2, possible: 1, not_found: 0, error: 0 };
  let best: { work: WorkOutput; judgement: Judgement } | null = null;
  for (const work of candidates) {
    const judgement = judgeSearchCandidate(work, citation);
    if (
      best == null ||
      rank[judgement.status] > rank[best.judgement.status] ||
      (rank[judgement.status] === rank[best.judgement.status] && judgement.similarity > best.judgement.similarity) ||
      // OpenAlex sometimes holds duplicate records of one work; the more cited is usually the main one
      (rank[judgement.status] === rank[best.judgement.status] &&
        judgement.similarity === best.judgement.similarity &&
        work.cited_by_count > best.work.cited_by_count)
    ) {
      best = { work, judgement };
    }
  }
  return best;
}
