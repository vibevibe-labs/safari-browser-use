---
name: control-safari
description: Control the user's existing Safari 26 tabs through a persistent JavaScript REPL with a Playwright-style browser API. Use when a task must inspect, navigate, click, fill, select, or verify a page in Safari while preserving the user's current logins and browser state.
---

# Control Safari

Use the plugin-provided `js` MCP tool. Every call contains a short `title` and
one synchronous JavaScript `code` cell. Bindings declared with `var` persist
until `js_reset` is called. Browser operations use Safari's Apple Events
interface and `do JavaScript`.

If the plugin-provided `js` or `js_reset` tool is unavailable, stop and report
that the plugin MCP server did not load. Do not fall back to another Safari
MCP tool because it cannot provide this plugin's control indicator.

## Bootstrap

Check the connection first:

```js
browser.doctor()
```

Stop if Safari is not version 26, `automationAvailable` is false, or
`javascriptFromAppleEvents` is false.

Resolve the target tab before selecting it. If the user names a website, URL,
or page title, list the open tabs first:

```js
var tabs = browser.tabs.list()
tabs
```

Use the returned metadata to get the matching tab by ID:

```js
var tab = browser.tabs.get("matching-tab-id")
tab.playwright.domSnapshot()
```

If no matching tab is open, create a new tab and navigate it to the requested
site. Do not inspect an unrelated current tab. Only use `browser.tabs.selected()`
when the user explicitly asks for the current tab or provides no target.

Use `var` for bindings that must persist across cells. `const` and `let`
bindings are local to one cell.

## Interaction Workflow

1. Reuse the current `tab` binding when it is still valid.
2. Read `tab.playwright.domSnapshot()` before constructing a locator.
3. Build a locator only from text, roles, labels, test IDs, or attributes shown
   in the latest snapshot.
4. Call `count()` when uniqueness is not obvious.
5. Click, fill, press, check, or select only when the locator resolves to one
   element.
6. Verify the result with a targeted read or a fresh snapshot.
7. Call `browser.release()` after the browser task finishes or stops.

Example:

```js
var snapshot = tab.playwright.domSnapshot()
snapshot
```

```js
var continueButton = tab.playwright.getByRole("button", {
  name: "Continue",
  exact: true
})
continueButton.count()
```

```js
continueButton.click()
tab.playwright.domSnapshot()
```

Do not guess selectors or use `.first()`, `.last()`, or `.nth()` to bypass an
ambiguous locator.

## Virtualized and Infinite Lists

Virtualized lists only keep the current batch of items in the DOM. Collect them
in a bounded loop: deduplicate stable text or attributes, scroll the last
current item into view, wait briefly for replacement items, and stop after a
known total or three consecutive rounds with no new keys.

Use `scrollIntoView()` when there is a stable item locator:

```js
var items = tab.playwright.getByTestId("UserCell")
var seen = {}
var stagnantRounds = 0
for (var round = 0; round < 50 && stagnantRounds < 3; round++) {
  var texts = items.allTextContents()
  var before = Object.keys(seen).length
  for (var index = 0; index < texts.length; index++) {
    seen[texts[index]] = texts[index]
  }
  stagnantRounds = Object.keys(seen).length === before
    ? stagnantRounds + 1
    : 0
  if (items.count() === 0 || stagnantRounds >= 3) break
  items.last().scrollIntoView({ block: "end" })
  tab.playwright.waitForTimeout(600)
}
```

Using `.last()` only to scroll the current batch is allowed; never use it to
bypass ambiguity for clicks or other consequential actions. When no stable
item exists, use `tab.playwright.scrollBy(0, 700)`. Use `allAttributes("href")`
when links provide a more stable key than localized text.

Do not use `press` with End, PageDown, Space, or Tab to scroll or move focus.
Safari page JavaScript cannot synthesize their trusted browser-default
behavior, so the runtime rejects them instead of reporting false success.

## Control Indicator

Selecting or operating a tab adds a non-interactive perimeter glow and replaces
the original favicon with a solid yellow light that remains visible in
compact Safari tabs. The page glow and yellow favicon start, refresh, and stop together
as one control indicator.

Always remove it before the final response, including when the task finishes
early:

```js
browser.release()
```

`js_reset` and MCP shutdown also release control. A 45-second inactivity lease
removes stale indicators and restores the original favicon if the session ends
unexpectedly.

## Safety

The `js` tool is write-capable. Obtain explicit confirmation immediately before
submitting forms, sending messages, making purchases, changing account
settings, deleting data, or publishing content unless the user already gave
precise authorization.

Use the REPL only for the injected `browser` API. Do not access JXA host APIs,
environment variables, the filesystem, subprocesses, or unrelated network
resources.

Read [references/safety.md](references/safety.md) before consequential actions.
Read [references/runtime-api.md](references/runtime-api.md) for the supported
API. Read [references/troubleshooting.md](references/troubleshooting.md) for
connection, permission, REPL, or locator errors.
