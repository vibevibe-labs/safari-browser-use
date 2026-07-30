import assert from "node:assert/strict";
import test from "node:test";

import { Window } from "happy-dom";

import {
  runPageOperation
} from "../plugins/safari-browser-use/server/src/page-runtime.mjs";

function createPage(html) {
  const window = new Window({
    url: "https://example.com/form"
  });
  window.document.body.innerHTML = html;

  return {
    window,
    execute(method, params = {}) {
      return runPageOperation(
        window.document,
        window,
        method,
        params
      );
    }
  };
}

test("inspects the Google Docs title and native editor point", () => {
  const { execute, window } = createPage(`
    <input class="docs-title-input" value="Project note">
    <div class="kix-appview-editor"></div>
  `);
  const editor = window.document.querySelector(
    ".kix-appview-editor"
  );
  editor.getBoundingClientRect = () => ({
    left: 100,
    top: 200,
    width: 600,
    height: 800,
    right: 700,
    bottom: 1000
  });

  assert.deepEqual(execute("googleDocs.editorState"), {
    title: "Project note",
    editorPoint: { x: 400, y: 600 }
  });
});

test("inspects Google Sheets tabs, selection, and native grid point", () => {
  const { execute, window } = createPage(`
    <input class="docs-title-input" value="Budget">
    <input class="waffle-name-box" value="B5">
    <div class="docs-sheet-tab" data-sheet-id="0">
      <span class="docs-sheet-tab-name">Summary</span>
    </div>
    <div class="docs-sheet-tab" data-sheet-id="42">
      <span class="docs-sheet-tab-name">Archive</span>
    </div>
    <div class="waffle-grid-container"></div>
  `);
  const grid = window.document.querySelector(
    ".waffle-grid-container"
  );
  const nameBox = window.document.querySelector(
    ".waffle-name-box"
  );
  nameBox.getBoundingClientRect = () => ({
    left: 10,
    top: 80,
    width: 120,
    height: 30,
    right: 130,
    bottom: 110
  });
  grid.getBoundingClientRect = () => ({
    left: 50,
    top: 150,
    width: 900,
    height: 600,
    right: 950,
    bottom: 750
  });

  assert.deepEqual(execute("googleSheets.editorState"), {
    title: "Budget",
    selectionRange: "B5",
    nameBoxPoint: { x: 70, y: 95 },
    sheets: [
      { name: "Summary", gid: "0", gridId: "0" },
      { name: "Archive", gid: "42", gridId: "42" }
    ],
    editorPoint: { x: 500, y: 450 }
  });
});

test("uses the Sheets canvas when the generic grid wrapper has no size", () => {
  const { execute, window } = createPage(`
    <input class="docs-title-input" value="Budget">
    <div class="grid-container"></div>
    <canvas></canvas>
  `);
  const canvas = window.document.querySelector("canvas");
  canvas.getBoundingClientRect = () => ({
    left: 40,
    top: 120,
    width: 800,
    height: 500,
    right: 840,
    bottom: 620
  });

  assert.deepEqual(
    execute("googleSheets.editorState").editorPoint,
    { x: 440, y: 370 }
  );
});

test("returns a Playwright-style DOM snapshot", () => {
  const { execute } = createPage(`
    <label for="email">Email address</label>
    <input id="email">
    <button>Continue</button>
  `);

  assert.equal(
    execute("playwright.domSnapshot"),
    [
      '- textbox "Email address"',
      '- button "Continue"'
    ].join("\n")
  );
});

test("includes stable locator attributes in the DOM snapshot", () => {
  const { execute } = createPage(`
    <section data-testid="product-card">
      <a href="/buy" data-testid="buy-link">Buy now</a>
    </section>
  `);

  assert.equal(
    execute("playwright.domSnapshot"),
    [
      '- element "Buy now" [data-testid="product-card"]',
      '- link "Buy now" [data-testid="buy-link"] [href="/buy"]'
    ].join("\n")
  );
});

test("counts and clicks an element located by role and name", () => {
  const { execute, window } = createPage(`
    <button aria-label="Continue">Next</button>
    <button>Cancel</button>
  `);
  let clicks = 0;
  window.document.querySelector("button").addEventListener(
    "click",
    () => clicks++
  );
  const locator = [{
    type: "role",
    role: "button",
    name: "Continue",
    exact: true
  }];

  assert.equal(
    execute("playwright.locator.count", { locator }),
    1
  );
  execute("playwright.locator.click", {
    locator,
    options: {}
  });

  assert.equal(clicks, 1);
});

