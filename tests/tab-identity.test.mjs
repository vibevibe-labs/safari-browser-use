import assert from "node:assert/strict";
import test from "node:test";

const moduleUrl = new URL(
  "../plugins/safari-browser-use/server/src/tab-identity.mjs",
  import.meta.url
);

async function loadTabIdentity() {
  const module = await import(moduleUrl).catch(() => null);

  assert.notEqual(
    module,
    null,
    "tab identity resolver must exist"
  );

  return module;
}

test("skips Safari windows that do not expose tabs", async () => {
  const { collectTabs } = await loadTabIdentity();
  const windows = [
    { id: "primary", tabs: [{ title: "Example" }] },
    { id: "auxiliary", tabs: null }
  ];

  assert.deepEqual(
    collectTabs(
      windows,
      window => window.tabs,
      (window, tab, tabIndex) => ({
        id: `${window.id}:${tabIndex}`,
        title: tab.title
      })
    ),
    [{ id: "primary:1", title: "Example" }]
  );
});

test("skips Safari windows whose tab collection fails", async () => {
  const { collectTabs } = await loadTabIdentity();
  const windows = [
    { id: "primary", tabs: [{ title: "Example" }] },
    { id: "oauth-popup" }
  ];

  assert.deepEqual(
    collectTabs(
      windows,
      window => {
        if (!window.tabs) {
          throw new TypeError(
            "null is not an object (evaluating 'tabs.length')"
          );
        }

        return window.tabs;
      },
      (window, tab, tabIndex) => ({
        id: `${window.id}:${tabIndex}`,
        title: tab.title
      })
    ),
    [{ id: "primary:1", title: "Example" }]
  );
});

test("reacquires a tab after its Safari index changes", async () => {
  const {
    createTabIdentity,
    resolveTabIdentity
  } = await loadTabIdentity();
  const identity = createTabIdentity({
    id: "63176:8",
    title: "Home / X",
    url: "https://x.com/home"
  });

  const resolved = resolveTabIdentity(identity, [
    {
      id: "63176:7",
      title: "Home / X",
      url: "https://x.com/home"
    }
  ]);

  assert.equal(resolved.id, "63176:7");
  assert.equal(identity.id, "63176:7");
});

test("never rebinds a stale handle to an unrelated tab", async () => {
  const {
    createTabIdentity,
    resolveTabIdentity
  } = await loadTabIdentity();
  const identity = createTabIdentity({
    id: "63176:8",
    title: "Home / X",
    url: "https://x.com/home"
  });

  assert.throws(
    () => resolveTabIdentity(identity, [{
      id: "63176:8",
      title: "GitHub",
      url: "https://github.com/"
    }]),
    /stale_tab_handle/
  );
});

test("does not recover a stale handle by origin alone", async () => {
  const {
    createTabIdentity,
    resolveTabIdentity
  } = await loadTabIdentity();
  const identity = createTabIdentity({
    id: "63176:8",
    title: "Home / X",
    url: "https://x.com/home"
  });

  assert.throws(
    () => resolveTabIdentity(identity, [
      {
        id: "63176:7",
        title: "Following / X",
        url: "https://x.com/example/following"
      }
    ]),
    /stale_tab_handle/
  );
});

test("rejects ambiguous exact URL recovery", async () => {
  const {
    createTabIdentity,
    resolveTabIdentity
  } = await loadTabIdentity();
  const identity = createTabIdentity({
    id: "63176:8",
    title: "Home / X",
    url: "https://x.com/home"
  });

  assert.throws(
    () => resolveTabIdentity(identity, [
      {
        id: "63176:6",
        title: "Home / X",
        url: "https://x.com/home"
      },
      {
        id: "63176:7",
        title: "Home / X",
        url: "https://x.com/home"
      }
    ]),
    /stale_tab_handle.*ambiguous/
  );
});

test("retargets an identity before an explicit navigation", async () => {
  const {
    createTabIdentity,
    retargetTabIdentity
  } = await loadTabIdentity();
  const identity = createTabIdentity({
    id: "63176:8",
    title: "Home / X",
    url: "https://x.com/home"
  });

  assert.equal(typeof retargetTabIdentity, "function");

  retargetTabIdentity(identity, "https://example.com/dashboard");

  assert.equal(identity.url, "https://example.com/dashboard");
});
