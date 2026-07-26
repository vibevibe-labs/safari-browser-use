ObjC.import("Foundation");

function runPageOperation(
  document,
  window,
  method,
  params = {}
) {
  const interactiveSelector = [
    "a[href]",
    "button",
    "input",
    "select",
    "textarea",
    "[contenteditable='true']",
    "[role]",
    "[tabindex]"
  ].join(",");
  const snapshotSelector =
    `${interactiveSelector},[data-testid]`;
  const controlIndicatorAttribute =
    "data-safari-browser-use-control";
  const controlStyleId =
    "__safari_browser_use_control_style__";
  const controlTimerKey =
    "__safari_browser_use_control_timer__";
  const controlTitleTimerKey =
    "__safari_browser_use_control_title_timer__";
  const controlTitleBaseKey =
    "__safari_browser_use_control_title_base__";
  const controlFaviconAttribute =
    "data-safari-browser-use-control-favicon";
  const controlFaviconStateKey =
    "__safari_browser_use_control_favicon_state__";
  const controlTitlePattern = /^(?:🟡|⚫) AI · /u;

  function escapeXmlAttribute(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function controlFaviconUrl(lit, sourceUrl) {
    const color = lit ? "#ffd400" : "#ad9300";
    const opacity = lit ? "0.92" : "0.5";
    const blur = lit ? "2.8" : "1.4";
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">',
      '<defs><filter id="halo" x="-50%" y="-50%" ',
      'width="200%" height="200%">',
      `<feGaussianBlur stdDeviation="${blur}"/>`,
      "</filter></defs>",
      `<circle cx="16" cy="16" r="12" fill="none" stroke="${color}"`,
      ` stroke-width="4" opacity="${opacity}" filter="url(#halo)"/>`,
      `<circle cx="16" cy="16" r="12" fill="none" stroke="${color}"`,
      ` stroke-width="2" opacity="${opacity}"/>`,
      `<image href="${escapeXmlAttribute(sourceUrl)}" x="6" y="6"`,
      ' width="20" height="20" preserveAspectRatio="xMidYMid meet"/>',
      "</svg>"
    ].join("");

    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }

  function showControlFavicon() {
    const originals = Array.from(
      document.querySelectorAll('link[rel~="icon"]')
    ).map(link => ({
      link,
      parent: link.parentNode,
      nextSibling: link.nextSibling
    }));
    const sourceUrl = originals[0]?.link.href ||
      new URL("/favicon.ico", document.baseURI).href;

    originals.forEach(({ link }) => link.remove());

    const favicon = document.createElement("link");
    favicon.setAttribute("rel", "icon");
    favicon.setAttribute("type", "image/svg+xml");
    favicon.setAttribute(controlFaviconAttribute, "");
    (document.head || document.documentElement).append(favicon);

    window[controlFaviconStateKey] = {
      favicon,
      originals,
      sourceUrl
    };
  }

  function updateControlFavicon(lit) {
    const state = window[controlFaviconStateKey];

    if (state?.favicon?.isConnected) {
      state.favicon.setAttribute(
        "href",
        controlFaviconUrl(lit, state.sourceUrl)
      );
    }
  }

  function restoreControlFavicon() {
    const state = window[controlFaviconStateKey];

    if (!state) {
      return;
    }

    state.favicon?.remove();

    for (let index = state.originals.length - 1; index >= 0; index--) {
      const { link, parent, nextSibling } = state.originals[index];

      if (!link.isConnected && parent?.isConnected) {
        const reference = nextSibling?.parentNode === parent
          ? nextSibling
          : null;
        parent.insertBefore(link, reference);
      }
    }

    delete window[controlFaviconStateKey];
  }

  function updateControlTitle(lit) {
    if (!controlTitlePattern.test(document.title)) {
      window[controlTitleBaseKey] = document.title;
    }

    document.title = `${lit ? "🟡" : "⚫"} AI · ` +
      window[controlTitleBaseKey];
  }

  function hideControlIndicator() {
    window.clearTimeout(window[controlTimerKey]);
    delete window[controlTimerKey];
    window.clearInterval(window[controlTitleTimerKey]);
    delete window[controlTitleTimerKey];

    if (controlTitleBaseKey in window) {
      if (!controlTitlePattern.test(document.title)) {
        window[controlTitleBaseKey] = document.title;
      }

      document.title = window[controlTitleBaseKey];
      delete window[controlTitleBaseKey];
    }

    document.querySelector(
      `[${controlIndicatorAttribute}]`
    )?.remove();
    document.getElementById(controlStyleId)?.remove();
    restoreControlFavicon();

    return { visible: false };
  }

  function showControlIndicator(options) {
    hideControlIndicator();

    const style = document.createElement("style");
    style.id = controlStyleId;
    style.textContent = `
      @keyframes __safari_browser_use_control_breathe__ {
        0%, 100% { opacity: 0.64; }
        50% { opacity: 1; }
      }

      [${controlIndicatorAttribute}] {
        animation:
          __safari_browser_use_control_breathe__
          1300ms cubic-bezier(0.25, 1, 0.5, 1) infinite;
      }

      @media (prefers-reduced-motion: reduce) {
        [${controlIndicatorAttribute}] {
          animation: none !important;
          opacity: 0.98 !important;
        }
      }
    `;
    (document.head || document.documentElement).append(style);

    const indicator = document.createElement("div");
    indicator.setAttribute(controlIndicatorAttribute, "");
    indicator.setAttribute("aria-hidden", "true");
    Object.assign(indicator.style, {
      position: "fixed",
      inset: "0",
      boxSizing: "border-box",
      pointerEvents: "none",
      zIndex: "2147483647",
      border: "3px solid rgba(194, 184, 38, 0.98)",
      outline: "1px solid rgba(255, 252, 210, 0.92)",
      outlineOffset: "-6px",
      borderRadius: "10px",
      boxShadow: [
        "inset 0 0 18px 4px rgba(255, 253, 220, 0.95)",
        "inset 0 0 56px 14px rgba(230, 222, 82, 0.78)",
        "inset 0 0 140px 28px rgba(183, 191, 42, 0.52)",
        "inset 0 0 200px 42px rgba(151, 162, 34, 0.28)"
      ].join(", "),
      contain: "strict",
      willChange: "opacity"
    });
    document.documentElement.append(indicator);

    showControlFavicon();
    window[controlTitleBaseKey] = document.title;
    updateControlTitle(true);
    updateControlFavicon(true);

    if (!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      let lit = true;
      window[controlTitleTimerKey] = window.setInterval(() => {
        lit = !lit;
        updateControlTitle(lit);
        updateControlFavicon(lit);
      }, 900);
    }

    const requestedLeaseMs = Number(options.leaseMs);
    const leaseMs = Number.isFinite(requestedLeaseMs) &&
      requestedLeaseMs > 0
      ? Math.min(requestedLeaseMs, 300_000)
      : 45_000;
    window[controlTimerKey] = window.setTimeout(
      hideControlIndicator,
      leaseMs
    );

    return { visible: true };
  }

  function normalizeText(value) {
    return value?.replace(/\s+/g, " ").trim() ?? "";
  }

  function implicitRole(element) {
    const tagName = element.tagName.toLowerCase();

    if (tagName === "a" && element.hasAttribute("href")) {
      return "link";
    }

    if (tagName === "button") {
      return "button";
    }

    if (tagName === "textarea") {
      return "textbox";
    }

    if (tagName === "select") {
      return "combobox";
    }

    if (tagName === "input") {
      const type =
        (element.getAttribute("type") ?? "text").toLowerCase();

      if (type === "checkbox" || type === "radio") {
        return type;
      }

      if (
        type === "button" ||
        type === "submit" ||
        type === "reset"
      ) {
        return "button";
      }

      return "textbox";
    }

    return element.getAttribute("contenteditable") === "true"
      ? "textbox"
      : null;
  }

  function accessibleName(element) {
    const ariaLabel = normalizeText(
      element.getAttribute("aria-label")
    );

    if (ariaLabel) {
      return ariaLabel;
    }

    const labelledBy = element.getAttribute("aria-labelledby");

    if (labelledBy) {
      const label = normalizeText(
        labelledBy
          .split(/\s+/)
          .map(id => document.getElementById(id)?.textContent)
          .filter(Boolean)
          .join(" ")
      );

      if (label) {
        return label;
      }
    }

    const associatedLabel = element.labels?.[0];

    if (associatedLabel) {
      const label = normalizeText(associatedLabel.textContent);

      if (label) {
        return label;
      }
    }

    for (const attribute of ["alt", "title", "placeholder"]) {
      const value = normalizeText(element.getAttribute(attribute));

      if (value) {
        return value;
      }
    }

    return normalizeText(element.textContent);
  }

  function isVisible(element) {
    if (element.hidden) {
      return false;
    }

    const style = window.getComputedStyle(element);
    return style.display !== "none" &&
      style.visibility !== "hidden";
  }

  function matchesText(actual, expected, exact) {
    const normalizedActual = normalizeText(actual);
    const normalizedExpected = normalizeText(String(expected));

    return exact
      ? normalizedActual === normalizedExpected
      : normalizedActual.includes(normalizedExpected);
  }

  function descendants(roots) {
    return roots.flatMap(root => [...root.querySelectorAll("*")]);
  }

  function resolveLocator(steps) {
    let roots = [document];

    for (const step of steps) {
      if (step.type === "index") {
        const index = step.index < 0
          ? roots.length + step.index
          : step.index;
        roots = roots[index] ? [roots[index]] : [];
        continue;
      }

      const candidates = descendants(roots);

      switch (step.type) {
        case "css":
          roots = roots.flatMap(root => [
            ...root.querySelectorAll(step.selector)
          ]);
          break;
        case "role":
          roots = candidates.filter(element =>
            (element.getAttribute("role") || implicitRole(element)) ===
              step.role &&
            (
              step.name === undefined ||
              matchesText(
                accessibleName(element),
                step.name,
                step.exact
              )
            )
          );
          break;
        case "text": {
          const matches = candidates.filter(element =>
            matchesText(element.textContent, step.text, step.exact)
          );
          roots = matches.filter(element =>
            ![...element.children].some(child =>
              matchesText(child.textContent, step.text, step.exact)
            )
          );
          break;
        }
        case "label":
          roots = candidates.filter(element =>
            "labels" in element &&
            matchesText(
              accessibleName(element),
              step.text,
              step.exact
            )
          );
          break;
        case "placeholder":
          roots = candidates.filter(element =>
            matchesText(
              element.getAttribute("placeholder"),
              step.text,
              step.exact
            )
          );
          break;
        case "testId":
          roots = candidates.filter(element =>
            element.getAttribute("data-testid") === step.testId
          );
          break;
        default:
          throw new Error(
            `unsupported_locator_step: ${step.type}`
          );
      }
    }

    return [...new Set(roots)];
  }

  function oneLocatorElement(locator) {
    const matches = resolveLocator(locator);

    if (matches.length !== 1) {
      throw new Error(
        `strict mode violation: locator resolved to ` +
        `${matches.length} elements`
      );
    }

    return matches[0];
  }

  function fillElement(element, value) {
    if (!("value" in element)) {
      throw new Error("element_not_fillable");
    }

    element.value = String(value);
    element.dispatchEvent(
      new window.Event("input", { bubbles: true })
    );
    element.dispatchEvent(
      new window.Event("change", { bubbles: true })
    );
  }

  function domSnapshot() {
    return [...document.querySelectorAll(snapshotSelector)]
      .filter(element => isVisible(element))
      .map(element => {
        const role = element.getAttribute("role") ||
          implicitRole(element) ||
          "element";
        const name = accessibleName(element);
        const attributes = [
          "data-testid",
          "href",
          "placeholder"
        ]
          .flatMap(attribute => {
            const value = element.getAttribute(attribute);
            return value === null
              ? []
              : [`[${attribute}=${JSON.stringify(value)}]`];
          })
          .join(" ");
        return [
          `- ${role} ${JSON.stringify(name)}`,
          attributes
        ].filter(Boolean).join(" ");
      })
      .join("\n");
  }

  function matchesState(locator, state) {
    const matches = resolveLocator(locator);

    switch (state) {
      case "attached":
        return matches.length > 0;
      case "detached":
        return matches.length === 0;
      case "hidden":
        return matches.length === 0 ||
          matches.every(element => !isVisible(element));
      case "visible":
        return matches.some(element => isVisible(element));
      default:
        throw new Error(`unsupported_locator_state: ${state}`);
    }
  }

  if (method === "playwright.domSnapshot") {
    return domSnapshot();
  }

  if (method === "control.show") {
    return showControlIndicator(params);
  }

  if (method === "control.hide") {
    return hideControlIndicator();
  }

  if (!method.startsWith("playwright.locator.")) {
    throw new Error(`unsupported_playwright_method: ${method}`);
  }

  const operation =
    method.slice("playwright.locator.".length);

  if (operation === "matchesState") {
    return matchesState(params.locator, params.state);
  }

  const matches = resolveLocator(params.locator);

  if (operation === "count") {
    return matches.length;
  }

  if (operation === "allTextContents") {
    return matches.map(element => element.textContent ?? "");
  }

  const element = oneLocatorElement(params.locator);

  switch (operation) {
    case "click":
      element.scrollIntoView?.({
        block: "center",
        inline: "center"
      });
      element.click();
      return { clicked: true };
    case "fill":
      fillElement(element, params.value);
      return { filled: true };
    case "type":
      fillElement(
        element,
        `${element.value ?? ""}${params.value}`
      );
      return { typed: true };
    case "press":
      element.focus?.();
      element.dispatchEvent(new window.KeyboardEvent("keydown", {
        key: params.value,
        bubbles: true
      }));
      element.dispatchEvent(new window.KeyboardEvent("keyup", {
        key: params.value,
        bubbles: true
      }));
      return { pressed: true };
    case "innerText":
      return normalizeText(element.innerText);
    case "textContent":
      return element.textContent;
    case "getAttribute":
      return element.getAttribute(params.name);
    case "isVisible":
      return isVisible(element);
    case "isEnabled":
      return !element.disabled;
    case "setChecked":
      if (!("checked" in element)) {
        throw new Error("element_not_checkable");
      }
      element.checked = Boolean(params.checked);
      element.dispatchEvent(
        new window.Event("input", { bubbles: true })
      );
      element.dispatchEvent(
        new window.Event("change", { bubbles: true })
      );
      return { checked: element.checked };
    case "selectOption": {
      if (element.tagName.toLowerCase() !== "select") {
        throw new Error("element_not_selectable");
      }
      const values = Array.isArray(params.value)
        ? params.value
        : [params.value];
      const expected = values.map(value =>
        typeof value === "object" ? value.value : value
      );

      for (const option of element.options) {
        option.selected = expected.includes(option.value);
      }

      element.dispatchEvent(
        new window.Event("input", { bubbles: true })
      );
      element.dispatchEvent(
        new window.Event("change", { bubbles: true })
      );
      return [...element.selectedOptions]
        .map(option => option.value);
    }
    default:
      throw new Error(
        `unsupported_locator_operation: ${operation}`
      );
  }
}


