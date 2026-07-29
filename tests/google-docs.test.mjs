import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { buildPlugin } from "../scripts/build-plugin.mjs";

const moduleUrl = new URL(
  "../plugins/safari-browser-use/server/src/google-docs.mjs",
  import.meta.url
);

test("parses a Google Docs URL with its account slot", async () => {
  const { parseGoogleDocsUrl } = await import(moduleUrl);

  assert.deepEqual(
    parseGoogleDocsUrl(
      "https://docs.google.com/document/u/2/d/abc-123_DEF/edit"
    ),
    { docId: "abc-123_DEF", uid: 2 }
  );
  assert.deepEqual(
    parseGoogleDocsUrl(
      "https://docs.google.com/document/d/abc-123_DEF/edit"
    ),
    { docId: "abc-123_DEF" }
  );
  assert.throws(
    () => parseGoogleDocsUrl("https://example.com/document/d/nope"),
    /invalid_google_docs_url/
  );
});

test("reads Docs HTML and text through an account-specific background URL", async () => {
  const { createGoogleDocs } = await import(moduleUrl);
  const urls = [];
  const googleDocs = createGoogleDocs({
    loadHtml(url) {
      urls.push(url);
      return [
        "<html><body><div id=\"contents\">",
        "<p>Hello &amp; welcome</p><p>Second<br>line</p>",
        "</div></body></html>"
      ].join("");
    },
    openEditor() {
      throw new Error("unexpected editor open");
    }
  });

  assert.match(
    googleDocs.getDocumentHTML({ docId: "abc-123", uid: 1 }),
    /Hello &amp; welcome/
  );
  assert.equal(
    googleDocs.getDocumentText(
      "https://docs.google.com/document/u/1/d/abc-123/edit"
    ),
    "Hello & welcome\nSecond\nline"
  );
  assert.deepEqual(urls, [
    "https://docs.google.com/document/u/1/d/abc-123/mobilebasic",
    "https://docs.google.com/document/u/1/d/abc-123/mobilebasic"
  ]);
});

test("extracts text from the real mobilebasic doc-content container", async () => {
  const { googleDocsHtmlToText } = await import(moduleUrl);

  assert.equal(
    googleDocsHtmlToText([
      "<html><head><style>body { color: red; }</style></head><body>",
      "<div class=\"app-container\"><div class=\"doc-container\">",
      "<div class=\"doc\"><div class=\"doc-content\" style=\"padding:72pt\">",
      "<p><span>SBU Docs roundtrip</span></p>",
      "</div></div></div></div>",
      "<script>window.setTimeout(function () {}, 0)</script>",
      "</body></html>"
    ].join("")),
    "SBU Docs roundtrip"
  );
});

test("connects one Docs editor and delegates native editing operations", async () => {
  const { createGoogleDocs } = await import(moduleUrl);
  const calls = [];
  const session = {
    url() {
      return "https://docs.google.com/document/d/new-doc/edit";
    },
    getTitle() {
      return "Project note";
    },
    getLiveText() {
      return "Hello";
    },
    getSelectedContent() {
      return { text: "ell", html: "<b>ell</b>" };
    },
    insertText(text) {
      calls.push(["insertText", text]);
    },
    selectAll() {
      calls.push(["selectAll"]);
    },
    insertHtmlContent(html) {
      calls.push(["insertHtmlContent", html]);
    },
    deleteSelection() {
      calls.push(["deleteSelection"]);
    },
    close() {
      calls.push(["close"]);
    }
  };
  const googleDocs = createGoogleDocs({
    loadHtml() {
      return "";
    },
    openEditor(url) {
      calls.push(["openEditor", url]);
      return session;
    }
  });

  assert.deepEqual(googleDocs.create(1), {
    docId: "new-doc",
    uid: 1,
    url: "https://docs.google.com/document/d/new-doc/edit"
  });
  assert.equal(googleDocs.getTitle(), "Project note");
  assert.equal(googleDocs.getLiveText(), "Hello");
  assert.deepEqual(
    googleDocs.getSelectedContent(),
    { text: "ell", html: "<b>ell</b>" }
  );
  assert.equal(googleDocs.insertText(" world"), undefined);
  assert.equal(googleDocs.selectAll(), undefined);
  assert.equal(
    googleDocs.insertHtmlContent("<strong>Done</strong>"),
    undefined
  );
  assert.equal(googleDocs.deleteSelection(), undefined);
  assert.equal(googleDocs.dispose(), undefined);
  assert.deepEqual(calls, [
    ["openEditor", "https://docs.google.com/document/u/1/create"],
    ["insertText", " world"],
    ["selectAll"],
    ["insertHtmlContent", "<strong>Done</strong>"],
    ["deleteSelection"],
    ["close"]
  ]);
  assert.throws(() => googleDocs.getTitle(), /google_docs_not_connected/);
});

test("rejects a second Docs connection until the first is disposed", async () => {
  const { createGoogleDocs } = await import(moduleUrl);
  const googleDocs = createGoogleDocs({
    loadHtml() {
      return "";
    },
    openEditor() {
      return {
        url() {
          return "https://docs.google.com/document/u/0/d/abc/edit";
        },
        close() {}
      };
    }
  });

  googleDocs.connect(
    "https://docs.google.com/document/u/0/d/abc/edit"
  );
  assert.throws(
    () => googleDocs.connect(
      "https://docs.google.com/document/u/0/d/def/edit"
    ),
    /google_docs_already_connected/
  );
  googleDocs.dispose();
});

test("bundles googleDocs as a persistent synchronous REPL global", async t => {
  const directory = await mkdtemp(
    join(tmpdir(), "safari-browser-use-google-docs-")
  );
  const outfile = join(directory, "server.jxa.js");

  t.after(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  await buildPlugin({ outfile });

  const bundle = await readFile(outfile, "utf8");
  assert.match(bundle, /function createGoogleDocs/);
  assert.match(bundle, /globalObject\.googleDocs = googleDocs/);
  assert.match(bundle, /googleDocs = createGoogleDocs/);
});
