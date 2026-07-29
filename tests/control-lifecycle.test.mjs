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
    refresh(tabId) {
      events.push(`refresh:${tabId}`);
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

  assert.deepEqual(events, ["show:10:1", "refresh:10:1"]);
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

test("restores control before a navigation operation returns", async () => {
  const lifecycle = await import(lifecycleModule);
  const restoreAfterNavigation =
    lifecycle.restoreControlAfterNavigation;
  let clock = 0;
  let inspections = 0;
  let restoreAttempts = 0;
  let controlVisible = false;

  const result = typeof restoreAfterNavigation === "function"
    ? restoreAfterNavigation({
        initialDocumentId: "document-1",
        initialUrl: "https://example.com/start",
        inspect() {
          inspections++;

          if (inspections === 1) {
            throw new Error("document is being replaced");
          }

          return {
            controlVisible,
            documentId: "document-2",
            readyState: inspections === 2
              ? "loading"
              : "interactive",
            tabUrl: "https://example.com/next",
            url: "https://example.com/next"
          };
        },
        now: () => clock,
        restore() {
          restoreAttempts++;

          if (restoreAttempts === 1) {
            throw new Error("new document is not ready");
          }

          controlVisible = true;
        },
        sleep(milliseconds) {
          clock += milliseconds;
        },
        timeoutMs: 1000
      })
    : null;

  assert.deepEqual(result, {
    changed: true,
    documentId: "document-2",
    restored: true
  });
  assert.equal(restoreAttempts, 2);
});

test("does not delay a browser action when its document stays active", async () => {
  const lifecycle = await import(lifecycleModule);
  const restoreAfterNavigation =
    lifecycle.restoreControlAfterNavigation;
  let clock = 0;
  let restores = 0;

  const result = typeof restoreAfterNavigation === "function"
    ? restoreAfterNavigation({
        changeTimeoutMs: 100,
        initialDocumentId: "document-1",
        initialUrl: "https://example.com/start",
        inspect() {
          return {
            controlVisible: true,
            documentId: "document-1",
            readyState: "complete",
            tabUrl: "https://example.com/start",
            url: "https://example.com/start"
          };
        },
        now: () => clock,
        restore() {
          restores++;
        },
        sleep(milliseconds) {
          clock += milliseconds;
        },
        timeoutMs: 1000
      })
    : null;

  assert.deepEqual(result, {
    changed: false,
    documentId: "document-1",
    restored: false
  });
  assert.equal(restores, 0);
});

test("restores an indicator removed from the current document", async () => {
  const lifecycle = await import(lifecycleModule);
  const restoreAfterNavigation =
    lifecycle.restoreControlAfterNavigation;
  let controlVisible = false;
  let restores = 0;

  const result = typeof restoreAfterNavigation === "function"
    ? restoreAfterNavigation({
        initialDocumentId: "document-1",
        initialUrl: "https://example.com/start",
        inspect() {
          return {
            controlVisible,
            documentId: "document-1",
            readyState: "complete",
            tabUrl: "https://example.com/start",
            url: "https://example.com/start"
          };
        },
        now: () => 0,
        restore() {
          restores++;
          controlVisible = true;
        },
        sleep() {},
        timeoutMs: 1000
      })
    : null;

  assert.deepEqual(result, {
    changed: false,
    documentId: "document-1",
    restored: true
  });
  assert.equal(restores, 1);
});
