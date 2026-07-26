---
name: control-safari
description: Control the user's existing Safari 26 tabs through a persistent JavaScript REPL with a Playwright-style browser API. Use when a task must inspect, navigate, click, fill, select, or verify a page in Safari while preserving the user's current logins and browser state.
---

# Control Safari

Use the plugin-provided `js` MCP tool. Every call contains a short `title` and
one synchronous JavaScript `code` cell. Bindings declared with `var` persist
until `js_reset` is called. Browser operations use Safari's Apple Events
interface and `do JavaScript`.

## Bootstrap

Check the connection first:

```js
browser.doctor()
```

Stop if Safari is not version 26, `automationAvailable` is false, or
`javascriptFromAppleEvents` is false.

Select the current tab once and reuse it:

```js
var tab = browser.tabs.selected()
tab.playwright.domSnapshot()
```

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

## Control Indicator

Selecting or operating a tab adds a non-interactive perimeter glow to show that
the AI agent controls that page. Each browser operation refreshes the indicator.

Always remove it before the final response, including when the task finishes
early:

```js
browser.release()
```

`js_reset` and MCP shutdown also release control. A 45-second inactivity lease
removes a stale indicator if the session ends unexpectedly.

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
