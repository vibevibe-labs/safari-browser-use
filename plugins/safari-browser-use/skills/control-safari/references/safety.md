# Browser Safety

## Require Confirmation

Request confirmation immediately before:

- Sending a message, email, comment, or form
- Publishing or uploading content
- Purchasing, booking, subscribing, or transferring money
- Deleting or overwriting user data
- Changing passwords, permissions, security, or account settings
- Accepting legal terms or consent dialogs

A request to inspect or prepare a form does not authorize submission.

## Minimize Scope

- Read the current state before every mutation.
- Target the tab explicitly when multiple tabs are open.
- Build locators from the latest DOM snapshot.
- Confirm ambiguous locators with `count()`.
- Perform one meaningful mutation per REPL cell.
- Verify the visible outcome after the mutation.
- Stop when the page state differs materially from the user's request.

## Protect Browser State

Do not export cookies, tokens, local storage, passwords, or private page data
unless the user explicitly requests the exact data and destination. Never log
page credentials or injected script results that contain secrets.

Use the REPL only for browser automation. Do not read host files, environment
variables, credentials, or unrelated network resources.

Apple Events grants the approved client broad control over Safari. Do not ask
the user to enable Automation access for unrelated applications.
