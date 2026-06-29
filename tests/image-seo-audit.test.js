import assert from "node:assert/strict";
import { calculateImageScore, createImageHttpClient, createImageSeoAudit, extractImages, parseSrcset, resolveImageUrl, runImageRules } from "../server/image-seo-audit.js";
import { handleImageSeoAuditRoute } from "../server/routes/image-seo-audit-routes.js";

assert.equal(resolveImageUrl("../img/hero.jpg", "https://example.com/a/page"), "https://example.com/img/hero.jpg");
assert.equal(resolveImageUrl("data:image/png;base64,abc", "https://example.com"), "");
assert.deepEqual(parseSrcset("small.jpg 320w, large.jpg 1280w"), [{ url: "small.jpg", value: 320, unit: "w" }, { url: "large.jpg", value: 1280, unit: "w" }]);

const fixture = `<!doctype html><html><head><base href="https://cdn.example.com/assets/"><meta property="og:image" content="social.jpg"><meta name="twitter:image" content="https://media.example.com/card.jpg"></head><body><main>
<img class="hero" src="hero.jpg" loading="lazy" width="1200">
<picture><source srcset="small.webp 480w, wide.webp 1200w"><img src="fallback.jpg" alt=""></picture>
<img src="one.jpg" alt="Repeated description" width="600" height="400" decoding="async">
<img src="two.jpg" alt="Repeated description" width="600" height="400">
<img src="product-photo.jpg" alt="product photo" width="400" height="300">
<img src="generic.jpg" alt="image" width="400" height="300">
<img src="long.jpg" alt="${"A detailed image description ".repeat(8)}" width="400" height="300">
</main></body></html>`;
const extracted = extractImages(fixture, "https://example.com/page");
assert.equal(extracted.length, 10);
assert.equal(extracted[0].src, "https://cdn.example.com/assets/hero.jpg");
assert.equal(extracted[1].src, "https://cdn.example.com/assets/wide.webp");
assert.equal(extracted.filter((item) => item.type === "og:image").length, 1);
assert.equal(extracted.filter((item) => item.type === "twitter:image").length, 1);
assert.equal(extractImages(`<body>${"<img src='x.jpg' alt='x'>".repeat(210)}</body>`, "https://example.com").length, 200);

const inspected = extracted.map((image) => ({ ...image, metadata: image.src.endsWith("hero.jpg")
  ? { ok: true, status: 200, contentLength: 1_200_000, contentType: "image/jpeg" }
  : image.src.endsWith("generic.jpg") ? { ok: false, status: 404, contentLength: null, contentType: "text/html" }
    : { ok: true, status: 200, contentLength: 1000, contentType: "image/jpeg" } }));
const ruled = runImageRules(inspected);
const ruleIds = new Set(ruled.flatMap((image) => image.issues.map((issue) => issue.id)));
for (const id of ["missing_alt", "broken_image", "large_image", "empty_alt", "generic_alt", "duplicate_alt", "filename_alt", "missing_dimensions", "hero_lazy_loading", "long_alt", "missing_decoding", "missing_lazy_loading"]) assert.equal(ruleIds.has(id), true, `expected ${id}`);
assert.deepEqual(ruled.filter((image) => image.issues.some((issue) => issue.id === "missing_alt")).map((image) => image.src), ["https://cdn.example.com/assets/hero.jpg"]);
assert.equal(ruled.filter((image) => image.hasAlt && image.issues.some((issue) => issue.id === "missing_alt")).length, 0);
assert.deepEqual(ruled.filter((image) => image.issues.some((issue) => issue.id === "empty_alt")).map((image) => image.src), ["https://cdn.example.com/assets/fallback.jpg"]);
assert.equal(runImageRules(extractImages(`<img src="icon.svg" alt="">`, "https://example.com"))[0].issues.some((issue) => ["missing_alt", "empty_alt"].includes(issue.id)), false);
const filteredRules = runImageRules(inspected, { enabledRules: ["broken_image"] });
assert.deepEqual([...new Set(filteredRules.flatMap((image) => image.issues.map((issue) => issue.id)))], ["broken_image"]);
assert.equal(filteredRules.some((image) => image.suggestedHtml.includes("decoding=\"async\"")), false);
assert.equal(calculateImageScore([{ issues: [{ severity: "critical" }, { severity: "warning" }, { severity: "notice" }] }]), 83);
assert.equal(calculateImageScore([{ issues: Array.from({ length: 20 }, () => ({ severity: "critical" })) }]), 0);

