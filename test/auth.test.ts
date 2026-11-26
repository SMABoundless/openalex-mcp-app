import { test } from "node:test";
import assert from "node:assert/strict";
import { isAuthorized } from "../server/auth.js";

const SECRET = "correct-horse-battery-staple";

test("with no secret configured every request is allowed", () => {
  assert.equal(isAuthorized(undefined, undefined, undefined), true);
  assert.equal(isAuthorized("Bearer anything", "anything", undefined), true);
});

test("a request with no credentials is refused once a secret is set", () => {
  assert.equal(isAuthorized(undefined, undefined, SECRET), false);
  assert.equal(isAuthorized("", "", SECRET), false);
});

test("the secret is accepted as a bearer token", () => {
  assert.equal(isAuthorized(`Bearer ${SECRET}`, undefined, SECRET), true);
  assert.equal(isAuthorized(`bearer   ${SECRET}`, undefined, SECRET), true);
});

test("the secret is accepted as the key query parameter", () => {
  assert.equal(isAuthorized(undefined, SECRET, SECRET), true);
});

test("a wrong, partial or differently-cased secret is refused", () => {
  assert.equal(isAuthorized("Bearer wrong", undefined, SECRET), false);
  assert.equal(isAuthorized(`Bearer ${SECRET.slice(0, -1)}`, undefined, SECRET), false);
  assert.equal(isAuthorized(`Bearer ${SECRET}x`, undefined, SECRET), false);
  assert.equal(isAuthorized(undefined, SECRET.toUpperCase(), SECRET), false);
});

test("the header must use the Bearer scheme", () => {
  assert.equal(isAuthorized(SECRET, undefined, SECRET), false);
  assert.equal(isAuthorized(`Basic ${SECRET}`, undefined, SECRET), false);
});

test("a repeated key parameter, which arrives as an array, is refused rather than crashing", () => {
  assert.equal(isAuthorized(undefined, [SECRET, SECRET], SECRET), false);
  assert.equal(isAuthorized(undefined, { nested: SECRET }, SECRET), false);
});

test("a right header wins even if the key parameter is wrong, and the reverse", () => {
  assert.equal(isAuthorized(`Bearer ${SECRET}`, "wrong", SECRET), true);
  assert.equal(isAuthorized("Bearer wrong", SECRET, SECRET), true);
});
