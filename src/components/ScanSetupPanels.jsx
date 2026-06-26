import React from "react";
import { FileSearch, Info, Loader2, Search } from "lucide-react";
import { pageSpeedText } from "../i18n.js";
import { readPageSpeedSessionKey, writePageSpeedSessionKey } from "../pagespeed-key.js";
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
  const pageSpeedCopy = pageSpeedText[language] || pageSpeedText.en;
  const [pageSpeedKey, setPageSpeedKey] = React.useState(readPageSpeedSessionKey);

  function updatePageSpeedKey(value) {
    setPageSpeedKey(value);
    writePageSpeedSessionKey(value);
    globalThis.dispatchEvent?.(new Event("soos:pagespeed-key"));
  }

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

      <section className="pagespeed-settings">
        <div className="url-policy-copy">
          <strong>{pageSpeedCopy.settingsTitle}</strong>
          <small>{pageSpeedCopy.settingsHelp}</small>
        </div>
        <label>
          <strong>{pageSpeedCopy.apiKey}</strong>
          <input
            type="password"
            autoComplete="off"
            value={pageSpeedKey}
            onChange={(event) => updatePageSpeedKey(event.target.value)}
            placeholder={pageSpeedCopy.apiKeyPlaceholder}
          />
        </label>
        <div className="pagespeed-settings-actions">
          {pageSpeedKey ? (
            <button className="export-button" type="button" onClick={() => updatePageSpeedKey("")}>
              {pageSpeedCopy.clearKey}
            </button>
          ) : null}
          <a className="export-button" href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">
            {pageSpeedCopy.applyApiKey}
          </a>
          <a className="export-button" href="https://console.cloud.google.com/apis/library/pagespeedonline.googleapis.com" target="_blank" rel="noreferrer">
            {pageSpeedCopy.enablePageSpeedApi}
          </a>
          <a className="export-button" href="https://developers.google.com/search/docs/monitor-debug/search-console-start" target="_blank" rel="noreferrer">
            {pageSpeedCopy.enableGscGuide}
          </a>
        </div>
      </section>

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
