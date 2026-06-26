import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ChartNoAxesCombined,
  History,
  Link,
  ListChecks,
  ScanSearch,
  Settings,
} from "lucide-react";
import { formatApiError } from "./api-client.js";
import {
  useAuditRunner,
} from "./hooks/useAuditRunner.js";
import { useGscWorkspace } from "./hooks/useGscWorkspace.js";
import { useRetainedJobs } from "./hooks/useRetainedJobs.js";
import { useReportHistory } from "./hooks/useReportHistory.js";
import { useScanSettings } from "./hooks/useScanSettings.js";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";
import { GoogleWorkspace } from "./components/GoogleWorkspace.jsx";
import { HistoryWorkspace } from "./components/HistoryWorkspace.jsx";
import {
  ScanLaunchPanel,
  ScanSettingsPanel,
} from "./components/ScanSetupPanels.jsx";
import { WorkspaceReport } from "./components/WorkspaceReport.jsx";
import {
  detectLanguage,
  dictionaries,
  workspaceText,
} from "./i18n.js";
import { loadWorkspaceView, saveWorkspaceView } from "./workspace-views.js";
import "./styles.css";

function App() {
  const [language, setLanguage] = useState(() => detectLanguage());
  const [activeView, setActiveView] = useState(() => loadWorkspaceView());
  const [error, setError] = useState("");
  const mainContentRef = useRef(null);
  const workspacePanelRef = useRef(null);
  const workspaceTabRefs = useRef([]);
  const t = dictionaries[language];
  const workspaceCopy = workspaceText[language] || workspaceText.en;
  const scanSettings = useScanSettings();
  const gsc = useGscWorkspace();
  const reportHistory = useReportHistory();
  const retainedJobs = useRetainedJobs({
    onOpenReport: handleCompletedReport,
    onDeleteActiveJob: (jobId) => auditRunner.clearSavedJobIfActive(jobId),
  });
  const auditRunner = useAuditRunner({
    copy: t,
    onComplete: handleCompletedReport,
    onRefreshJobs: () => retainedJobs.load().catch(() => {}),
    onError: (err) => setError(formatApiError(err)),
  });
  const workspaceViews = [
    ["scan", ScanSearch],
    ["google", ChartNoAxesCombined],
    ["issues", ListChecks],
    ["urls", Link],
    ["history", History],
    ["settings", Settings],
  ];

  function changeView(view, options = {}) {
    setActiveView(saveWorkspaceView(view));
    if (options.focus !== false) {
      window.requestAnimationFrame(() => workspacePanelRef.current?.focus({ preventScroll: true }));
    }
  }

  function handleWorkspaceKeyDown(event, currentIndex) {
    const lastIndex = workspaceViews.length - 1;
    let nextIndex = null;
    if (event.key === "ArrowRight") nextIndex = currentIndex === lastIndex ? 0 : currentIndex + 1;
    if (event.key === "ArrowLeft") nextIndex = currentIndex === 0 ? lastIndex : currentIndex - 1;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = lastIndex;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextView = workspaceViews[nextIndex][0];
    changeView(nextView, { focus: false });
    window.requestAnimationFrame(() => workspaceTabRefs.current[nextIndex]?.focus());
  }

  function handleCompletedReport(result) {
    reportHistory.saveCompleted(result);
    retainedJobs.load().catch(() => {});
  }

  async function runAudit(event) {
    event.preventDefault();
    setError("");
    reportHistory.setReport(null);
    try {
      await auditRunner.start(scanSettings.toAuditRequest());
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  return (
    <>
      <a className="skip-link" href="#workspace-content">{t.skipToContent}</a>
      <main id="workspace-content" tabIndex="-1" ref={mainContentRef}>
      <header className="top">
        <div>
          <span className="mark">soos</span>
          <h1>{t.heading}</h1>
        </div>
        <div className="top-actions">
          <p>{t.subheading}</p>
          <label className="visually-hidden" htmlFor="language-select">{t.languageLabel}</label>
          <select id="language-select" value={language} onChange={(event) => setLanguage(event.target.value)}>
            <option value="en">English</option>
            <option value="zh-CN">{"\u7b80\u4f53\u4e2d\u6587"}</option>
            <option value="zh-TW">{"\u7e41\u9ad4\u4e2d\u6587"}</option>
          </select>
        </div>
      </header>

      <nav className="workspace-nav" aria-label={workspaceCopy.navigation} role="tablist">
        {workspaceViews.map(([view, Icon], index) => (
          <button
            className={activeView === view ? "active" : ""}
            type="button"
            key={view}
            id={`workspace-tab-${view}`}
            role="tab"
            aria-selected={activeView === view}
            aria-controls="workspace-panel"
            tabIndex={activeView === view ? 0 : -1}
            ref={(element) => {
              workspaceTabRefs.current[index] = element;
            }}
            onClick={() => changeView(view, { focus: false })}
            onKeyDown={(event) => handleWorkspaceKeyDown(event, index)}
          >
            <Icon size={17} aria-hidden="true" />
            <span>{workspaceCopy[view]}</span>
          </button>
        ))}
      </nav>

      <div
        id="workspace-panel"
        className="workspace-panel"
        role="tabpanel"
        aria-labelledby={`workspace-tab-${activeView}`}
        tabIndex={0}
        ref={workspacePanelRef}
      >
      <div className="workspace-view" hidden={activeView !== "scan"}>
        <ErrorBoundary panel>
          <ScanLaunchPanel
            t={t}
            settings={scanSettings}
            runner={auditRunner}
            onSubmit={runAudit}
            onControl={(action) => auditRunner.control(action).catch((err) => setError(formatApiError(err)))}
          />
        </ErrorBoundary>
      </div>

      <div className="workspace-view" hidden={activeView !== "settings"}>
        <ErrorBoundary panel>
          <ScanSettingsPanel
            t={t}
            language={language}
            settings={scanSettings}
            onDeleted={() => {
              scanSettings.reset();
              reportHistory.reset();
              gsc.reset();
              retainedJobs.reset();
              setError("");
              auditRunner.reset();
            }}
          />
        </ErrorBoundary>
      </div>

      <div className="workspace-view" hidden={activeView !== "google"}>
        <ErrorBoundary panel>
          <GoogleWorkspace gsc={gsc} report={reportHistory.report} language={language} />
        </ErrorBoundary>
      </div>

      <div className="workspace-view" hidden={activeView !== "history"}>
        <ErrorBoundary panel>
          <HistoryWorkspace
            retainedJobs={retainedJobs}
            reportHistory={reportHistory}
            scanSettings={scanSettings}
            auditRunner={auditRunner}
            t={t}
            onError={setError}
          />
        </ErrorBoundary>
      </div>

      {error ? <div className="error" role="alert">{error}</div> : null}
      <WorkspaceReport
        report={reportHistory.report}
        t={t}
        gsc={gsc}
        language={language}
        activeView={activeView}
        onViewChange={changeView}
        comparisonEntry={reportHistory.comparisonEntry}
      />
      </div>
      </main>
    </>
  );
}

const reactRootKey = Symbol.for("soos.reactRoot");
const reactRootElement = document.getElementById("root");
const reactRoot = reactRootElement[reactRootKey] || createRoot(reactRootElement);
reactRootElement[reactRootKey] = reactRoot;

reactRoot.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);

