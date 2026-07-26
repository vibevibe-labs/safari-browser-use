<div align="center">
  <img src="assets/safari-browser-use-hero.png" alt="Safari Browser Use by VibeVibe Labs" width="100%">
</div>

# Safari Browser Use Plugin

Control existing Safari 26 tabs from Codex, Claude Code, GitHub Copilot, or
Cursor with a persistent JavaScript REPL and a Playwright-style browser API.

The plugin uses JXA and Apple Events already included with macOS. It does not
require Node.js, npm, a companion app, Xcode, or an Apple Developer
certificate.

## Supported Agents

| Agent | Support | Integration |
| --- | --- | --- |
| OpenAI Codex | Native | Codex plugin, Agent Skill, and MCP server |
| Claude Code | Native | Claude Code plugin, Agent Skill, and MCP server |
| GitHub Copilot CLI | Native | Copilot plugin, Agent Skill, and MCP server |
| Cursor Agent | Native | Cursor plugin, Agent Skill, and MCP server |

## Requirements

- macOS with Safari 26

Safari 27 is not supported by this release.

## Installation

### Setup prompt

Paste into Codex, Claude Code, GitHub Copilot CLI, or Cursor:

```text
Install or upgrade Safari Browser Use for this client from https://github.com/vibevibe-labs/safari-browser-use using its native plugin system; do not install Node.js or build from source. Reload plugins when supported, or tell me to start a new session, then connect it to Safari 26. Ask me to enable "Allow JavaScript from Apple Events" if needed. Follow https://github.com/vibevibe-labs/safari-browser-use/blob/main/plugins/safari-browser-use/README.md#manual-installation if setup or connection fails.
```

Safari and macOS permission prompts still require your confirmation.

### Manual installation

#### Codex

```sh
codex plugin marketplace add vibevibe-labs/safari-browser-use
codex plugin add safari-browser-use@vibevibe-labs
```

Start a new Codex task after installation.

#### Claude Code

```sh
claude plugin marketplace add vibevibe-labs/safari-browser-use --scope user
claude plugin install safari-browser-use@vibevibe-labs --scope user
```

Run `/reload-plugins` after installation.

#### GitHub Copilot CLI

```sh
copilot plugin install vibevibe-labs/safari-browser-use:plugins/safari-browser-use
```

Start a new Copilot CLI session after installation.

#### Cursor

Until the plugin is listed in Cursor Marketplace, install it from a local
checkout:

```sh
git clone --depth 1 https://github.com/vibevibe-labs/safari-browser-use.git
mkdir -p "$HOME/.cursor/plugins/local"
cp -R safari-browser-use/plugins/safari-browser-use "$HOME/.cursor/plugins/local/"
```

Restart Cursor after installation.

#### Connect Safari

1. Open Safari Settings > Advanced.
2. Enable **Show features for web developers**.
3. Open Safari Settings > Developer > Automation.
4. Enable **Allow JavaScript from Apple Events**.
5. Open at least one Safari window.

In the new or reloaded agent session, ask it to use the `js` MCP tool:


```json
{
  "title": "Check Safari",
  "code": "browser.doctor()"
}
```

Approve the macOS request allowing the current client or terminal to control
Safari. If it was previously denied, open System Settings > Privacy & Security
> Automation and enable Safari for that application.

A working result contains:

```json
{
  "safariSupported": true,
  "automationAvailable": true,
  "javascriptFromAppleEvents": true,
  "issues": []
}
```

## Quick Start

Start with a natural-language request:

> Use Safari Browser Use to inspect my current Safari tab and summarize the page. Do not click or type anything.

The equivalent REPL workflow is:

```json
{
  "title": "Select the active tab",
  "code": "var tab = browser.tabs.selected(); ({ title: tab.title(), url: tab.url() })"
}
```

```json
{
  "title": "Inspect the page",
  "code": "tab.playwright.domSnapshot()"
}
```

Confirm that an element is unique before interacting with it:

```json
{
  "title": "Locate Continue",
  "code": "var continueButton = tab.playwright.getByRole('button', { name: 'Continue', exact: true }); continueButton.count()"
}
```

```json
{
  "title": "Click Continue",
  "code": "continueButton.click()"
}
```

The REPL is synchronous. Bindings declared with `var` persist across `js`
calls; use `js_reset` to clear them.

## Common Operations

```js
browser.tabs.list()
var tab = browser.tabs.selected()
tab.goto("https://example.com")
tab.playwright.domSnapshot()
tab.playwright.getByLabel("Email").fill("user@example.com")
tab.playwright.getByRole("button", { name: "Submit" }).click()
```

Page operations run through Safari's `do JavaScript` Apple Event. Closed shadow
roots and cross-origin frames are outside the supported surface.
