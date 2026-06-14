export const LARGE_RESULT_PAGE_SIZE = 50;

export function paginateResultRows(rows, pageNumber, pageSize = LARGE_RESULT_PAGE_SIZE) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const safePageSize = Math.max(1, Number(pageSize) || LARGE_RESULT_PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(safeRows.length / safePageSize));
  const page = Math.min(pageCount, Math.max(1, Number(pageNumber) || 1));
  const start = (page - 1) * safePageSize;
  return {
    items: safeRows.slice(start, start + safePageSize),
    page,
    pageCount,
    total: safeRows.length,
  };
}
