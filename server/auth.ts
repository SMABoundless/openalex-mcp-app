import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Optional shared secret for the HTTP transport. When MCP_AUTH_TOKEN is set,
 * every request to /mcp must present it. It has no effect on stdio, where the
 * server is only reachable by the program that launched it.
 */
export const MCP_AUTH_TOKEN = process.env.MCP_AUTH_TOKEN?.trim() || undefined;

/** Compare without leaking, through timing, how much of the secret matched. */
function sameSecret(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * Whether a request carries the shared secret.
 *
 * Two ways to present it are accepted:
 * - an `Authorization: Bearer <secret>` header, for clients that can send headers;
 * - a `key` query parameter (`/mcp?key=<secret>`), for clients that only take a URL.
 *
 * With no secret configured, every request is allowed.
 */
export function isAuthorized(
  authorizationHeader: string | undefined,
  keyParam: unknown,
  expected: string | undefined = MCP_AUTH_TOKEN
): boolean {
  if (!expected) return true;

  const bearer = authorizationHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (bearer && sameSecret(bearer, expected)) return true;

  if (typeof keyParam === "string" && keyParam.length > 0 && sameSecret(keyParam, expected)) return true;

  return false;
}
