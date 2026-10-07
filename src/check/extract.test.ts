import assert from "node:assert/strict";
import { test } from "node:test";
import { extractPageText } from "./extract";

test("an inline hidden element doesn't split the visible text around it", () => {
  const page = extractPageText(
    "<p>Guaran<span hidden></span>teed approval</p><p>Rates <span style='display:none'>secret</span>from 7.99% APR.</p>",
  );
  assert.equal(page.visibleText, "Guaranteed approval\nRates from 7.99% APR.");
  assert.equal(page.hiddenText, "secret");
});
