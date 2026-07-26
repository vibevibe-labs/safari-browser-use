import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const pluginRoot = new URL("../plugins/safari-browser-use/", import.meta.url);
const repositoryRoot = new URL("../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, pluginRoot), "utf8"));
}

async function readRepositoryJson(path) {
  return JSON.parse(await readFile(new URL(path, repositoryRoot), "utf8"));
}

test("all client manifests expose the shared skill and native MCP config", async () => {
  const manifests = [
    [".codex-plugin/plugin.json", "./.mcp.json"],
    [".claude-plugin/plugin.json", "./.mcp.json"],
    ["plugin.json", "./copilot.mcp.json"],
    [".cursor-plugin/plugin.json", "./cursor.mcp.json"]
  ];

  for (const [path, mcpServers] of manifests) {
    const manifest = await readJson(path);

    assert.equal(manifest.name, "safari-browser-use");
    assert.equal(manifest.version, "0.1.0");
    assert.equal(manifest.skills, "./skills/");
    assert.equal(manifest.mcpServers, mcpServers);
  }
});

test("client MCP configurations start JXA with the system osascript", async () => {
  const configurations = [
    [".mcp.json", "${CLAUDE_PLUGIN_ROOT}/dist/server.jxa.js"],
    ["copilot.mcp.json", "${PLUGIN_ROOT}/dist/server.jxa.js"],
    ["cursor.mcp.json", "${CURSOR_PLUGIN_ROOT}/dist/server.jxa.js"]
  ];

  for (const [path, serverPath] of configurations) {
    const config = await readJson(path);
    const server = config.mcpServers["safari-browser-use"];

    assert.equal(server.command, "/usr/bin/osascript");
    assert.deepEqual(server.args, [
      "-l",
      "JavaScript",
      serverPath
    ]);
  }

  const copilot = await readJson("copilot.mcp.json");
  assert.deepEqual(
    copilot.mcpServers["safari-browser-use"].tools,
    ["*"]
  );
});

test("the Claude marketplace publishes the shared plugin directory", async () => {
  const marketplace = await readRepositoryJson(
    ".claude-plugin/marketplace.json"
  );

  assert.equal(marketplace.name, "vibevibe-labs");
  assert.match(marketplace.description, /Safari 26/);
  assert.deepEqual(marketplace.plugins.map(plugin => ({
    name: plugin.name,
    source: plugin.source
  })), [{
    name: "safari-browser-use",
    source: "./plugins/safari-browser-use"
  }]);
});

test("the Codex marketplace uses the public publisher name", async () => {
  const marketplace = await readRepositoryJson(
    ".agents/plugins/marketplace.json"
  );

  assert.equal(marketplace.name, "vibevibe-labs");
  assert.equal(marketplace.interface.displayName, "VibeVibe Labs");
});

test("GitHub Copilot and Cursor marketplaces publish the shared plugin directory", async () => {
  const copilot = await readRepositoryJson(
    ".github/plugin/marketplace.json"
  );
  assert.equal(copilot.name, "vibevibe-labs");
  assert.deepEqual(copilot.plugins.map(plugin => ({
    name: plugin.name,
    source: plugin.source,
    version: plugin.version
  })), [{
    name: "safari-browser-use",
    source: "./plugins/safari-browser-use",
    version: "0.1.0"
  }]);

  const cursor = await readRepositoryJson(
    ".cursor-plugin/marketplace.json"
  );
  assert.equal(cursor.name, "vibevibe-labs");
  assert.deepEqual(cursor.plugins.map(plugin => ({
    name: plugin.name,
    source: plugin.source
  })), [{
    name: "safari-browser-use",
    source: "./plugins/safari-browser-use"
  }]);
});

test("repository installation guide covers every supported client", async () => {
  const readme = await readFile(
    new URL("README.md", repositoryRoot),
    "utf8"
  );

  assert.match(readme, /GitHub Copilot/);
  assert.match(
    readme,
    /codex plugin marketplace add vibevibe-labs\/safari-browser-use/
  );
  assert.match(
    readme,
    /codex plugin add safari-browser-use@vibevibe-labs/
  );
  assert.match(
    readme,
    /claude plugin marketplace add vibevibe-labs\/safari-browser-use/
  );
  assert.match(
    readme,
    /claude plugin install safari-browser-use@vibevibe-labs/
  );
  assert.match(
    readme,
    /copilot plugin install vibevibe-labs\/safari-browser-use:plugins\/safari-browser-use/
  );
  assert.match(readme, /Cursor/);
  assert.match(readme, /\.cursor\/plugins\/local/);
  assert.match(readme, /Only install the plugin/);
  assert.match(readme, /When installation is complete/);
  assert.match(readme, /example request/);
  assert.match(readme, /Allow JavaScript from Apple Events/);
  assert.match(readme, /does not\s+require Node\.js/i);
  assert.doesNotMatch(readme, /safari-browser-use@personal/);
  assert.doesNotMatch(readme, /plugin marketplace add "\$PWD"/);
  assert.doesNotMatch(readme, /then connect it to Safari/);
  assert.doesNotMatch(readme, /if setup or connection fails/);
  assert.doesNotMatch(readme, /npm ci|npm run build/);
  assert.doesNotMatch(readme, /\bawait\b/);
  assert.doesNotMatch(
    readme,
    /xcodeproj|signing team|Safari Settings > Extensions/i
  );

  await assert.rejects(
    access(new URL("README.md", pluginRoot)),
    error => error.code === "ENOENT"
  );
});

test("skill uses Apple Events without an extension bridge", async () => {
  const skill = await readFile(
    new URL("skills/control-safari/SKILL.md", pluginRoot),
    "utf8"
  );

  assert.match(skill, /Apple Events/);
  assert.match(skill, /synchronous/i);
  assert.doesNotMatch(skill, /\bawait\b/);
  assert.doesNotMatch(skill, /bridge|Safari extension/i);
});

test("repository quick start describes a zero-dependency synchronous REPL", async () => {
  const readme = await readFile(
    new URL("README.md", repositoryRoot),
    "utf8"
  );

  assert.match(readme, /does not require Node\.js/i);
  assert.match(readme, /synchronous/i);
  assert.match(readme, /Only install the plugin/);
  assert.match(readme, /When installation is complete/);
  assert.match(readme, /example request/);
  assert.doesNotMatch(readme, /then connect it to Safari/);
  assert.doesNotMatch(readme, /if setup or connection fails/);
  assert.doesNotMatch(readme, /\bawait\b/);
});

test("ships without a Safari app or Web Extension", async () => {
  await assert.rejects(
    access(new URL("safari/", pluginRoot)),
    error => error.code === "ENOENT"
  );

  const packageJson = await readRepositoryJson("package.json");
  assert.deepEqual(packageJson.dependencies ?? {}, {});
});
