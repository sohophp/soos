import assert from "node:assert/strict";
import {
  createOAuthState,
  OAUTH_STATE_TTL_MS,
  validateOAuthState,
} from "../server/oauth-security.js";

const now = Date.now();
const oauth = createOAuthState(now);
assert.match(oauth.state, /^[A-Za-z0-9_-]+$/);
assert.equal(validateOAuthState(oauth.state, oauth.state, oauth.createdAt, now + 1000), true);
assert.throws(
  () => validateOAuthState(oauth.state, "different", oauth.createdAt, now),
  /did not match/,
);
assert.throws(
  () => validateOAuthState(oauth.state, oauth.state, oauth.createdAt, now + OAUTH_STATE_TTL_MS + 1),
  /expired/,
);
assert.throws(
  () => validateOAuthState(oauth.state, oauth.state, "", now),
  /expired/,
);

console.log("oauth-security-tests-passed");
