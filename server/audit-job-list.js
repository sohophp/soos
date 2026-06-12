const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

export function normalizeAuditJobListOptions(options = {}) {
  const pageSize = Math.max(1, Math.min(Number(options.pageSize) || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE));
  const page = Math.max(1, Number(options.page) || 1);
  const query = String(options.query || "").trim().toLowerCase().slice(0, 200);
  const status = /^[a-z_]+$/.test(String(options.status || "")) ? String(options.status) : "";
  return { page, pageSize, query, status };
}

function jobSearchText(job) {
  return [
    job.id,
    job.status,
    job.request?.sitemapUrl,
    job.request?.url,
    job.request?.inputUrl,
    job.result?.input?.originalUrl,
    job.result?.input?.sitemapUrl,
  ].filter(Boolean).join(" ").toLowerCase();
}

export function paginateAuditJobs(items, options = {}, retentionMs = 0) {
  const normalized = normalizeAuditJobListOptions(options);
  const filtered = (items || [])
    .filter((job) => !normalized.status || job.status === normalized.status)
    .filter((job) => !normalized.query || jobSearchText(job).includes(normalized.query))
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / normalized.pageSize));
  const page = Math.min(normalized.page, pageCount);
  const start = (page - 1) * normalized.pageSize;
  return {
    items: filtered.slice(start, start + normalized.pageSize).map((job) => ({
      ...job,
      expiresAt: retentionMs && job.updatedAt
        ? new Date(Number(job.updatedAt) + retentionMs).toISOString()
        : null,
    })),
    total,
    page,
    pageSize: normalized.pageSize,
    pageCount,
  };
}