test("supports scoped CSS and text locators", () => {
  const { execute } = createPage(`
    <section data-testid="first"><button>Buy now</button></section>
    <section data-testid="second"><button>Buy now</button></section>
  `);
  const locator = [
    {
      type: "css",
      selector: "[data-testid='second']"
    },
    {
      type: "text",
      text: "Buy now",
      exact: true
    }
  ];

  assert.equal(
    execute("playwright.locator.innerText", {
      locator,
      options: {}
    }),
    "Buy now"
  );
});

test("rejects ambiguous locator actions", () => {
  const { execute } = createPage(`
    <button>Continue</button>
    <button>Continue</button>
  `);

  assert.throws(
    () => execute("playwright.locator.click", {
      locator: [{
        type: "role",
        role: "button",
        name: "Continue",
        exact: true
      }],
      options: {}
    }),
    /strict mode violation.*2 elements/
  );
});

test("fills an element located by its label", () => {
  const { execute, window } = createPage(`
    <label for="name">Full name</label>
    <input id="name">
  `);

  execute("playwright.locator.fill", {
    locator: [{
      type: "label",
      text: "Full name",
      exact: true
    }],
    value: "Ada Lovelace",
    options: {}
  });

  assert.equal(
    window.document.querySelector("input").value,
    "Ada Lovelace"
  );
});

test("fills a contenteditable rich editor by locator", () => {
  const { execute, window } = createPage(`
    <div
      id="editor"
      role="textbox"
      contenteditable="true"
      aria-label="Document body"
    >old text</div>
  `);
  const editor = window.document.querySelector("#editor");
  const events = [];
  for (const type of ["beforeinput", "input", "change"]) {
    editor.addEventListener(type, event => {
      events.push({ type: event.type, bubbles: event.bubbles });
    });
  }

  assert.deepEqual(
    execute("playwright.locator.fill", {
      locator: [{
        type: "role",
        role: "textbox",
        name: "Document body",
        exact: true
      }],
      value: "new content"
    }),
    { filled: true }
  );

  assert.equal(editor.textContent, "new content");
  assert.deepEqual(
    events.map(event => event.type),
    ["beforeinput", "input"]
  );
  assert.ok(events.every(event => event.bubbles === true));
});

test("types appended text into a contenteditable rich editor", () => {
  const { execute, window } = createPage(`
    <div id="editor" contenteditable="true" aria-label="Notes">Hello</div>
  `);
  const editor = window.document.querySelector("#editor");
  let inputs = 0;
  editor.addEventListener("input", () => inputs++);

  assert.deepEqual(
    execute("playwright.locator.type", {
      locator: [{ type: "css", selector: "#editor" }],
      value: " World"
    }),
    { typed: true }
  );

  assert.equal(editor.textContent, "Hello World");
  assert.equal(inputs, 1);
});

test("clears a contenteditable rich editor when filled with empty text", () => {
  const { execute, window } = createPage(`
    <div id="editor" contenteditable="true" aria-label="Body">remove me</div>
  `);

  execute("playwright.locator.fill", {
    locator: [{ type: "css", selector: "#editor" }],
    value: ""
  });

  assert.equal(
    window.document.querySelector("#editor").textContent,
    ""
  );
});

test("still rejects filling a non-editable element", () => {
  const { execute } = createPage(`
    <div id="static">read only</div>
  `);

  assert.throws(
    () => execute("playwright.locator.fill", {
      locator: [{ type: "css", selector: "#static" }],
      value: "nope"
    }),
    /element_not_fillable/
  );
});

test("reports locator state synchronously for JXA-side polling", () => {
  const { execute, window } = createPage("<main></main>");
  const params = {
    locator: [{
      type: "role",
      role: "button",
      name: "Continue",
      exact: true
    }],
    state: "visible"
  };

  assert.equal(
    execute("playwright.locator.matchesState", params),
    false
  );

  const button = window.document.createElement("button");
  button.textContent = "Continue";
  window.document.querySelector("main").append(button);

  assert.equal(
    execute("playwright.locator.matchesState", params),
    true
  );
});

test("reports the document readiness state for navigation waits", () => {
  const { execute, window } = createPage("<main>Ready</main>");

  Object.defineProperty(window.document, "readyState", {
    configurable: true,
    value: "interactive"
  });

  assert.equal(
    execute("playwright.readyState"),
    "interactive"
  );
});

