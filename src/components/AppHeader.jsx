import React from "react";

export function AppHeader({
  language,
  onLanguageChange,
  report,
  t,
}) {
  const siteLabel = report?.input?.siteRootUrl || report?.input?.originalUrl || "";
  return (
    <header className="app-header">
      <div className="app-header-main">
        <span className="app-wordmark">IndexPilot</span>
        <div>
          <h1>{t.heading}</h1>
          <p>{t.subheading}</p>
        </div>
      </div>
      <div className="app-header-actions">
        {siteLabel ? (
          <span className="app-site-summary" title={siteLabel}>
            {siteLabel}
          </span>
        ) : null}
        <label className="visually-hidden" htmlFor="language-select">{t.languageLabel}</label>
        <select id="language-select" value={language} onChange={(event) => onLanguageChange(event.target.value)}>
          <option value="en">English</option>
          <option value="zh-CN">{"\u7b80\u4f53\u4e2d\u6587"}</option>
          <option value="zh-TW">{"\u7e41\u9ad4\u4e2d\u6587"}</option>
        </select>
      </div>
    </header>
  );
}
