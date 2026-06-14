import { inspectionCandidateKey } from "./url-inspection-candidates.js";
import { diagnoseInspectionResult } from "./url-inspection-diagnostics.js";

export function buildInspectionQueueState(candidates, results, batchSize = 25) {
  const inspectedKeys = new Set((results || []).map((item) => inspectionCandidateKey(item.url)));
  const pendingCandidates = (candidates || []).filter((candidate) => !inspectedKeys.has(candidate.key));
  const nextCandidates = pendingCandidates.slice(0, batchSize);
  const sourceCounts = (candidates || []).reduce((counts, candidate) => {
    for (const source of candidate.sources || []) counts[source] = (counts[source] || 0) + 1;
    return counts;
  }, {});
  return {
    pendingCandidates,
    nextCandidates,
    nextUrls: nextCandidates.map((candidate) => candidate.url),
    anomalyCount: (candidates || []).filter((candidate) => candidate.priority < 40).length,
    sourceCounts,
    indexedCount: (results || []).filter((item) => item.verdict === "PASS").length,
    failedCount: (results || []).filter((item) => !item.ok || item.verdict === "FAIL").length,
  };
}

export function buildInspectionQuotaSummary(candidates, results, context = {}, batchSize = 25) {
  const safeBatchSize = Math.max(1, Number(batchSize) || 25);
  const candidateKeys = new Set((candidates || []).map((item) => item.key).filter(Boolean));
  const inspectedKeys = new Set(
    (results || [])
      .map((item) => inspectionCandidateKey(item.url))
      .filter((key) => candidateKeys.has(key)),
  );
  const total = candidateKeys.size;
  const inspected = inspectedKeys.size;
  const remaining = Math.max(0, total - inspected);
  const scopeReasons = [];

  if (!context.configured) scopeReasons.push("gsc_not_connected");
  else if (!String(context.siteUrl || "").trim()) scopeReasons.push("property_missing");
  if (!context.hasGscRows) scopeReasons.push("gsc_rows_unavailable");
  if (!context.internalCrawl) scopeReasons.push("internal_discovery_disabled");
  if (!context.comparisonAvailable) scopeReasons.push("history_comparison_missing");
  else if (!context.historyPageSnapshotAvailable) scopeReasons.push("history_page_snapshot_unavailable");
  if (context.truncated) scopeReasons.push("scan_truncated");
  if (!total) scopeReasons.push("no_candidates");

  return {
    total,
    inspected,
    remaining,
    batchSize: safeBatchSize,
    totalBatches: Math.ceil(total / safeBatchSize),
    remainingBatches: Math.ceil(remaining / safeBatchSize),
    nextBatchSize: Math.min(remaining, safeBatchSize),
    scopeReasons,
  };
}

export function localizeInspectionResults(results, language, diagnosisText) {
  return (results || []).map((item) => ({
    ...item,
    diagnoses: diagnoseInspectionResult(item).map((diagnosis) => {
      const localized = diagnosisText[language]?.[diagnosis.type];
      return localized ? { ...diagnosis, title: localized[0], action: localized[1] } : diagnosis;
    }),
  }));
}

export function summarizeInspectionDiagnoses(results) {
  return (results || []).reduce(
    (summary, item) => {
      for (const diagnosis of item.diagnoses || []) {
        summary[diagnosis.severity] = (summary[diagnosis.severity] || 0) + 1;
      }
      return summary;
    },
    { critical: 0, warning: 0, notice: 0 },
  );
}

export function mergeInspectionBatch(current, body, candidates) {
  const previousResults = current?.results || [];
  const candidateByKey = new Map((candidates || []).map((candidate) => [candidate.key, candidate]));
  const batchResults = (body?.results || []).map((item) => ({
    ...item,
    candidate: candidateByKey.get(inspectionCandidateKey(item.url)) || null,
  }));
  return {
    ...body,
    inspected: previousResults.length + batchResults.length,
    results: [...previousResults, ...batchResults],
  };
}
