import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { buildPlugin } from "../scripts/build-plugin.mjs";

const moduleUrl = new URL(
  "../plugins/safari-browser-use/server/src/google-sheets.mjs",
  import.meta.url
);

test("parses a Google Sheets URL with account and grid IDs", async () => {
  const { parseGoogleSheetsUrl } = await import(moduleUrl);

  assert.deepEqual(
    parseGoogleSheetsUrl(
      "https://docs.google.com/spreadsheets/u/3/d/sheet_123/edit#gid=42"
    ),
    { spreadsheetId: "sheet_123", uid: 3, gid: "42" }
  );
  assert.deepEqual(
    parseGoogleSheetsUrl(
      "https://docs.google.com/spreadsheets/d/sheet_123/edit"
    ),
    { spreadsheetId: "sheet_123" }
  );
  assert.throws(
    () => parseGoogleSheetsUrl("https://example.com/sheet"),
    /invalid_google_sheets_url/
  );
});

test("reads spreadsheet metadata and one sheet through the background reader", async () => {
  const { createGoogleSheets } = await import(moduleUrl);
  const calls = [];
  const googleSheets = createGoogleSheets({
    readSpreadsheet(target) {
      calls.push(["info", target]);
      return {
        docTitle: "Budget",
        sheets: [
          {
            name: "Summary",
            gid: "0",
            gridId: "0",
            size: { rows: 1000, cols: 26 }
          }
        ]
      };
    },
    readSheet(target, gid) {
      calls.push(["sheet", target, gid]);
      return {
        name: "Summary",
        gid: "0",
        gridId: "0",
        size: { rows: 2, cols: 2 },
        cells: [
          {
            cell: "A1",
            row: 1,
            col: 0,
            colLetter: "A",
            value: "Revenue",
            valueType: "string"
          }
        ]
      };
    },
    openEditor() {
      throw new Error("unexpected editor open");
    }
  });
  const url =
    "https://docs.google.com/spreadsheets/u/2/d/sheet_123/edit#gid=0";

  assert.equal(googleSheets.getSpreadsheetInfo(url).docTitle, "Budget");
  assert.equal(googleSheets.readSheet(url).cells[0].cell, "A1");
  assert.deepEqual(calls, [
    [
      "info",
      { spreadsheetId: "sheet_123", uid: 2, gid: "0" }
    ],
    [
      "sheet",
      { spreadsheetId: "sheet_123", uid: 2, gid: "0" },
      "0"
    ]
  ]);
});

test("writes matrices as escaped TSV through one connected Sheets editor", async () => {
  const { createGoogleSheets } = await import(moduleUrl);
  const calls = [];
  const session = {
    url() {
      return [
        "https://docs.google.com/spreadsheets/d/new-sheet/",
        "edit#gid=0"
      ].join("");
    },
    writeTsv(range, tsv) {
      calls.push(["writeTsv", range, tsv]);
    },
    writeHtml(range, html) {
      calls.push(["writeHtml", range, html]);
    },
    navigateToCell(cell) {
      calls.push(["navigateToCell", cell]);
    },
    switchSheet(gid) {
      calls.push(["switchSheet", gid]);
    },
    readSelection() {
      return { range: "A1:B2", tsv: "A\tB\n1\t2" };
    },
    close() {
      calls.push(["close"]);
    }
  };
  const googleSheets = createGoogleSheets({
    readSpreadsheet() {
      return {};
    },
    readSheet() {
      return {};
    },
    openEditor(url) {
      calls.push(["openEditor", url]);
      return session;
    }
  });

  assert.deepEqual(googleSheets.create(2), {
    spreadsheetId: "new-sheet",
    uid: 2,
    gid: "0",
    url: [
      "https://docs.google.com/spreadsheets/d/new-sheet/",
      "edit#gid=0"
    ].join("")
  });
  googleSheets.writeMatrix("A1", [
    ["Name", "Note"],
    ["Ada", "line 1\nline 2"],
    ["Grace", "quoted \"value\""]
  ]);
  googleSheets.writeHtml("D1", "<b>Total</b>");
  googleSheets.navigateToCell("B5");
  googleSheets.switchSheet("42");
  assert.deepEqual(
    googleSheets.readSelection(),
    { range: "A1:B2", tsv: "A\tB\n1\t2" }
  );
  googleSheets.dispose();

  assert.deepEqual(calls, [
    [
      "openEditor",
      "https://docs.google.com/spreadsheets/u/2/create"
    ],
    [
      "writeTsv",
      "A1",
      [
        "Name\tNote",
        "Ada\t\"line 1\nline 2\"",
        "Grace\t\"quoted \"\"value\"\"\""
      ].join("\n")
    ],
    ["writeHtml", "D1", "<b>Total</b>"],
    ["navigateToCell", "B5"],
    ["switchSheet", "42"],
    ["close"]
  ]);
});

