import assert from "node:assert/strict";
import {
  deleteSessionDataFromDatabase,
  readSessionDataFromDatabase,
} from "../server/session-data.js";

function fakeSql(result) {
  const calls = [];
  const sql = async (strings, ...values) => {
    calls.push({
      text: strings.join("?").replace(/\s+/g, " ").trim(),
      values,
    });
    return [result];
  };
  return { sql, calls };
}

const summaryDb = fakeSql({
  gsc_config: true,
  jobs: 3,
  batches: 7,
  leases: 1,
});
assert.deepEqual(await readSessionDataFromDatabase(summaryDb.sql, "session-a"), {
  gscConfig: true,
  jobs: 3,
  batches: 7,
  leases: 1,
});
assert.match(summaryDb.calls[0].text, /value->>'sessionId'/);
assert.match(summaryDb.calls[0].text, /audit_job_batch:/);
assert.match(summaryDb.calls[0].text, /key ~ '\^audit_job:'/);
assert.match(summaryDb.calls[0].text, /left\( batch\.key/);
assert.equal(summaryDb.calls[0].values.includes("session-a"), true);

const deleteDb = fakeSql({
  gsc_configs: 1,
  jobs: 3,
  batches: 7,
  leases: 1,
});
assert.deepEqual(await deleteSessionDataFromDatabase(deleteDb.sql, "session-a"), {
  gscConfigs: 1,
  jobs: 3,
  batches: 7,
  leases: 1,
});
assert.match(deleteDb.calls[0].text, /deleted_leases AS/);
assert.match(deleteDb.calls[0].text, /deleted_config AS/);
assert.equal(deleteDb.calls[0].values.includes("gsc_config:session-a"), true);
assert.match(deleteDb.calls[0].text, /audit_job_batch:/);
assert.match(deleteDb.calls[0].text, /config\.key ~ '\^audit_job:'/);
assert.match(deleteDb.calls[0].text, /left\( config\.key/);

console.log("session-data-tests-passed");
