export const STATIC_ASSET_PATH = /\.(?:avif|bmp|css|eot|gif|ico|jpe?g|js|map|mp4|pdf|png|svg|ttf|webm|webp|woff2?)(?:$|\?)/i;

const GOOGLE_CRAWLER_UA = /(googlebot|googleother|google-inspectiontool|adsbot-google|mediapartners-google|apis-google|google-safety)/i;
const MAX_LOG_LINES = 200000;

function normalizedLogTimestamp(value) {
  if (value === "" || value === null || value === undefined) return "";
  const numeric = Number(value);
  const digits = String(value).replace(/\D/g, "").length;
  const epochMilliseconds = digits >= 18 ? numeric / 1000000 : digits >= 15 ? numeric / 1000 : digits <= 10 ? numeric * 1000 : numeric;
  const date = Number.isFinite(numeric) && digits >= 10
    ? new Date(epochMilliseconds)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function parseApacheDate(value) {
  const match = /^(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})$/.exec(value || "");
  if (!match) return normalizedLogTimestamp(value);
  const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  const offset = `${match[7].slice(0, 3)}:${match[7].slice(3)}`;
  return normalizedLogTimestamp(`${match[3]}-${String((months[match[2]] ?? 0) + 1).padStart(2, "0")}-${match[1]}T${match[4]}:${match[5]}:${match[6]}${offset}`);
}

function logValue(object, keys) {
  for (const key of keys) {
    if (object?.[key] !== undefined && object[key] !== null && object[key] !== "") return object[key];
  }
  return "";
}

function logRecordFromObject(object) {
  const request = String(logValue(object, ["request", "Request", "ClientRequestURI", "requestPath", "path", "url", "URL"]) || "");
  const requestParts = /^([A-Z]+)\s+(\S+)(?:\s+HTTP\/[\d.]+)?$/i.exec(request);
  return {
    ip: String(logValue(object, ["ClientIP", "clientIp", "client_ip", "ip", "remote_addr", "RemoteAddr", "xForwardedFor"])).split(",")[0].trim(),
    method: String(logValue(object, ["ClientRequestMethod", "method", "requestMethod", "Method"]) || requestParts?.[1] || "GET"),
    path: String(requestParts?.[2] || request),
    host: String(logValue(object, ["ClientRequestHost", "host", "hostname", "Host"])),
    status: Number(logValue(object, ["EdgeResponseStatus", "OriginResponseStatus", "status", "statusCode", "responseStatus", "Status"])) || 0,
    userAgent: String(logValue(object, ["ClientRequestUserAgent", "userAgent", "user_agent", "http_user_agent", "UserAgent"])),
    timestamp: normalizedLogTimestamp(logValue(object, ["timestamp", "time", "datetime", "EdgeStartTimestamp", "ClientRequestStart", "RequestTimestamp", "date"])),
  };
}

function parseCommonLogLine(line) {
  const match = /^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"([A-Z]+)\s+(\S+)(?:\s+HTTP\/[\d.]+)?"\s+(\d{3})\s+\S+(?:\s+"[^"]*"\s+"([^"]*)")?/i.exec(line);
  if (!match) return null;
  return {
    ip: match[1],
    timestamp: parseApacheDate(match[2]),
    method: match[3],
    path: match[4],
    host: "",
    status: Number(match[5]) || 0,
    userAgent: match[6] || "",
  };
}

function parseDelimitedRows(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const delimiter = firstLine.includes("\t") ? "\t" : ",";
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

export function parseAccessLog(text) {
  const trimmed = text.trim();
  const records = [];
  const formats = new Set();
  let truncated = false;
  const addRecord = (record, format) => {
    if (!record?.path || !GOOGLE_CRAWLER_UA.test(record.userAgent || "")) return;
    records.push(record);
    formats.add(format);
  };

  if (trimmed.startsWith("[")) {
    try {
      const values = JSON.parse(trimmed);
      if (Array.isArray(values)) values.slice(0, MAX_LOG_LINES).forEach((value) => addRecord(logRecordFromObject(value), "JSON"));
      truncated = values.length > MAX_LOG_LINES;
      return { records, formats: [...formats], truncated };
    } catch {
      // Continue with line parsing.
    }
  }

  const lines = text.split(/\r?\n/);
  truncated = lines.length > MAX_LOG_LINES;
  const sample = lines.find((line) => line.trim()) || "";
  const looksDelimited = !sample.trim().startsWith("{") && /(?:,|\t)/.test(sample) && /(?:user.?agent|clientrequesturi|status|requestpath)/i.test(sample);
  if (looksDelimited) {
    const rows = parseDelimitedRows(lines.slice(0, MAX_LOG_LINES + 1).join("\n"));
    const headers = (rows.shift() || []).map((header) => header.trim());
    for (const row of rows.slice(0, MAX_LOG_LINES)) {
      addRecord(logRecordFromObject(Object.fromEntries(headers.map((header, index) => [header, row[index] || ""]))), "CSV/TSV");
    }
  } else {
    for (const rawLine of lines.slice(0, MAX_LOG_LINES)) {
      const line = rawLine.trim();
      if (!line) continue;
      if (line.startsWith("{")) {
        try {
          addRecord(logRecordFromObject(JSON.parse(line)), "JSON/NDJSON");
          continue;
        } catch {
          // Fall through to common log parsing.
        }
      }
      addRecord(parseCommonLogLine(line), "Nginx/Apache");
    }
  }
  return { records, formats: [...formats], truncated };
}

export function absoluteLogUrl(record, siteRootUrl) {
  try {
    const root = new URL(siteRootUrl);
    if (record.host) root.host = record.host;
    const url = new URL(record.path, root);
    url.hash = "";
    return url.toString();
  } catch {
    return record.path;
  }
}
