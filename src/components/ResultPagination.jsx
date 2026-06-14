import React from "react";
import { workspaceText } from "../i18n.js";

export function ResultPagination({ pagination, onPage, label, language }) {
  if (pagination.pageCount <= 1) return null;
  const copy = workspaceText[language] || workspaceText.en;
  return (
    <nav className="result-pagination" aria-label={label}>
      <button
        type="button"
        aria-label={`${copy.previousPage}: ${label}`}
        onClick={() => onPage(pagination.page - 1)}
        disabled={pagination.page === 1}
      >
        {copy.previousPage}
      </button>
      <span aria-live="polite" aria-atomic="true">
        {copy.page} {pagination.page} {copy.of} {pagination.pageCount}
      </span>
      <button
        type="button"
        aria-label={`${copy.nextPage}: ${label}`}
        onClick={() => onPage(pagination.page + 1)}
        disabled={pagination.page === pagination.pageCount}
      >
        {copy.nextPage}
      </button>
    </nav>
  );
}
