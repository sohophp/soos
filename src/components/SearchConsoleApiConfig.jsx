import React, { useEffect, useRef, useState } from "react";
import { formatApiError } from "../api-client.js";
import {
  clearGscConnection,
  getGscStatus,
  loadGscSites,
  saveGscProperty,
  startGscOAuth,
} from "../gsc-client.js";
import { gscUiText } from "../i18n.js";

export function SearchConsoleApiConfig({ status, onStatus, siteUrl, onSiteUrlChange, language }) {
  const copy = gscUiText[language] || gscUiText.en;
  const [showOauthHelp, setShowOauthHelp] = useState(true);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [sitesLoading, setSitesLoading] = useState(false);
  const [propertySaving, setPropertySaving] = useState(false);
  const [sites, setSites] = useState([]);
  const [sitesError, setSitesError] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const oauthRefreshAtRef = useRef(0);

  useEffect(() => {
    if (status?.siteUrl) onSiteUrlChange(status.siteUrl);
  }, [onSiteUrlChange, status?.siteUrl]);

  useEffect(() => {
    if (status?.configured) {
      refreshSites();
    } else {
      setSites([]);
      setSitesError("");
    }
  }, [status?.configured]);

  useEffect(() => {
    function handleMessage(event) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "soos:gsc-oauth-connected") return;
      refreshAfterOAuth();
    }
    function handleStorage(event) {
      if (event.key !== "soos:gsc-oauth-connected" || !event.newValue) return;
      refreshAfterOAuth();
    }
    window.addEventListener("message", handleMessage);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const tokenState = status?.refreshToken
    ? copy.connected
    : status?.token
      ? status.tokenLikelyExpired
        ? copy.tokenExpired
        : copy.tokenSaved
      : copy.noToken;
  const connectedAccount = status?.googleAccountEmail || status?.googleAccountName || "";

  async function refreshSites() {
    setSitesLoading(true);
    setSitesError("");
    try {
      const body = await loadGscSites();
      setSites(body.sites || []);
      if (!siteUrl && body.selectedSiteUrl) onSiteUrlChange(body.selectedSiteUrl);
    } catch (err) {
      setSitesError(formatApiError(err));
    } finally {
      setSitesLoading(false);
    }
  }

  async function selectProperty(event) {
    const nextSiteUrl = event.target.value;
    const previousSiteUrl = siteUrl;
    onSiteUrlChange(nextSiteUrl);
    setPropertySaving(true);
    setMessage("");
    setError("");
    try {
      const body = await saveGscProperty(nextSiteUrl);
      onStatus(body);
      setMessage(copy.propertySaved);
    } catch (err) {
      onSiteUrlChange(previousSiteUrl);
      setError(formatApiError(err));
    } finally {
      setPropertySaving(false);
    }
  }

  async function clearConfig() {
    if (status?.serverless && !status?.databaseConfigured) {
      setError(copy.startServerlessError);
      return;
    }
    setOauthLoading(true);
    setMessage("");
    setError("");
    try {
      const body = await clearGscConnection();
      onStatus(body);
      setMessage(body.revoke?.revoked ? copy.disconnectedMessage : `${copy.disconnectedMessage} ${copy.revokeNotConfirmed}`);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setOauthLoading(false);
    }
  }

  async function refreshStatus(reason = "") {
    setMessage("");
    setError("");
    try {
      const body = await getGscStatus();
      onStatus(body);
      setMessage(reason === "oauth-connected" ? copy.connectedRefreshed : body.refreshToken ? copy.oauthRefreshed : copy.statusRefreshed);
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  function refreshAfterOAuth() {
    const now = Date.now();
    if (now - oauthRefreshAtRef.current < 1000) return;
    oauthRefreshAtRef.current = now;
    refreshStatus("oauth-connected");
  }

  async function startOAuth() {
    if (status?.serverless && !status?.databaseConfigured) {
      setError(copy.startServerlessError);
      return;
    }
    if (!status?.oauthConfigured) {
      setError(copy.missingOAuthError);
      return;
    }
    if (!siteUrl.trim()) {
      setError(copy.missingPropertyError);
      return;
    }
    setOauthLoading(true);
    setMessage("");
    setError("");
    const oauthWindow = window.open("", "soos-gsc-oauth", "popup,width=620,height=760");
    if (oauthWindow) {
      oauthWindow.document.title = "Connecting Google Search Console";
      oauthWindow.document.body.innerHTML = "<p style=\"font-family:system-ui;padding:24px\">Opening Google OAuth...</p>";
    }
    let popupPoll = null;
    try {
      const body = await startGscOAuth(siteUrl);
      setMessage(copy.openingMessage);
      if (oauthWindow) {
        oauthWindow.location.href = body.authUrl;
        popupPoll = window.setInterval(() => {
          if (!oauthWindow.closed) return;
          window.clearInterval(popupPoll);
          popupPoll = null;
          refreshAfterOAuth();
        }, 600);
      } else {
        window.location.href = body.authUrl;
      }
    } catch (err) {
      if (popupPoll) window.clearInterval(popupPoll);
      oauthWindow?.close();
      setError(formatApiError(err));
    } finally {
      setOauthLoading(false);
    }
  }

  return (
    <section className={`panel gsc-api-config ${status?.configured ? "connected" : ""}`}>
      <div className="panel-head">
        <h2>{copy.apiTitle}</h2>
        <span>{status?.configured ? tokenState : copy.notConfigured}</span>
      </div>
      <form className="gsc-api-body" onSubmit={(event) => event.preventDefault()}>
        <div className="gsc-api-fields">
          <label>
            <strong className="gsc-label-row">
              {copy.propertyUrl}
              {!status?.configured ? (
                <button
                  className="gsc-help-button"
                  type="button"
                  onClick={() => setShowOauthHelp((value) => !value)}
                  aria-label={copy.oauthHelpTitle}
                  aria-expanded={showOauthHelp}
                  aria-controls="gsc-oauth-help"
                >
                  ?
                </button>
              ) : null}
            </strong>
            {status?.configured ? (
              <select aria-label={copy.propertyUrl} value={siteUrl} onChange={selectProperty} disabled={sitesLoading || propertySaving}>
                {siteUrl && !sites.some((site) => site.siteUrl === siteUrl) ? <option value={siteUrl}>{siteUrl}</option> : null}
                {!siteUrl ? <option value="">{copy.chooseProperty}</option> : null}
                {sites.map((site) => (
                  <option value={site.siteUrl} key={site.siteUrl}>
                    {site.siteUrl} · {copy[site.permissionLevel] || site.permissionLevel}
                  </option>
                ))}
              </select>
            ) : (
              <input aria-label={copy.propertyUrl} type="text" placeholder="https://example.com/ or sc-domain:example.com" value={siteUrl} onChange={(event) => onSiteUrlChange(event.target.value)} />
            )}
            {!status?.configured ? (
              <small>{copy.propertyHelp}</small>
            ) : (
              <small>
                {sitesLoading
                  ? copy.loadingProperties
                  : sites.length
                    ? `${sites.length} ${copy.propertiesAvailable}`
                    : copy.noProperties}
              </small>
            )}
            {sitesError ? <small className="gsc-api-error" role="alert">{sitesError}</small> : null}
          </label>
        </div>
        {status?.configured ? (
          <div className="gsc-oauth-help">
            <strong>{copy.connectedAs}</strong>
            <span>{connectedAccount || copy.connectedAccountFallback}</span>
            {!connectedAccount ? <small>{copy.reconnectHint}</small> : null}
          </div>
        ) : null}
        {showOauthHelp && !status?.configured ? (
          <div className="gsc-oauth-help" id="gsc-oauth-help">
            <strong>{copy.oauthHelpTitle}</strong>
            <ol>
              {copy.oauthHelpSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <a href="https://support.google.com/webmasters/answer/7687615" target="_blank" rel="noreferrer">
              {copy.docsLabel}
            </a>
          </div>
        ) : null}
        <div className="gsc-api-actions">
          {!status?.configured ? (
            <button className="export-button" type="button" onClick={startOAuth} disabled={oauthLoading}>
              {oauthLoading ? copy.opening : copy.connect}
            </button>
          ) : null}
          {status?.configured && !connectedAccount ? (
            <button className="export-button" type="button" onClick={startOAuth} disabled={oauthLoading}>
              {oauthLoading ? copy.opening : copy.reconnect}
            </button>
          ) : null}
          {status?.configured && (sitesError || (!sitesLoading && !sites.length)) ? (
            <button className="export-button" type="button" onClick={refreshSites} disabled={sitesLoading || propertySaving}>
              {sitesLoading ? copy.loadingProperties : copy.refreshProperties}
            </button>
          ) : null}
          {status?.configured ? (
            <button className="export-button" type="button" onClick={clearConfig} disabled={oauthLoading}>
              {copy.clear}
            </button>
          ) : null}
        </div>
        <div className="gsc-api-help">
          {!status?.configured ? <small>{status?.note || copy.connectionHelp}</small> : null}
          {status?.serverless ? <small>{copy.serverlessHelp}</small> : null}
          <small>{copy.privacyNote}</small>
        </div>
        {message ? <small className="gsc-api-message" role="status">{message}</small> : null}
        {error ? <small className="gsc-api-error" role="alert">{error}</small> : null}
      </form>
    </section>
  );
}
