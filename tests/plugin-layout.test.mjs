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
    [".codex-plugin/plugin.json", "./codex.mcp.json"],
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
    ["codex.mcp.json", "dist/server.jxa.js"],
    [".mcp.json", "${CLAUDE_PLUGIN_ROOT}/dist/server.jxa.js"],
    ["copilot.mcp.json", "${PLUGIN_ROOT}/dist/server.jxa.js"],
    ["cursor.mcp.json", "${CURSOR_PLUGIN_ROOT}/dist/server.jxa.js"]
  ];

  for (const [path, serverPath] of configurations) {
    const config = await readJson(path);
    const servers = config.mcpServers ?? config.mcp_servers ?? config;
    const server = servers["safari-browser-use"];

    assert.equal(server.command, "/usr/bin/osascript");
    assert.deepEqual(server.args, [
      "-l",
      "JavaScript",
      serverPath
    ]);
  }

  const codex = await readJson("codex.mcp.json");
  assert.equal(codex["safari-browser-use"].cwd, ".");

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
  assert.match(readme, /using the current client's plugin installer/);
  assert.match(readme, /Stop after installation/);
  assert.match(readme, /give me one example request/);
  assert.match(readme, /Allow JavaScript from Apple Events/);
  assert.match(readme, /does not\s+require Node\.js/i);
  assert.doesNotMatch(readme, /safari-browser-use@personal/);
  assert.doesNotMatch(readme, /plugin marketplace add "\$PWD"/);
  assert.doesNotMatch(readme, /Only install the plugin|native plugin system/);
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
  assert.match(skill, /browser\.release\(\)/);
  assert.match(skill, /control indicator/i);
  assert.match(skill, /do not fall back/i);
  assert.doesNotMatch(skill, /\bawait\b/);
  assert.doesNotMatch(skill, /bridge|Safari extension/i);
});

test("skill resolves an explicitly named site before selecting a tab", async () => {
  const skill = await readFile(
    new URL("skills/control-safari/SKILL.md", pluginRoot),
    "utf8"
  );

  assert.match(skill, /browser\.tabs\.list\(\)/);
  assert.match(
    skill,
    /Only use `browser\.tabs\.selected\(\)`.*current tab.*no target/is
  );
  assert.match(skill, /Do not inspect an unrelated current tab/i);
});

test("Codex prompts defer to an explicitly named target tab", async () => {
  const agent = await readFile(
    new URL(
      "skills/control-safari/agents/openai.yaml",
      pluginRoot
    ),
    "utf8"
  );
  const manifest = await readJson(".codex-plugin/plugin.json");

  assert.match(agent, /Safari tab I identify/i);
  assert.doesNotMatch(agent, /my current Safari/i);
  assert.match(
    manifest.interface.defaultPrompt,
    /Safari tab I identify/i
  );
  assert.doesNotMatch(
    manifest.interface.defaultPrompt,
    /the current page/i
  );
});

test("runtime API documents how to release the active tab", async () => {
  const runtimeApi = await readFile(
    new URL(
      "skills/control-safari/references/runtime-api.md",
      pluginRoot
    ),
    "utf8"
  );

  assert.match(runtimeApi, /browser\.release\(\)/);
  assert.match(runtimeApi, /control indicator/i);
});

test("skill documents bounded virtualized-list collection", async () => {
  const [skill, runtimeApi] = await Promise.all([
    readFile(
      new URL("skills/control-safari/SKILL.md", pluginRoot),
      "utf8"
    ),
    readFile(
      new URL(
        "skills/control-safari/references/runtime-api.md",
        pluginRoot
      ),
      "utf8"
    )
  ]);

  assert.match(skill, /virtualized/i);
  assert.match(skill, /scrollIntoView/);
  assert.match(skill, /scrollBy/);
  assert.match(skill, /three consecutive/i);
  assert.doesNotMatch(skill, /press\(["'](?:End|PageDown|Space|Tab)/);
  assert.match(runtimeApi, /scrollIntoView/);
  assert.match(runtimeApi, /scrollBy/);
  assert.match(runtimeApi, /allAttributes/);
  assert.match(runtimeApi, /synthetic/i);
});

test("control indicator docs describe only the page overlay", async () => {
  const documents = await Promise.all([
    readFile(new URL("README.md", repositoryRoot), "utf8"),
    readFile(
      new URL("skills/control-safari/SKILL.md", pluginRoot),
      "utf8"
    ),
    readFile(
      new URL(
        "skills/control-safari/references/runtime-api.md",
        pluginRoot
      ),
      "utf8"
    )
  ]);

  for (const document of documents) {
    assert.match(document, /perimeter glow/i);
    assert.match(document, /(?:fake|visible) cursor/i);
    assert.doesNotMatch(document, /favicon/i);
    assert.doesNotMatch(document, /compact Safari\s+tabs/i);
  }
});

test("repository quick start describes a zero-dependency synchronous REPL", async () => {
  const readme = await readFile(
    new URL("README.md", repositoryRoot),
    "utf8"
  );

  assert.match(readme, /does not require Node\.js/i);
  assert.match(readme, /synchronous/i);
  assert.match(readme, /using the current client's plugin installer/);
  assert.match(readme, /Stop after installation/);
  assert.match(readme, /give me one example request/);
  assert.doesNotMatch(readme, /Only install the plugin|native plugin system/);
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
