<div align="center">
  <img src="assets/vibevibe-labs-icon.jpg" alt="VibeVibe Labs" width="112" height="112">
  <h1>Safari Browser Use Plugin</h1>
  <p><strong>Let AI agents control the Safari session you already use.</strong></p>
  <p>
    <a href="#supported-agents">Supported Agents</a>
    ·
    <a href="#requirements">Requirements</a>
    ·
    <a href="#installation">Installation</a>
    ·
    <a href="#quick-start">Quick Start</a>
  </p>
  <p>
    <code>Codex</code>
    <code>Claude Code</code>
    <code>GitHub Copilot CLI</code>
    <code>Cursor Agent</code>
  </p>
</div>

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

### Option 1: Ask an agent to install it

Send this single instruction to Codex, Claude Code, GitHub Copilot, or Cursor:

> Install and register Safari Browser Use from https://github.com/vibevibe-labs/safari-browser-use for the current client, guide me through enabling JavaScript from Apple Events in Safari, restart the client if needed, and verify the setup with `browser.doctor()`.

The agent can complete the repository and client installation steps. Safari
and macOS permission prompts still require your confirmation.

### Option 2: Install it manually

#### 1. Clone

```sh
git clone https://github.com/vibevibe-labs/safari-browser-use.git
cd safari-browser-use
```

#### 2. Configure Safari

1. Open Safari Settings > Advanced.
2. Enable **Show features for web developers**.
3. Open Safari Settings > Developer > Automation.
4. Enable **Allow JavaScript from Apple Events**.

#### 3. Install the plugin

For Codex:

```sh
codex plugin marketplace add "$PWD"
codex plugin add safari-browser-use@personal
```

For Claude Code:

```sh
claude plugin marketplace add "$PWD" --scope user
claude plugin install safari-browser-use@vibevibe-labs --scope user
```

For GitHub Copilot CLI:

```sh
copilot plugin marketplace add "$PWD"
copilot plugin install safari-browser-use@vibevibe-labs
```

For Cursor, copy the plugin into Cursor's local plugin directory:

```sh
mkdir -p "$HOME/.cursor/plugins/local"
cp -R "$PWD/plugins/safari-browser-use" "$HOME/.cursor/plugins/local/"
```

Restart the client after installation so the MCP server and skill are loaded.

#### 4. Approve Automation access and verify

Open at least one Safari window, then ask the client to use the `js` MCP tool:

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
