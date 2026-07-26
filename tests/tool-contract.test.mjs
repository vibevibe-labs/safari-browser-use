import assert from "node:assert/strict";
import test from "node:test";

import {
  createToolDefinitions
} from "../plugins/safari-browser-use/server/src/tool-definitions.mjs";

test("exposes a persistent JavaScript REPL and reset tool", () => {
  const tools = createToolDefinitions();

  assert.deepEqual(
    tools.map(tool => tool.name),
    ["js", "js_reset"]
  );
});

test("marks REPL code as write-capable", () => {
  const tools = Object.fromEntries(
    createToolDefinitions().map(tool => [tool.name, tool])
  );

  assert.equal(tools.js.annotations.readOnlyHint, false);
});

test("requires title and code for each REPL cell", () => {
  const tools = Object.fromEntries(
    createToolDefinitions().map(tool => [tool.name, tool])
  );

  assert.deepEqual(tools.js.inputSchema.required, ["title", "code"]);
  assert.equal(tools.js.inputSchema.properties.title.type, "string");
  assert.equal(tools.js.inputSchema.properties.code.type, "string");
});
