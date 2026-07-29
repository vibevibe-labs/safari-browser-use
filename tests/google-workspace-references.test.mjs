import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pluginRoot = new URL(
  "../plugins/safari-browser-use/",
  import.meta.url
);

test("routes Google Docs and Sheets tasks to dedicated references", async () => {
  const [skill, docs, sheets] = await Promise.all([
    readFile(
      new URL("skills/control-safari/SKILL.md", pluginRoot),
      "utf8"
    ),
    readFile(
      new URL(
        "skills/control-safari/references/google-docs.md",
        pluginRoot
      ),
      "utf8"
    ),
    readFile(
      new URL(
        "skills/control-safari/references/google-sheets.md",
        pluginRoot
      ),
      "utf8"
    )
  ]);

  assert.match(skill, /references\/google-docs\.md/);
  assert.match(skill, /references\/google-sheets\.md/);

  assert.match(docs, /docs\.google\.com\/document/);
  assert.match(docs, /googleAccounts\.list\(\)/);
  assert.match(docs, /googleDocs\.create\(/);
  assert.match(docs, /googleDocs\.getDocumentText\(/);
  assert.match(docs, /googleDocs\.insertText\(/);
  assert.match(docs, /temporary background tab/i);
  assert.match(docs, /clipboard/i);
  assert.doesNotMatch(docs, /\bawait\b/);

  assert.match(sheets, /docs\.google\.com\/spreadsheets/);
  assert.match(sheets, /googleAccounts\.list\(\)/);
  assert.match(sheets, /googleSheets\.create\(/);
  assert.match(sheets, /googleSheets\.getSpreadsheetInfo\(/);
  assert.match(sheets, /googleSheets\.writeMatrix\(/);
  assert.match(sheets, /foreground/i);
  assert.match(sheets, /clipboard/i);
  assert.doesNotMatch(sheets, /\bawait\b/);
});

test("runtime guide lists both synchronous Google Workspace globals", async () => {
  const guide = await readFile(
    new URL("server/src/documentation.md", pluginRoot),
    "utf8"
  );

  assert.match(guide, /googleDocs\.create\(/);
  assert.match(guide, /googleDocs\.dispose\(\)/);
  assert.match(guide, /googleSheets\.create\(/);
  assert.match(guide, /googleSheets\.writeMatrix\(/);
  assert.match(guide, /synchronous/i);
});