const SUPPORTED_SAFARI_MAJOR = 26;

function parseSafariMajor(version) {
  const match = /^(\d+)(?:\.|$)/.exec(version);

  if (!match) {
    throw new Error(`Invalid Safari version: ${version}`);
  }

  return Number(match[1]);
}

function evaluateSafariVersion(version) {
  const major = parseSafariMajor(version);

  if (major === SUPPORTED_SAFARI_MAJOR) {
    return { supported: true, major, reason: null };
  }

  const reason = major < SUPPORTED_SAFARI_MAJOR
    ? `Safari 26 is required; found Safari ${major}.`
    : `Safari ${major} is not supported; install Safari 26.`;

  return { supported: false, major, reason };
}


const emptyInputSchema = {
  type: "object",
  properties: {},
  additionalProperties: false
};

const replInputSchema = {
  type: "object",
  properties: {
    title: {
      type: "string",
      minLength: 1,
      maxLength: 120
    },
    code: {
      type: "string",
      minLength: 1,
      maxLength: 100_000
    }
  },
  required: ["title", "code"],
  additionalProperties: false
};

function createToolDefinitions() {
  return [
    {
      name: "js",
      description: "Run a synchronous JavaScript cell in the persistent Safari 26 REPL.",
      inputSchema: replInputSchema,
      annotations: {
        readOnlyHint: false
      }
    },
    {
      name: "js_reset",
      description: "Reset the Safari JavaScript REPL and clear user bindings.",
      inputSchema: emptyInputSchema,
      annotations: {
        readOnlyHint: false
      }
    }
  ];
}


