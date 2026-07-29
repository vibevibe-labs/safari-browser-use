# Google Docs

Use this reference for `docs.google.com/document/`. Follow
`browser.documentation()` first. All methods below are synchronous.

## Choose the account

Read [the Google Accounts reference](google-accounts.md) and call
`googleAccounts.list()` before constructing an account-specific URL. Never
assume account `0`; match the intended email address to its `accountId`.

## Read without keeping an editor open

Parse a URL or read the complete mobile document view:

```js
googleDocs.parseUrl(
  "https://docs.google.com/document/u/1/d/abc123/edit"
)
googleDocs.getDocumentHTML(
  "https://docs.google.com/document/u/1/d/abc123/edit"
)
googleDocs.getDocumentText({ docId: "abc123", uid: 1 })
```

`getDocumentHTML()` and `getDocumentText()` load Google Docs' authenticated
mobile view in a temporary background tab, then close it. Safari Apple Events
does not expose cookies, so these are not direct Cookie HTTP requests.

## Create or edit

`create(accountId)` opens a new document for that signed-in account and leaves
it connected. `connect(url)` opens an existing document:

```js
var createdDoc = googleDocs.create(1)
googleDocs.insertText("Hello world")
googleDocs.getLiveText()
googleDocs.dispose()
```

```js
googleDocs.connect(
  "https://docs.google.com/document/u/1/d/abc123/edit"
)
googleDocs.selectAll()
googleDocs.insertHtmlContent("<h1>Summary</h1><p>Done</p>")
googleDocs.dispose()
```

Only one Docs editor can be connected at a time. Always call
`googleDocs.dispose()` when finished; it closes only the tab created by
`connect()` or `create()`.

The editing methods use trusted macOS keyboard input and clipboard paste because
Google Docs rejects synthetic DOM typing. They temporarily replace the
clipboard, then restore every original pasteboard item and type. Native input
brings the editor tab to the foreground and requires macOS Accessibility
permission for the app running Safari Browser Use.

## Supported methods

| Method | Purpose |
|---|---|
| `googleDocs.parseUrl(url)` | Return `{ docId, uid? }` |
| `googleDocs.getDocumentHTML(target)` | Read authenticated mobile-view HTML |
| `googleDocs.getDocumentText(target)` | Read mobile-view plain text |
| `googleDocs.create(accountId)` | Create and connect a document |
| `googleDocs.connect(url)` | Open and connect an existing document |
| `googleDocs.dispose()` | Close the managed Docs tab |
| `googleDocs.getTitle()` | Read the live editor title |
| `googleDocs.getLiveText()` | Select all and copy the live document text |
| `googleDocs.getSelectedContent()` | Copy `{ text, html }` from the selection |
| `googleDocs.insertText(text)` | Paste plain text at the active insertion point |
| `googleDocs.selectAll()` | Select all document content |
| `googleDocs.insertHtmlContent(html)` | Paste rich HTML with a text fallback |
| `googleDocs.deleteSelection()` | Delete the current selection |

## Limits

- `getLiveText()` leaves all document content selected.
- Insert and delete methods change cloud content. Confirm immediately before the
  write unless the user's current request already authorizes that exact edit.
- Index-based selection, atomic diffs, suggestion batches, Markdown paste, and
  comments are not exposed because they have not passed reliable Safari
  round-trip verification.
- Always call `browser.release()` after the browser task finishes or stops.
