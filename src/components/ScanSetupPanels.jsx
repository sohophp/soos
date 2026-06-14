import React from "react";
import { FileSearch, Info, Loader2, Search } from "lucide-react";
import { PrivacyDataPanel } from "./PrivacyDataPanel.jsx";
import {
  ProgressBar,
  ProgressControls,
  RuntimePanel,
} from "./ScanRuntimePanel.jsx";

export function ScanLaunchPanel({ t, settings, runner, onSubmit, onControl }) {
  return (
    <>
      <form className="searchbar" onSubmit={onSubmit}>
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
        <button type="submit" disabled={runner.loading}>
          {runner.loading
            ? <Loader2 className="spin" size={18} aria-hidden="true" />
            : <FileSearch size={18} aria-hidden="true" />}
          {t.audit}
        </button>
      </form>

      <ProgressBar progress={runner.progress} />
      <RuntimePanel
        loading={runner.loading}
        jobStatus={runner.jobStatus}
        progress={runner.progress}
        runtimeMeta={runner.runtimeMeta}
        t={t}
      />
      <ProgressControls
        loading={runner.loading}
        jobStatus={runner.jobStatus}
        onPause={() => onControl("pause")}
        onResume={() => onControl("resume")}
        onStop={() => onControl("stop")}
        t={t}
      />
    </>
  );
}

export function ScanSettingsPanel({ t, language, settings, onDeleted }) {
  return (
    <>
      <SettingToggle
        checked={settings.contentChecks}
        title={t.pageChecksTitle}
        help={t.pageChecksHelp}
        onChange={(value) => settings.setValue("contentChecks", value)}
      />
      <aside className="scan-boundary-note" aria-label={t.rawHtmlBoundaryTitle}>
        <Info size={17} aria-hidden="true" />
        <span>
          <strong>{t.rawHtmlBoundaryTitle}</strong>
          <small>{t.rawHtmlBoundaryHelp}</small>
        </span>
      </aside>
      <SettingToggle
        checked={settings.performanceChecks}
        title={t.performanceChecksTitle || "Performance checks"}
        help={t.performanceChecksHelp || "TTFB, HTML size, scripts, stylesheets, images, and lightweight CWV readiness signals"}
        onChange={(value) => settings.setValue("performanceChecks", value)}
      />
      <SettingToggle
        checked={settings.backgroundMode}
        title={t.backgroundModeTitle || "Background worker mode"}
        help={t.backgroundModeHelp || "Raise the scan limit to 2000 URLs and keep the job available longer"}
        onChange={(value) => settings.setValue("backgroundMode", value)}
      />
      <SettingToggle
        checked={settings.internalCrawl}
        title={t.internalCrawlTitle}
        help={t.internalCrawlHelp}
        onChange={(value) => settings.setValue("internalCrawl", value)}
      />

      <section className="url-policy-settings">
        <div className="url-policy-copy">
          <strong>{t.urlPolicyTitle}</strong>
          <small>{t.urlPolicyHelp}</small>
        </div>
        <label>
          <strong>{t.queryPolicy}</strong>
          <select
            value={settings.urlQueryPolicy}
            onChange={(event) => settings.setValue("urlQueryPolicy", event.target.value)}
          >
            <option value="preserve">{t.queryPreserve}</option>
            <option value="strip_tracking">{t.queryStripTracking}</option>
            <option value="drop_all">{t.queryDropAll}</option>
          </select>
        </label>
        <label>
          <strong>{t.trailingSlashPolicy}</strong>
          <select
            value={settings.trailingSlashPolicy}
            onChange={(event) => settings.setValue("trailingSlashPolicy", event.target.value)}
          >
            <option value="preserve">{t.slashPreserve}</option>
            <option value="remove">{t.slashRemove}</option>
            <option value="add">{t.slashAdd}</option>
          </select>
        </label>
      </section>

      <SettingToggle
        checked={settings.directoryRobots}
        title={t.directoryRobotsTitle}
        help={t.directoryRobotsHelp}
        onChange={(value) => settings.setValue("directoryRobots", value)}
      />

      <PrivacyDataPanel language={language} onDeleted={onDeleted} />
    </>
  );
}

function SettingToggle({ checked, title, help, onChange }) {
  return (
    <label className="option-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <strong>{title}</strong>
        <small>{help}</small>
      </span>
    </label>
  );
}
