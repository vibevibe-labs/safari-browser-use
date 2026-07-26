import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StdioClientTransport
} from "@modelcontextprotocol/sdk/client/stdio.js";

test("starts the real MCP entrypoint over stdio", async t => {
  const entrypoint = process.env.MCP_ENTRYPOINT ?? fileURLToPath(new URL(
    "../plugins/safari-browser-use/dist/server.jxa.js",
    import.meta.url
  ));
  const transport = new StdioClientTransport({
    command: "/usr/bin/osascript",
    args: ["-l", "JavaScript", entrypoint],
    stderr: "pipe"
  });
  const client = new Client({
    name: "safari-browser-use-stdio-test",
    version: "0.1.0"
  });

  t.after(async () => {
    await client.close();
  });

  await client.connect(transport);

  const tools = await client.listTools();
  const first = await client.callTool({
    name: "js",
    arguments: {
      title: "Create a persistent value",
      code: "var answer = 42; answer"
    }
  });
  const second = await client.callTool({
    name: "js",
    arguments: {
      title: "Reuse the persistent value",
      code: "({ answer, browserType: typeof browser })"
    }
  });

  assert.deepEqual(
    tools.tools.map(tool => tool.name),
    ["js", "js_reset"]
  );
  assert.equal(first.structuredContent.value, 42);
  assert.deepEqual(second.structuredContent.value, {
    answer: 42,
    browserType: "object"
  });
});

test("captures output and resets persistent JXA bindings", async t => {
  const entrypoint = fileURLToPath(new URL(
    "../plugins/safari-browser-use/dist/server.jxa.js",
    import.meta.url
  ));
  const transport = new StdioClientTransport({
    command: "/usr/bin/osascript",
    args: ["-l", "JavaScript", entrypoint],
    stderr: "pipe"
  });
  const client = new Client({
    name: "safari-browser-use-reset-test",
    version: "0.1.0"
  });

  t.after(async () => {
    await client.close();
  });

  await client.connect(transport);

  const first = await client.callTool({
    name: "js",
    arguments: {
      title: "Log and save",
      code: "console.log('tab', 7); var temporary = 5; temporary"
    }
  });
  await client.callTool({
    name: "js_reset",
    arguments: {}
  });
  const afterReset = await client.callTool({
    name: "js",
    arguments: {
      title: "Read cleared value",
      code: "temporary"
    }
  });

  assert.deepEqual(first.structuredContent, {
    value: 5,
    output: ["tab 7"]
  });
  assert.equal(afterReset.isError, true);
  assert.match(afterReset.content[0].text, /temporary/);
});