test("reports the loaded document URL with its readiness state", () => {
  const { execute, window } = createPage("<main>Ready</main>");

  Object.defineProperty(window.document, "readyState", {
    configurable: true,
    value: "complete"
  });
  window.history.replaceState({}, "", "/dashboard");

  const first = execute("playwright.pageState");
  const second = execute("playwright.pageState");

  assert.equal(first.readyState, "complete");
  assert.equal(first.url, "https://example.com/dashboard");
  assert.equal(first.controlVisible, false);
  assert.match(first.documentId, /^document-/);
  assert.equal(second.documentId, first.documentId);
});

test("scrolls the page by explicit offsets", () => {
  const { execute, window } = createPage("<main>Feed</main>");
  let received;
  window.scrollBy = (deltaX, deltaY) => {
    received = [deltaX, deltaY];
  };

  assert.deepEqual(
    execute("playwright.scrollBy", {
      deltaX: 20,
      deltaY: 640
    }),
    {
      deltaX: 20,
      deltaY: 640
    }
  );
  assert.deepEqual(received, [20, 640]);
});

test("scrolls one locator into view without clicking it", () => {
  const { execute, window } = createPage(`
    <button data-testid="load-more">Load more</button>
  `);
  const button = window.document.querySelector("button");
  let scrollOptions;
  let clicks = 0;
  button.scrollIntoView = options => {
    scrollOptions = options;
  };
  button.addEventListener("click", () => clicks++);

  assert.deepEqual(
    execute("playwright.locator.scrollIntoView", {
      locator: [{
        type: "testId",
        testId: "load-more"
      }],
      options: {
        block: "end",
        inline: "nearest"
      }
    }),
    { scrolled: true }
  );
  assert.deepEqual(scrollOptions, {
    block: "end",
    inline: "nearest"
  });
  assert.equal(clicks, 0);
});

test("returns one attribute value for every locator match", () => {
  const { execute } = createPage(`
    <a href="/one">One</a>
    <a>Two</a>
  `);

  assert.deepEqual(
    execute("playwright.locator.allAttributes", {
      locator: [{
        type: "css",
        selector: "a"
      }],
      name: "href"
    }),
    ["/one", null]
  );
});

test("keeps descendant fields paired with each list item", () => {
  const { execute } = createPage(`
    <div data-testid="UserCell">
      <a href="/alpha">Alpha</a>
    </div>
    <div data-testid="UserCell">
      <a href="/beta">Beta</a>
      <button aria-label="Following @beta">Following</button>
    </div>
  `);

  assert.deepEqual(
    execute("playwright.locator.allRecords", {
      locator: [{
        type: "testId",
        testId: "UserCell"
      }],
      fields: {
        profileHrefs: {
          selector: "a[href]",
          attribute: "href"
        },
        actionLabels: {
          selector: "button",
          attribute: "aria-label"
        }
      }
    }),
    [
      {
        textContent: "\n      Alpha\n    ",
        fields: {
          profileHrefs: ["/alpha"],
          actionLabels: []
        }
      },
      {
        textContent: "\n      Beta\n      Following\n    ",
        fields: {
          profileHrefs: ["/beta"],
          actionLabels: ["Following @beta"]
        }
      }
    ]
  );
});

test("rejects keys whose browser-default behavior cannot be synthesized", () => {
  const { execute, window } = createPage(`
    <button data-testid="item">Item</button>
  `);
  let keydowns = 0;
  window.document.querySelector("button").addEventListener(
    "keydown",
    () => keydowns++
  );

  assert.throws(
    () => execute("playwright.locator.press", {
      locator: [{
        type: "testId",
        testId: "item"
      }],
      value: "PageDown",
      options: {}
    }),
    /unsupported_press_default_action.*scrollBy/
  );
  assert.equal(keydowns, 0);
});

test("reports supported key events as synthetic", () => {
  const { execute } = createPage(`
    <input data-testid="search">
  `);

  assert.deepEqual(
    execute("playwright.locator.press", {
      locator: [{
        type: "testId",
        testId: "search"
      }],
      value: "Enter",
      options: {}
    }),
    {
      pressed: true,
      trusted: false
    }
  );
});

test("marks same-tab link clicks as navigation-capable", () => {
  const { execute, window } = createPage(`
    <a href="https://example.com/next">Continue</a>
  `);
  const link = window.document.querySelector("a");
  link.addEventListener("click", event => event.preventDefault());

  const result = execute("playwright.locator.click", {
    locator: [{
      type: "role",
      role: "link",
      name: "Continue",
      exact: true
    }],
    options: {}
  });

  assert.deepEqual(result, {
    clicked: true,
    navigationExpected: true
  });

  execute("control.hide");
});

