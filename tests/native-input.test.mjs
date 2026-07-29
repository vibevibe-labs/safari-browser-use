import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { buildPlugin } from "../scripts/build-plugin.mjs";
import {
  runPageOperation
} from "../plugins/safari-browser-use/server/src/page-runtime.mjs";

const nativeInputModule = new URL(
  "../plugins/safari-browser-use/server/src/native-input.mjs",
  import.meta.url
);

const viewport = {
  innerHeight: 1330,
  innerWidth: 2213,
  outerHeight: 1410,
  outerWidth: 2213,
  visualOffsetLeft: 0,
  visualOffsetTop: 0,
  visualScale: 1
};

const windowBounds = {
  height: 1410,
  width: 2213,
  x: 1512,
  y: -259
};

test("reports the viewport metrics needed for native input", () => {
  assert.deepEqual(
    runPageOperation(
      {},
      {
        innerHeight: 700,
        innerWidth: 1000,
        outerHeight: 780,
        outerWidth: 1000,
        visualViewport: {
          offsetLeft: 0,
          offsetTop: 0,
          scale: 1
        }
      },
      "playwright.viewportMetrics"
    ),
    {
      innerHeight: 700,
      innerWidth: 1000,
      outerHeight: 780,
      outerWidth: 1000,
      visualOffsetLeft: 0,
      visualOffsetTop: 0,
      visualScale: 1
    }
  );
});

test("maps viewport coordinates into a multi-display screen point", async () => {
  const { viewportPointToScreen } = await import(nativeInputModule);

  assert.deepEqual(
    viewportPointToScreen(
      { x: 100, y: 200 },
      viewport,
      windowBounds
    ),
    { x: 1612, y: 21 }
  );
});

test("rejects a native click outside the visible viewport", async () => {
  const { viewportPointToScreen } = await import(nativeInputModule);

  assert.throws(
    () => viewportPointToScreen(
      { x: 2213, y: 200 },
      viewport,
      windowBounds
    ),
    /native_click_outside_viewport/
  );
});

test("rejects a transformed visual viewport", async () => {
  const { viewportPointToScreen } = await import(nativeInputModule);

  assert.throws(
    () => viewportPointToScreen(
      { x: 100, y: 200 },
      { ...viewport, visualScale: 1.25 },
      windowBounds
    ),
    /native_click_unsupported_viewport_transform/
  );
});

test("focuses the target tab before posting one native click", async () => {
  const { createNativeInput } = await import(nativeInputModule);
  const calls = [];
  const nativeInput = createNativeInput({
    focus(tabId) {
      calls.push(["focus", tabId]);
    },
    readViewport(tabId) {
      calls.push(["viewport", tabId]);
      return viewport;
    },
    readWindowBounds(tabId) {
      calls.push(["window", tabId]);
      return windowBounds;
    },
    postClick(point) {
      calls.push(["click", point]);
    }
  });

  assert.deepEqual(
    nativeInput.clickAt("71009:19", 100, 200),
    {
      clicked: true,
      screen: { x: 1612, y: 21 },
      viewport: { x: 100, y: 200 }
    }
  );
  assert.deepEqual(calls, [
    ["focus", "71009:19"],
    ["viewport", "71009:19"],
    ["window", "71009:19"],
    ["click", { x: 1612, y: 21 }]
  ]);
});

test("build exposes nativeClickAt without changing clickAt", async t => {
  const directory = await mkdtemp(
    join(tmpdir(), "safari-browser-use-native-input-")
  );
  const outfile = join(directory, "server.jxa.js");

  t.after(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  await buildPlugin({ outfile });

  const bundle = await readFile(outfile, "utf8");

  assert.match(bundle, /function viewportPointToScreen/);
  assert.match(bundle, /function createNativeInput/);
  assert.match(
    bundle,
    /SafariPlaywright\.prototype\.nativeClickAt/
  );
  assert.match(
    bundle,
    /SafariPlaywright\.prototype\.clickAt/
  );
  assert.match(bundle, /Application\("System Events"\)/);
  assert.match(bundle, /CGWindowListCopyWindowInfo/);
  assert.match(bundle, /\.click\(\{ at: \[/);
});

test("documents native input as an explicit cross-origin fallback", async () => {
  const [guide, captchaReference] = await Promise.all([
    readFile(
      new URL(
        "../plugins/safari-browser-use/server/src/documentation.md",
        import.meta.url
      ),
      "utf8"
    ),
    readFile(
      new URL(
        "../plugins/safari-browser-use/skills/control-safari/references/captcha.md",
        import.meta.url
      ),
      "utf8"
    )
  ]);

  assert.match(guide, /nativeClickAt\(\)/);
  assert.match(guide, /foreground/i);
  assert.match(guide, /cross-origin iframe/i);
  assert.match(captchaReference, /nativeClickAt\(\)/);
  assert.match(captchaReference, /explicit confirmation/i);
  assert.match(captchaReference, /authoritative signal/i);
});
