import assert from "node:assert/strict";
import {
  dictionaries,
  googlebotLogText,
  gscDataText,
  gscSupportingText,
  gscUiText,
  inspectionDiagnosisText,
  pageSpeedText,
  privacyDataText,
  structuredDiagnosticText,
  workspaceText,
} from "../src/i18n.js";

const resources = {
  dictionaries,
  gscUiText,
  gscDataText,
  inspectionDiagnosisText,
  structuredDiagnosticText,
  googlebotLogText,
  gscSupportingText,
  pageSpeedText,
  privacyDataText,
  workspaceText,
};
const languages = ["en", "zh-CN", "zh-TW"];

function collectKeys(value, prefix = "") {
  return Object.entries(value || {}).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) {
      return collectKeys(child, path);
    }
    return [path];
  });
}

for (const [resourceName, resource] of Object.entries(resources)) {
  const supportedLanguages = resource.en ? languages : ["zh-CN", "zh-TW"];
  for (const language of supportedLanguages) {
    assert.ok(resource[language], `${resourceName} is missing ${language}`);
  }

  const baselineLanguage = resource.en ? "en" : "zh-CN";
  const baselineKeys = collectKeys(resource[baselineLanguage]).sort();
  for (const language of supportedLanguages.filter((item) => item !== baselineLanguage)) {
    assert.deepEqual(
      collectKeys(resource[language]).sort(),
      baselineKeys,
      `${resourceName}.${language} keys differ from ${baselineLanguage}`,
    );
  }

  const serialized = JSON.stringify(resource);
  assert.equal(serialized.includes("\uFFFD"), false, `${resourceName} contains replacement characters`);
  assert.equal(serialized.includes("锟"), false, `${resourceName} contains likely mojibake`);
  assert.equal(/Ã.|Â.|ðŸ|â€/.test(serialized), false, `${resourceName} contains likely UTF-8 mojibake`);
  assert.equal(
    serialized.includes("http://127.0.0.1:4177"),
    false,
    `${resourceName} exposes a local debugging URL`,
  );
}

for (const key of ["alternates", "title", "description", "lang", "viewport"]) {
  assert.notEqual(dictionaries["zh-CN"][key], dictionaries.en[key], `zh-CN.${key} is not localized`);
  assert.notEqual(dictionaries["zh-TW"][key], dictionaries.en[key], `zh-TW.${key} is not localized`);
}

const forbiddenPhrases = {
  "zh-CN": ["載入", "測試中", "中斷連線", "資料", "網頁", "連結", "設定", "選擇", "無法"],
  "zh-TW": ["加载", "测试中", "断开连接", "数据", "网页", "链接", "设置", "选择", "无法"],
};

for (const [resourceName, resource] of Object.entries(resources)) {
  for (const language of ["zh-CN", "zh-TW"]) {
    const serialized = JSON.stringify(resource[language] || {});
    for (const phrase of forbiddenPhrases[language]) {
      assert.equal(
        serialized.includes(phrase),
        false,
        `${resourceName}.${language} contains the wrong script phrase: ${phrase}`,
      );
    }
  }
}

console.log("i18n-tests-passed");
