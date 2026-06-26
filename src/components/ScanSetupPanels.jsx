import React from "react";
import { Info } from "lucide-react";
import { pageSpeedText } from "../i18n.js";
import {
  readGoogleApiSessionKey,
  readPageSpeedSessionKey,
  writeGoogleApiSessionKey,
  writePageSpeedSessionKey,
} from "../pagespeed-key.js";
import { PrivacyDataPanel } from "./PrivacyDataPanel.jsx";
import {
  ProgressBar,
  ProgressControls,
  RuntimePanel,
} from "./ScanRuntimePanel.jsx";
import { ScanCommandBar } from "./ScanCommandBar.jsx";

export function ScanLaunchPanel({ t, settings, runner, onSubmit, onControl }) {
  return (
    <>
      <section className="scan-start-guide" aria-label={t.scanStepsTitle}>
        <div>
          <span>1</span>
          <strong>{t.scanStepSettings}</strong>
          <small>{t.scanStepSettingsHelp}</small>
        </div>
        <div>
          <span>2</span>
          <strong>{t.scanStepRun}</strong>
          <small>{t.scanStepRunHelp}</small>
        </div>
        <div>
          <span>3</span>
          <strong>{t.scanStepEvidence}</strong>
          <small>{t.scanStepEvidenceHelp}</small>
        </div>
      </section>
      <ScanCommandBar t={t} settings={settings} runner={runner} onSubmit={onSubmit} />

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
  const [googleApiKey, setGoogleApiKey] = React.useState(readGoogleApiSessionKey);
  const [pageSpeedKey, setPageSpeedKey] = React.useState(readPageSpeedSessionKey);

  function notifyApiKeyChange() {
    globalThis.dispatchEvent?.(new Event("soos:pagespeed-key"));
  }

  function updateGoogleApiKey(value) {
    setGoogleApiKey(value);
    writeGoogleApiSessionKey(value);
    notifyApiKeyChange();
  }

  function updatePageSpeedKey(value) {
    setPageSpeedKey(value);
    writePageSpeedSessionKey(value);
    notifyApiKeyChange();
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
          <strong>{pageSpeedCopy.sharedApiKey}</strong>
          <input
            type="password"
            autoComplete="off"
            value={googleApiKey}
            onChange={(event) => updateGoogleApiKey(event.target.value)}
            placeholder={pageSpeedCopy.sharedApiKeyPlaceholder}
          />
        </label>
        <label>
          <strong>{pageSpeedCopy.pageSpeedApiKey}</strong>
          <input
            type="password"
            autoComplete="off"
            value={pageSpeedKey}
            onChange={(event) => updatePageSpeedKey(event.target.value)}
            placeholder={pageSpeedCopy.pageSpeedApiKeyPlaceholder}
          />
        </label>
        <div className="pagespeed-settings-actions">
          {googleApiKey || pageSpeedKey ? (
            <button className="export-button" type="button" onClick={() => {
              updateGoogleApiKey("");
              updatePageSpeedKey("");
            }}>
              {pageSpeedCopy.clearKey}
            </button>
          ) : null}
          <a className="export-button" href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">
            {pageSpeedCopy.applyApiKey}
          </a>
          <a className="export-button" href="https://console.cloud.google.com/apis/library/pagespeedonline.googleapis.com" target="_blank" rel="noreferrer">
            {pageSpeedCopy.enablePageSpeedApi}
          </a>
          <a className="export-button" href="https://console.cloud.google.com/apis/library/searchconsole.googleapis.com" target="_blank" rel="noreferrer">
            {pageSpeedCopy.enableSearchConsoleApi}
          </a>
          <a className="export-button" href="https://developers.google.com/webmaster-tools/v1/how-tos/authorizing" target="_blank" rel="noreferrer">
            {pageSpeedCopy.gscAuthGuide}
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
