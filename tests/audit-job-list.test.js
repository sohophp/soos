import assert from "node:assert/strict";
import { normalizeAuditJobListOptions, paginateAuditJobs } from "../server/audit-job-list.js";

assert.deepEqual(normalizeAuditJobListOptions({
  page: -2,
  pageSize: 500,
  query: "  Example.COM  ",
  status: "done",
}), {
  page: 1,
  pageSize: 50,
  query: "example.com",
  status: "done",
});
assert.equal(normalizeAuditJobListOptions({ status: "bad value!" }).status, "");

const jobs = [
  { id: "job-a", status: "done", updatedAt: 1000, request: { sitemapUrl: "https://example.com/sitemap.xml" } },
  { id: "job-b", status: "error", updatedAt: 3000, request: { sitemapUrl: "https://other.test/sitemap.xml" } },
  { id: "job-c", status: "done", updatedAt: 2000, request: { sitemapUrl: "https://example.com/news.xml" } },
];
const result = paginateAuditJobs(jobs, {
  query: "example.com",
  status: "done",
  page: 1,
  pageSize: 1,
}, 60000);
assert.equal(result.total, 2);
assert.equal(result.pageCount, 2);
assert.equal(result.items[0].id, "job-c");
assert.equal(result.items[0].expiresAt, new Date(62000).toISOString());

const clamped = paginateAuditJobs(jobs, { page: 20, pageSize: 2 }, 0);
assert.equal(clamped.page, 2);
assert.equal(clamped.items[0].id, "job-a");

console.log("audit-job-list-tests-passed");
