import assert from "node:assert/strict";
import {
  access,
  mkdtemp,
  readFile,
  rm
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { buildPlugin } from "../scripts/build-plugin.mjs";

const sourceUrl = new URL(
  "../plugins/safari-browser-use/server/src/google-accounts.mjs",
  import.meta.url
);

const accountsHtml = `
  <div id="choose-account-0">
    <img src="https://example.com/ada.png">
    <span class="account-name">Ada Lovelace</span>
    <span class="account-email">ada@example.com</span>
  </div>
  <div id="choose-account-2">
    <img src="https://example.com/grace.png">
    <span class="account-name">Grace Hopper</span>
    <span class="account-email">grace@example.com</span>
  </div>
`;

async function loadSubject() {
  return import(sourceUrl.href);
}

test("waits for a temporary tab to leave about:blank", async () => {
  const { loadTemporaryPageSource } = await loadSubject();
  assert.equal(typeof loadTemporaryPageSource, "function");

  const states = [
    {
      url: "about:blank",
      readyState: "complete",
      source: "<html></html>"
    },
    {
      url: "https://accounts.google.com/SignOutOptions?hl=en",
      readyState: "loading",
      source: ""
    },
    {
      url: "https://accounts.google.com/SignOutOptions?hl=en",
      readyState: "complete",
      source: accountsHtml
    }
  ];
  let closes = 0;
  let inspections = 0;
  let sleeps = 0;
  let time = 0;

  const source = loadTemporaryPageSource(
    "https://accounts.google.com/SignOutOptions?hl=en",
    {
      open() {
        return {};
      },
      inspect() {
        inspections++;
        return states.shift();
      },
      close() {
        closes++;
      },
      sleep() {
        sleeps++;
      },
      now() {
        return time++;
      },
      timeoutMs: 1000
    }
  );

  assert.equal(source, accountsHtml);
  assert.equal(inspections, 3);
  assert.equal(sleeps, 2);
  assert.equal(closes, 1);
});

test("parses signed-in Google accounts from SignOutOptions HTML", async () => {
  const { parseGoogleAccounts } = await loadSubject();

  assert.deepEqual(parseGoogleAccounts(accountsHtml), [
    {
      accountId: 0,
      name: "Ada Lovelace",
      email: "ada@example.com",
      profileImageUrl: "https://example.com/ada.png"
    },
    {
      accountId: 2,
      name: "Grace Hopper",
      email: "grace@example.com",
      profileImageUrl: "https://example.com/grace.png"
    }
  ]);
});

test("lists accounts through the Google sign-out options page", async () => {
  const { createGoogleAccounts } = await loadSubject();
  const requestedUrls = [];
  const googleAccounts = createGoogleAccounts({
    loadHtml(url) {
      requestedUrls.push(url);
      return accountsHtml;
    },
    write() {}
  });

  assert.deepEqual(googleAccounts.list(), [
    {
      accountId: 0,
      name: "Ada Lovelace",
      email: "ada@example.com",
      profileImageUrl: "https://example.com/ada.png"
    },
    {
      accountId: 2,
      name: "Grace Hopper",
      email: "grace@example.com",
      profileImageUrl: "https://example.com/grace.png"
    }
  ]);
  assert.deepEqual(requestedUrls, [
    "https://accounts.google.com/SignOutOptions?hl=en"
  ]);
});

test("prints a concise account list", async () => {
  const { createGoogleAccounts } = await loadSubject();
  const output = [];
  const googleAccounts = createGoogleAccounts({
    loadHtml() {
      return accountsHtml;
    },
    write(value) {
      output.push(value);
    }
  });

  assert.equal(googleAccounts.print(), undefined);
  assert.deepEqual(output, [
    [
      "[0] Ada Lovelace (ada@example.com)",
      "[2] Grace Hopper (grace@example.com)"
    ].join("\n")
  ]);
});

test("bundles googleAccounts as a persistent REPL global", async t => {
  const directory = await mkdtemp(
    join(tmpdir(), "safari-browser-use-google-accounts-")
  );
  const outfile = join(directory, "server.jxa.js");

  t.after(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  await buildPlugin({ outfile });

  const bundle = await readFile(outfile, "utf8");
  assert.match(bundle, /function createGoogleAccounts/);
  assert.match(bundle, /globalObject\.googleAccounts = googleAccounts/);
  assert.match(bundle, /SignOutOptions\?hl=en/);
});

test("documents the synchronous Google account discovery API", async () => {
  const pluginRoot = new URL(
    "../plugins/safari-browser-use/",
    import.meta.url
  );
  const [skill, reference, guide] = await Promise.all([
    readFile(
      new URL("skills/control-safari/SKILL.md", pluginRoot),
      "utf8"
    ),
    readFile(
      new URL(
        "skills/control-safari/references/google-accounts.md",
        pluginRoot
      ),
      "utf8"
    ),
    readFile(
      new URL("server/src/documentation.md", pluginRoot),
      "utf8"
    )
  ]);

  assert.match(skill, /references\/google-accounts\.md/);
  assert.match(reference, /googleAccounts\.list\(\)/);
  assert.match(reference, /temporary background tab/i);
  assert.doesNotMatch(reference, /\bawait\b/);
  assert.match(guide, /googleAccounts\.print\(\)/);
  assert.match(guide, /temporary background tab/i);
  await assert.rejects(
    access(
      new URL("skills/google-accounts/SKILL.md", pluginRoot)
    ),
    /ENOENT/
  );
});
