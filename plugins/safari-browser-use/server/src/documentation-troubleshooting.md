# Safari Browser Use — Troubleshooting

Returned at runtime by `browser.documentation("troubleshooting")`. Read this when
`browser.doctor()` reports a problem, or when connection, permission, REPL, or
locator errors occur.

## Doctor Reports an Unsupported Version

Safari Browser Use supports Safari 26 only. Do not bypass the version gate or
fall back to another Safari version's automation.

## Automation Is Unavailable

Check, in order:

1. Safari 26 is running with at least one open window.
2. Safari Settings > Advanced > Show features for web developers is enabled.
3. Safari Settings > Developer > Automation >
   Allow JavaScript from Apple Events is enabled.
4. System Settings > Privacy & Security > Automation allows the current client
   or terminal to control Safari.
5. Restart the client after changing either permission.

Do not attempt to change these settings without the user's knowledge.

## Unsupported Press Default Action

Safari page JavaScript cannot synthesize trusted browser-default behavior for
Tab, PageDown, PageUp, Home, End, or Space. Use `tab.playwright.scrollBy(...)` or
`locator.scrollIntoView(...)` for scrolling, and use a direct locator action
instead of keyboard focus traversal.

## Control Indicator Remains Visible

Call `browser.release()` to remove the active tab's perimeter glow and fake
cursor. `js_reset` also releases it. If the MCP process ended unexpectedly, the
indicator removes itself after 45 seconds without browser activity.

## REPL Binding Conflicts

Reuse or reassign an existing `var`, choose a fresh name, or call `js_reset` when
the session genuinely needs to be cleared. Do not reset after every cell. All
browser methods are synchronous.

## Locator Is Ambiguous

Take a new DOM snapshot and scope the locator to a stable container, attribute,
role, label, or test ID. Do not use `.first()` to hide a strict-mode failure.

## Page Interaction Does Not Work

Read a new DOM snapshot and confirm the element still exists and is visible.
Safari synthetic DOM events may not activate controls that require trusted native
input. Closed shadow roots and cross-origin frames are not available through
`do JavaScript`; report that limitation instead of retrying destructive actions.

## Native Click Is Denied

`nativeClickAt()` requires Accessibility permission for the app running Safari
Browser Use. Ask the user to enable that app under System Settings > Privacy &
Security > Accessibility, then retry the one confirmed click. Do not change the
setting on the user's behalf.
