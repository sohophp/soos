import { useState } from "react";
import { buildAuditRequest, DEFAULT_SCAN_SETTINGS } from "../scan-settings.js";

export function useScanSettings() {
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_SCAN_SETTINGS }));

  function setValue(name, value) {
    setSettings((current) => ({ ...current, [name]: value }));
  }

  function reset() {
    setSettings({ ...DEFAULT_SCAN_SETTINGS });
  }

  return {
    ...settings,
    setValue,
    reset,
    toAuditRequest: () => buildAuditRequest(settings),
  };
}
