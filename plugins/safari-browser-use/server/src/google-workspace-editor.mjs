export function waitForGoogleEditorReady(kind, tab, options) {
  const method = kind === "docs"
    ? "googleDocs.editorState"
    : "googleSheets.editorState";
  const finalUrlPattern = kind === "docs"
    ? /^https:\/\/docs\.google\.com\/document(?:\/u\/\d+)?\/d\/[A-Za-z0-9_-]+/i
    : /^https:\/\/docs\.google\.com\/spreadsheets(?:\/u\/\d+)?\/d\/[A-Za-z0-9_-]+/i;
  const now = options.now ?? Date.now;
  const deadline = now() + (options.timeoutMs ?? 30000);
  let lastError = null;

  while (now() <= deadline) {
    try {
      const inspected = options.inspect(tab, method);

      if (
        finalUrlPattern.test(String(inspected.url)) &&
        inspected.editorState &&
        inspected.editorState.editorPoint
      ) {
        return inspected.editorState;
      }
    } catch (error) {
      lastError = error;
    }

    options.sleep(100);
  }

  throw new Error(
    `google_${kind}_editor_timeout` +
    (lastError ? `: ${lastError.message}` : "")
  );
}

export function googleSheetsRangeUrl(url, range) {
  const source = String(url);
  const base = source.replace(/#.*$/, "");
  const hash = source.includes("#")
    ? source.slice(source.indexOf("#") + 1)
    : "";
  const gid =
    /(?:^|&)gid=([^&]+)/i.exec(hash) ||
    /[?&]gid=([^&#]+)/i.exec(base);
  const value = gid ? decodeURIComponent(gid[1]) : "0";

  return (
    `${base}#gid=${encodeURIComponent(value)}` +
    `&range=${encodeURIComponent(String(range))}`
  );
}
