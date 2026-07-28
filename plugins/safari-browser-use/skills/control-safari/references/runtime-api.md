# Safari REPL API

The MCP server exposes:

| Tool | Purpose |
|---|---|
| `js({ title, code })` | Execute one cell in the persistent JavaScript REPL |
| `js_reset()` | Clear user bindings and restore the injected `browser` object |

Cells are synchronous. The value of the final expression is returned.

## Browser

| Method | Purpose |
|---|---|
| `browser.doctor()` | Check Safari 26, Automation access, and JavaScript from Apple Events |
| `browser.release()` | Remove the active tab's AI control indicator |
| `browser.tabs.list()` | List open Safari tabs |
| `browser.tabs.selected()` | Return the selected `Tab` |
| `browser.tabs.get(id)` | Return a tab by ID |
| `browser.tabs.new()` | Open and return a blank tab |

## Tab

| Method | Purpose |
|---|---|
| `tab.id` | Current Safari window and tab coordinate |
| `tab.title()` | Read the current title |
| `tab.url()` | Read the current URL |
| `tab.goto(url)` | Navigate to an HTTP or HTTPS URL |
| `tab.close()` | Close the tab |
| `tab.playwright.domSnapshot()` | Read a semantic DOM snapshot |
| `tab.playwright.canvasSnapshot(selector, options?)` | Capture one `<canvas>` as an image the model can see |
| `tab.playwright.scrollBy(deltaX, deltaY)` | Scroll the page by explicit pixel offsets |
| `tab.playwright.clickAt(x, y, options?)` | Click at viewport coordinates (for `<canvas>` / drawing surfaces) |
| `tab.playwright.drag(fromX, fromY, toX, toY, options?)` | Drag a pointer path between viewport coordinates |
| `tab.playwright.waitForURL(expected, options?)` | Wait for a URL substring, or an exact URL with `{ exact: true }` |
| `tab.playwright.waitForLoadState(options?)` | Wait for `complete`, or `{ state: "interactive" }` |
| `tab.playwright.waitForTimeout(ms)` | Wait for a fixed duration, capped at 30 seconds |

Safari tab coordinates can change when tabs are moved or closed. A `Tab`
automatically reacquires its target when its URL is unique in the original
window. It never recovers by origin alone. Ambiguous or missing targets throw
`stale_tab_handle`; call `browser.tabs.list()` and explicitly select the
intended tab instead of retrying against the old coordinate.

After an action that navigates, prefer observable waits:

```js
tab.goto("https://example.com/dashboard")
tab.playwright.waitForURL("example.com/dashboard")
tab.playwright.waitForLoadState()
```

Both waits accept `{ timeoutMs }` up to 30 seconds. Successful navigation waits
also restore the control indicator in the new document.

## Control Indicator

Selecting a tab or calling one of its browser methods displays a non-interactive
perimeter glow and visible fake cursor on the controlled page. They share one
control lifecycle. Call `browser.release()` when the browser task finishes.
The indicator is removed by `js_reset`, MCP shutdown, or 45 seconds without
activity on that tab.

## Locator Builders

The following builders exist on both `tab.playwright` and locators:

```js
tab.playwright.locator("[data-testid='card']")
tab.playwright.getByRole("button", { name: "Continue", exact: true })
tab.playwright.getByText("Completed", { exact: true })
tab.playwright.getByLabel("Email", { exact: true })
tab.playwright.getByPlaceholder("Search", { exact: true })
tab.playwright.getByTestId("submit")
```

Locators may be scoped:

```js
var card = tab.playwright.locator("[data-testid='product-card']")
var buy = card.getByRole("button", { name: "Buy", exact: true })
```

## Locator Operations

| Method | Purpose |
|---|---|
| `count()` | Count matches |
| `click(options?)` | Click one strict match |
| `fill(value, options?)` | Replace a form value, or the text of a `contenteditable` editor |
| `type(value, options?)` | Append text to an input, textarea, or `contenteditable` editor |
| `press(key, options?)` | Press a key on the matched element |
| `innerText(options?)` | Read rendered text |
| `textContent(options?)` | Read raw text content |
| `allTextContents(options?)` | Read text for every match |
| `allAttributes(name, options?)` | Read one attribute for every match |
| `allRecords(options?)` | Read each match with paired descendant fields |
| `getAttribute(name, options?)` | Read one attribute |
| `isVisible()` | Check visibility |
| `isEnabled()` | Check whether the control is enabled |
| `check()` / `uncheck()` | Change a checkbox or radio |
| `setChecked(value)` | Set checked state explicitly |
| `selectOption(value)` | Select native `<select>` options |
| `canvasSnapshot(options?)` | Capture one `<canvas>` element as a PNG image the model can see |
| `setInputFiles(paths)` | Upload local file(s) into a `<input type="file">` |
| `dropFiles(paths)` | Drop local file(s) onto a drag-and-drop upload zone |
| `scrollIntoView(options?)` | Scroll one strict match into view without clicking it |
| `waitFor(options?)` | Wait for the locator |

