function joinLines(values = []) {
  return values.filter(Boolean).join("\n");
}

export function buildFixPlanCsvRows(issues = []) {
  const rows = [[
    "priority",
    "severity",
    "category",
    "type",
    "confidence",
    "affected_urls",
    "title",
    "summary",
    "impact",
    "fix_steps",
    "verification_steps",
    "evidence",
  ]];

  for (const issue of issues || []) {
    rows.push([
      issue.priorityScore ?? "",
      issue.severity || "",
      issue.category || "",
      issue.type || "",
      issue.confidence || "",
      issue.affectedUrlCount ?? issue.affectedUrls?.length ?? 0,
      issue.title || "",
      issue.summary || "",
      issue.impact || "",
      joinLines(issue.recommendedFix?.steps || []),
      joinLines((issue.verification || []).flatMap((item) => item.steps || [])),
      joinLines((issue.evidence || []).map((item) => [
        item.url || "",
        item.label || "",
        item.detail || "",
      ].filter(Boolean).join(" | "))),
    ]);
  }

  return rows;
}
