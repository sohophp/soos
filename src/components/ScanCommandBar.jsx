import React from "react";
import { FileSearch, Loader2, Search } from "lucide-react";

export function ScanCommandBar({ t, settings, runner, onSubmit }) {
  return (
    <form className="scan-command-bar" onSubmit={onSubmit}>
      <div className="scan-command-field">
        <Search size={20} aria-hidden="true" />
        <label className="visually-hidden" htmlFor="audit-url">{t.auditUrlLabel}</label>
        <input
          id="audit-url"
          type="url"
          required
          placeholder={t.placeholder}
          value={settings.sitemapUrl}
          onChange={(event) => settings.setValue("sitemapUrl", event.target.value)}
        />
      </div>
      <button type="submit" disabled={runner.loading}>
        {runner.loading
          ? <Loader2 className="spin" size={18} aria-hidden="true" />
          : <FileSearch size={18} aria-hidden="true" />}
        {t.audit}
      </button>
      <small>{t.scanCommandHelp}</small>
    </form>
  );
}
