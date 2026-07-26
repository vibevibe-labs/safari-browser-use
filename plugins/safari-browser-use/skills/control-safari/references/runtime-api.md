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
| `tab.playwright.waitForTimeout(ms)` | Wait for a fixed duration |

Safari tab coordinates can change when tabs are moved or closed. Reacquire the
tab with `browser.tabs.selected()` or `browser.tabs.get(id)` after manual tab
reordering.

## Control Indicator

Selecting a tab or calling one of its browser methods displays a non-interactive
perimeter glow, flashes a yellow favicon that remains visible in compact Safari
tabs, and prefixes the title with an AI marker. Call `browser.release()` when
the browser task finishes. The indicators are removed and the original title
and favicon are restored by `js_reset`, MCP shutdown, or 45 seconds without
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
| `fill(value, options?)` | Replace a form value |
| `type(value, options?)` | Append text |
| `press(key, options?)` | Press a key on the matched element |
| `innerText(options?)` | Read rendered text |
| `textContent(options?)` | Read raw text content |
| `allTextContents(options?)` | Read text for every match |
| `getAttribute(name, options?)` | Read one attribute |
| `isVisible()` | Check visibility |
| `isEnabled()` | Check whether the control is enabled |
| `check()` / `uncheck()` | Change a checkbox or radio |
| `setChecked(value)` | Set checked state explicitly |
| `selectOption(value)` | Select native `<select>` options |
| `waitFor(options?)` | Wait for the locator |

`click`, `fill`, `type`, `press`, and single-element reads use strict mode and
throw when the locator resolves to zero or multiple elements.

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