test("readAllSheets reads every gid discovered from metadata", async () => {
  const { createGoogleSheets } = await import(moduleUrl);
  const gids = [];
  const googleSheets = createGoogleSheets({
    readSpreadsheet() {
      return {
        docTitle: "Workbook",
        sheets: [
          { name: "One", gid: "0" },
          { name: "Two", gid: "9" }
        ]
      };
    },
    readSheet(target, gid) {
      gids.push(gid);
      return { gid, cells: [] };
    },
    openEditor() {
      throw new Error("unexpected editor open");
    }
  });

  assert.deepEqual(
    googleSheets.readAllSheets(
      "https://docs.google.com/spreadsheets/u/1/d/book/edit"
    ),
    [
      { gid: "0", cells: [] },
      { gid: "9", cells: [] }
    ]
  );
  assert.deepEqual(gids, ["0", "9"]);
});

test("converts copied TSV into typed A1 cell records", async () => {
  const { tsvToSheetData } = await import(moduleUrl);

  assert.deepEqual(
    tsvToSheetData(
      "Name\tCount\tActive\nAda\t42\tTRUE\nGrace\t\"line 1\nline 2\"\t",
      {
        name: "Summary",
        gid: "0",
        gridId: "0"
      }
    ),
    {
      name: "Summary",
      gid: "0",
      gridId: "0",
      size: { rows: 3, cols: 3 },
      cells: [
        {
          cell: "A1",
          row: 1,
          col: 0,
          colLetter: "A",
          value: "Name",
          valueType: "string"
        },
        {
          cell: "B1",
          row: 1,
          col: 1,
          colLetter: "B",
          value: "Count",
          valueType: "string"
        },
        {
          cell: "C1",
          row: 1,
          col: 2,
          colLetter: "C",
          value: "Active",
          valueType: "string"
        },
        {
          cell: "A2",
          row: 2,
          col: 0,
          colLetter: "A",
          value: "Ada",
          valueType: "string"
        },
        {
          cell: "B2",
          row: 2,
          col: 1,
          colLetter: "B",
          value: 42,
          valueType: "number"
        },
        {
          cell: "C2",
          row: 2,
          col: 2,
          colLetter: "C",
          value: true,
          valueType: "boolean"
        },
        {
          cell: "A3",
          row: 3,
          col: 0,
          colLetter: "A",
          value: "Grace",
          valueType: "string"
        },
        {
          cell: "B3",
          row: 3,
          col: 1,
          colLetter: "B",
          value: "line 1\nline 2",
          valueType: "string"
        }
      ]
    }
  );
});

test("parses sheet names, gids, and sizes from Sheets bootstrap data", async () => {
  const { parseGoogleSheetsBootstrap } = await import(moduleUrl);
  const firstSheet = JSON.stringify([
    0,
    0,
    "0",
    [{ 1: [[0, 0, "Summary"]] }],
    1000,
    26
  ]);
  const secondSheet = JSON.stringify([
    1,
    0,
    "42",
    [{ 1: [[0, 0, "Archive"]] }],
    200,
    12
  ]);
  const bootstrap = JSON.stringify({
    topsnapshot: [
      [21350203, firstSheet],
      [21350203, secondSheet]
    ],
    initialCommands: [
      [21350203, firstSheet]
    ]
  });
  const html = [
    "<script>var bootstrapData = ",
    bootstrap,
    "; function loadWaffle() {}</script>"
  ].join("");

  assert.deepEqual(parseGoogleSheetsBootstrap(html), [
    {
      name: "Summary",
      gid: "0",
      gridId: "0",
      size: { rows: 1000, cols: 26 }
    },
    {
      name: "Archive",
      gid: "42",
      gridId: "42",
      size: { rows: 200, cols: 12 }
    }
  ]);
});

test("bundles googleSheets as a persistent synchronous REPL global", async t => {
  const directory = await mkdtemp(
    join(tmpdir(), "safari-browser-use-google-sheets-")
  );
  const outfile = join(directory, "server.jxa.js");

  t.after(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  await buildPlugin({ outfile });

  const bundle = await readFile(outfile, "utf8");
  assert.match(bundle, /function createGoogleSheets/);
  assert.match(bundle, /globalObject\.googleSheets = googleSheets/);
  assert.match(bundle, /googleSheets = createGoogleSheets/);
});
