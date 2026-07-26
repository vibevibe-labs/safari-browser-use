export function runPageOperation(
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
  const controlTitlePattern = /^(?:🟡|⚫) AI · /u;

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

    window[controlTitleBaseKey] = document.title;
    updateControlTitle(true);

    if (!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      let lit = true;
      window[controlTitleTimerKey] = window.setInterval(() => {
        lit = !lit;
        updateControlTitle(lit);
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
