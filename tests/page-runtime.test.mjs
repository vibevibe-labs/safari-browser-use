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

test("replaces the original favicon with a solid yellow light", () => {
  const { execute, window } = createPage("<main>Dashboard</main>");
  const original = window.document.createElement("link");
  let intervals = 0;

  original.setAttribute("rel", "icon");
  original.setAttribute("href", "/favicon.svg?theme=dark&v=1");
  window.document.head.append(original);
  window.setInterval = () => {
    intervals++;
    return 7;
  };

  execute("control.show", { leaseMs: 1000 });

  const favicon = window.document.querySelector(
    "[data-safari-browser-use-control-favicon]"
  );
  const href = favicon.getAttribute("href");
  const svg = decodeURIComponent(href.split(",")[1]);

  assert.equal(original.isConnected, false);
  assert.equal(favicon.getAttribute("rel"), "icon");
  assert.equal(favicon.getAttribute("type"), "image/svg+xml");
  assert.match(href, /^data:image\/svg\+xml,/);
  assert.match(svg, /fill="#ffd400"/i);
  assert.doesNotMatch(svg, /<image /i);
  assert.equal(intervals, 0);

  execute("control.hide");
});

test("starts and stops the overlay and yellow favicon together", () => {
  const { execute, window } = createPage("<main>Dashboard</main>");
  const original = window.document.createElement("link");
  const following = window.document.createElement("meta");

  original.setAttribute("rel", "icon");
  original.setAttribute("href", "/favicon.ico");
  following.setAttribute("name", "theme-color");
  window.document.head.append(original, following);

  execute("control.show", { leaseMs: 1000 });

  assert.notEqual(
    window.document.querySelector(
      "[data-safari-browser-use-control]"
    ),
    null
  );
  assert.notEqual(
    window.document.querySelector(
      "[data-safari-browser-use-control-favicon]"
    ),
    null
  );
  assert.equal(original.isConnected, false);

  execute("control.hide");

  assert.equal(
    window.document.querySelector(
      "[data-safari-browser-use-control]"
    ),
    null
  );
  assert.equal(
    window.document.querySelector(
      "[data-safari-browser-use-control-favicon]"
    ),
    null
  );
  assert.equal(original.isConnected, true);
  assert.equal(original.nextSibling, following);
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
  const original = window.document.createElement("link");

  original.setAttribute("rel", "icon");
  original.setAttribute("href", "/favicon.ico");
  window.document.head.append(original);

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
      "[data-safari-browser-use-control-favicon]"
    ),
    null
  );
  assert.equal(original.isConnected, true);
});
