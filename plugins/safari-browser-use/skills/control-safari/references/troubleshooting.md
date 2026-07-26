# Troubleshooting

## Doctor Reports an Unsupported Version

Safari Browser Use supports Safari 26 only. Do not bypass the version gate or
fall back to Safari 27 MCP.

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

## REPL Binding Conflicts

Reuse or reassign an existing `var`, choose a fresh name, or call `js_reset`
when the session genuinely needs to be cleared. Do not reset after every cell.
Do not use `await`; all browser methods are synchronous.

## Locator Is Ambiguous

Take a new DOM snapshot and scope the locator to a stable container, attribute,
role, label, or test ID. Do not use `.first()` to hide a strict-mode failure.

## Page Interaction Does Not Work

Read a new DOM snapshot and confirm the element still exists and is visible.
Safari synthetic DOM events may not activate controls that require trusted
native input. Closed shadow roots and cross-origin frames are not available
through `do JavaScript`; report that limitation instead of retrying destructive
actions.
