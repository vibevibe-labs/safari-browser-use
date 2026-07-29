const googleAccountsUrl =
  "https://accounts.google.com/SignOutOptions?hl=en";

export function loadTemporaryPageSource(url, options) {
  const tab = options.open(url);
  const now = options.now ?? Date.now;
  const deadline = now() + (options.timeoutMs ?? 15000);

  try {
    while (now() <= deadline) {
      try {
        const state = options.inspect(tab);
        const loaded =
          /^https?:\/\//i.test(String(state.url)) &&
          (
            state.readyState === "interactive" ||
            state.readyState === "complete"
          );

        if (loaded && state.source) {
          return state.source;
        }
      } catch (error) {
        // The temporary page may still be replacing about:blank.
      }

      options.sleep(100);
    }

    throw new Error("Google account discovery timed out.");
  } finally {
    options.close(tab);
  }
}

export function parseGoogleAccounts(html) {
  const accountPattern =
    /id="choose-account-(\d+)"[\s\S]*?<img[^>]+src="([^"]*)"[\s\S]*?class="account-name"[^>]*>([\s\S]*?)<\/span>[\s\S]*?class="account-email"[^>]*>([\s\S]*?)<\/span>/g;
  const accounts = [];
  let match;

  while ((match = accountPattern.exec(String(html)))) {
    accounts.push({
      accountId: Number(match[1]),
      name: match[3].trim(),
      email: match[4].trim(),
      profileImageUrl: match[2]
    });
  }

  return accounts;
}

export function createGoogleAccounts({ loadHtml, write }) {
  return Object.freeze({
    list() {
      return parseGoogleAccounts(loadHtml(googleAccountsUrl));
    },
    print() {
      write(
        this.list()
          .map(account =>
            `[${account.accountId}] ${account.name} (${account.email})`
          )
          .join("\n")
      );
    }
  });
}
