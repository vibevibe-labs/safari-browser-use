<div align="center">
  <img src="plugins/safari-browser-use/assets/safari-browser-use-hero.png" alt="Safari Browser Use by VibeVibe Labs" width="100%">
</div>

# Safari Browser Use

Safari Browser Use lets Codex, Claude Code, GitHub Copilot, and Cursor control
your existing Safari 26 tabs with agent-written JavaScript.

It provides:

- A persistent synchronous JavaScript REPL
- A Playwright-style API for inspecting and interacting with pages
- A visible perimeter glow on the tab currently controlled by the agent
- Native plugin manifests for Codex, Claude Code, GitHub Copilot, and Cursor
- Browser automation through the Apple Events support built into macOS

It does not require Node.js, npm, a companion app, Xcode, or an Apple
Developer certificate.

## Installation

### Ask an agent

Paste into Codex, Claude Code, GitHub Copilot CLI, or Cursor:

```text
Install the Safari Browser Use plugin from https://github.com/vibevibe-labs/safari-browser-use using the current client's plugin installer. Stop after installation, then tell me whether to reload plugins or start a new session and give me one example request.
```

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

## Quick Start

Start with a natural-language request:

> Use Safari Browser Use to inspect my current Safari tab and summarize the page. Do not click or type anything.

Variables persist between `js` calls. Use `js_reset` when you want a clean
REPL context.

Selecting or operating a tab adds a non-interactive perimeter glow so you can
see which page the agent controls. The agent removes the control indicator with
`browser.release()` when the browser task ends. It also clears automatically
after 45 seconds without tab activity.

## Available Browser API

```js
browser.doctor()
browser.release()
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

If Safari reports that JavaScript from Apple Events is disabled:

1. Open Safari Settings > Advanced.
2. Enable **Show features for web developers**.
3. Open Safari Settings > Developer > Automation.
4. Enable **Allow JavaScript from Apple Events**.