function createControlLifecycle({ show, hide }) {
  let activeTabId = null;

  return {
    activate(tabId) {
      const nextTabId = String(tabId);

      if (activeTabId !== null && activeTabId !== nextTabId) {
        hide(activeTabId);
      }

      activeTabId = nextTabId;
      show(nextTabId);
    },

    release() {
      if (activeTabId === null) {
        return;
      }

      const releasedTabId = activeTabId;
      activeTabId = null;
      hide(releasedTabId);
    }
  };
}


var run = (function (globalObject) {
  var foundation = $;
  var safari = Application("Safari");
  var input = foundation.NSFileHandle.fileHandleWithStandardInput;
  var output = foundation.NSFileHandle.fileHandleWithStandardOutput;
  var currentOutput = null;

  function stringify(value) {
    if (typeof value === "string") {
      return value;
    }

    try {
      var json = JSON.stringify(value);
      return json === undefined ? String(value) : json;
    } catch (error) {
      return String(value);
    }
  }

  function writeLine(value) {
    var text = foundation(
      JSON.stringify(value) + "\n"
    );
    output.writeData(
      text.dataUsingEncoding(foundation.NSUTF8StringEncoding)
    );
  }

  function decode(data) {
    return ObjC.unwrap(
      foundation.NSString.alloc.initWithDataEncoding(
        data,
        foundation.NSUTF8StringEncoding
      )
    );
  }

  function consoleWrite() {
    if (currentOutput === null) {
      return;
    }

    var parts = [];

    for (var index = 0; index < arguments.length; index++) {
      parts.push(stringify(arguments[index]));
    }

    currentOutput.push(parts.join(" "));
  }

  var replConsole = Object.freeze({
    log: consoleWrite,
    info: consoleWrite,
    warn: consoleWrite,
    error: consoleWrite
  });

  function safariVersion() {
    var bundle = foundation.NSBundle.bundleWithPath(
      "/Applications/Safari.app"
    );
    var value = bundle.objectForInfoDictionaryKey(
      "CFBundleShortVersionString"
    );

    return String(ObjC.unwrap(value));
  }

  function ensureSafari26() {
    var support = evaluateSafariVersion(safariVersion());

    if (!support.supported) {
      throw new Error(support.reason);
    }
  }

  function tabMetadata(window, tab, tabIndex) {
    var title = tab.name();
    var url = tab.url();

    return {
      id: String(window.id()) + ":" + String(tabIndex),
      title: title === null ? "" : String(title),
      url: url === null ? "" : String(url)
    };
  }

  function listTabs() {
    var result = [];
    var windows = safari.windows();

    for (
      var windowIndex = 0;
      windowIndex < windows.length;
      windowIndex++
    ) {
      var window = windows[windowIndex];
      var tabs = window.tabs();

      for (var tabIndex = 0; tabIndex < tabs.length; tabIndex++) {
        result.push(
          tabMetadata(window, tabs[tabIndex], tabIndex + 1)
        );
      }
    }

    return result;
  }

  function currentTabMetadata() {
    var windows = safari.windows();

    if (windows.length === 0) {
      throw new Error("Safari has no open windows.");
    }

    var window = windows[0];
    var tab = window.currentTab();

    return tabMetadata(window, tab, Number(tab.index()));
  }

  function parseTabId(tabId) {
    var match = /^(\d+):(\d+)$/.exec(String(tabId));

    if (!match) {
      throw new Error("Invalid Safari tab ID: " + tabId);
    }

    return {
      windowId: Number(match[1]),
      tabIndex: Number(match[2])
    };
  }

  function findTab(tabId) {
    var parsed = parseTabId(tabId);
    var windows = safari.windows();

    for (var index = 0; index < windows.length; index++) {
      var window = windows[index];

      if (Number(window.id()) !== parsed.windowId) {
        continue;
      }

      var tabs = window.tabs();
      var tab = tabs[parsed.tabIndex - 1];

      if (!tab) {
        break;
      }

      return {
        window: window,
        tab: tab,
        tabIndex: parsed.tabIndex
      };
    }

    throw new Error("Safari tab not found: " + tabId);
  }

  function openTab() {
    var windows = safari.windows();

    if (windows.length === 0) {
      safari.Document().make();
      windows = safari.windows();
    }

    var window = windows[0];
    var tab = safari.Tab({ url: "about:blank" });
    window.tabs.push(tab);
    window.currentTab = tab;

    return currentTabMetadata();
  }

  function pageJavaScript(method, params) {
    var runtime = runPageOperation.toString();

    return [
      "(function () {",
      "try {",
      "var value = (" + runtime + ")(",
      "document, window,",
      JSON.stringify(method) + ",",
      JSON.stringify(params),
      ");",
      "return JSON.stringify({",
      "ok: true,",
      "value: value === undefined ? null : value",
      "});",
      "} catch (error) {",
      "return JSON.stringify({",
      "ok: false,",
      "error: error && error.message ? error.message : String(error)",
      "});",
      "}",
      "})()"
    ].join(" ");
  }

  function runPage(method, params) {
    var target = findTab(params.tabId);
    var raw = safari.doJavaScript(
      pageJavaScript(method, params),
      { in: target.tab }
    );
    var envelope;

    try {
      envelope = JSON.parse(String(raw));
    } catch (error) {
      throw new Error("Safari returned an invalid page result.");
    }

    if (!envelope.ok) {
      throw new Error(
        envelope.error || "Safari page operation failed."
      );
    }

    return envelope.value;
  }

  var controlLifecycle = createControlLifecycle({
    show: function (tabId) {
      try {
        runPage("control.show", {
          tabId: tabId,
          leaseMs: 45000
        });
      } catch (error) {
        // The indicator must never block the browser operation.
      }
    },
    hide: function (tabId) {
      try {
        runPage("control.hide", { tabId: tabId });
      } catch (error) {
        // Navigation or tab closure may already have removed it.
      }
    }
  });

  function waitFor(params) {
    var options = params.options || {};
    var state = options.state || "visible";
    var timeoutMs = Math.min(
      options.timeoutMs === undefined ? 5000 : options.timeoutMs,
      30000
    );
    var deadline = Date.now() + timeoutMs;

    while (Date.now() <= deadline) {
      if (runPage("playwright.locator.matchesState", {
        tabId: params.tabId,
        locator: params.locator,
        state: state
      })) {
        return { matched: true };
      }

      foundation.NSThread.sleepForTimeInterval(0.05);
    }

    throw new Error("locator_wait_timeout: " + state);
  }

  function callSafari(method, params) {
    ensureSafari26();
    params = params || {};

    if (params.tabId && method !== "tabs.close") {
      controlLifecycle.activate(params.tabId);
    }

    if (method === "tabs.list") {
      return listTabs();
    }

    if (method === "tabs.current") {
      return currentTabMetadata();
    }

    if (method === "tabs.open") {
      return openTab();
    }

    if (method === "tabs.close") {
      findTab(params.tabId).tab.close();
      return null;
    }

    if (method === "page.navigate") {
      var url = String(params.url);

      if (!/^https?:\/\//i.test(url)) {
        throw new Error("Only HTTP and HTTPS URLs are allowed.");
      }

      findTab(params.tabId).tab.url = url;
      return null;
    }

    if (method === "playwright.locator.waitFor") {
      return waitFor(params);
    }

    if (method.indexOf("playwright.") === 0) {
      return runPage(method, params);
    }

    throw new Error("Unsupported Safari operation: " + method);
  }

  function doctor() {
    var version = safariVersion();
    var support = evaluateSafariVersion(version);
    var automationAvailable = false;
    var javascriptFromAppleEvents = false;
    var issues = [];

    if (!support.supported) {
      issues.push(support.reason);
    }

    try {
      if (!safari.running()) {
        issues.push("Safari is not running.");
      } else {
        var windows = safari.windows();
        automationAvailable = true;

        if (windows.length === 0) {
          issues.push("Safari has no open window.");
        } else {
          try {
            safari.doJavaScript(
              "document.title",
              { in: windows[0].currentTab() }
            );
            javascriptFromAppleEvents = true;
          } catch (error) {
            issues.push(
              "Enable Allow JavaScript from Apple Events in " +
              "Safari Settings > Developer > Automation."
            );
          }
        }
      }
    } catch (error) {
      issues.push(
        "Apple Events failed: " +
        (error.message || String(error))
      );
    }

    return {
      safariVersion: version,
      safariSupported: support.supported,
      automationAvailable: automationAvailable,
      javascriptFromAppleEvents: javascriptFromAppleEvents,
      issues: issues
    };
  }

  function locatorStep(type, value, options) {
    var result = { type: type };
    var key;

    for (key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        result[key] = value[key];
      }
    }

    options = options || {};

    for (key in options) {
      if (Object.prototype.hasOwnProperty.call(options, key)) {
        result[key] = options[key];
      }
    }

    return result;
  }

  function SafariLocator(tabId, steps) {
    this.tabId = tabId;
    this.steps = steps;
  }

  SafariLocator.prototype.append = function (step) {
    return new SafariLocator(
      this.tabId,
      this.steps.concat([step])
    );
  };

  SafariLocator.prototype.locator = function (selector) {
    return this.append(
      locatorStep("css", { selector: selector })
    );
  };

  SafariLocator.prototype.getByRole = function (role, options) {
    options = options || {};
    var value = { role: role };

    if (options.name !== undefined) {
      value.name = options.name;
    }

    return this.append(locatorStep("role", value, {
      exact: options.exact
    }));
  };

  SafariLocator.prototype.getByText = function (text, options) {
    options = options || {};
    return this.append(locatorStep("text", {
      text: text
    }, {
      exact: options.exact
    }));
  };

  SafariLocator.prototype.getByLabel = function (text, options) {
    options = options || {};
    return this.append(locatorStep("label", {
      text: text
    }, {
      exact: options.exact
    }));
  };

  SafariLocator.prototype.getByPlaceholder = function (
    text,
    options
  ) {
    options = options || {};
    return this.append(locatorStep("placeholder", {
      text: text
    }, {
      exact: options.exact
    }));
  };

  SafariLocator.prototype.getByTestId = function (testId) {
    return this.append(locatorStep("testId", {
      testId: testId
    }));
  };

  SafariLocator.prototype.first = function () {
    return this.append(locatorStep("index", { index: 0 }));
  };

  SafariLocator.prototype.last = function () {
    return this.append(locatorStep("index", { index: -1 }));
  };

  SafariLocator.prototype.nth = function (index) {
    return this.append(locatorStep("index", { index: index }));
  };

  SafariLocator.prototype.call = function (operation, params) {
    params = params || {};
    params.tabId = this.tabId;
    params.locator = this.steps;

    return callSafari(
      "playwright.locator." + operation,
      params
    );
  };

  SafariLocator.prototype.count = function () {
    return this.call("count");
  };

  SafariLocator.prototype.click = function (options) {
    return this.call("click", { options: options || {} });
  };

  SafariLocator.prototype.fill = function (value, options) {
    return this.call("fill", {
      value: value,
      options: options || {}
    });
  };

  SafariLocator.prototype.type = function (value, options) {
    return this.call("type", {
      value: value,
      options: options || {}
    });
  };

  SafariLocator.prototype.press = function (value, options) {
    return this.call("press", {
      value: value,
      options: options || {}
    });
  };

  SafariLocator.prototype.innerText = function (options) {
    return this.call("innerText", { options: options || {} });
  };

  SafariLocator.prototype.textContent = function (options) {
    return this.call("textContent", {
      options: options || {}
    });
  };

  SafariLocator.prototype.allTextContents = function (options) {
    return this.call("allTextContents", {
      options: options || {}
    });
  };

  SafariLocator.prototype.getAttribute = function (name, options) {
    return this.call("getAttribute", {
      name: name,
      options: options || {}
    });
  };

  SafariLocator.prototype.isVisible = function () {
    return this.call("isVisible");
  };

  SafariLocator.prototype.isEnabled = function () {
    return this.call("isEnabled");
  };

  SafariLocator.prototype.check = function (options) {
    return this.call("setChecked", {
      checked: true,
      options: options || {}
    });
  };

  SafariLocator.prototype.uncheck = function (options) {
    return this.call("setChecked", {
      checked: false,
      options: options || {}
    });
  };

  SafariLocator.prototype.setChecked = function (
    checked,
    options
  ) {
    return this.call("setChecked", {
      checked: checked,
      options: options || {}
    });
  };

  SafariLocator.prototype.selectOption = function (
    value,
    options
  ) {
    return this.call("selectOption", {
      value: value,
      options: options || {}
    });
  };

  SafariLocator.prototype.waitFor = function (options) {
    return this.call("waitFor", { options: options || {} });
  };

  function SafariPlaywright(tabId) {
    this.tabId = tabId;
  }

  SafariPlaywright.prototype.locator = function (selector) {
    return new SafariLocator(this.tabId, [
      locatorStep("css", { selector: selector })
    ]);
  };

  SafariPlaywright.prototype.getByRole = function (
    role,
    options
  ) {
    return new SafariLocator(this.tabId, [])
      .getByRole(role, options);
  };

  SafariPlaywright.prototype.getByText = function (
    text,
    options
  ) {
    return new SafariLocator(this.tabId, [])
      .getByText(text, options);
  };

  SafariPlaywright.prototype.getByLabel = function (
    text,
    options
  ) {
    return new SafariLocator(this.tabId, [])
      .getByLabel(text, options);
  };

  SafariPlaywright.prototype.getByPlaceholder = function (
    text,
    options
  ) {
    return new SafariLocator(this.tabId, [])
      .getByPlaceholder(text, options);
  };

  SafariPlaywright.prototype.getByTestId = function (testId) {
    return new SafariLocator(this.tabId, [])
      .getByTestId(testId);
  };

  SafariPlaywright.prototype.domSnapshot = function () {
    return callSafari("playwright.domSnapshot", {
      tabId: this.tabId
    });
  };

  SafariPlaywright.prototype.waitForTimeout = function (timeoutMs) {
    foundation.NSThread.sleepForTimeInterval(
      Math.max(0, Number(timeoutMs)) / 1000
    );
  };

  function SafariTab(metadata) {
    this.id = String(metadata.id);
    this.playwright = new SafariPlaywright(this.id);
  }

  SafariTab.prototype.title = function () {
    controlLifecycle.activate(this.id);
    var tabs = listTabs();

    for (var index = 0; index < tabs.length; index++) {
      if (tabs[index].id === this.id) {
        return tabs[index].title;
      }
    }

    return undefined;
  };

  SafariTab.prototype.url = function () {
    controlLifecycle.activate(this.id);
    var tabs = listTabs();

    for (var index = 0; index < tabs.length; index++) {
      if (tabs[index].id === this.id) {
        return tabs[index].url;
      }
    }

    return undefined;
  };

  SafariTab.prototype.goto = function (url) {
    return callSafari("page.navigate", {
      tabId: this.id,
      url: url
    });
  };

  SafariTab.prototype.close = function () {
    return callSafari("tabs.close", { tabId: this.id });
  };

  function wrapTab(metadata) {
    controlLifecycle.activate(metadata.id);
    return new SafariTab(metadata);
  }

  var browser = Object.freeze({
    name: "Safari 26",
    doctor: doctor,
    release: function () {
      controlLifecycle.release();
      return { released: true };
    },
    tabs: Object.freeze({
      list: function () {
        return callSafari("tabs.list", {});
      },
      selected: function () {
        return wrapTab(callSafari("tabs.current", {}));
      },
      get: function (id) {
        var tabId = String(id);
        var tabs = callSafari("tabs.list", {});

        for (var index = 0; index < tabs.length; index++) {
          if (tabs[index].id === tabId) {
            return wrapTab(tabs[index]);
          }
        }

        throw new Error("Safari tab not found: " + id);
      },
      new: function () {
        return wrapTab(callSafari("tabs.open", {}));
      }
    })
  });

  globalObject.browser = browser;
  globalObject.console = replConsole;

  var baselineGlobals = Object.getOwnPropertyNames(globalObject);

  function resetRepl() {
    var names = Object.getOwnPropertyNames(globalObject);

    for (var index = 0; index < names.length; index++) {
      if (baselineGlobals.indexOf(names[index]) === -1) {
        try {
          delete globalObject[names[index]];
        } catch (error) {
          // Ignore non-configurable bindings.
        }
      }
    }

    globalObject.browser = browser;
    globalObject.console = replConsole;
  }

  function jsonValue(value) {
    if (value === undefined) {
      return null;
    }

    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return stringify(value);
    }
  }

  function evaluate(code) {
    currentOutput = [];

    try {
      var value = (0, eval)(code);
      return {
        value: value,
        output: currentOutput
      };
    } finally {
      currentOutput = null;
    }
  }

  function toolResult(result) {
    var lines = result.output.slice();

    if (result.value !== undefined) {
      lines.push(stringify(result.value));
    }

    return {
      content: [{
        type: "text",
        text: lines.join("\n") || "undefined"
      }],
      structuredContent: {
        value: jsonValue(result.value),
        output: result.output
      }
    };
  }

  var tools = createToolDefinitions();

  function hasId(message) {
    return Object.prototype.hasOwnProperty.call(message, "id");
  }

  function success(id, result) {
    writeLine({
      jsonrpc: "2.0",
      id: id,
      result: result
    });
  }

  function failure(id, code, message) {
    writeLine({
      jsonrpc: "2.0",
      id: id,
      error: {
        code: code,
        message: message
      }
    });
  }

  function handleToolCall(message) {
    var params = message.params || {};
    var name = params.name;
    var args = params.arguments || {};

    try {
      if (name === "js") {
        if (
          typeof args.title !== "string" ||
          args.title.length === 0 ||
          typeof args.code !== "string" ||
          args.code.length === 0
        ) {
          throw new Error("js requires non-empty title and code.");
        }

        success(message.id, toolResult(evaluate(args.code)));
        return;
      }

      if (name === "js_reset") {
        controlLifecycle.release();
        resetRepl();
        success(message.id, toolResult({
          value: undefined,
          output: ["Safari REPL reset."]
        }));
        return;
      }

      throw new Error("Unknown tool: " + name);
    } catch (error) {
      success(message.id, {
        content: [{
          type: "text",
          text: error.message || String(error)
        }],
        isError: true
      });
    }
  }

  function handleMessage(message) {
    if (message.method === "initialize" && hasId(message)) {
      success(message.id, {
        protocolVersion:
          message.params && message.params.protocolVersion
            ? message.params.protocolVersion
            : "2025-03-26",
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: "safari-browser-use",
          version: "0.1.0"
        }
      });
      return;
    }

    if (message.method === "ping" && hasId(message)) {
      success(message.id, {});
      return;
    }

    if (message.method === "tools/list" && hasId(message)) {
      success(message.id, { tools: tools });
      return;
    }

    if (message.method === "tools/call" && hasId(message)) {
      handleToolCall(message);
      return;
    }

    if (!hasId(message)) {
      return;
    }

    failure(message.id, -32601, "Method not found");
  }

  function handleLine(line) {
    if (!line.trim()) {
      return;
    }

    var message;

    try {
      message = JSON.parse(line);
    } catch (error) {
      failure(null, -32700, "Parse error");
      return;
    }

    handleMessage(message);
  }

  function serve() {
    var pending = foundation.NSMutableData.data;

    while (true) {
      var chunk = input.availableData;

      if (Number(chunk.length) === 0) {
        break;
      }

      pending.appendData(chunk);
      var bytes = pending.bytes;
      var length = Number(pending.length);
      var start = 0;

      for (var index = 0; index < length; index++) {
        if (bytes[index] !== 10) {
          continue;
        }

        var lineData = pending.subdataWithRange(
          foundation.NSMakeRange(start, index - start)
        );
        handleLine(decode(lineData));
        start = index + 1;
      }

      if (start > 0) {
        pending = foundation.NSMutableData.dataWithData(
          pending.subdataWithRange(
            foundation.NSMakeRange(start, length - start)
          )
        );
      }
    }
  }

  return function () {
    try {
      serve();
    } finally {
      controlLifecycle.release();
    }
  };
})(this);
