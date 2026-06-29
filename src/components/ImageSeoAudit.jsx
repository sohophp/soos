import React, { useState } from "react";
import { Check, Clipboard, Image as ImageIcon, LoaderCircle, ScanSearch } from "lucide-react";
import { apiPost, formatApiError } from "../api-client.js";

const severityOrder = { critical: 0, warning: 1, notice: 2 };
const auditChecks = [
  ["missing_alt", "Missing alt", "critical"], ["broken_image", "Broken image", "critical"], ["large_image", "Large image (>1 MB)", "critical"],
  ["empty_alt", "Empty alt on content image", "warning"], ["generic_alt", "Generic alt", "warning"], ["duplicate_alt", "Duplicate alt", "warning"],
  ["filename_alt", "Filename used as alt", "warning"], ["missing_dimensions", "Missing width / height", "warning"], ["hero_lazy_loading", "Hero lazy loading", "warning"],
  ["long_alt", "Alt text too long", "notice"], ["missing_decoding", "Missing decoding=\"async\"", "notice"], ["missing_lazy_loading", "Missing lazy loading", "notice"],
];
const defaultChecks = auditChecks.map(([id]) => id).filter((id) => id !== "missing_decoding");

function SeverityBadge({ severity }) {
  return <span className={`image-audit-badge ${severity}`}>{severity}</span>;
}

function ImageCard({ image, visibleIssues }) {
  const [copied, setCopied] = useState(false);
  async function copyHtml() {
    await navigator.clipboard.writeText(image.suggestedHtml);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }
  return (
    <article className="image-audit-card">
      <div className="image-audit-preview">
        <img src={image.src} alt="" loading="lazy" referrerPolicy="no-referrer" />
        <span>{image.type}</span>
      </div>
      <div className="image-audit-card-body">
        <a className="image-audit-url" href={image.src} target="_blank" rel="noreferrer">{image.src}</a>
        <dl className="image-audit-facts">
          <div><dt>Current alt (raw HTML)</dt><dd>{image.hasAlt ? (image.alt || <em>empty attribute</em>) : <em>attribute missing</em>}</dd></div>
          <div><dt>Signals</dt><dd>{[image.hero && "hero", image.decorative && "decorative", image.metadata?.contentLength ? `${Math.round(image.metadata.contentLength / 1024)} KB` : ""].filter(Boolean).join(" · ") || "—"}</dd></div>
        </dl>
        <details className="image-audit-evidence">
          <summary>Scanned HTML evidence</summary>
          <code>{image.outerHTML}</code>
          <p>The audit evaluates server-returned HTML. Attributes added later by JavaScript are not visible to this scan.</p>
        </details>
        {visibleIssues.length ? (
          <div className="image-audit-findings">
            {[...visibleIssues].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]).map((issue) => (
              <section key={issue.id}>
                <header><SeverityBadge severity={issue.severity} /><strong>{issue.title}</strong></header>
                <p><b>Why it matters:</b> {issue.why}</p>
                <p><b>Recommended fix:</b> {issue.fix}</p>
              </section>
            ))}
          </div>
        ) : <p className="image-audit-pass"><Check size={16} /> {image.issues.length ? "No issues match the current filters." : "All image SEO checks passed."}</p>}
        <div className="image-audit-code">
          <div><strong>Suggested HTML</strong><button type="button" onClick={copyHtml}>{copied ? <Check size={15} /> : <Clipboard size={15} />}{copied ? "Copied" : "Copy"}</button></div>
          <code>{image.suggestedHtml}</code>
        </div>
      </div>
    </article>
  );
}

