import assert from "node:assert/strict";
import {
  dictionaries,
  googlebotLogText,
  gscDataText,
  gscSupportingText,
  gscUiText,
  inspectionDiagnosisText,
  structuredDiagnosticText,
} from "../src/i18n.js";

const resources = {
  dictionaries,
  gscUiText,
  gscDataText,
  inspectionDiagnosisText,
  structuredDiagnosticText,
  googlebotLogText,
  gscSupportingText,
};
const languages = ["en", "zh-CN", "zh-TW"];

for (const [resourceName, resource] of Object.entries(resources)) {
  const supportedLanguages = resource.en ? languages : ["zh-CN", "zh-TW"];
  for (const language of supportedLanguages) {
    assert.ok(resource[language], `${resourceName} is missing ${language}`);
  }

  const baselineLanguage = resource.en ? "en" : "zh-CN";
  const baselineKeys = Object.keys(resource[baselineLanguage]).sort();
  for (const language of supportedLanguages.filter((item) => item !== baselineLanguage)) {
    assert.deepEqual(
      Object.keys(resource[language]).sort(),
      baselineKeys,
      `${resourceName}.${language} keys differ from ${baselineLanguage}`,
    );
  }

  const serialized = JSON.stringify(resource);
  assert.equal(serialized.includes("\uFFFD"), false, `${resourceName} contains replacement characters`);
  assert.equal(serialized.includes("锟"), false, `${resourceName} contains likely mojibake`);
}

console.log("i18n-tests-passed");
