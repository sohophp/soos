import assert from "node:assert/strict";
import { detectCsvDelimiter, parseCsvRows, parseSearchConsoleCsv } from "../src/gsc-csv.js";

assert.equal(detectCsvDelimiter("a,b\n1,2"), ",");
assert.equal(detectCsvDelimiter("a\tb\n1\t2"), "\t");

assert.deepEqual(parseCsvRows("a,b\n\"x,y\",z"), [["a", "b"], ["x,y", "z"]]);

const parsedCn = parseSearchConsoleCsv([
  "排名靠前的网页,点击次数,展示,点击率,排名",
  "https://example.com/a,12,345,3.48%,6.7",
].join("\n"));
assert.equal(parsedCn.length, 1);
assert.equal(parsedCn[0].page, "https://example.com/a");
assert.equal(parsedCn[0].clicks, 12);
assert.equal(parsedCn[0].impressions, 345);
assert.equal(parsedCn[0].ctr, 3.48);
assert.equal(parsedCn[0].position, 6.7);

const parsedTsv = parseSearchConsoleCsv([
  "Pages\tClicks\tImpressions\tCTR\tPosition",
  "https://example.com/b\t5\t120\t4.17%\t9.4",
].join("\n"));
assert.equal(parsedTsv.length, 1);
assert.equal(parsedTsv[0].key, "https://example.com/b");

assert.deepEqual(parseSearchConsoleCsv("Date,Clicks\n2026-01-01,1"), []);

console.log("gsc-csv-tests-passed");
