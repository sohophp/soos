import { normalizeReportUrl } from "./url-policy.js";

export function googleRichIssues(inspection) {
  const issues = [];
  for (const detected of inspection?.richResultsDetectedItems || []) {
    const richType = detected.richResultType || detected.type || "Rich result";
    for (const item of detected.items || []) {
      for (const issue of item.issues || []) {
        issues.push({
          type: richType,
          severity: String(issue.severity || "WARNING").toLowerCase(),
          detail: issue.issueMessage || issue.message || JSON.stringify(issue),
        });
      }
    }
  }
  return issues;
}

export function buildStructuredDataRows(report, inspectionResults) {
  const inspectionByUrl = new Map(
    (inspectionResults || []).map((item) => [normalizeReportUrl(item.url), item]),
  );
  return (report?.pages || [])
    .map((page) => {
      const local = page.structuredData;
      const inspection = inspectionByUrl.get(normalizeReportUrl(page.url));
      const localErrors = (local?.diagnostics || []).filter((item) => item.severity === "warning");
      const recommendations = (local?.diagnostics || []).filter((item) => item.severity === "notice");
      return {
        url: page.url,
        nodeCount: local?.nodeCount || 0,
        types: local?.types || [],
        validatedTypes: local?.validatedTypes || [],
        unvalidatedTypes: local?.unvalidatedTypes || [],
        localErrors,
        recommendations,
        googleIssues: googleRichIssues(inspection),
        googleVerdict: inspection?.richResultsVerdict || "",
        hasMarkup: Boolean(local?.count || local?.nodeCount || inspection?.richResultsDetectedItems?.length),
      };
    })
    .filter((row) => row.hasMarkup);
}

export function summarizeStructuredDataRows(rows) {
  return rows.reduce(
    (sum, row) => ({
      errors: sum.errors + row.localErrors.length,
      recommendations: sum.recommendations + row.recommendations.length,
      google: sum.google + row.googleIssues.length,
    }),
    { errors: 0, recommendations: 0, google: 0 },
  );
}

export function buildStructuredDataCoverage(rows) {
  const typeMap = new Map();
  for (const row of rows) {
    for (const type of row.types) {
      const current = typeMap.get(type) || { type, pages: 0, validated: false };
      current.pages += 1;
      current.validated = current.validated || row.validatedTypes.includes(type);
      typeMap.set(type, current);
    }
  }
  return [...typeMap.values()].sort(
    (a, b) => Number(b.validated) - Number(a.validated) || b.pages - a.pages || a.type.localeCompare(b.type),
  );
}

export function buildStructuredDataCsvRows(rows, noIssuesLabel) {
  const exportRows = [["url", "source", "severity", "schema_type", "property", "detail"]];
  for (const row of rows) {
    for (const item of [...row.localErrors, ...row.recommendations]) {
      exportRows.push([row.url, "local", item.severity, item.type, item.property, item.detail]);
    }
    for (const item of row.googleIssues) {
      exportRows.push([row.url, "google", item.severity, item.type, "", item.detail]);
    }
    if (!row.localErrors.length && !row.recommendations.length && !row.googleIssues.length) {
      exportRows.push([row.url, "local", "ok", row.types.join(" | "), "", noIssuesLabel]);
    }
  }
  return exportRows;
}
