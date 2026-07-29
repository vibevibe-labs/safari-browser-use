import assert from "node:assert/strict";
import test from "node:test";

const moduleUrl = new URL(
  "../plugins/safari-browser-use/server/src/google-workspace-editor.mjs",
  import.meta.url
);

test("waits for a create redirect by inspecting the same raw tab", async () => {
  const { waitForGoogleEditorReady } = await import(moduleUrl);
  const rawTab = {};
  const inspected = [];
  const states = [
    {
      url: "https://docs.google.com/document/u/0/create",
      editorState: { editorPoint: null }
    },
    {
      url: "https://docs.google.com/document/u/0/d/abc123/edit",
      editorState: { editorPoint: { x: 100, y: 200 } }
    }
  ];
  let now = 0;

  assert.deepEqual(
    waitForGoogleEditorReady("docs", rawTab, {
      inspect(tab, method) {
        inspected.push([tab, method]);
        return states.shift();
      },
      now() {
        return now++;
      },
      sleep() {},
      timeoutMs: 1000
    }),
    {
      editorPoint: { x: 100, y: 200 }
    }
  );
  assert.deepEqual(inspected, [
    [rawTab, "googleDocs.editorState"],
    [rawTab, "googleDocs.editorState"]
  ]);
});

test("rejects an editor that redirects outside the requested Google app", async () => {
  const { waitForGoogleEditorReady } = await import(moduleUrl);
  let now = 0;

  assert.throws(
    () => waitForGoogleEditorReady("sheets", {}, {
      inspect() {
        return {
          url: "https://accounts.google.com/signin",
          editorState: { editorPoint: { x: 1, y: 1 } }
        };
      },
      now() {
        return now += 100;
      },
      sleep() {},
      timeoutMs: 150
    }),
    /google_sheets_editor_timeout/
  );
});

test("builds a Sheets range URL without duplicating gid parameters", async () => {
  const { googleSheetsRangeUrl } = await import(moduleUrl);

  assert.equal(
    googleSheetsRangeUrl(
      [
        "https://docs.google.com/spreadsheets/d/book/edit",
        "?gid=0#gid=0"
      ].join(""),
      "B5"
    ),
    [
      "https://docs.google.com/spreadsheets/d/book/edit",
      "?gid=0#gid=0&range=B5"
    ].join("")
  );
  assert.equal(
    googleSheetsRangeUrl(
      "https://docs.google.com/spreadsheets/d/book/edit#gid=42",
      "A1:B2"
    ),
    [
      "https://docs.google.com/spreadsheets/d/book/edit",
      "#gid=42&range=A1%3AB2"
    ].join("")
  );
});
