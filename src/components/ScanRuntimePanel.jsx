import React from "react";
import {
  clampProgressValue,
  formatElapsedTime,
  formatStartedTime,
} from "../scan-runtime.js";

export function ProgressBar({ progress }) {
  if (!progress) return null;
  const value = clampProgressValue(progress.value);
  return (
    <section
      className="progress-panel"
      role="progressbar"
      aria-label={progress.label}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={value}
      aria-valuetext={`${progress.label}: ${value}%`}
    >
      <div className="progress-top">
        <strong>{progress.label}</strong>
        <span>{value}%</span>
      </div>
      <div className="progress-track">
        <div style={{ width: `${value}%` }} />
      </div>
      {progress.meta ? <p className="progress-meta">{progress.meta}</p> : null}
    </section>
  );
}

export function ProgressControls({ loading, jobStatus, onPause, onResume, onStop, t }) {
  if (!loading) return null;
  return (
    <div className="progress-controls">
      {jobStatus === "paused" ? (
        <button className="export-button" type="button" onClick={onResume}>
          {t.resume}
        </button>
      ) : (
        <button className="export-button" type="button" onClick={onPause}>
          {t.pause}
        </button>
      )}
      <button className="export-button" type="button" onClick={onStop}>
        {t.stop}
      </button>
    </div>
  );
}

export function RuntimePanel({ loading, jobStatus, progress, runtimeMeta, t }) {
  if (!loading && !runtimeMeta.startedAt) return null;
  return (
    <section className="panel runtime-panel">
      <div className="panel-head">
        <h2>{t.runtime}</h2>
      </div>
      <div className="runtime-grid" aria-live="polite" aria-atomic="true">
        <div className="runtime-item">
          <strong>{t.status}</strong>
          <span>{jobStatus || "idle"}</span>
        </div>
        <div className="runtime-item">
          <strong>{t.currentStage}</strong>
          <span>{progress?.label || "-"}</span>
        </div>
        <div className="runtime-item">
          <strong>{t.startedAt}</strong>
          <span>{formatStartedTime(runtimeMeta.startedAt)}</span>
        </div>
        <div className="runtime-item">
          <strong>{t.elapsed}</strong>
          <span>{formatElapsedTime(runtimeMeta.elapsedMs)}</span>
        </div>
        <div className="runtime-item">
          <strong>{t.stageElapsed || "Stage elapsed"}</strong>
          <span>{formatElapsedTime(runtimeMeta.stageElapsedMs)}</span>
        </div>
        <div className="runtime-item">
          <strong>{t.pauseCount}</strong>
          <span>{runtimeMeta.pauseCount || 0}</span>
        </div>
      </div>
    </section>
  );
}
