export function healthScoreTone(score) {
  if (score >= 85) return "good";
  if (score >= 65) return "warn";
  return "bad";
}

export function robotsImpactIssueType(scope) {
  if (scope === "submitted_url") return "robots_disallow";
  if (scope === "canonical_target") return "canonical_blocked";
  return "alternate_blocked";
}
