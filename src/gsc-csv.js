import { normalizeReportUrl } from "./url-policy.js";

export function detectCsvDelimiter(text) {
  const commaCount = (text.match(/,/g) || []).length;
  const tabCount = (text.match(/\t/g) || []).length;
  return tabCount > commaCount ? "\t" : ",";
}

export function parseCsvRows(text) {
  const delimiter = detectCsvDelimiter(text);
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === "\"" && next === "\"") {
        value += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }
    if (char === "\"") {
      quoted = true;
      continue;
    }
    if (char === delimiter) {
      row.push(value);
      value = "";
      continue;
    }
    if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }
    if (char === "\r") continue;
    value += char;
  }
  if (value.length || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

export function parseSearchConsoleCsv(text) {
  const rows = parseCsvRows(text);
  if (rows.length < 2) return [];
  const [header, ...dataRows] = rows;
  const lower = header.map((item) => item.trim().toLowerCase());
  const pageIndex = lower.findIndex((item) => ["top pages", "pages", "page", "ranking pages", "排名靠前的网页", "網頁"].includes(item));
  const clicksIndex = lower.findIndex((item) => ["clicks", "点击次数", "點擊次數"].includes(item));
  const impressionsIndex = lower.findIndex((item) => ["impressions", "展示", "曝光"].includes(item));
  const ctrIndex = lower.findIndex((item) => ["ctr", "点击率", "點閱率"].includes(item));
  const positionIndex = lower.findIndex((item) => ["position", "排名"].includes(item));
  if ([pageIndex, clicksIndex, impressionsIndex, ctrIndex, positionIndex].some((index) => index === -1)) return [];
  return dataRows.map((row) => {
    const page = row[pageIndex]?.trim();
    if (!page) return null;
    const numberValue = (index) => {
      const raw = row[index]?.replace(/[% ,]/g, "").trim();
      if (!raw) return 0;
      const value = Number(raw);
      return Number.isFinite(value) ? value : 0;
    };
    return {
      page,
      key: normalizeReportUrl(page),
      clicks: numberValue(clicksIndex),
      impressions: numberValue(impressionsIndex),
      ctr: numberValue(ctrIndex),
      position: numberValue(positionIndex),
    };
  }).filter(Boolean);
}
