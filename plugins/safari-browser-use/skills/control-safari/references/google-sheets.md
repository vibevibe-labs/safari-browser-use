# Google Sheets

Use this reference for `docs.google.com/spreadsheets/`. Follow
`browser.documentation()` first. All methods below are synchronous.

## Choose the account

Read [the Google Accounts reference](google-accounts.md) and call
`googleAccounts.list()` before constructing an account-specific URL. Never
assume account `0`; match the intended email address to its `accountId`.

## Read spreadsheet data

```js
var sheetUrl =
  "https://docs.google.com/spreadsheets/u/1/d/abc123/edit#gid=0"
googleSheets.getSpreadsheetInfo(sheetUrl)
googleSheets.readSheet(sheetUrl)
googleSheets.readAllSheets(sheetUrl)
```

`getSpreadsheetInfo()` returns the title and bootstrap sheet metadata, including
sheet names, gids, and allocated row/column sizes.
`readSheet()` selects the used region, copies it as TSV, and converts non-empty
values into A1 cell records. `readAllSheets()` repeats that operation for every
discovered sheet.

Safari Apple Events cannot export cookies. These read methods therefore open a
temporary Sheets editor tab, bring it to the foreground when native copy is
needed, and close it before returning. The user's clipboard is restored with
all original pasteboard formats. The reported `size` is the copied used
region, not the sheet's allocated row and column capacity.

## Create or edit

`create(accountId)` opens a new spreadsheet for that account and leaves it
connected. `connect(url)` opens an existing spreadsheet:

```js
var createdSheet = googleSheets.create(1)
googleSheets.writeMatrix("A1", [
  ["Name", "Count"],
  ["Ada", 42]
])
googleSheets.readSelection()
googleSheets.dispose()
```

```js
googleSheets.connect(sheetUrl)
googleSheets.navigateToCell("B5")
googleSheets.writeTsv("B5", "one\ttwo\nthree\tfour")
googleSheets.switchSheet("42")
googleSheets.dispose()
```

Only one Sheets editor can be connected at a time. Always call
`googleSheets.dispose()` when finished; it closes only the managed tab.

Writes use trusted macOS keyboard input and clipboard paste because the Sheets
grid rejects synthetic DOM typing. Native input brings Safari to the foreground
and requires macOS Accessibility permission for the app running Safari Browser
Use.

## Supported methods

| Method | Purpose |
|---|---|
| `googleSheets.parseUrl(url)` | Return `{ spreadsheetId, uid?, gid? }` |
| `googleSheets.getSpreadsheetInfo(target)` | Read title and sheet metadata |
| `googleSheets.readSheet(target, gid?)` | Read one used region as cell records |
| `googleSheets.readAllSheets(target)` | Read every discovered sheet |
| `googleSheets.create(accountId)` | Create and connect a spreadsheet |
| `googleSheets.connect(url)` | Open and connect an existing spreadsheet |
| `googleSheets.dispose()` | Close the managed Sheets tab |
| `googleSheets.writeMatrix(range, data)` | Paste a 2D array as escaped TSV |
| `googleSheets.writeTsv(range, tsv)` | Paste TSV at an A1 range |
| `googleSheets.writeHtml(range, html)` | Paste rich HTML at an A1 range |
| `googleSheets.navigateToCell(cell)` | Select an A1 cell or rectangular range |
| `googleSheets.switchSheet(gid)` | Switch by numeric sheet gid |
| `googleSheets.readSelection()` | Copy `{ range, tsv, html }` |

## Limits

- Reads reconstruct copied values; formulas and formatting are not currently
  distinguished from their displayed values.
- Notes, comments, dropdown metadata, conditional formats, images, merges, and
  rich cell extraction are not exposed until they pass reliable Safari
  round-trip verification.
- Writes change cloud content. Confirm immediately before the write unless the
  user's current request already authorizes that exact edit.
- Always call `browser.release()` after the browser task finishes or stops.
