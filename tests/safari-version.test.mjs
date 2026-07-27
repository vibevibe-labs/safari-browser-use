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

test("accepts Safari versions older than 26", () => {
  assert.deepEqual(evaluateSafariVersion("25.6"), {
    supported: true,
    major: 25,
    reason: null
  });
});

test("directs Safari 27 users to the native MCP server", () => {
  assert.deepEqual(evaluateSafariVersion("27.0"), {
    supported: false,
    major: 27,
    reason: "Safari 27 includes a native MCP server; use /usr/bin/safaridriver --mcp."
  });
});

test("rejects malformed Safari versions", () => {
  assert.throws(
    () => parseSafariMajor("Safari"),
    /Invalid Safari version/
  );
});
