import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateSafariVersion,
  parseSafariMajor
} from "../plugins/safari-browser-use/server/src/safari-version.mjs";

test("parses the major version from a Safari version string", () => {
  assert.equal(parseSafariMajor("26.5"), 26);
});

test("accepts Safari 26", () => {
  assert.deepEqual(evaluateSafariVersion("26.5"), {
    supported: true,
    major: 26,
    reason: null
  });
});

test("rejects Safari versions older than 26", () => {
  assert.deepEqual(evaluateSafariVersion("25.6"), {
    supported: false,
    major: 25,
    reason: "Safari 26 is required; found Safari 25."
  });
});

test("rejects unvalidated Safari versions newer than 26", () => {
  assert.deepEqual(evaluateSafariVersion("27.0"), {
    supported: false,
    major: 27,
    reason: "Safari 27 is not supported; install Safari 26."
  });
});

test("rejects malformed Safari versions", () => {
  assert.throws(
    () => parseSafariMajor("Safari"),
    /Invalid Safari version/
  );
});