test("shows one non-interactive AI control indicator", () => {
  const { execute, window } = createPage("<main>Dashboard</main>");

  execute("control.show", { leaseMs: 1000 });
  const original = window.document.querySelector(
    "[data-safari-browser-use-control]"
  );
  execute("control.show", { leaseMs: 1000 });

  const indicators = window.document.querySelectorAll(
    "[data-safari-browser-use-control]"
  );
  const indicator = indicators[0];
  const style = window.document.getElementById(
    "__safari_browser_use_control_style__"
  );

  assert.equal(indicators.length, 1);
  assert.equal(indicator, original);
  assert.equal(indicator.style.pointerEvents, "none");
  assert.equal(indicator.getAttribute("aria-hidden"), "true");
  assert.match(style.textContent, /prefers-reduced-motion/);

  execute("control.hide");
});

test("makes active AI control visually unmistakable", () => {
  const { execute, window } = createPage("<main>Dashboard</main>");

  execute("control.show", { leaseMs: 1000 });

  const indicator = window.document.querySelector(
    "[data-safari-browser-use-control]"
  );
  const style = window.document.getElementById(
    "__safari_browser_use_control_style__"
  );

  assert.equal(indicator.style.borderWidth, "3px");
  assert.equal(indicator.style.outlineWidth, "1px");
  assert.match(indicator.style.boxShadow, /140px 28px/);
  assert.match(style.textContent, /1300ms/);
  assert.match(style.textContent, /opacity: 0\.64/);

  execute("control.hide");
});

test("shows a non-interactive fake cursor inside the overlay", () => {
  const { execute, window } = createPage("<main>Dashboard</main>");

  execute("control.show", { leaseMs: 1000 });

  const indicator = window.document.querySelector(
    "[data-safari-browser-use-control]"
  );
  const cursor = indicator.querySelector(
    "[data-safari-browser-use-control-cursor]"
  );

  assert.notEqual(cursor, null);
  assert.equal(cursor.style.pointerEvents, "none");

  execute("control.hide");

  assert.equal(cursor.isConnected, false);
});

test("leaves the controlled tab title unchanged", () => {
  const { execute, window } = createPage("<main>Dashboard</main>");

  window.document.title = "Dashboard";

  execute("control.show", { leaseMs: 1000 });

  assert.equal(window.document.title, "Dashboard");

  execute("control.hide");
});

test("leaves the controlled tab favicon unchanged", () => {
  const { execute, window } = createPage("<main>Dashboard</main>");
  const original = window.document.createElement("link");

  original.setAttribute("rel", "icon");
  original.setAttribute("href", "/favicon.svg?theme=dark&v=1");
  window.document.head.append(original);

  execute("control.show", { leaseMs: 1000 });

  assert.equal(original.isConnected, true);
  assert.equal(
    original.getAttribute("href"),
    "/favicon.svg?theme=dark&v=1"
  );
  assert.equal(
    window.document.querySelectorAll('link[rel~="icon"]').length,
    1
  );
  assert.equal(
    window.document.querySelector(
      "[data-safari-browser-use-control-favicon]"
    ),
    null
  );

  execute("control.hide");
});

test("starts and stops the overlay and fake cursor together", () => {
  const { execute, window } = createPage("<main>Dashboard</main>");

  execute("control.show", { leaseMs: 1000 });

  assert.notEqual(
    window.document.querySelector(
      "[data-safari-browser-use-control]"
    ),
    null
  );
  assert.notEqual(
    window.document.querySelector(
      "[data-safari-browser-use-control-cursor]"
    ),
    null
  );

  execute("control.hide");

  assert.equal(
    window.document.querySelector(
      "[data-safari-browser-use-control]"
    ),
    null
  );
  assert.equal(
    window.document.querySelector(
      "[data-safari-browser-use-control-cursor]"
    ),
    null
  );
});

test("does not interfere with page title updates", () => {
  const { execute, window } = createPage("<main>Inbox</main>");

  window.document.title = "Inbox";

  execute("control.show", { leaseMs: 1000 });
  window.document.title = "Updated Inbox";
  execute("control.hide");

  assert.equal(window.document.title, "Updated Inbox");
});