`click`, `fill`, `type`, `press`, and single-element reads use strict mode and
throw when the locator resolves to zero or multiple elements.

`press()` dispatches synthetic page events, not trusted Safari keyboard input.
Keys that depend on browser-default behavior—Tab, PageDown, PageUp, Home, End,
and Space—are rejected. Use `scrollBy()` or `scrollIntoView()` for scrolling
and direct locator actions for interaction.

`fill()` and `type()` also target `contenteditable` rich-text editors: `fill()`
replaces the editor's text and `type()` appends to it, dispatching `beforeinput`
and `input` events so page frameworks observe the change. Editors that maintain
their own off-DOM model and only accept trusted keystrokes (for example Google
Docs and Google Sheets cell editing) may not fully reflect programmatic text; a
plain `contenteditable` region, and standard `input`, `textarea`, and `select`
form controls, are fully supported.

## Canvas Vision and Coordinate Input

Pages that render to `<canvas>` (whiteboards, spreadsheet grids, diagram
editors) expose no DOM structure, so `domSnapshot()` returns nothing for their
drawing surface. Two operations bridge that gap:

```js
// See the canvas: returns an image the model reads directly.
tab.playwright.canvasSnapshot("#board")

// Operate the canvas: read a feature's position in the snapshot, then act.
tab.playwright.clickAt(x, y)
tab.playwright.drag(fromX, fromY, toX, toY, { steps: 12 })
```

`canvasSnapshot()` returns an image content block plus metadata:

```json
{
  "image": { "mimeType": "image/png", "width": 240, "height": 120, "bytes": 4812 },
  "source": {
    "width": 240, "height": 120,
    "viewport": { "x": 0, "y": 82, "width": 240, "height": 120 }
  },
  "blank": false
}
```

Use `source.viewport` to convert a pixel `(px, py)` in the returned image into a
click coordinate: `clickAt(viewport.x + px * viewport.width / image.width, …)`.
`options.maxSize` (default `1280`) downsamples large canvases to bound payload.

`clickAt()` and `drag()` dispatch coordinate `PointerEvent`s (plus their mouse
equivalents) spaced across event-loop ticks, which real 2D-canvas apps accept.

Known limits:

- **WebGL canvases** (e.g. Figma) usually read back blank unless the page
  created its context with `preserveDrawingBuffer: true`; `blank: true` flags
  this. Same-origin 2D canvases capture reliably.
- **Cross-origin** pixels taint the canvas and throw
  `canvas_tainted_cross_origin`.
- Each pointer event is a separate Apple Events round-trip, so long drag paths
  are slow. Apps that require **trusted input** (pointer lock, some games) still
  reject synthetic events.

## File Uploads

Provide absolute local paths; the server reads the bytes and reconstructs the
files inside the page.

```js
// Standard <input type="file">
tab.playwright.locator("#avatar").setInputFiles("/Users/me/photo.png")

// Drag-and-drop upload zone
tab.playwright.locator("#dropzone").dropFiles(["/Users/me/a.pdf", "/Users/me/b.pdf"])
```

`setInputFiles()` assigns the files through a `DataTransfer` and dispatches
`input` and `change`; `dropFiles()` dispatches `dragenter`, `dragover`, and
`drop` carrying the files. Both return `{ files: [{ name, size, type }], via }`.

## Unsupported Operations

These operations are intentionally not available because the Apple Events
JavaScript channel cannot perform them safely:

| Operation | Reason | Workaround |
|---|---|---|
| Full-page / native screenshots | No native capture over Apple Events, and page JavaScript cannot rasterize the whole tab faithfully | Read structure with `tab.playwright.domSnapshot()`; capture a specific `<canvas>` with `canvasSnapshot()` |
| WebGL canvas capture | `toDataURL()` reads back blank unless the page set `preserveDrawingBuffer: true` | None from script; capture reports `blank: true` |

File **downloads** need no special API: locate the download control and
`click()` it. Safari saves the file to the user's Downloads folder using its
normal download flow.

For virtualized or infinite lists, collect and deduplicate the current batch,
call `last().scrollIntoView({ block: "end" })`, wait briefly, and repeat with a
fixed round limit. Stop after reaching a known total or three consecutive
rounds without new stable keys. Use `allRecords()` when values from descendant
elements must remain associated with their containing item:

```js
var records = items.allRecords({
  fields: {
    links: { selector: "a[href]", attribute: "href" }
  }
})
```

Each result has `{ textContent, fields }`; every field is an array because one
item can contain multiple descendants. Prefer stable `href` values over
localized text when deduplicating.

## Persistent State

Bindings persist:

```js
var tab = browser.tabs.selected()
var login = tab.playwright.getByRole("button", { name: "Sign in" })
```

A later cell can reuse `tab` and `login`. Prefer `var` for reusable bindings.
Call `js_reset` only when a clean session is required.

The supported surface is intentionally smaller than upstream Playwright. Do not
call methods that are not listed here.
