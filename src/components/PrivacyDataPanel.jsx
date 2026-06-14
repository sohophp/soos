import React, { useEffect, useState } from "react";
import { formatApiError } from "../api-client.js";
import {
  browserSoosDataSummary,
  clearBrowserSoosData,
  deleteSessionData,
  getSessionDataSummary,
} from "../session-data.js";
import { privacyDataText } from "../i18n.js";

export function PrivacyDataPanel({ language, onDeleted }) {
  const copy = privacyDataText[language] || privacyDataText.en;
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const localCount = browserSoosDataSummary().count;

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setSummary(await getSessionDataSummary());
    } catch (requestError) {
      setError(formatApiError(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function removeAllData() {
    if (!window.confirm(copy.confirmDelete)) return;
    setDeleting(true);
    setError("");
    setMessage("");
    try {
      const result = await deleteSessionData();
      const localDeleted = clearBrowserSoosData();
      setSummary(result.remaining);
      setMessage(copy.deleted.replace("{local}", String(localDeleted)));
      onDeleted?.(result);
    } catch (requestError) {
      setError(formatApiError(requestError));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="panel privacy-data-panel">
      <div className="panel-head">
        <div>
          <h2>{copy.title}</h2>
          <small>{copy.help}</small>
        </div>
        <button className="export-button" type="button" onClick={refresh} disabled={loading || deleting}>
          {loading ? copy.loading : copy.refresh}
        </button>
      </div>
      <div className="privacy-data-grid" aria-live="polite">
        <div><strong>{copy.googleConnection}</strong><span>{summary?.gscConfig ? copy.present : copy.none}</span></div>
        <div><strong>{copy.retainedJobs}</strong><span>{summary?.jobs ?? "-"}</span></div>
        <div><strong>{copy.checkpoints}</strong><span>{summary?.batches ?? "-"}</span></div>
        <div><strong>{copy.leases}</strong><span>{summary?.leases ?? "-"}</span></div>
        <div><strong>{copy.localData}</strong><span>{localCount}</span></div>
      </div>
      <p className="privacy-data-note">{copy.retention}</p>
      <button className="danger-button" type="button" onClick={removeAllData} disabled={deleting}>
        {deleting ? copy.deleting : copy.deleteAll}
      </button>
      {message ? <small className="gsc-api-message" role="status">{message}</small> : null}
      {error ? <small className="gsc-api-error" role="alert">{error}</small> : null}
    </section>
  );
}
