import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  access,
  mkdtemp,
  readFile,
  rm
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const repositoryRoot = new URL("../", import.meta.url);
const pluginSkillRoot = new URL(
  "../plugins/safari-browser-use/skills/control-safari/",
  import.meta.url
);
const standaloneSkillRoot = new URL(
  "../skills/control-safari/",
  import.meta.url
);
const cliPath = fileURLToPath(
  new URL("scripts/safari-repl.mjs", standaloneSkillRoot)
);

async function runCli(args, sessionDirectory) {
  const { stdout } = await execFileAsync(
    process.execPath,
    [cliPath, ...args],
    {
      env: {
        ...process.env,
        SBU_SESSION_DIR: sessionDirectory
      }
    }
  );

  return JSON.parse(stdout);
}

test("ships a standalone script-driven Safari skill", async () => {
  const skill = await readFile(
    new URL("SKILL.md", standaloneSkillRoot),
    "utf8"
  );
  const agent = await readFile(
    new URL("agents/openai.yaml", standaloneSkillRoot),
    "utf8"
  );

  assert.match(skill, /^name: control-safari$/m);
  assert.match(skill, /\{baseDir\}\/scripts\/safari-repl\.mjs start/);
  assert.match(skill, /\{baseDir\}\/scripts\/safari-repl\.mjs run/);
  assert.match(skill, /\{baseDir\}\/scripts\/safari-repl\.mjs release/);
  assert.match(skill, /\{baseDir\}\/scripts\/safari-repl\.mjs stop/);
  assert.doesNotMatch(skill, /plugin-provided `js` MCP tool/);
  assert.match(agent, /\$control-safari/);

  await access(new URL("scripts/safari-repl.mjs", standaloneSkillRoot));
  await assert.rejects(
    access(new URL("scripts/safari.mjs", standaloneSkillRoot))
  );
  await access(new URL(
    "scripts/runtime/safari-repl.jxa.js",
    standaloneSkillRoot
  ));
  await assert.rejects(
    access(
      new URL(
        "scripts/runtime/server.jxa.js",
        standaloneSkillRoot
      )
    )
  );

  for (const name of [
    "captcha.md",
    "google-accounts.md",
    "google-docs.md",
    "google-sheets.md"
  ]) {
    const pluginReference = await readFile(
      new URL(`references/${name}`, pluginSkillRoot),
      "utf8"
    );
    const standaloneReference = await readFile(
      new URL(`references/${name}`, standaloneSkillRoot),
      "utf8"
    );

    assert.equal(standaloneReference, pluginReference);
  }
});

test("runtime documentation is transport neutral", async () => {
  for (const name of [
    "documentation.md",
    "documentation-troubleshooting.md"
  ]) {
    const documentation = await readFile(
      new URL(
        `plugins/safari-browser-use/server/src/${name}`,
        repositoryRoot
      ),
      "utf8"
    );

    assert.doesNotMatch(documentation, /\bMCP\b/);
    assert.doesNotMatch(documentation, /`js_reset`/);
  }
});

test("standalone CLI keeps REPL state isolated by session", async t => {
  const sessionDirectory = await mkdtemp(
    join(tmpdir(), "safari-browser-use-skill-")
  );
  const sessions = [];

  t.after(async () => {
    for (const sessionId of sessions) {
      await runCli(
        ["stop", "--session", sessionId],
        sessionDirectory
      ).catch(() => {});
    }
    await rm(sessionDirectory, { recursive: true, force: true });
  });

  const first = await runCli(["start"], sessionDirectory);
  const second = await runCli(["start"], sessionDirectory);
  sessions.push(first.sessionId, second.sessionId);

  const stored = await runCli([
    "run",
    "--session",
    first.sessionId,
    "--title",
    "Store a value",
    "--code",
    "var skillValue = 41; skillValue"
  ], sessionDirectory);
  const reused = await runCli([
    "run",
    "--session",
    first.sessionId,
    "--title",
    "Reuse a value",
    "--code",
    "skillValue + 1"
  ], sessionDirectory);
  const isolated = await runCli([
    "run",
    "--session",
    second.sessionId,
    "--title",
    "Check isolation",
    "--code",
    "typeof skillValue"
  ], sessionDirectory);

  assert.equal(stored.value, 41);
  assert.equal(reused.value, 42);
  assert.equal(isolated.value, "undefined");
});

test("standalone CLI writes image results to a local file", async t => {
  const sessionDirectory = await mkdtemp(
    join(tmpdir(), "safari-browser-use-image-")
  );
  let sessionId;

  t.after(async () => {
    if (sessionId) {
      await runCli(
        ["stop", "--session", sessionId],
        sessionDirectory
      ).catch(() => {});
    }
    await rm(sessionDirectory, { recursive: true, force: true });
  });

  const started = await runCli(["start"], sessionDirectory);
  sessionId = started.sessionId;
  const result = await runCli([
    "run",
    "--session",
    sessionId,
    "--title",
    "Return an image",
    "--code",
    `({
      __sbuImage: {
        base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        mimeType: "image/png",
        width: 1,
        height: 1
      }
    })`
  ], sessionDirectory);

  assert.equal(result.images.length, 1);
  await access(result.images[0]);
});
