export const EMPTY_RETAINED_JOBS_META = {
  total: 0,
  page: 1,
  pageSize: 10,
  pageCount: 1,
  retentionSeconds: 0,
  storage: "memory",
};

export function normalizeRetainedJobsResponse(body = {}) {
  return {
    jobs: body.items || [],
    meta: {
      total: body.total || 0,
      page: body.page || 1,
      pageSize: body.pageSize || 10,
      pageCount: body.pageCount || 1,
      retentionSeconds: body.retentionSeconds || 0,
      storage: body.storage || "memory",
    },
  };
}