test("hides the AI control indicator and its styles", () => {
  const { execute, window } = createPage("<main>Dashboard</main>");

  execute("control.show", { leaseMs: 1000 });
  execute("control.hide");

  assert.equal(
    window.document.querySelector(
      "[data-safari-browser-use-control]"
    ),
    null
  );
  assert.equal(
    window.document.getElementById(
      "__safari_browser_use_control_style__"
    ),
    null
  );
});

test("expires the AI control indicator after inactivity", async () => {
  const { execute, window } = createPage("<main>Dashboard</main>");

  execute("control.show", { leaseMs: 5 });
  await new Promise(resolve => setTimeout(resolve, 20));

  assert.equal(
    window.document.querySelector(
      "[data-safari-browser-use-control]"
    ),
    null
  );
  assert.equal(
    window.document.querySelector(
      "[data-safari-browser-use-control-cursor]"
    ),
    null
  );
});

test("captures a canvas as an image marker for the vision model", () => {
  const { execute, window } = createPage(
    `<canvas id="board" width="200" height="120"></canvas>`
  );
  const canvas = window.document.querySelector("#board");
  canvas.getBoundingClientRect = () => ({
    left: 40,
    top: 24,
    width: 200,
    height: 120
  });
  canvas.toDataURL = () => "data:image/png;base64,QUJD";

  const result = execute("playwright.locator.canvasSnapshot", {
    locator: [{ type: "css", selector: "#board" }]
  });

  assert.deepEqual(result.__sbuImage, {
    mimeType: "image/png",
    base64: "QUJD",
    width: 200,
    height: 120
  });
  assert.deepEqual(result.source.viewport, {
    x: 40,
    y: 24,
    width: 200,
    height: 120
  });
  assert.equal(result.source.width, 200);
  assert.equal(result.source.height, 120);
});

test("downsamples oversized canvases below maxSize", () => {
  const { execute, window } = createPage(
    `<canvas id="huge" width="4000" height="2000"></canvas>`
  );
  const canvas = window.document.querySelector("#huge");
  canvas.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 4000,
    height: 2000
  });

  const result = execute("playwright.locator.canvasSnapshot", {
    locator: [{ type: "css", selector: "#huge" }],
    maxSize: 1000
  });

  assert.equal(result.__sbuImage.width, 1000);
  assert.equal(result.__sbuImage.height, 500);
  assert.equal(result.source.width, 4000);
});

test("rejects capturing a non-canvas element", () => {
  const { execute } = createPage(`<div id="not-canvas"></div>`);

  assert.throws(
    () => execute("playwright.locator.canvasSnapshot", {
      locator: [{ type: "css", selector: "#not-canvas" }]
    }),
    /not_a_canvas/
  );
});

test("maps a cross-origin tainted canvas to a clear error", () => {
  const { execute, window } = createPage(
    `<canvas id="tainted" width="10" height="10"></canvas>`
  );
  window.document.querySelector("#tainted").toDataURL = () => {
    throw new Error("The operation is insecure.");
  };

  assert.throws(
    () => execute("playwright.locator.canvasSnapshot", {
      locator: [{ type: "css", selector: "#tainted" }]
    }),
    /canvas_tainted_cross_origin/
  );
});

test("dispatches a coordinate pointer event at a canvas position", () => {
  const { execute, window } = createPage(
    `<canvas id="stage" width="300" height="150"></canvas>`
  );
  const canvas = window.document.querySelector("#stage");
  window.document.elementFromPoint = () => canvas;
  const received = [];
  canvas.addEventListener("pointerdown", event => {
    received.push({
      type: event.type,
      x: event.clientX,
      y: event.clientY,
      buttons: event.buttons
    });
  });

  const result = execute("playwright.mouseEvent", {
    type: "pointerdown",
    x: 80,
    y: 54,
    buttons: 1
  });

  assert.equal(result.type, "pointerdown");
  assert.equal(result.target, "canvas");
  assert.deepEqual(received, [{
    type: "pointerdown",
    x: 80,
    y: 54,
    buttons: 1
  }]);
});

test("also emits the mouse-equivalent for pointer gestures", () => {
  const { execute, window } = createPage(
    `<canvas id="stage" width="300" height="150"></canvas>`
  );
  const canvas = window.document.querySelector("#stage");
  window.document.elementFromPoint = () => canvas;
  let mouseUps = 0;
  canvas.addEventListener("mouseup", () => mouseUps++);

  execute("playwright.mouseEvent", {
    type: "pointerup",
    x: 10,
    y: 10,
    buttons: 0
  });

  assert.equal(mouseUps, 1);
});

