import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { buildPlugin } from "../scripts/build-plugin.mjs";

test("builds a self-contained JXA MCP server", async t => {
  const directory = await mkdtemp(
    join(tmpdir(), "safari-browser-use-build-")
  );
  const outfile = join(directory, "server.jxa.js");

  t.after(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  await buildPlugin({ outfile });

  const bundle = await readFile(outfile, "utf8");
  assert.match(bundle, /safari-browser-use/);
  assert.match(bundle, /function runPageOperation/);
  assert.match(bundle, /Application\("Safari"\)/);
  assert.match(
    bundle,
    /SafariPlaywright\.prototype\.scrollBy/
  );
  assert.match(
    bundle,
    /SafariLocator\.prototype\.scrollIntoView/
  );
  assert.match(
    bundle,
    /SafariLocator\.prototype\.allAttributes/
  );
  assert.doesNotMatch(
    bundle,
    /data-safari-browser-use-control-favicon/
  );
  assert.doesNotMatch(bundle, /controlFaviconUrl/);
  assert.doesNotMatch(bundle, /\bimport\s/);
  assert.doesNotMatch(bundle, /\brequire\s*\(/);
  assert.doesNotMatch(bundle, /node:/);
});
