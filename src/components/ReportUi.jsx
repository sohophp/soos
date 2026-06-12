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
      <Icon size={14} />
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

export function ReportEmptyState({ t }) {
  return (
    <section className="empty">
      <FileSearch size={42} />
      <p>{t.placeholder}</p>
    </section>
  );
}