test("rejects a pointer event without finite coordinates", () => {
  const { execute } = createPage(`<main></main>`);

  assert.throws(
    () => execute("playwright.mouseEvent", {
      type: "pointermove",
      x: "nope",
      y: 10
    }),
    /invalid_coordinates/
  );
});

test("assigns uploaded files to a file input via DataTransfer", () => {
  const { execute, window } = createPage(
    `<input id="upload" type="file">`
  );
  const input = window.document.querySelector("#upload");
  const changes = [];
  input.addEventListener("change", () => {
    changes.push([...input.files].map(file => file.name));
  });

  const result = execute("playwright.locator.setInputFiles", {
    locator: [{ type: "css", selector: "#upload" }],
    files: [{
      name: "report.txt",
      mimeType: "text/plain",
      base64: "SEVMTE8="
    }]
  });

  assert.equal(result.via, "input");
  assert.deepEqual(result.files, [{
    name: "report.txt",
    size: 5,
    type: "text/plain"
  }]);
  assert.equal(input.files.length, 1);
  assert.equal(input.files[0].name, "report.txt");
  assert.deepEqual(changes, [["report.txt"]]);
});

test("rejects setInputFiles on a non-file input", () => {
  const { execute } = createPage(`<input id="text" type="text">`);

  assert.throws(
    () => execute("playwright.locator.setInputFiles", {
      locator: [{ type: "css", selector: "#text" }],
      files: [{ name: "a.txt", base64: "QQ==" }]
    }),
    /element_not_file_input/
  );
});

test("uploads through a trigger that creates a file input", () => {
  const { execute, window } = createPage(
    `<button id="upload">Upload file</button>`
  );
  let uploaded = null;

  window.document.querySelector("#upload").addEventListener(
    "click",
    () => {
      const input = window.document.createElement("input");
      input.type = "file";
      input.addEventListener("change", () => {
        uploaded = [...input.files].map(file => file.name);
      });
      window.document.body.append(input);
      input.click();
    }
  );

  const result = execute("playwright.locator.uploadFiles", {
    locator: [{ type: "css", selector: "#upload" }],
    files: [{
      name: "photo.png",
      mimeType: "image/png",
      base64: "SEVMTE8="
    }]
  });

  assert.equal(result.status, "uploaded");
  assert.equal(result.via, "dynamic-input");
  assert.deepEqual(uploaded, ["photo.png"]);
});

test("intercepts showPicker without opening the native chooser", () => {
  const { execute, window } = createPage(
    `<button id="upload">Upload file</button>`
  );
  let pickerCalls = 0;
  let uploaded = null;

  window.HTMLInputElement.prototype.showPicker = function () {
    pickerCalls += 1;
  };
  window.document.querySelector("#upload").addEventListener(
    "click",
    () => {
      const input = window.document.createElement("input");
      input.type = "file";
      input.addEventListener("change", () => {
        uploaded = input.files[0]?.name ?? null;
      });
      window.document.body.append(input);
      input.showPicker();
    }
  );

  const result = execute("playwright.locator.uploadFiles", {
    locator: [{ type: "css", selector: "#upload" }],
    files: [{
      name: "photo.png",
      mimeType: "image/png",
      base64: "SEVMTE8="
    }]
  });

  assert.equal(result.status, "uploaded");
  assert.equal(result.via, "dynamic-input");
  assert.equal(pickerCalls, 0);
  assert.equal(uploaded, "photo.png");
});

test("keeps an upload armed for an asynchronously created input", async () => {
  const { execute, window } = createPage(
    `<button id="upload">Upload file</button>`
  );
  let uploaded = null;

  window.document.querySelector("#upload").addEventListener(
    "click",
    () => {
      window.setTimeout(() => {
        const input = window.document.createElement("input");
        input.type = "file";
        input.addEventListener("change", () => {
          uploaded = input.files[0]?.name ?? null;
        });
        window.document.body.append(input);
        input.click();
      }, 0);
    }
  );

  const armed = execute("playwright.locator.uploadFiles", {
    locator: [{ type: "css", selector: "#upload" }],
    files: [{
      name: "photo.png",
      mimeType: "image/png",
      base64: "SEVMTE8="
    }]
  });

  assert.equal(armed.status, "pending");
  await new Promise(resolve => window.setTimeout(resolve, 10));

  const result = execute("playwright.fileUploadStatus", {
    token: armed.token
  });

  assert.equal(result.status, "uploaded");
  assert.equal(result.via, "dynamic-input");
  assert.equal(uploaded, "photo.png");
});

