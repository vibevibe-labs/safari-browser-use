ObjC.import("Foundation");

/*__SBU_PAGE_RUNTIME__*/

/*__SBU_SAFARI_VERSION__*/

/*__SBU_TOOL_DEFINITIONS__*/

/*__SBU_CONTROL_LIFECYCLE__*/

/*__SBU_TAB_IDENTITY__*/

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

  function runGesture(params) {
    var steps = params.steps || [];
    var delayMs = Number(params.delayMs) > 0 ? Number(params.delayMs) : 90;
    var dispatched = 0;

    for (var index = 0; index < steps.length; index++) {
      var step = steps[index];
      step.tabId = params.tabId;
      runPage("playwright.mouseEvent", step);
      dispatched += 1;

      if (index < steps.length - 1) {
        foundation.NSThread.sleepForTimeInterval(delayMs / 1000);
      }
    }

    return { steps: dispatched };
  }

  function mimeTypeForPath(path) {
    var lower = String(path).toLowerCase();
    var extension = lower.slice(lower.lastIndexOf(".") + 1);
    var types = {
      txt: "text/plain",
      csv: "text/csv",
      json: "application/json",
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
      html: "text/html",
      md: "text/markdown",
      zip: "application/zip"
    };

    return types[extension] || "application/octet-stream";
  }

  function readLocalFiles(paths) {
    var list = Array.isArray(paths) ? paths : [paths];
    var files = [];

    for (var index = 0; index < list.length; index++) {
      var path = String(list[index]);
      var data = foundation.NSData.dataWithContentsOfFile(path);

      if (!data) {
        throw new Error("file_not_found: " + path);
      }

      var name = path.slice(path.lastIndexOf("/") + 1) || path;

      files.push({
        name: name,
        mimeType: mimeTypeForPath(path),
        base64: data.base64EncodedStringWithOptions(0).js
      });
    }

    return files;
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
    refresh: function (tabId) {
      try {
        runPage("control.show", {
          tabId: tabId,
          leaseMs: 45000
        });
      } catch (error) {
        // Navigation may be replacing the page document.
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

  function waitForURL(params) {
    var options = params.options || {};
    var expected = String(params.expected);
    var exact = options.exact === true;
    var timeoutMs = Math.min(
      options.timeoutMs === undefined ? 10000 : options.timeoutMs,
      30000
    );
    var deadline = Date.now() + timeoutMs;

    while (Date.now() <= deadline) {
      var candidates = listTabs().filter(function (tab) {
        if (
          tabWindowId(tab.id) !== params.tabIdentity.windowId
        ) {
          return false;
        }

        var url = String(tab.url || "");
        return exact
          ? url === expected
          : url.indexOf(expected) !== -1;
      });

      if (candidates.length === 1) {
        updateTabIdentity(params.tabIdentity, candidates[0]);
        controlLifecycle.activate(candidates[0].id);
        return {
          matched: true,
          url: candidates[0].url
        };
      }

      if (candidates.length > 1) {
        throw new Error(
          "stale_tab_handle: ambiguous URL candidates"
        );
      }

      foundation.NSThread.sleepForTimeInterval(0.05);
    }

    throw new Error("url_wait_timeout: " + expected);
  }

  function waitForLoadState(params) {
    var options = params.options || {};
    var state = options.state || "complete";
    var timeoutMs = Math.min(
      options.timeoutMs === undefined ? 10000 : options.timeoutMs,
      30000
    );
    var deadline = Date.now() + timeoutMs;

    if (state !== "interactive" && state !== "complete") {
      throw new Error("unsupported_load_state: " + state);
    }

    while (Date.now() <= deadline) {
      var metadata = resolveTabIdentity(
        params.tabIdentity,
        listTabs()
      );

      try {
        var pageState = runPage("playwright.pageState", {
          tabId: metadata.id
        });
        var matched = pageState.url === metadata.url &&
          (
            pageState.readyState === "complete" ||
            state === "interactive" &&
              pageState.readyState === "interactive"
          );

        if (matched) {
          controlLifecycle.activate(metadata.id);
          return {
            matched: true,
            state: pageState.readyState
          };
        }
      } catch (error) {
        // Safari can reject page JavaScript while replacing a document.
      }

      foundation.NSThread.sleepForTimeInterval(0.05);
    }

    throw new Error("load_state_timeout: " + state);
  }

  function callSafari(method, params) {
    ensureSafari26();
    params = params || {};

    if (method === "playwright.waitForURL") {
      return waitForURL(params);
    }

    if (method === "playwright.waitForLoadState") {
      return waitForLoadState(params);
    }

    if (params.tabIdentity) {
      resolveTabIdentity(params.tabIdentity, listTabs());
      params.tabId = params.tabIdentity.id;
    }

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
      retargetTabIdentity(params.tabIdentity, url);
      return null;
    }

    if (method === "playwright.locator.waitFor") {
      return waitFor(params);
    }

    if (method === "playwright.gesture") {
      return runGesture(params);
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

  function SafariLocator(tabIdentity, steps) {
    this.tabIdentity = tabIdentity;
    this.steps = steps;
  }

  SafariLocator.prototype.append = function (step) {
    return new SafariLocator(
      this.tabIdentity,
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
    params.tabIdentity = this.tabIdentity;
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

  SafariLocator.prototype.allAttributes = function (name, options) {
    return this.call("allAttributes", {
      name: name,
      options: options || {}
    });
  };

  SafariLocator.prototype.allRecords = function (options) {
    options = options || {};
    return this.call("allRecords", {
      fields: options.fields || {}
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

  SafariLocator.prototype.scrollIntoView = function (options) {
    return this.call("scrollIntoView", {
      options: options || {}
    });
  };

  SafariLocator.prototype.canvasSnapshot = function (options) {
    options = options || {};
    return this.call("canvasSnapshot", {
      maxSize: options.maxSize
    });
  };

  SafariLocator.prototype.setInputFiles = function (paths) {
    return this.call("setInputFiles", {
      files: readLocalFiles(paths)
    });
  };

  SafariLocator.prototype.dropFiles = function (paths) {
    return this.call("dropFiles", {
      files: readLocalFiles(paths)
    });
  };

  function SafariPlaywright(tabIdentity) {
    this.tabIdentity = tabIdentity;
  }

  SafariPlaywright.prototype.locator = function (selector) {
    return new SafariLocator(this.tabIdentity, [
      locatorStep("css", { selector: selector })
    ]);
  };

  SafariPlaywright.prototype.getByRole = function (
    role,
    options
  ) {
    return new SafariLocator(this.tabIdentity, [])
      .getByRole(role, options);
  };

  SafariPlaywright.prototype.getByText = function (
    text,
    options
  ) {
    return new SafariLocator(this.tabIdentity, [])
      .getByText(text, options);
  };

  SafariPlaywright.prototype.getByLabel = function (
    text,
    options
  ) {
    return new SafariLocator(this.tabIdentity, [])
      .getByLabel(text, options);
  };

  SafariPlaywright.prototype.getByPlaceholder = function (
    text,
    options
  ) {
    return new SafariLocator(this.tabIdentity, [])
      .getByPlaceholder(text, options);
  };

  SafariPlaywright.prototype.getByTestId = function (testId) {
    return new SafariLocator(this.tabIdentity, [])
      .getByTestId(testId);
  };

  SafariPlaywright.prototype.domSnapshot = function () {
    return callSafari("playwright.domSnapshot", {
      tabIdentity: this.tabIdentity
    });
  };

  SafariPlaywright.prototype.canvasSnapshot = function (
    selector,
    options
  ) {
    return this.locator(selector).canvasSnapshot(options);
  };

  SafariPlaywright.prototype.clickAt = function (x, y, options) {
    options = options || {};
    var point = { x: Number(x), y: Number(y) };
    var steps = [
      { type: "pointermove", x: point.x, y: point.y, buttons: 0 },
      {
        type: "pointerdown",
        x: point.x,
        y: point.y,
        button: 0,
        buttons: 1
      },
      {
        type: "pointerup",
        x: point.x,
        y: point.y,
        button: 0,
        buttons: 0
      },
      { type: "click", x: point.x, y: point.y, button: 0, buttons: 0 }
    ];

    return callSafari("playwright.gesture", {
      tabIdentity: this.tabIdentity,
      steps: steps,
      delayMs: options.delayMs
    });
  };

  SafariPlaywright.prototype.drag = function (
    fromX,
    fromY,
    toX,
    toY,
    options
  ) {
    options = options || {};
    var from = { x: Number(fromX), y: Number(fromY) };
    var to = { x: Number(toX), y: Number(toY) };
    var count = Number(options.steps) > 0 ? Number(options.steps) : 8;
    var steps = [
      { type: "pointermove", x: from.x, y: from.y, buttons: 0 },
      { type: "pointerdown", x: from.x, y: from.y, button: 0, buttons: 1 }
    ];

    for (var index = 1; index <= count; index++) {
      var ratio = index / count;
      steps.push({
        type: "pointermove",
        x: Math.round(from.x + (to.x - from.x) * ratio),
        y: Math.round(from.y + (to.y - from.y) * ratio),
        buttons: 1
      });
    }

    steps.push({
      type: "pointerup",
      x: to.x,
      y: to.y,
      button: 0,
      buttons: 0
    });

    return callSafari("playwright.gesture", {
      tabIdentity: this.tabIdentity,
      steps: steps,
      delayMs: options.delayMs
    });
  };

  SafariPlaywright.prototype.scrollBy = function (
    deltaX,
    deltaY
  ) {
    return callSafari("playwright.scrollBy", {
      tabIdentity: this.tabIdentity,
      deltaX: deltaX,
      deltaY: deltaY
    });
  };

  SafariPlaywright.prototype.waitForURL = function (
    expected,
    options
  ) {
    return callSafari("playwright.waitForURL", {
      tabIdentity: this.tabIdentity,
      expected: expected,
      options: options || {}
    });
  };

  SafariPlaywright.prototype.waitForLoadState = function (options) {
    return callSafari("playwright.waitForLoadState", {
      tabIdentity: this.tabIdentity,
      options: options || {}
    });
  };

  SafariPlaywright.prototype.waitForTimeout = function (timeoutMs) {
    var metadata = resolveTabIdentity(
      this.tabIdentity,
      listTabs()
    );
    controlLifecycle.activate(metadata.id);

    foundation.NSThread.sleepForTimeInterval(
      Math.min(30000, Math.max(0, Number(timeoutMs) || 0)) /
        1000
    );
    metadata = resolveTabIdentity(
      this.tabIdentity,
      listTabs()
    );
    controlLifecycle.activate(metadata.id);
  };

  function SafariTab(metadata) {
    this._identity = createTabIdentity(metadata);
    this.playwright = new SafariPlaywright(this._identity);
    Object.defineProperty(this, "id", {
      enumerable: true,
      get: function () {
        return this._identity.id;
      }
    });
  }

  SafariTab.prototype.title = function () {
    var metadata = resolveTabIdentity(
      this._identity,
      listTabs()
    );
    controlLifecycle.activate(metadata.id);
    return metadata.title;
  };

  SafariTab.prototype.url = function () {
    var metadata = resolveTabIdentity(
      this._identity,
      listTabs()
    );
    controlLifecycle.activate(metadata.id);
    return metadata.url;
  };

  SafariTab.prototype.goto = function (url) {
    return callSafari("page.navigate", {
      tabIdentity: this._identity,
      url: url
    });
  };

  SafariTab.prototype.close = function () {
    return callSafari("tabs.close", {
      tabIdentity: this._identity
    });
  };

  function wrapTab(metadata) {
    var tab = new SafariTab(metadata);
    controlLifecycle.activate(tab.id);
    return tab;
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

  function imageMarker(value) {
    if (
      value &&
      typeof value === "object" &&
      value.__sbuImage &&
      typeof value.__sbuImage === "object" &&
      typeof value.__sbuImage.base64 === "string"
    ) {
      return value.__sbuImage;
    }

    return null;
  }

  function toolResult(result) {
    var lines = result.output.slice();
    var marker = imageMarker(result.value);

    if (marker) {
      var summary = {
        mimeType: marker.mimeType || "image/png",
        width: marker.width,
        height: marker.height,
        bytes: marker.base64.length
      };
      var structured = {};
      var key;

      for (key in result.value) {
        if (
          Object.prototype.hasOwnProperty.call(result.value, key) &&
          key !== "__sbuImage"
        ) {
          structured[key] = result.value[key];
        }
      }

      structured.image = summary;

      return {
        content: [
          {
            type: "text",
            text: lines.concat([stringify(summary)]).join("\n")
          },
          {
            type: "image",
            data: marker.base64,
            mimeType: summary.mimeType
          }
        ],
        structuredContent: {
          value: jsonValue(structured),
          output: result.output
        }
      };
    }

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
          version: "0.1.1"
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
