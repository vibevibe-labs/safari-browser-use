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
  const controlCursorAttribute =
    "data-safari-browser-use-control-cursor";
  const controlStyleId =
    "__safari_browser_use_control_style__";
  const controlTimerKey =
    "__safari_browser_use_control_timer__";
  const highlightAttribute =
    "data-safari-browser-use-highlight";
  const highlightStyleId =
    "__safari_browser_use_highlight_style__";

  function hideControlIndicator() {
    window.clearTimeout(window[controlTimerKey]);
    delete window[controlTimerKey];

    document.querySelector(
      `[${controlIndicatorAttribute}]`
    )?.remove();
    document.getElementById(controlStyleId)?.remove();

    return { visible: false };
  }

  function showControlIndicator(options) {
    const existingIndicator = document.querySelector(
      `[${controlIndicatorAttribute}]`
    );
    const existingStyle = document.getElementById(controlStyleId);

    if (existingIndicator && existingStyle) {
      window.clearTimeout(window[controlTimerKey]);
      window[controlTimerKey] = window.setTimeout(
        hideControlIndicator,
        controlLeaseMs(options)
      );
      return { visible: true };
    }

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

    const cursor = document.createElement("div");
    const cursorSvg = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 36">',
      '<path d="M3 2v27l7-7 6 12 6-3-6-11h10z"',
      ' fill="#111" stroke="#fff" stroke-width="2"',
      ' stroke-linejoin="round"/>',
      "</svg>"
    ].join("");
    cursor.setAttribute(controlCursorAttribute, "");
    Object.assign(cursor.style, {
      position: "absolute",
      right: "96px",
      bottom: "80px",
      width: "28px",
      height: "36px",
      pointerEvents: "none",
      backgroundImage:
        `url("data:image/svg+xml,${encodeURIComponent(cursorSvg)}")`,
      backgroundRepeat: "no-repeat",
      backgroundSize: "contain",
      filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.55))"
    });
    indicator.append(cursor);
    document.documentElement.append(indicator);

    window[controlTimerKey] = window.setTimeout(
      hideControlIndicator,
      controlLeaseMs(options)
    );

    return { visible: true };
  }

  function controlLeaseMs(options) {
    const requestedLeaseMs = Number(options.leaseMs);

    return Number.isFinite(requestedLeaseMs) &&
      requestedLeaseMs > 0
      ? Math.min(requestedLeaseMs, 300_000)
      : 45_000;
  }

  function controlCursorElement() {
    return document.querySelector(`[${controlCursorAttribute}]`);
  }

  function prefersReducedMotion() {
    return (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function moveControlCursorTo(point, options = {}) {
    if (
      !point ||
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y)
    ) {
      return { moved: false };
    }

    showControlIndicator(options);

    const cursor = controlCursorElement();

    if (!cursor) {
      return { moved: false };
    }

    const glideMs = Number.isFinite(Number(options.glideMs))
      ? Number(options.glideMs)
      : 320;

    cursor.style.right = "auto";
    cursor.style.bottom = "auto";
    cursor.style.transition = prefersReducedMotion()
      ? "none"
      : `left ${glideMs}ms cubic-bezier(0.22, 1, 0.36, 1), ` +
        `top ${glideMs}ms cubic-bezier(0.22, 1, 0.36, 1)`;
    cursor.style.left = `${point.x - 3}px`;
    cursor.style.top = `${point.y - 2}px`;

    return { moved: true, x: point.x, y: point.y };
  }

  function pointerablePoint(element) {
    if (
      !element ||
      typeof element.getBoundingClientRect !== "function"
    ) {
      return null;
    }

    const rect = element.getBoundingClientRect();

    if (!rect || (!rect.width && !rect.height)) {
      return null;
    }

    // Aim near the centre with a small imprecise offset so the
    // cursor lands naturally rather than pixel-perfectly.
    const jitterX = (Math.random() - 0.5) * Math.min(rect.width, 24);
    const jitterY = (Math.random() - 0.5) * Math.min(rect.height, 16);
    const viewportWidth = window.innerWidth || rect.right;
    const viewportHeight = window.innerHeight || rect.bottom;
    const x = Math.max(
      2,
      Math.min(rect.left + rect.width / 2 + jitterX, viewportWidth - 2)
    );
    const y = Math.max(
      2,
      Math.min(rect.top + rect.height / 2 + jitterY, viewportHeight - 2)
    );

    return { x, y };
  }

  function moveControlCursorToElement(element, options) {
    try {
      return moveControlCursorTo(pointerablePoint(element), options);
    } catch (error) {
      // The cursor illusion must never break a real operation.
      return { moved: false };
    }
  }

  function ensureHighlightStyle() {
    if (document.getElementById(highlightStyleId)) {
      return;
    }

    const style = document.createElement("style");
    style.id = highlightStyleId;
    style.textContent = `
      @keyframes __safari_browser_use_highlight_fade__ {
        0% { opacity: 1; transform: scale(1.03); }
        5% { opacity: 1; transform: scale(1); }
        25% { opacity: 1; transform: scale(1); }
        100% { opacity: 0; transform: scale(1); }
      }

      [${highlightAttribute}] {
        animation:
          __safari_browser_use_highlight_fade__
          3000ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
      }

      @media (prefers-reduced-motion: reduce) {
        [${highlightAttribute}] {
          animation: none !important;
          opacity: 1 !important;
          transform: none !important;
        }
      }
    `;
    (document.head || document.documentElement).append(style);
  }

  function highlightElement(element) {
    try {
      const rect =
        element && typeof element.getBoundingClientRect === "function"
          ? element.getBoundingClientRect()
          : null;

      if (!rect || (!rect.width && !rect.height)) {
        return { highlighted: false };
      }

      ensureHighlightStyle();

      const pad = 4;
      const glow = document.createElement("div");
      glow.setAttribute(highlightAttribute, "");
      glow.setAttribute("aria-hidden", "true");
      Object.assign(glow.style, {
        position: "fixed",
        left: `${rect.left - pad}px`,
        top: `${rect.top - pad}px`,
        width: `${rect.width + pad * 2}px`,
        height: `${rect.height + pad * 2}px`,
        boxSizing: "border-box",
        pointerEvents: "none",
        zIndex: "2147483646",
        borderRadius: "10px",
        border: "2px solid rgba(255, 148, 0, 0.95)",
        backgroundColor: "rgba(255, 152, 32, 0.12)",
        boxShadow: [
          "0 0 0 3px rgba(255, 165, 40, 0.55)",
          "0 0 16px 4px rgba(255, 140, 0, 0.80)",
          "0 0 38px 12px rgba(255, 120, 0, 0.45)"
        ].join(", "),
        willChange: "opacity, transform"
      });

      const remove = () => glow.remove();
      glow.addEventListener("animationend", remove);
      // Fallback removal in case the animation event never fires.
      window.setTimeout(remove, 3200);

      document.documentElement.append(glow);

      return { highlighted: true };
    } catch (error) {
      // The highlight is decorative and must never break an operation.
      return { highlighted: false };
    }
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

  function isContentEditable(element) {
    return element.getAttribute("contenteditable") === "true" ||
      element.isContentEditable === true;
  }

  function fillContentEditable(element, value) {
    const text = String(value);

    element.focus?.();
    element.dispatchEvent(
      new window.Event("beforeinput", { bubbles: true })
    );
    element.textContent = text;
    element.dispatchEvent(
      new window.Event("input", { bubbles: true })
    );
  }

  function fillElement(element, value) {
    if (isContentEditable(element)) {
      fillContentEditable(element, value);
      return;
    }

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

  function appendToElement(element, value) {
    if (isContentEditable(element)) {
      fillContentEditable(
        element,
        `${element.textContent ?? ""}${value}`
      );
      return;
    }

    fillElement(element, `${element.value ?? ""}${value}`);
  }

  function decodeBase64(base64) {
    const decode = window.atob || (typeof atob === "function" ? atob : null);

    if (!decode) {
      throw new Error("base64_decode_unavailable");
    }

    const binary = decode(String(base64));
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  }

  function buildFileTransfer(files) {
    if (!Array.isArray(files) || files.length === 0) {
      throw new Error("no_files_provided");
    }

    const dataTransfer = new window.DataTransfer();
    const meta = [];

    for (const spec of files) {
      if (
        !spec ||
        typeof spec.name !== "string" ||
        typeof spec.base64 !== "string"
      ) {
        throw new Error("invalid_file_spec");
      }

      const file = new window.File(
        [decodeBase64(spec.base64)],
        spec.name,
        { type: spec.mimeType || "application/octet-stream" }
      );
      dataTransfer.items.add(file);
      meta.push({ name: file.name, size: file.size, type: file.type });
    }

    return { dataTransfer, meta };
  }

  function canvasSnapshot(element, options) {
    if (!element || element.tagName.toLowerCase() !== "canvas") {
      throw new Error("not_a_canvas");
    }

    const sourceWidth = Number(element.width) || 0;
    const sourceHeight = Number(element.height) || 0;
    const maxSize = Number(options.maxSize) > 0
      ? Number(options.maxSize)
      : 1280;
    const longestEdge = Math.max(sourceWidth, sourceHeight) || 1;

    let outputWidth = sourceWidth;
    let outputHeight = sourceHeight;
    let exportCanvas = element;

    if (longestEdge > maxSize) {
      const scale = maxSize / longestEdge;
      outputWidth = Math.max(1, Math.round(sourceWidth * scale));
      outputHeight = Math.max(1, Math.round(sourceHeight * scale));

      const scaled = document.createElement("canvas");
      scaled.width = outputWidth;
      scaled.height = outputHeight;

      const scaledContext = scaled.getContext("2d");

      if (scaledContext) {
        scaledContext.drawImage(element, 0, 0, outputWidth, outputHeight);
      }

      exportCanvas = scaled;
    }

    let dataUrl;

    try {
      dataUrl = exportCanvas.toDataURL("image/png");
    } catch (error) {
      throw new Error("canvas_tainted_cross_origin");
    }

    const separator = dataUrl.indexOf(",");
    const base64 = separator === -1 ? "" : dataUrl.slice(separator + 1);

    let blank = false;

    try {
      const sampleMax = 96;
      const sampleLongest = Math.max(outputWidth, outputHeight) || 1;
      const sampleScale = sampleLongest > sampleMax
        ? sampleMax / sampleLongest
        : 1;
      const sampleWidth = Math.max(1, Math.round(outputWidth * sampleScale));
      const sampleHeight = Math.max(1, Math.round(outputHeight * sampleScale));

      const sampler = document.createElement("canvas");
      sampler.width = sampleWidth;
      sampler.height = sampleHeight;

      const context = sampler.getContext("2d");

      if (!context) {
        throw new Error("no_2d_context");
      }

      context.drawImage(exportCanvas, 0, 0, sampleWidth, sampleHeight);

      const pixels = context.getImageData(
        0,
        0,
        sampleWidth,
        sampleHeight
      ).data;

      blank = true;

      for (let index = 3; index < pixels.length; index += 4) {
        if (pixels[index] !== 0) {
          blank = false;
          break;
        }
      }
    } catch (error) {
      blank = false;
    }

    const rect = element.getBoundingClientRect
      ? element.getBoundingClientRect()
      : { left: 0, top: 0, width: sourceWidth, height: sourceHeight };

    return {
      __sbuImage: {
        mimeType: "image/png",
        base64,
        width: outputWidth,
        height: outputHeight
      },
      source: {
        width: sourceWidth,
        height: sourceHeight,
        viewport: {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height
        }
      },
      blank
    };
  }

  function dispatchMouseEvent(params) {
    const x = Number(params.x);
    const y = Number(params.y);

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error("invalid_coordinates");
    }

    const type = String(params.type);
    const button = Number(params.button ?? 0);
    const buttons = Number(params.buttons ?? 0);
    const pointerId = Number(params.pointerId ?? 1);
    const target =
      (document.elementFromPoint && document.elementFromPoint(x, y)) ||
      document.documentElement ||
      document.body;

    // Glide the fake cursor along the coordinate path so a person
    // watching sees the pointer travel to where the AI is acting.
    try {
      moveControlCursorTo({ x, y }, { glideMs: 90 });
    } catch (error) {
      // never let the illusion break a real gesture
    }

    const base = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: x,
      clientY: y,
      button,
      buttons
    };

    if (type.indexOf("pointer") === 0 && window.PointerEvent) {
      target.dispatchEvent(
        new window.PointerEvent(
          type,
          Object.assign({}, base, {
            pointerId,
            pointerType: "mouse",
            isPrimary: true,
            pressure: buttons ? 0.5 : 0
          })
        )
      );
    }

    const mouseType = {
      pointerdown: "mousedown",
      pointermove: "mousemove",
      pointerup: "mouseup",
      click: "click"
    }[type];

    if (mouseType && window.MouseEvent) {
      target.dispatchEvent(new window.MouseEvent(mouseType, base));
    }

    return {
      type,
      target: target && target.tagName
        ? target.tagName.toLowerCase()
        : null,
      x,
      y
    };
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

  if (method === "playwright.readyState") {
    return document.readyState;
  }

  if (method === "playwright.pageState") {
    return {
      readyState: document.readyState,
      url: window.location.href
    };
  }

  if (method === "playwright.scrollBy") {
    const deltaX = Number(params.deltaX ?? 0);
    const deltaY = Number(params.deltaY ?? 0);

    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) {
      throw new Error("invalid_scroll_offset");
    }

    window.scrollBy(deltaX, deltaY);
    return { deltaX, deltaY };
  }

  if (method === "playwright.mouseEvent") {
    return dispatchMouseEvent(params);
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

  if (operation === "allAttributes") {
    if (typeof params.name !== "string" || !params.name) {
      throw new Error("attribute_name_required");
    }

    return matches.map(element =>
      element.getAttribute(params.name)
    );
  }

  if (operation === "allRecords") {
    const fields = params.fields || {};

    return matches.map(element => ({
      textContent: element.textContent ?? "",
      fields: Object.fromEntries(
        Object.entries(fields).map(([name, field]) => {
          if (
            !field ||
            typeof field.selector !== "string" ||
            typeof field.attribute !== "string"
          ) {
            throw new Error("invalid_record_field: " + name);
          }

          return [
            name,
            [...element.querySelectorAll(field.selector)].map(
              child => child.getAttribute(field.attribute)
            )
          ];
        })
      )
    }));
  }

  const element = oneLocatorElement(params.locator);

  const pointerOperations = new Set([
    "click",
    "fill",
    "type",
    "press",
    "check",
    "uncheck",
    "setChecked",
    "selectOption",
    "setInputFiles",
    "dropFiles"
  ]);

  if (pointerOperations.has(operation)) {
    moveControlCursorToElement(element, params);
    if (operation !== "click") {
      highlightElement(element);
    }
  }

  switch (operation) {
    case "click":
      element.scrollIntoView?.({
        block: "center",
        inline: "center"
      });
      moveControlCursorToElement(element, params);
      highlightElement(element);
      element.click();
      return { clicked: true };
    case "canvasSnapshot":
      return canvasSnapshot(element, params);
    case "setInputFiles": {
      if (
        element.tagName.toLowerCase() !== "input" ||
        (element.getAttribute("type") ?? "").toLowerCase() !== "file"
      ) {
        throw new Error("element_not_file_input");
      }

      const { dataTransfer, meta } = buildFileTransfer(params.files);
      element.files = dataTransfer.files;
      element.dispatchEvent(
        new window.Event("input", { bubbles: true })
      );
      element.dispatchEvent(
        new window.Event("change", { bubbles: true })
      );
      return { files: meta, via: "input" };
    }
    case "dropFiles": {
      const { dataTransfer, meta } = buildFileTransfer(params.files);
      const options = { bubbles: true, cancelable: true };

      for (const eventType of ["dragenter", "dragover", "drop"]) {
        let event;

        try {
          event = new window.DragEvent(
            eventType,
            Object.assign({}, options, { dataTransfer })
          );
        } catch (error) {
          event = new window.Event(eventType, options);
        }

        if (event.dataTransfer !== dataTransfer) {
          try {
            Object.defineProperty(event, "dataTransfer", {
              configurable: true,
              value: dataTransfer
            });
          } catch (defineError) {
            try {
              event.dataTransfer = dataTransfer;
            } catch (assignError) {
              // Some engines expose dataTransfer as read-only; the
              // constructor init above already carries it in Safari.
            }
          }
        }

        element.dispatchEvent(event);
      }

      return { files: meta, via: "drop" };
    }
    case "fill":
      fillElement(element, params.value);
      return { filled: true };
    case "type":
      appendToElement(element, params.value);
      return { typed: true };
    case "press": {
      const key = String(params.value);
      const unsupportedDefaultActionKeys = [
        "Tab",
        "PageDown",
        "PageUp",
        "Home",
        "End",
        "Space",
        " "
      ];

      if (unsupportedDefaultActionKeys.includes(key)) {
        throw new Error(
          "unsupported_press_default_action: " +
          `"${key}" cannot be synthesized; use ` +
          "tab.playwright.scrollBy() or locator.scrollIntoView()"
        );
      }

      element.focus?.();
      element.dispatchEvent(new window.KeyboardEvent("keydown", {
        key,
        bubbles: true
      }));
      element.dispatchEvent(new window.KeyboardEvent("keyup", {
        key,
        bubbles: true
      }));
      return { pressed: true, trusted: false };
    }
    case "scrollIntoView": {
      const options = params.options || {};
      element.scrollIntoView?.({
        block: options.block || "center",
        inline: options.inline || "nearest"
      });
      return { scrolled: true };
    }
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


const MAX_SUPPORTED_SAFARI_MAJOR = 26;

function parseSafariMajor(version) {
  const match = /^(\d+)(?:\.|$)/.exec(version);

  if (!match) {
    throw new Error(`Invalid Safari version: ${version}`);
  }

  return Number(match[1]);
}

function evaluateSafariVersion(version) {
  const major = parseSafariMajor(version);

  if (major <= MAX_SUPPORTED_SAFARI_MAJOR) {
    return { supported: true, major, reason: null };
  }

  return {
    supported: false,
    major,
    reason: `Safari ${major} includes a native MCP server; use /usr/bin/safaridriver --mcp.`
  };
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


function createControlLifecycle({ show, refresh, hide }) {
  let activeTabId = null;

  return {
    activate(tabId) {
      const nextTabId = String(tabId);

      if (activeTabId === nextTabId) {
        refresh(nextTabId);
        return;
      }

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


function tabWindowId(tabId) {
  const match = /^(\d+):\d+$/.exec(String(tabId));

  return match ? match[1] : "";
}

function createTabIdentity(metadata) {
  return {
    id: String(metadata.id),
    windowId: tabWindowId(metadata.id),
    title: String(metadata.title || ""),
    url: String(metadata.url || "")
  };
}

function retargetTabIdentity(identity, url) {
  identity.url = String(url);
}

function updateTabIdentity(identity, metadata) {
  identity.id = String(metadata.id);
  identity.windowId = tabWindowId(metadata.id);
  identity.title = String(metadata.title || "");
  identity.url = String(metadata.url || "");

  return metadata;
}

function resolveTabIdentity(identity, tabs) {
  const candidates = tabs.filter(tab =>
    tabWindowId(tab.id) === identity.windowId
  );
  const current = candidates.find(tab => tab.id === identity.id);

  if (current && String(current.url || "") === identity.url) {
    return updateTabIdentity(identity, current);
  }

  const exact = candidates.filter(tab =>
    String(tab.url || "") === identity.url
  );

  if (exact.length === 1) {
    return updateTabIdentity(identity, exact[0]);
  }

  if (exact.length > 1) {
    throw new Error(
      "stale_tab_handle: ambiguous candidates for " + identity.id
    );
  }

  throw new Error("stale_tab_handle: tab not found " + identity.id);
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
