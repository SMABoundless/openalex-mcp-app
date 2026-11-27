// Checks the colour tokens for readable contrast.
//
// Every pairing of a text colour with the background it is used on must meet
// WCAG 2 level AA for normal text, a contrast ratio of at least 4.5:1, in both
// the light and the dark theme. The values are read from the stylesheet, so a
// token changed there is checked here without editing this file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Comments are removed first: one sits directly before a rule and would be read as part of its selector
const css = readFileSync(new URL("../ui/shared/styles/base.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const channel = (i: number): number => {
    const v = Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

type Tokens = Map<string, string>;

/** Custom properties declared in a block of CSS, by selector scope ("" for :root, ".cat-works" and so on). */
function declarations(block: string): Map<string, Tokens> {
  const scopes = new Map<string, Tokens>();
  for (const rule of block.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const scope = rule[1].trim() === ":root" ? "" : rule[1].trim();
    const tokens = scopes.get(scope) ?? new Map<string, string>();
    for (const d of rule[2].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) tokens.set(d[1], d[2].trim());
    scopes.set(scope, tokens);
  }
  return scopes;
}

const darkStart = css.indexOf("@media (prefers-color-scheme: dark)");
// The stylesheet has two dark blocks: the app's accent, then the family style
const darkBlocks = [...css.matchAll(/@media \(prefers-color-scheme: dark\) \{([\s\S]*?)\n\}\n/g)].map(m => m[1]);
const lightCss = css.replace(/@media \(prefers-color-scheme: dark\) \{[\s\S]*?\n\}\n/g, "");
const light = declarations(lightCss);
const dark = declarations(darkBlocks.join("\n"));

/** The tokens in force for a scope in a theme: the light values, overridden by the dark ones in dark mode. */
function theme(mode: "light" | "dark", scope = ""): (name: string) => string {
  const layers = [light.get("")!, light.get(scope)];
  if (mode === "dark") layers.push(dark.get(""), dark.get(scope));
  const merged = new Map<string, string>();
  for (const layer of layers) for (const [k, v] of layer ?? []) merged.set(k, v);
  const resolve = (name: string, depth = 0): string => {
    const value = merged.get(name);
    assert.ok(value, `token ${name} is defined`);
    const ref = value.match(/^var\((--[a-z0-9-]+)\)$/);
    if (ref && depth < 5) return resolve(ref[1], depth + 1);
    assert.match(value, /^#[0-9a-f]{6}$/i, `${name} resolves to a #rrggbb colour (got ${value})`);
    return value;
  };
  return resolve;
}

// Text colour, then the background it appears on
const PAIRS: [string, string][] = [
  ["--oa-text", "--oa-bg"], ["--oa-text", "--oa-surface"], ["--oa-text", "--oa-bg-secondary"], ["--oa-text", "--oa-bg-muted"],
  ["--oa-text-strong", "--oa-bg"], ["--oa-text-strong", "--oa-bg-secondary"],
  ["--oa-text-secondary", "--oa-bg"], ["--oa-text-secondary", "--oa-surface"], ["--oa-text-secondary", "--oa-bg-secondary"], ["--oa-text-secondary", "--oa-bg-muted"],
  ["--oa-text-muted", "--oa-bg"], ["--oa-text-muted", "--oa-surface"],
  ["--oa-title", "--oa-surface"],
  ["--oa-link", "--oa-bg"], ["--oa-link", "--oa-surface"], ["--oa-link", "--oa-bg-secondary"],
  ["--oa-accent-on", "--oa-accent"],
  ["--oa-accent", "--oa-accent-soft"],
  ["--oa-info-fg", "--oa-info-bg"], ["--oa-success-fg", "--oa-success-bg"], ["--oa-warning-fg", "--oa-warning-bg"], ["--oa-danger-fg", "--oa-danger-bg"],
  ["--oa-chip-fg", "--oa-chip-bg"], ["--oa-chip2-fg", "--oa-chip2-bg"],
  ["--oa-query-fg", "--oa-query-bg"],
];
// Per kind of record: the label on its tint, and the page colour on the solid marker
const CATEGORY_PAIRS: [string, string][] = [["--oa-cat-dark", "--oa-cat-light"], ["--oa-bg", "--oa-cat-mid"], ["--oa-cat-dark", "--oa-surface"]];
const CATEGORIES = [".cat-works", ".cat-authors", ".cat-sources", ".cat-institutions", ".cat-funders", ".cat-topics"];

const AA = 4.5;

for (const mode of ["light", "dark"] as const) {
  test(`every text colour meets WCAG AA contrast on its background (${mode})`, () => {
    const failures: string[] = [];
    const check = (get: (n: string) => string, fg: string, bg: string, where: string): void => {
      const ratio = contrast(get(fg), get(bg));
      if (ratio < AA) failures.push(`${where}${fg} ${get(fg)} on ${bg} ${get(bg)}: ${ratio.toFixed(2)}:1`);
    };
    const root = theme(mode);
    for (const [fg, bg] of PAIRS) check(root, fg, bg, "");
    for (const scope of CATEGORIES) {
      const scoped = theme(mode, scope);
      for (const [fg, bg] of CATEGORY_PAIRS) check(scoped, fg, bg, `${scope} `);
    }
    assert.deepEqual(failures, [], `pairs below ${AA}:1`);
  });
}

test("the contrast calculation matches known values", () => {
  assert.equal(contrast("#000000", "#ffffff"), 21);
  assert.equal(contrast("#ffffff", "#ffffff"), 1);
  assert.ok(Math.abs(contrast("#767676", "#ffffff") - 4.54) < 0.01, "#767676 is the lightest grey that passes on white");
  assert.ok(darkStart > 0 && darkBlocks.length === 2, "both dark blocks of the stylesheet were found");
});
