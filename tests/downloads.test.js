import assert from "node:assert/strict";
import { csvCell, serializeCsv } from "../src/downloads.js";

assert.equal(csvCell("plain"), "plain");
assert.equal(csvCell("a,b"), "\"a,b\"");
assert.equal(csvCell("a\"b"), "\"a\"\"b\"");
assert.equal(csvCell(null), "");
assert.equal(
  serializeCsv([
    ["url", "message"],
    ["https://example.com/?a=1,b=2", "line 1\nline 2"],
  ]),
  "url,message\n\"https://example.com/?a=1,b=2\",\"line 1\nline 2\"",
);

console.log("download-tests-passed");
