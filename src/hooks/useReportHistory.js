import { useState } from "react";
import {
  loadHistory,
  loadHistoryLimit,
  saveHistory,
  saveHistoryLimit,
  toHistoryEntry,
} from "../history.js";

export function useReportHistory() {
  const [report, setReport] = useState(null);
  const [history, setHistory] = useState(() => loadHistory());
  const [historyLimit, setHistoryLimit] = useState(() => loadHistoryLimit());
  const [comparisonEntry, setComparisonEntry] = useState(null);

  function saveCompleted(result) {
    setReport(result);
    setHistory((currentHistory) => {
      const nextHistory = [
        toHistoryEntry(result),
        ...currentHistory.filter((item) => item.scannedAt !== result.scannedAt),
      ].slice(0, historyLimit);
      saveHistory(nextHistory);
      return nextHistory;
    });
    setComparisonEntry(null);
  }

  function removeHistoryEntry(id) {
    const nextHistory = history.filter((entry) => entry.id !== id);
    setHistory(nextHistory);
    saveHistory(nextHistory);
    setComparisonEntry((current) => current?.id === id ? null : current);
  }

  function clearHistory() {
    setHistory([]);
    saveHistory([]);
    setComparisonEntry(null);
  }

  function changeHistoryLimit(limit) {
    const nextHistory = history.slice(0, limit);
    setHistoryLimit(limit);
    saveHistoryLimit(limit);
    setHistory(nextHistory);
    saveHistory(nextHistory);
    setComparisonEntry((current) => (
      current && !nextHistory.some((entry) => entry.id === current.id) ? null : current
    ));
  }

  function reset() {
    setReport(null);
    setHistory([]);
    setHistoryLimit(12);
    setComparisonEntry(null);
  }

  return {
    report,
    history,
    historyLimit,
    comparisonEntry,
    setReport,
    setComparisonEntry,
    saveCompleted,
    removeHistoryEntry,
    clearHistory,
    changeHistoryLimit,
    reset,
  };
}
