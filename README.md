<div align="center">
  <img src="plugins/safari-browser-use/assets/vibevibe-labs-icon.jpg" alt="VibeVibe Labs" width="112" height="112">
  <h1>Safari Browser Use</h1>
  <p><strong>Let AI agents control the Safari session you already use.</strong></p>
  <p>
    <a href="#installation">Installation</a>
    ·
    <a href="#quick-start">Quick Start</a>
    ·
    <a href="plugins/safari-browser-use/README.md#supported-agents">Supported Agents</a>
  </p>
  <p>
    <code>Codex</code>
    <code>Claude Code</code>
    <code>GitHub Copilot CLI</code>
    <code>Cursor Agent</code>
  </p>
</div>

Safari Browser Use lets Codex, Claude Code, GitHub Copilot, and Cursor control
your existing Safari 26 tabs with agent-written JavaScript.

It provides:

- A persistent synchronous JavaScript REPL
- A Playwright-style API for inspecting and interacting with pages
- Native plugin manifests for Codex, Claude Code, GitHub Copilot, and Cursor
- Browser automation through the Apple Events support built into macOS

It does not require Node.js, npm, a companion app, Xcode, or an Apple
Developer certificate.

## Requirements

- macOS with Safari 26
- JavaScript from Apple Events enabled in Safari

Safari 27 is not supported by this release.

## Installation

### Ask an agent

Send this single instruction to Codex, Claude Code, GitHub Copilot, or Cursor:

> Install and register Safari Browser Use from https://github.com/vibevibe-labs/safari-browser-use for the current client, guide me through enabling JavaScript from Apple Events in Safari, restart the client if needed, and verify the setup with `browser.doctor()`.

### Install manually

Follow the
[installation and quick-start guide](plugins/safari-browser-use/README.md)
for your client and the two required macOS permissions.

## Quick Start

Start with a natural-language request:

> Use Safari Browser Use to inspect my current Safari tab and summarize the page. Do not click or type anything.

Or call the `js` MCP tool directly:

```json
{
  "title": "Check Safari",
  "code": "browser.doctor()"
}
```

```json
{
  "title": "Inspect the current tab",
  "code": "var tab = browser.tabs.selected(); tab.playwright.domSnapshot()"
}
```

```json
{
  "title": "Click Continue",
  "code": "var button = tab.playwright.getByRole('button', { name: 'Continue', exact: true }); if (button.count() !== 1) throw new Error('Expected one Continue button'); button.click()"
}
```

Variables persist between `js` calls. Use `js_reset` when you want a clean
REPL context.

## Available Browser API

```js
browser.doctor()
browser.tabs.list()
var tab = browser.tabs.selected()
tab.title()
tab.url()
tab.goto("https://example.com")
tab.playwright.domSnapshot()
tab.playwright.getByLabel("Email").fill("user@example.com")
tab.playwright.getByRole("button", { name: "Submit" }).click()
```

Safari asks for Automation permission the first time the plugin controls it.
Only approve that request when you intend to let the current client automate
Safari.
