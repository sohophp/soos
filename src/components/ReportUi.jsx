import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  ShieldAlert,
  XCircle,
} from "lucide-react";

const severityIcons = {
  critical: XCircle,
  warning: AlertTriangle,
  notice: ShieldAlert,
};

export function Badge({ severity, children }) {
  const Icon = severityIcons[severity] || CheckCircle2;
  return (
    <span className={`badge badge-${severity || "ok"}`}>
      <Icon size={14} aria-hidden="true" focusable="false" />
      {children}
    </span>
  );
}

export function Stat({ label, value, tone }) {
  return (
    <div className={`stat ${tone ? `stat-${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function ReportEmptyState({ t, onStartScan }) {
  return (
    <section className="empty">
      <FileSearch size={42} aria-hidden="true" focusable="false" />
      <h2>{t.emptyReportTitle}</h2>
      <p>{t.emptyReportHelp}</p>
      {onStartScan ? (
        <button className="export-button" type="button" onClick={onStartScan}>
          {t.emptyReportAction}
        </button>
      ) : null}
    </section>
  );
}
