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
