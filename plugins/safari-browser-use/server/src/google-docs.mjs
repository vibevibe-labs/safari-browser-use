function googleDocsTarget(value) {
  if (typeof value === "string") {
    return parseGoogleDocsUrl(value);
  }

  if (
    !value ||
    typeof value !== "object" ||
    !/^[A-Za-z0-9_-]+$/.test(String(value.docId || ""))
  ) {
    throw new Error("invalid_google_docs_target");
  }

  const target = { docId: String(value.docId) };

  if (value.uid !== undefined) {
    const uid = Number(value.uid);

    if (!Number.isInteger(uid) || uid < 0) {
      throw new Error("invalid_google_account_uid");
    }

    target.uid = uid;
  }

  return target;
}

function googleDocsUrl(target, suffix) {
  const account = target.uid === undefined
    ? ""
    : `/u/${target.uid}`;

  return (
    `https://docs.google.com/document${account}/d/` +
    `${target.docId}/${suffix}`
  );
}

function decodeHtmlText(value) {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: "\""
  };

  return String(value).replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (match, entity) => {
      const lower = entity.toLowerCase();

      if (lower[0] === "#") {
        const hexadecimal = lower[1] === "x";
        const code = Number.parseInt(
          lower.slice(hexadecimal ? 2 : 1),
          hexadecimal ? 16 : 10
        );
        return Number.isFinite(code)
          ? String.fromCodePoint(code)
          : match;
      }

      return Object.prototype.hasOwnProperty.call(named, lower)
        ? named[lower]
        : match;
    }
  );
}

export function googleDocsHtmlToText(html) {
  const source = String(html);
  const contents =
    /<[^>]+class=["'][^"']*\bdoc-content\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|main)>/i
      .exec(source) ||
    /<[^>]+id=["']contents["'][^>]*>([\s\S]*?)<\/(?:div|main)>/i
      .exec(source);
  const body = contents ? contents[1] : source;

  return decodeHtmlText(
    body
      .replace(/<(?:br)\b[^>]*>/gi, "\n")
      .replace(/<\/(?:p|div|li|h[1-6])>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "- ")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseGoogleDocsUrl(url) {
  const match =
    /^https:\/\/docs\.google\.com\/document(?:\/u\/(\d+))?\/d\/([A-Za-z0-9_-]+)(?:[/?#]|$)/i
      .exec(String(url));

  if (!match) {
    throw new Error("invalid_google_docs_url");
  }

  const result = { docId: match[2] };

  if (match[1] !== undefined) {
    result.uid = Number(match[1]);
  }

  return result;
}

export function createGoogleDocs({ loadHtml, openEditor }) {
  let session = null;

  function connected() {
    if (!session) {
      throw new Error("google_docs_not_connected");
    }

    return session;
  }

  function connect(url) {
    if (session) {
      throw new Error("google_docs_already_connected");
    }

    session = openEditor(String(url));
  }

  function create(uid) {
    const target = googleDocsTarget({ docId: "create", uid });
    const url =
      `https://docs.google.com/document/u/${target.uid}/create`;

    connect(url);

    const finalUrl = connected().url();
    const created = parseGoogleDocsUrl(finalUrl);

    return {
      docId: created.docId,
      uid: created.uid === undefined ? target.uid : created.uid,
      url: finalUrl
    };
  }

  return Object.freeze({
    parseUrl: parseGoogleDocsUrl,
    getDocumentHTML(target) {
      const parsed = googleDocsTarget(target);
      return loadHtml(googleDocsUrl(parsed, "mobilebasic"));
    },
    getDocumentText(target) {
      const parsed = googleDocsTarget(target);
      return googleDocsHtmlToText(
        loadHtml(googleDocsUrl(parsed, "mobilebasic"))
      );
    },
    connect,
    create,
    dispose() {
      if (!session) {
        return;
      }

      const active = session;
      session = null;
      active.close();
    },
    getTitle() {
      return connected().getTitle();
    },
    getLiveText() {
      return connected().getLiveText();
    },
    getSelectedContent() {
      return connected().getSelectedContent();
    },
    insertText(text) {
      return connected().insertText(String(text));
    },
    selectAll() {
      return connected().selectAll();
    },
    insertHtmlContent(html) {
      return connected().insertHtmlContent(String(html));
    },
    deleteSelection() {
      return connected().deleteSelection();
    }
  });
}
