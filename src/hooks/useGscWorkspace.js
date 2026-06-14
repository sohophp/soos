import { useEffect, useState } from "react";
import { getGscStatus } from "../gsc-client.js";

const UNAVAILABLE_STATUS = Object.freeze({
  configured: false,
  note: "Search Console API status is unavailable.",
});

export function useGscWorkspace() {
  const [rows, setRows] = useState([]);
  const [rowsSource, setRowsSource] = useState("");
  const [rowsSiteUrl, setRowsSiteUrl] = useState("");
  const [status, setStatus] = useState(null);
  const [siteUrl, setSiteUrl] = useState("");
  const [resetKey, setResetKey] = useState(0);

  function clearRows() {
    setRows([]);
    setRowsSource("");
    setRowsSiteUrl("");
  }

  function changeSiteUrl(nextSiteUrl) {
    const normalized = String(nextSiteUrl || "");
    setSiteUrl((current) => {
      if (current && current !== normalized) clearRows();
      return normalized;
    });
  }

  function applyStatus(nextStatus) {
    if (
      Boolean(status?.configured) !== Boolean(nextStatus?.configured)
      || (status?.siteUrl && status.siteUrl !== nextStatus?.siteUrl)
    ) {
      clearRows();
    }
    setStatus(nextStatus);
    if (nextStatus?.configured && nextStatus.siteUrl) {
      changeSiteUrl(nextStatus.siteUrl);
    } else if (nextStatus && !nextStatus.configured) {
      setSiteUrl("");
      clearRows();
    }
  }

  function applyRows(nextRows, context = {}) {
    setRows(Array.isArray(nextRows) ? nextRows : []);
    setRowsSource(context.source || "");
    setRowsSiteUrl(context.siteUrl || "");
  }

  async function refreshStatus() {
    try {
      const nextStatus = await getGscStatus();
      applyStatus(nextStatus);
      return nextStatus;
    } catch {
      setStatus(UNAVAILABLE_STATUS);
      return UNAVAILABLE_STATUS;
    }
  }

  function reset() {
    clearRows();
    setStatus({ configured: false });
    setSiteUrl("");
    setResetKey((value) => value + 1);
  }

  useEffect(() => {
    refreshStatus();
  }, []);

  return {
    rows,
    rowsSource,
    rowsSiteUrl,
    status,
    siteUrl,
    resetKey,
    clearRows,
    setRows: applyRows,
    setStatus: applyStatus,
    setSiteUrl: changeSiteUrl,
    refreshStatus,
    reset,
  };
}