export function ImageSeoAudit() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [visibleChecks, setVisibleChecks] = useState(() => new Set(defaultChecks));
  const [showPassed, setShowPassed] = useState(false);
  function toggleCheck(id) {
    setVisibleChecks((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  async function scan(event) {
    event.preventDefault(); setLoading(true); setError(""); setResult(null);
    try { setResult(await apiPost("/api/image-seo-audit", { url }, { fallbackMessage: "Image audit failed" })); }
    catch (scanError) { setError(formatApiError(scanError)); }
    finally { setLoading(false); }
  }
  return (
    <div className="image-audit-workspace">
      <header className="image-audit-hero">
        <div><span className="image-audit-kicker"><ImageIcon size={15} /> Focused diagnostic</span><h2>Image SEO Audit</h2><p>Inspect image search, accessibility, and performance signals in server-rendered HTML.</p></div>
        <span className="image-audit-limit">Up to 200 images</span>
      </header>
      <form className="image-audit-form" onSubmit={scan}>
        <label htmlFor="image-audit-url">Page URL</label>
        <div><input id="image-audit-url" type="url" required value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/page" /><button type="submit" disabled={loading}>{loading ? <LoaderCircle className="spin" size={18} /> : <ScanSearch size={18} />}{loading ? "Scanning…" : "Scan"}</button></div>
      </form>
      {error ? <div className="image-audit-error" role="alert">{error}</div> : null}
      {result ? <>
        <section className="image-audit-summary" aria-label="Audit summary">
          <div className="score"><span>Image SEO Score</span><strong>{result.score}</strong><small>/ 100</small></div>
          {["totalImages", "critical", "warning", "notice", "passed"].map((key) => <div key={key} className={key}><span>{key === "totalImages" ? "Total Images" : key}</span><strong>{result.summary[key]}</strong></div>)}
        </section>
        <fieldset className="image-audit-checks image-audit-result-filters">
          <legend>Filter results <span>{visibleChecks.size} / {auditChecks.length} checks</span></legend>
          <div className="image-audit-check-actions">
            <button type="button" onClick={() => setVisibleChecks(new Set(auditChecks.map(([id]) => id)))}>Select all</button>
            <button type="button" onClick={() => setVisibleChecks(new Set(defaultChecks))}>Recommended</button>
            <button type="button" onClick={() => setVisibleChecks(new Set())}>Clear</button>
          </div>
          <div className="image-audit-check-grid">
            {auditChecks.map(([id, label, severity]) => <label key={id} className={visibleChecks.has(id) ? "selected" : ""}>
              <input type="checkbox" checked={visibleChecks.has(id)} onChange={() => toggleCheck(id)} />
              <span><strong>{label}</strong><small className={severity}>{severity}</small></span>
            </label>)}
            <label className={showPassed ? "selected" : ""}>
              <input type="checkbox" checked={showPassed} onChange={(event) => setShowPassed(event.target.checked)} />
              <span><strong>Show passed / unmatched images</strong></span>
            </label>
          </div>
          <p>Filters update the existing scan instantly. The recommended view hides the low-impact decoding hint.</p>
        </fieldset>
        {(() => {
          const visibleGroups = result.issueGroups.filter((group) => visibleChecks.has(group.id));
          const visibleImages = result.images.map((image) => ({
            image: visibleChecks.has("missing_decoding") ? image : { ...image, suggestedHtml: image.suggestedHtml.replace(/\sdecoding="async"/, "") },
            visibleIssues: image.issues.filter((issue) => visibleChecks.has(issue.id)),
          })).filter(({ visibleIssues }) => showPassed || visibleIssues.length);
          return <>
            <section className="image-audit-overview"><div><h3>Issues overview</h3><p>{visibleGroups.length ? `${visibleGroups.length} selected rule groups need attention.` : "No issues match the current filters."}</p></div><div className="image-audit-groups">{visibleGroups.map((group) => <span key={group.id}><SeverityBadge severity={group.severity} /> {group.title}<b>{group.count}</b></span>)}</div></section>
            <section className="image-audit-results"><div><h3>Images</h3><p>Showing {visibleImages.length} of {result.images.length} images. Each card includes evidence and a copy-ready fix.</p></div>{result.images.length ? (visibleImages.length ? visibleImages.map(({ image, visibleIssues }) => <ImageCard key={image.id} image={image} visibleIssues={visibleIssues} />) : <div className="image-audit-empty">No images match the selected result filters.</div>) : <div className="image-audit-empty">No supported images were found in the server-rendered HTML.</div>}</section>
          </>;
        })()}
      </> : null}
    </div>
  );
}
