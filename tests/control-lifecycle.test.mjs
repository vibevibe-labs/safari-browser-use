import assert from "node:assert/strict";
import test from "node:test";

const lifecycleModule = new URL(
  "../plugins/safari-browser-use/server/src/control-lifecycle.mjs",
  import.meta.url
);

async function createRecorder() {
  const { createControlLifecycle } = await import(lifecycleModule);
  const events = [];
  const lifecycle = createControlLifecycle({
    show(tabId) {
      events.push(`show:${tabId}`);
    },
    hide(tabId) {
      events.push(`hide:${tabId}`);
    }
  });

  return { events, lifecycle };
}

test("activating the current tab refreshes its indicator lease", async () => {
  const { events, lifecycle } = await createRecorder();

  lifecycle.activate("10:1");
  lifecycle.activate("10:1");

  assert.deepEqual(events, ["show:10:1", "show:10:1"]);
});

test("activating another tab hides the previous indicator first", async () => {
  const { events, lifecycle } = await createRecorder();

  lifecycle.activate("10:1");
  lifecycle.activate("10:2");

  assert.deepEqual(events, [
    "show:10:1",
    "hide:10:1",
    "show:10:2"
  ]);
});

test("releasing control hides the active indicator once", async () => {
  const { events, lifecycle } = await createRecorder();

  lifecycle.activate("10:1");
  lifecycle.release();
  lifecycle.release();

  assert.deepEqual(events, ["show:10:1", "hide:10:1"]);
});