test("delivers dropped files to a drop zone handler", () => {
  const { execute, window } = createPage(
    `<div id="zone" style="width:200px;height:80px"></div>`
  );
  const zone = window.document.querySelector("#zone");
  let dropped = null;
  zone.addEventListener("drop", event => {
    dropped = [...event.dataTransfer.files].map(file => ({
      name: file.name,
      size: file.size
    }));
  });

  const result = execute("playwright.locator.dropFiles", {
    locator: [{ type: "css", selector: "#zone" }],
    files: [{
      name: "photo.png",
      mimeType: "image/png",
      base64: "SEVMTE8="
    }]
  });

  assert.equal(result.via, "drop");
  assert.deepEqual(dropped, [{ name: "photo.png", size: 5 }]);
});

test("glides the fake cursor to a clicked element", () => {
  const { execute, window } = createPage(
    `<button id="go">Continue</button>`
  );
  const button = window.document.querySelector("#go");
  button.getBoundingClientRect = () => ({
    left: 200,
    top: 120,
    width: 100,
    height: 40,
    right: 300,
    bottom: 160
  });

  execute("playwright.locator.click", {
    locator: [{ type: "css", selector: "#go" }]
  });

  const cursor = window.document.querySelector(
    "[data-safari-browser-use-control-cursor]"
  );

  assert.notEqual(cursor, null);
  // The cursor left its parked corner and now sits over the element.
  assert.equal(cursor.style.right, "auto");
  assert.equal(cursor.style.bottom, "auto");
  const transform = cursor.style.transform.match(
    /translate3d\(([-\d.]+)px,\s*([-\d.]+)px,\s*0px\)/
  );
  assert.notEqual(transform, null);
  const left = Number(transform[1]) + 3;
  const top = Number(transform[2]) + 2;
  assert.ok(left >= 200 && left <= 300, `left ${left} within element`);
  assert.ok(top >= 120 && top <= 160, `top ${top} within element`);
  execute("control.hide");
});

test("glides the fake cursor along a coordinate gesture", () => {
  const { execute, window } = createPage(
    `<canvas id="stage" width="300" height="150"></canvas>`
  );
  const canvas = window.document.querySelector("#stage");
  window.document.elementFromPoint = () => canvas;

  execute("playwright.mouseEvent", {
    type: "pointermove",
    x: 64,
    y: 48,
    buttons: 1
  });

  const cursor = window.document.querySelector(
    "[data-safari-browser-use-control-cursor]"
  );

  assert.notEqual(cursor, null);
  assert.equal(cursor.style.right, "auto");
  assert.equal(cursor.style.bottom, "auto");
  assert.equal(cursor.style.left, "0px");
  assert.equal(cursor.style.top, "0px");
  assert.equal(
    cursor.style.transform,
    `translate3d(${64 - 3}px, ${48 - 2}px, 0px)`
  );
  assert.match(cursor.style.transition, /^transform 90ms/);
  assert.doesNotMatch(cursor.style.transition, /\bleft\b|\btop\b/);
  assert.equal(cursor.style.willChange, "transform");
  execute("control.hide");
});

test("shows a circular highlight for coordinate clicks", () => {
  const { execute, window } = createPage(`<main></main>`);
  const removalDelays = [];
  window.setTimeout = (_callback, delay) => {
    removalDelays.push(delay);
    return 1;
  };

  execute("playwright.gestureHighlight", {
    kind: "click",
    x: 100,
    y: 80
  });

  const highlight = window.document.querySelector(
    "[data-safari-browser-use-gesture-highlight='click']"
  );
  const style = window.document.getElementById(
    "__safari_browser_use_gesture_highlight_style__"
  );

  assert.notEqual(highlight, null);
  assert.equal(parseFloat(highlight.style.left), 100 - 18);
  assert.equal(parseFloat(highlight.style.top), 80 - 18);
  assert.equal(parseFloat(highlight.style.width), 36);
  assert.equal(parseFloat(highlight.style.height), 36);
  assert.equal(highlight.style.borderRadius, "50%");
  assert.match(style.textContent, /4000ms/);
  assert.equal(removalDelays.at(-1), 4200);
});

