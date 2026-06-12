import React, { useState } from "react";
import { formatApiError } from "../api-client.js";
import { parseSearchConsoleCsv } from "../gsc-csv.js";
import { gscSupportingText } from "../i18n.js";

export function SearchConsoleImport({ rows, onImport, onClear, language }) {
  const copy = gscSupportingText[language] || gscSupportingText.en;
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setMessage(`${copy.reading} ${file.name}...`);
    try {
      const text = await file.text();
      const parsed = parseSearchConsoleCsv(text);
      if (!parsed.length) {
        setError(copy.noRows);
        setMessage(`${file.name}: 0 ${copy.parsed}`);
        onImport([]);
      } else {
        onImport(parsed);
        setMessage(`${file.name}: ${parsed.length} ${copy.imported}`);
      }
    } catch (err) {
      setError(formatApiError(err));
      setMessage(`${file.name}: ${copy.importFailed}`);
    } finally {
      event.target.value = "";
    }
  }

  function clearImportedRows() {
    onClear();
    setMessage(copy.cleared);
    setError("");
  }

  return (
    <section className="panel gsc-import">
      <div className="panel-head">
        <h2>{copy.csvTitle}</h2>
        <span>{rows.length ? `${rows.length} ${copy.rowsLoaded}` : copy.optional}</span>
      </div>
      <div className="gsc-import-body">
        <div>
          <strong>{copy.importTitle}</strong>
          <small>{copy.importHelp}</small>
          {message ? <small className="gsc-import-message" role="status">{message}</small> : null}
          {error ? <small className="gsc-import-error" role="alert">{error}</small> : null}
        </div>
        <div className="gsc-import-actions">
          <label className="export-button file-button">
            {copy.importButton}
            <input type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values,text/plain" onChange={handleFile} />
          </label>
          {rows.length ? (
            <button className="export-button" type="button" onClick={clearImportedRows}>
              {copy.clearButton}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
