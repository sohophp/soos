import assert from "node:assert/strict";
import fs from "node:fs/promises";

const configSource = await fs.readFile(new URL("../vite.config.js", import.meta.url), "utf8");

assert.match(configSource, /chunkSizeWarningLimit:\s*600/);
assert.doesNotMatch(configSource, /chunkSizeWarningLimit:\s*(?:[7-9]\d\d|[1-9]\d{3,})/);

console.log("build-config-tests-passed");
