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
  assert.match(
    bundle,
    /SafariLocator\.prototype\.allRecords/
  );
  assert.match(
    bundle,
    /SafariLocator\.prototype\.uploadFiles/
  );
  assert.match(bundle, /playwright\.fileUploadStatus/);
  assert.match(bundle, /function resolveTabIdentity/);
  assert.match(
    bundle,
    /resolveTabIdentity\(params\.tabIdentity, listTabs\(\)\)/
  );
  assert.match(
    bundle,
    /new SafariPlaywright\(this\._identity\)/
  );
  assert.match(
    bundle,
    /SafariPlaywright\.prototype\.waitForURL/
  );
  assert.match(
    bundle,
    /SafariPlaywright\.prototype\.waitForLoadState/
  );
  assert.match(
    bundle,
    /pageState\.url === metadata\.url/
  );
  assert.match(bundle, /function restoreControlAfterNavigation/);
  assert.match(bundle, /documentId/);
  assert.ok(
    (bundle.match(/restoreControlAfterNavigation\(/g) || []).length >= 2
  );
  const runGesture = bundle.match(
    /function runGesture[\s\S]*?\n  function mimeTypeForPath/m
  )?.[0] ?? "";
  assert.match(
    runGesture,
    /runPage\("playwright\.gestureHighlight"/
  );
  const clickAt = bundle.match(
    /SafariPlaywright\.prototype\.clickAt[\s\S]*?\n  };/m
  )?.[0] ?? "";
  const drag = bundle.match(
    /SafariPlaywright\.prototype\.drag[\s\S]*?\n  };/m
  )?.[0] ?? "";
  assert.match(clickAt, /kind: "click"/);
  assert.match(drag, /kind: "drag"/);
  const waitForTimeout = bundle.match(
    /SafariPlaywright\.prototype\.waitForTimeout[\s\S]*?\n  };/m
  )?.[0] ?? "";
  assert.equal(
    (waitForTimeout.match(/controlLifecycle\.activate/g) || [])
      .length,
    2
  );
  assert.match(bundle, /var SBU_DOCUMENTATION_TEXT = /);
  assert.match(bundle, /var SBU_DOCUMENTATION_TROUBLESHOOTING_TEXT = /);
  assert.match(bundle, /documentation: browserDocumentation/);
  assert.match(bundle, /Safari Browser Use — Operating Guide/);
  assert.match(bundle, /Browser Safety/);
  assert.match(bundle, /Unknown documentation topic/);
  assert.match(bundle, /instructions:/);
  assert.doesNotMatch(
    bundle,
    /data-safari-browser-use-control-favicon/
  );
  assert.doesNotMatch(bundle, /controlFaviconUrl/);
  assert.doesNotMatch(bundle, /\bimport\s/);
  assert.doesNotMatch(bundle, /\brequire\s*\(/);
  assert.doesNotMatch(bundle, /node:/);
});
