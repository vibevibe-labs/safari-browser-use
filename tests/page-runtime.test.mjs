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

test("shows one non-interactive AI control indicator", () => {
  const { execute, window } = createPage("<main>Dashboard</main>");

  execute("control.show", { leaseMs: 1000 });
  execute("control.show", { leaseMs: 1000 });

  const indicators = window.document.querySelectorAll(
    "[data-safari-browser-use-control]"
  );
  const indicator = indicators[0];
  const style = window.document.getElementById(
    "__safari_browser_use_control_style__"
  );

  assert.equal(indicators.length, 1);
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
});