let metadataRequestCount = 0;
const rangedInspector = createImageHttpClient({ allowLocal: true, fetchImpl: async (_url, init) => {
  metadataRequestCount += 1;
  return init.method === "HEAD"
    ? new Response(null, { status: 200, headers: { "content-type": "image/jpeg" } })
    : new Response(null, { status: 206, headers: { "content-type": "image/jpeg", "content-length": "1", "content-range": "bytes 0-0/2000000" } });
} });
const rangedMetadata = await rangedInspector("http://localhost/large.jpg");
assert.equal(metadataRequestCount, 2);
assert.equal(rangedMetadata.contentLength, 2_000_000);

let localDispatcherUsed = false;
let localDispatcherClosed = false;
const localService = createImageSeoAudit({
  allowLocal: true,
  createLocalDispatcher: async () => {
    localDispatcherUsed = true;
    return { close: async () => { localDispatcherClosed = true; } };
  },
  fetchImpl: async (_url, init) => {
    assert.ok(init.dispatcher);
    return new Response("<html></html>", { status: 200, headers: { "content-type": "text/html" } });
  },
});
await localService.auditPage("https://72.rocky.wsl/www.da-vinci.com.tw/");
assert.equal(localDispatcherUsed, true);
assert.equal(localDispatcherClosed, true);

const service = createImageSeoAudit({ fetchHtml: async () => ({ html: fixture, finalUrl: "https://example.com/final" }), inspectImage: async (url) => ({ ok: !url.endsWith("generic.jpg"), status: url.endsWith("generic.jpg") ? 404 : 200, contentLength: url.endsWith("hero.jpg") ? 1_200_000 : 1000, contentType: "image/jpeg" }) });
const result = await service.auditPage("https://example.com/start");
assert.equal(result.url, "https://example.com/final");
assert.equal(result.summary.totalImages, 10);
assert.equal(result.issueGroups.length, 12);
assert.equal(result.images.every((image) => typeof image.suggestedHtml === "string"), true);
const recommendedResult = await service.auditPage("https://example.com/start", { enabledRules: ["missing_alt", "broken_image"] });
assert.deepEqual(recommendedResult.enabledRules, ["missing_alt", "broken_image"]);
assert.equal(recommendedResult.issueGroups.some((group) => group.id === "missing_decoding"), false);
await assert.rejects(() => createImageSeoAudit({ allowLocal: false }).auditPage("http://localhost/admin"), (error) => error.code === "UNSAFE_URL");
await assert.rejects(() => service.auditPage("file:///tmp/test"), (error) => error.code === "INVALID_URL");

function response() { let finish; const finished = new Promise((resolve) => { finish = resolve; }); return { soosRequestId: "image-route-test", setHeader() {}, writeHead(status) { this.statusCode = status; }, end(body) { this.body = JSON.parse(body); this.writableEnded = true; finish(); }, finished }; }
const res = response();
assert.equal(handleImageSeoAuditRoute({ method: "POST", body: { url: "https://example.com" } }, res, "/api/image-seo-audit", { auditPage: async () => ({ score: 100, summary: { totalImages: 0 }, issueGroups: [], images: [] }), sendRouteError: () => {} }), true);
await res.finished;
assert.equal(res.statusCode, 200);
assert.equal(res.body.score, 100);
assert.equal(handleImageSeoAuditRoute({ method: "GET" }, response(), "/api/image-seo-audit", {}), false);
console.log("image-seo-audit-tests-passed");
