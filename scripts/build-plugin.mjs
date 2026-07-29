import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  ".."
);
const templatePath = resolve(
  repositoryRoot,
  "plugins/safari-browser-use/server/src/jxa-server.template.js"
);
const pageRuntimePath = resolve(
  repositoryRoot,
  "plugins/safari-browser-use/server/src/page-runtime.mjs"
);
const safariVersionPath = resolve(
  repositoryRoot,
  "plugins/safari-browser-use/server/src/safari-version.mjs"
);
const toolDefinitionsPath = resolve(
  repositoryRoot,
  "plugins/safari-browser-use/server/src/tool-definitions.mjs"
);
const nativeInputPath = resolve(
  repositoryRoot,
  "plugins/safari-browser-use/server/src/native-input.mjs"
);
const controlLifecyclePath = resolve(
  repositoryRoot,
  "plugins/safari-browser-use/server/src/control-lifecycle.mjs"
);
const tabIdentityPath = resolve(
  repositoryRoot,
  "plugins/safari-browser-use/server/src/tab-identity.mjs"
);
const documentationPath = resolve(
  repositoryRoot,
  "plugins/safari-browser-use/server/src/documentation.md"
);
const troubleshootingPath = resolve(
  repositoryRoot,
  "plugins/safari-browser-use/server/src/documentation-troubleshooting.md"
);
const defaultOutfile = resolve(
  repositoryRoot,
  "plugins/safari-browser-use/dist/server.jxa.js"
);

export async function buildPlugin({ outfile = defaultOutfile } = {}) {
  const [
    template,
    pageRuntime,
    safariVersion,
    toolDefinitions,
    nativeInput,
    controlLifecycle,
    tabIdentity,
    documentation,
    troubleshooting
  ] = await Promise.all([
    readFile(templatePath, "utf8"),
    readFile(pageRuntimePath, "utf8"),
    readFile(safariVersionPath, "utf8"),
    readFile(toolDefinitionsPath, "utf8"),
    readFile(nativeInputPath, "utf8"),
    readFile(controlLifecyclePath, "utf8"),
    readFile(tabIdentityPath, "utf8"),
    readFile(documentationPath, "utf8"),
    readFile(troubleshootingPath, "utf8")
  ]);
  const withoutExports = source =>
    source.replace(/^export\s+/gm, "");
  const output = template
    .replace(
      "/*__SBU_PAGE_RUNTIME__*/",
      withoutExports(pageRuntime)
    )
    .replace(
      "/*__SBU_SAFARI_VERSION__*/",
      withoutExports(safariVersion)
    )
    .replace(
      "/*__SBU_TOOL_DEFINITIONS__*/",
      withoutExports(toolDefinitions)
    )
    .replace(
      "/*__SBU_NATIVE_INPUT__*/",
      withoutExports(nativeInput)
    )
    .replace(
      "/*__SBU_CONTROL_LIFECYCLE__*/",
      withoutExports(controlLifecycle)
    )
    .replace(
      "/*__SBU_TAB_IDENTITY__*/",
      withoutExports(tabIdentity)
    )
    .replace(
      "/*__SBU_DOCUMENTATION__*/",
      `var SBU_DOCUMENTATION_TEXT = ${JSON.stringify(documentation)};`
    )
    .replace(
      "/*__SBU_DOCUMENTATION_TROUBLESHOOTING__*/",
      `var SBU_DOCUMENTATION_TROUBLESHOOTING_TEXT = ${
        JSON.stringify(troubleshooting)
      };`
    );

  await writeFile(outfile, output);
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  await buildPlugin();
}
