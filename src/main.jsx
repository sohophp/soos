import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ChartNoAxesCombined,
  History,
  Link,
  ListChecks,
  ScanSearch,
  Settings,
  Images,
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
import { AppHeader } from "./components/AppHeader.jsx";
import { GoogleWorkspace } from "./components/GoogleWorkspace.jsx";
import { HistoryWorkspace } from "./components/HistoryWorkspace.jsx";
import {
  ScanLaunchPanel,
  ScanSettingsPanel,
} from "./components/ScanSetupPanels.jsx";
import { WorkspaceNavigation } from "./components/WorkspaceNavigation.jsx";
import { WorkspaceReport } from "./components/WorkspaceReport.jsx";
import { ImageSeoAudit } from "./components/ImageSeoAudit.jsx";
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
  const workspaceViews = useMemo(() => [
    ["scan", ScanSearch],
    ["images", Images],
    ["google", ChartNoAxesCombined],
    ["issues", ListChecks],
    ["urls", Link],
    ["history", History],
    ["settings", Settings],
  ], []);

  useEffect(() => {
    if (workspaceViews.some(([view]) => view === activeView)) return;
    setActiveView(saveWorkspaceView("scan"));
  }, [activeView, workspaceViews]);

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
      <AppHeader
        language={language}
        onLanguageChange={setLanguage}
        report={reportHistory.report}
        t={t}
      />

      <WorkspaceNavigation
        activeView={activeView}
        ariaLabel={workspaceCopy.navigation}
        labels={workspaceCopy}
        onChange={changeView}
        onKeyDown={handleWorkspaceKeyDown}
        tabRefs={workspaceTabRefs}
        views={workspaceViews}
      />

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

      <div className="workspace-view" hidden={activeView !== "images"}>
        <ErrorBoundary panel><ImageSeoAudit /></ErrorBoundary>
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