test("shows a path between coordinate drag endpoints", () => {
  const { execute, window } = createPage(`<main></main>`);

  execute("playwright.gestureHighlight", {
    kind: "drag",
    fromX: 10,
    fromY: 20,
    toX: 40,
    toY: 60
  });

  const highlight = window.document.querySelector(
    "[data-safari-browser-use-gesture-highlight='drag']"
  );
  const path = highlight?.querySelector(
    "[data-safari-browser-use-gesture-path]"
  );
  const start = highlight?.querySelector(
    "[data-safari-browser-use-gesture-point='start']"
  );
  const end = highlight?.querySelector(
    "[data-safari-browser-use-gesture-point='end']"
  );

  assert.notEqual(path, null);
  assert.equal(parseFloat(path.style.left), 10);
  assert.equal(parseFloat(path.style.top), 20);
  assert.equal(parseFloat(path.style.width), 50);
  assert.match(path.style.transform, /rotate\(53\.13/);
  assert.notEqual(start, null);
  assert.notEqual(end, null);
});

test("does not summon the cursor for read-only reads", () => {
  const { execute, window } = createPage(
    `<p id="copy">Hello</p>`
  );

  execute("playwright.locator.innerText", {
    locator: [{ type: "css", selector: "#copy" }]
  });

  assert.equal(
    window.document.querySelector(
      "[data-safari-browser-use-control-cursor]"
    ),
    null
  );
});

test("wraps a clicked element in a fading orange highlight", () => {
  const { execute, window } = createPage(
    `<button id="go">Continue</button>`
  );
  const removalDelays = [];
  window.setTimeout = (_callback, delay) => {
    removalDelays.push(delay);
    return 1;
  };
  const button = window.document.querySelector("#go");
  button.getBoundingClientRect = () => ({
    left: 200,
    top: 120,
    width: 100,
    height: 40,
    right: 300,
    bottom: 160
  });

  execute("playwright.locator.click", {
    locator: [{ type: "css", selector: "#go" }]
  });

  const glow = window.document.querySelector(
    "[data-safari-browser-use-highlight]"
  );

  assert.notEqual(glow, null);
  assert.equal(glow.style.position, "fixed");
  assert.equal(glow.style.pointerEvents, "none");
  assert.equal(glow.getAttribute("aria-hidden"), "true");
  // Positioned over the element (with a small padding).
  assert.equal(parseFloat(glow.style.left), 200 - 4);
  assert.equal(parseFloat(glow.style.top), 120 - 4);
  assert.equal(parseFloat(glow.style.width), 100 + 8);
  assert.equal(parseFloat(glow.style.height), 40 + 8);
  // Orange glow.
  assert.match(glow.style.boxShadow, /255,\s*(1[234]0|165)/);
  // A single fade stylesheet is injected.
  const style = window.document.getElementById(
    "__safari_browser_use_highlight_style__"
  );
  assert.notEqual(style, null);
  assert.match(style.textContent, /4000ms/);
  assert.equal(removalDelays.at(-1), 4200);
});

test("highlights inputs, checkboxes and selects on interaction", () => {
  const cases = [
    {
      html: `<input id="t" type="text">`,
      method: "playwright.locator.fill",
      params: { value: "hi" }
    },
    {
      html: `<input id="t" type="checkbox">`,
      method: "playwright.locator.setChecked",
      params: { checked: true }
    },
    {
      html: `<select id="t"><option value="a">A</option></select>`,
      method: "playwright.locator.selectOption",
      params: { values: ["a"] }
    }
  ];

  for (const testCase of cases) {
    const { execute, window } = createPage(testCase.html);
    const target = window.document.querySelector("#t");
    target.getBoundingClientRect = () => ({
      left: 10,
      top: 10,
      width: 120,
      height: 30,
      right: 130,
      bottom: 40
    });

    execute(testCase.method, {
      locator: [{ type: "css", selector: "#t" }],
      ...testCase.params
    });

    assert.notEqual(
      window.document.querySelector(
        "[data-safari-browser-use-highlight]"
      ),
      null,
      `expected highlight for ${testCase.method}`
    );
  }
});

test("does not highlight read-only reads", () => {
  const { execute, window } = createPage(`<p id="copy">Hello</p>`);
  const target = window.document.querySelector("#copy");
  target.getBoundingClientRect = () => ({
    left: 10,
    top: 10,
    width: 100,
    height: 20,
    right: 110,
    bottom: 30
  });

  execute("playwright.locator.innerText", {
    locator: [{ type: "css", selector: "#copy" }]
  });

  assert.equal(
    window.document.querySelector(
      "[data-safari-browser-use-highlight]"
    ),
    null
  );
});
